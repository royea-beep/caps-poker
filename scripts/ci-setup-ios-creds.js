#!/usr/bin/env node
/**
 * CI pre-build: Create fresh iOS provisioning profile + build credentials in EAS for CAPS.
 *
 * UPDATED 2026-05-22 — replaces the prior hardcoded-cert version. The prior
 * script referenced cert J4YQW7L9V2 / 8bf63564 by name; both EAS-managed
 * (40BAE4...) and CI-manual (45EBC138...) certs have since been rejected by
 * xcodebuild as "may have been revoked or expired". This version:
 *   - Auto-discovers EAS_IOS_CREDS_ID + EAS_APP_IDENTIFIER_ID via GraphQL
 *   - Maintains a KNOWN_REVOKED_SERIALS deny-list of dead certs
 *   - Verifies ASC key has Admin scope before touching certs
 *   - Asserts the cert finally wired into EAS is not deny-listed
 *
 * Mirrors Wingman's ci-setup-ios-creds.js (which itself was originally adapted
 * FROM an earlier CAPS version) with additional hardening.
 *
 * Required env vars:
 *   EXPO_TOKEN          — EAS Bearer token (or local Expo session for dev runs)
 *   APPLE_API_KEY_ID    — ASC API key ID (e.g. HH732W7XQJ)
 *   APPLE_API_ISSUER_ID — 686f97b8-3f8a-40b7-a6cd-5293a3168439
 * Required file (in CWD):
 *   AuthKey_${APPLE_API_KEY_ID}.p8
 */

'use strict';
const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');

// ─── Constants (CAPS-specific) ────────────────────────────────────────────────
const APPLE_KEY_ID    = process.env.APPLE_API_KEY_ID;
const APPLE_ISSUER_ID = process.env.APPLE_API_ISSUER_ID;
const EXPO_TOKEN      = process.env.EXPO_TOKEN;

const EAS_API        = 'api.expo.dev';
const EAS_ACCOUNT_ID = '1c06cc8a-50cd-4eee-b8d1-2fdbd3683eef'; // @royea
const EAS_APP_ID     = '114b97d5-5cb3-4798-9a97-8233a6a37c07'; // @royea/caps-poker
const BUNDLE_ID      = 'com.capspoker.app';
const TEAM_ID        = '3K9KJNGL9U';
// EAS_IOS_CREDS_ID + EAS_APP_IDENTIFIER_ID are auto-discovered via GraphQL (per
// user request — prior version had them hardcoded as 039c8567... / bb6b0809...,
// which is brittle if EAS objects are recreated).

function normSerial(s) {
  return String(s || '').toUpperCase().replace(/^0+/, '');
}

// ─── HARDENING — known-revoked cert serial deny-list ──────────────────────────
// Any Apple-returned cert matching one of these is treated as unsafe regardless
// of `expirationDate` or `status`. Add to this list if the cycle repeats.
//
// Evidence:
//   45EBC138... — CI manual cert. xcodebuild ARCHIVE FAILED 2026-05-19:
//                 "Signing certificate ... serial 45EBC138... is not valid for code signing."
//   40BAE4...   — EAS-managed cert. xcodebuild ARCHIVE FAILED 2026-04-21 (build 449):
//                 "Signing certificate ... serial 40BAE4... is not valid for code signing."
const KNOWN_REVOKED_SERIALS = new Set([
  '45EBC138DF94E77658BA9558EAAE19FC',
  '40BAE4E40658CE4EE6C1A72122FB552B',
].map(normSerial));

// Local Expo session fallback (for local runs without EXPO_TOKEN)
function getLocalExpoSession() {
  try {
    const stateFile = path.join(os.homedir(), '.expo', 'state.json');
    const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    return state.auth && state.auth.sessionSecret;
  } catch { return null; }
}

// ─── CSR generation ───────────────────────────────────────────────────────────
function generateCSR() {
  const { execSync } = require('child_process');
  const tmpDir = os.tmpdir();
  const keyFile = path.join(tmpDir, 'caps-dist-key.pem');
  const csrFile = path.join(tmpDir, 'caps-dist-csr.pem');
  const subject = `/C=US/O=${TEAM_ID}/CN=Apple Distribution: Roye Arguan`;
  execSync(`openssl genrsa -out "${keyFile}" 2048`, { stdio: 'pipe' });
  execSync(`openssl req -new -key "${keyFile}" -out "${csrFile}" -subj "${subject}"`, { stdio: 'pipe' });
  const privateKeyPem = fs.readFileSync(keyFile, 'utf8');
  const csrPem = fs.readFileSync(csrFile, 'utf8');
  try { fs.unlinkSync(keyFile); fs.unlinkSync(csrFile); } catch {}
  return { privateKeyPem, csrPem };
}

// ─── Apple server time (compensates for local clock skew) ─────────────────────
function getAppleServerTime() {
  return new Promise((resolve) => {
    const req = https.request({ hostname: 'api.appstoreconnect.apple.com', path: '/', method: 'HEAD', headers: { Accept: '*/*' } }, res => {
      const d = res.headers['date'];
      res.resume();
      resolve(d ? Math.floor(new Date(d).getTime() / 1000) : Math.floor(Date.now() / 1000));
    });
    req.on('error', () => resolve(Math.floor(Date.now() / 1000)));
    req.setTimeout(5000, () => { req.destroy(); resolve(Math.floor(Date.now() / 1000)); });
    req.end();
  });
}

// ─── Apple JWT ────────────────────────────────────────────────────────────────
async function generateAppleJWT() {
  const keyFile = `AuthKey_${APPLE_KEY_ID}.p8`;
  const p8 = fs.readFileSync(keyFile, 'utf8').trim();
  const now = await getAppleServerTime();
  const header  = Buffer.from(JSON.stringify({ alg: 'ES256', kid: APPLE_KEY_ID, typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss: APPLE_ISSUER_ID, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' })).toString('base64url');
  const sigInput = `${header}.${payload}`;
  const sign = crypto.createSign('SHA256');
  sign.update(sigInput);
  const sig = sign.sign({ key: p8, dsaEncoding: 'ieee-p1363' });
  return `${sigInput}.${sig.toString('base64url')}`;
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
function appleRequest(method, reqPath, body, jwt) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.appstoreconnect.apple.com',
      path: reqPath, method,
      headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Apple API timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function easGraphQL(query, variables) {
  const localSession = !EXPO_TOKEN ? getLocalExpoSession() : null;
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query, variables });
    const authHeader = EXPO_TOKEN
      ? { Authorization: `Bearer ${EXPO_TOKEN}` }
      : { 'expo-session': localSession };
    const options = {
      hostname: EAS_API, path: '/graphql', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.errors) reject(new Error(`EAS GraphQL error: ${parsed.errors[0].message}`));
          else resolve(parsed.data);
        } catch (e) {
          reject(new Error(`EAS parse error: ${data.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('EAS API timeout')); });
    req.write(body);
    req.end();
  });
}

// ─── HARDENED cert-validity check ─────────────────────────────────────────────
function isAppleCertSafe(cert) {
  const attrs = cert.attributes || {};
  const expiry = attrs.expirationDate ? new Date(attrs.expirationDate) : null;
  if (!expiry || expiry <= new Date()) return { ok: false, reason: 'expired or no expiry' };
  // HARDENING 1: explicit Apple-side status check (when available — Apple may or may not expose this)
  if (attrs.status && attrs.status !== 'ISSUED') return { ok: false, reason: `status=${attrs.status}` };
  // HARDENING 2: known-revoked deny-list (xcodebuild has told us these are dead even if Apple says otherwise)
  const serial = normSerial(attrs.serialNumber);
  if (KNOWN_REVOKED_SERIALS.has(serial)) return { ok: false, reason: `serial ${serial} on KNOWN_REVOKED_SERIALS deny-list` };
  return { ok: true };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (!APPLE_KEY_ID || !APPLE_ISSUER_ID) {
    console.error('❌ APPLE_API_KEY_ID and APPLE_API_ISSUER_ID must be set');
    process.exit(1);
  }
  if (!EXPO_TOKEN && !getLocalExpoSession()) {
    console.error('❌ EXPO_TOKEN must be set (or run `expo login` for local session)');
    process.exit(1);
  }
  if (!EXPO_TOKEN) console.log('ℹ️  Using local Expo session (no EXPO_TOKEN set)');
  const keyFile = `AuthKey_${APPLE_KEY_ID}.p8`;
  if (!fs.existsSync(keyFile)) {
    console.error(`❌ ${keyFile} not found in CWD (${process.cwd()})`);
    process.exit(1);
  }

  console.log(`🔑 Generating Apple ASC JWT (key: ${APPLE_KEY_ID})...`);
  const jwt = await generateAppleJWT();

  // ── Step 0: ASC key permission verify ─────────────────────────────────────
  // GET /v1/users requires Admin role on the ASC API key. If we can read users,
  // we have full cert-management access. 403 = Developer-only role → cert ops
  // may still work but we surface it loudly.
  console.log('🔐 Verifying ASC key capability (GET /v1/users)...');
  const usersResp = await appleRequest('GET', '/v1/users?limit=1', null, jwt);
  if (usersResp.status === 401) {
    console.error(`❌ ASC key ${APPLE_KEY_ID} returned 401 Unauthorized.`);
    console.error('   → Key may be revoked at appstoreconnect.apple.com → Users and Access → Integrations.');
    process.exit(1);
  } else if (usersResp.status === 403) {
    console.error(`⚠️  ASC key ${APPLE_KEY_ID} can't read /v1/users (403) — likely Developer role, not Admin.`);
    console.error('   This script needs to CREATE certificates. If cert creation also fails, upgrade the key role at');
    console.error('   appstoreconnect.apple.com → Users and Access → Integrations → App Store Connect API.');
    // Don't exit — cert creation may still work; let the next step decide.
  } else if (usersResp.status !== 200) {
    console.error(`❌ ASC key check failed (${usersResp.status}): ${usersResp.body.slice(0, 200)}`);
    process.exit(1);
  } else {
    console.log('✅ ASC key is valid AND has Admin scope (can read /v1/users)');
  }

  // ── Step 1: List Apple's IOS_DISTRIBUTION certs ───────────────────────────
  console.log('🍎 Fetching Apple IOS_DISTRIBUTION certs (source of truth)...');
  const distCertsResp = await appleRequest('GET', '/v1/certificates?filter[certificateType]=IOS_DISTRIBUTION&limit=10', null, jwt);
  if (distCertsResp.status !== 200) {
    console.error(`❌ Apple /v1/certificates returned ${distCertsResp.status}: ${distCertsResp.body.slice(0, 200)}`);
    process.exit(1);
  }
  const appleDistCerts = JSON.parse(distCertsResp.body).data || [];
  const safeAppleCerts = new Map(); // portalId → cert
  for (const c of appleDistCerts) {
    const attrs = c.attributes || {};
    const check = isAppleCertSafe(c);
    console.log(`  cert ${c.id}: serial=${attrs.serialNumber} expires=${attrs.expirationDate} status=${attrs.status || 'n/a'} → ${check.ok ? '✅ SAFE' : '❌ UNSAFE (' + check.reason + ')'}`);
    if (check.ok) safeAppleCerts.set(c.id, c);
  }
  console.log(`  → ${safeAppleCerts.size} Apple cert(s) pass hardened check`);

  // ── Step 2: Auto-discover EAS IDs + find a reusable safe cert ─────────────
  console.log('🔍 Querying EAS for Caps iosAppCredentials...');
  const easData = await easGraphQL(`
    { app { byId(appId: "${EAS_APP_ID}") {
      iosAppCredentials {
        id
        appleAppIdentifier { id bundleIdentifier }
        iosAppBuildCredentialsList {
          id iosDistributionType
          distributionCertificate { id developerPortalIdentifier serialNumber validityNotAfter }
          provisioningProfile { id }
        }
      }
    }}}
  `, {});
  const iosCred = (easData?.app?.byId?.iosAppCredentials || [])[0];
  if (!iosCred) {
    console.error(`❌ EAS app ${EAS_APP_ID} has no iosAppCredentials yet — initial setup may be needed (run \`eas credentials\` interactively once).`);
    process.exit(1);
  }
  const EAS_IOS_CREDS_ID      = iosCred.id;
  const EAS_APP_IDENTIFIER_ID = iosCred.appleAppIdentifier?.id;
  console.log(`  Auto-discovered EAS_IOS_CREDS_ID      = ${EAS_IOS_CREDS_ID}`);
  console.log(`  Auto-discovered EAS_APP_IDENTIFIER_ID = ${EAS_APP_IDENTIFIER_ID}`);
  if (!EAS_APP_IDENTIFIER_ID) {
    console.error('❌ Could not auto-discover EAS_APP_IDENTIFIER_ID. EAS GraphQL schema may have changed.');
    process.exit(1);
  }

  let easCertId = null;
  let appleCertId = null;
  let appleCertContent = null;
  let appleCertSerial = null;
  let newCertPrivateKey = null;

  for (const cred of (iosCred.iosAppBuildCredentialsList || [])) {
    const dc = cred.distributionCertificate;
    if (!dc) continue;
    const matched = safeAppleCerts.has(dc.developerPortalIdentifier);
    const denyHit = KNOWN_REVOKED_SERIALS.has(normSerial(dc.serialNumber));
    console.log(`  EAS cert ${dc.id}: portal=${dc.developerPortalIdentifier} serial=${dc.serialNumber} appleSafe=${matched} denyListed=${denyHit}`);
    if (matched && !denyHit && !easCertId) {
      easCertId = dc.id;
      appleCertId = dc.developerPortalIdentifier;
      console.log(`✅ Reusing EAS cert ${easCertId} (Apple-safe + not deny-listed)`);
    }
  }

  // ── Step 3: If no safe match, DELETE unsafe Apple certs + create fresh ────
  if (!easCertId) {
    console.log('⚠️  No safe cert reusable — clearing unsafe Apple certs and creating fresh');
    for (const c of appleDistCerts) {
      const attrs = c.attributes || {};
      const check = isAppleCertSafe(c);
      const onDeny = KNOWN_REVOKED_SERIALS.has(normSerial(attrs.serialNumber));
      if (!check.ok || onDeny) {
        console.log(`  🗑  Deleting Apple cert ${c.id} (serial=${attrs.serialNumber}, reason: ${onDeny ? 'deny-listed' : check.reason})`);
        const delResp = await appleRequest('DELETE', `/v1/certificates/${c.id}`, null, jwt);
        if (delResp.status !== 204 && delResp.status !== 200) {
          console.error(`  ⚠️  Delete returned ${delResp.status}: ${delResp.body.slice(0, 200)} — continuing`);
        }
      }
    }

    console.log('🔨 Creating fresh IOS_DISTRIBUTION cert...');
    const { privateKeyPem, csrPem } = generateCSR();
    newCertPrivateKey = privateKeyPem;
    const csrContent = csrPem.split('\n').filter(l => l.trim() && !l.includes('-----')).join('');
    const createResp = await appleRequest('POST', '/v1/certificates', {
      data: { type: 'certificates', attributes: { certificateType: 'IOS_DISTRIBUTION', csrContent } }
    }, jwt);
    if (createResp.status !== 201 && createResp.status !== 200) {
      console.error(`❌ Cert creation failed ${createResp.status}: ${createResp.body.slice(0, 500)}`);
      if (createResp.body.includes('maximum') || createResp.body.includes('limit')) {
        console.error('🚨 Apple cert limit reached. Revoke certs at developer.apple.com → Certificates.');
      } else if (createResp.status === 403) {
        console.error('🚨 403 on POST /v1/certificates — ASC key likely lacks Admin/App Manager role (see step 0 warning).');
      }
      process.exit(1);
    }
    const created = JSON.parse(createResp.body);
    appleCertId      = created.data?.id;
    appleCertContent = created.data?.attributes?.certificateContent;
    appleCertSerial  = created.data?.attributes?.serialNumber;
    console.log(`✅ Created IOS_DISTRIBUTION cert: portal=${appleCertId} serial=${appleCertSerial}`);

    if (KNOWN_REVOKED_SERIALS.has(normSerial(appleCertSerial))) {
      console.error(`❌ Newly-created cert serial ${appleCertSerial} is on the deny-list. This should never happen. Aborting.`);
      process.exit(1);
    }
  }

  // ── Step 4: Upload new cert to EAS (if we created one) ────────────────────
  if (appleCertContent && !easCertId) {
    console.log('⬆️  Uploading new cert to EAS...');
    const { execSync } = require('child_process');
    const p12Pass = 'caps2026';
    fs.writeFileSync('/tmp/caps_cert.pem',
      `-----BEGIN CERTIFICATE-----\n${appleCertContent.match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----\n`);
    fs.writeFileSync('/tmp/caps_key.pem', newCertPrivateKey);
    execSync(`openssl pkcs12 -export -out /tmp/caps.p12 -inkey /tmp/caps_key.pem -in /tmp/caps_cert.pem -passout pass:${p12Pass} -legacy`, { stdio: 'pipe' });
    const certP12Base64 = fs.readFileSync('/tmp/caps.p12').toString('base64');

    const tQ = await easGraphQL(`{ account { byId(accountId: "${EAS_ACCOUNT_ID}") { appleTeamsPaginated(first: 10) { edges { node { id appleTeamIdentifier } } } } } }`, {});
    let appleTeamId = (tQ?.account?.byId?.appleTeamsPaginated?.edges || []).find(t => t.node.appleTeamIdentifier === TEAM_ID)?.node?.id;
    if (!appleTeamId) {
      const atM = await easGraphQL(`mutation($a:ID!,$t:String!,$n:String!){appleTeam{createAppleTeam(accountId:$a,appleTeamInput:{appleTeamIdentifier:$t,appleTeamName:$n}){id}}}`,
        { a: EAS_ACCOUNT_ID, t: TEAM_ID, n: 'Roye Arguan' });
      appleTeamId = atM?.appleTeam?.createAppleTeam?.id;
    }

    const storeCertData = await easGraphQL(`
      mutation CreateAppleDistributionCertificate($accountId: ID!, $certInput: AppleDistributionCertificateInput!) {
        appleDistributionCertificate {
          createAppleDistributionCertificate(accountId: $accountId, appleDistributionCertificateInput: $certInput) {
            id serialNumber validityNotAfter
          }
        }
      }
    `, {
      accountId: EAS_ACCOUNT_ID,
      certInput: {
        certP12: certP12Base64,
        certPassword: p12Pass,
        certPrivateSigningKey: newCertPrivateKey,
        developerPortalIdentifier: appleCertId,
        appleTeamId,
      },
    });
    easCertId = storeCertData?.appleDistributionCertificate?.createAppleDistributionCertificate?.id;
    if (!easCertId) {
      console.error('❌ Failed to store cert in EAS:', JSON.stringify(storeCertData)); process.exit(1);
    }
    console.log(`✅ Cert in EAS: ${easCertId}`);
  }

  if (!easCertId) { console.error('❌ Could not resolve EAS cert ID'); process.exit(1); }

  // ── Step 5: Lookup Apple bundle ID ────────────────────────────────────────
  console.log(`🔍 Looking up Apple bundle ID for ${BUNDLE_ID}...`);
  const bundleResp = await appleRequest('GET', `/v1/bundleIds?filter[identifier]=${BUNDLE_ID}&filter[platform]=IOS`, null, jwt);
  if (bundleResp.status !== 200) {
    console.error(`❌ Bundle ID lookup failed: ${bundleResp.status} ${bundleResp.body.slice(0, 200)}`); process.exit(1);
  }
  const bundleData = JSON.parse(bundleResp.body);
  if (!bundleData.data || bundleData.data.length === 0) {
    console.error(`❌ Bundle ID ${BUNDLE_ID} not found in Apple Developer Portal`); process.exit(1);
  }
  const appleBundleId = bundleData.data[0].id;
  console.log(`✅ Apple bundle ID: ${appleBundleId}`);

  // ── Step 6: Create provisioning profile ───────────────────────────────────
  console.log('📝 Creating new provisioning profile...');
  const createProfileResp = await appleRequest('POST', '/v1/profiles', {
    data: {
      type: 'profiles',
      attributes: { name: `CAPS Distribution ${Date.now()}`, profileType: 'IOS_APP_STORE' },
      relationships: {
        bundleId: { data: { type: 'bundleIds', id: appleBundleId } },
        certificates: { data: [{ type: 'certificates', id: appleCertId }] },
        devices: { data: [] },
      },
    },
  }, jwt);
  if (createProfileResp.status !== 201 && createProfileResp.status !== 200) {
    console.error(`❌ Profile creation failed: ${createProfileResp.status} ${createProfileResp.body.slice(0, 500)}`); process.exit(1);
  }
  const createdPP = JSON.parse(createProfileResp.body);
  const ppBase64 = createdPP.data?.attributes?.profileContent;
  const appleProfilePortalId = createdPP.data?.id;
  if (!ppBase64) { console.error('❌ Profile created but no profileContent'); process.exit(1); }
  console.log(`✅ Provisioning profile created: ${appleProfilePortalId}`);

  // ── Step 7: Upload PP to EAS ──────────────────────────────────────────────
  console.log('⬆️  Uploading provisioning profile to EAS...');
  const createPPData = await easGraphQL(`
    mutation CreateAppleProvisioningProfile($input: AppleProvisioningProfileInput!, $accountId: ID!, $appleAppIdentifierId: ID!) {
      appleProvisioningProfile {
        createAppleProvisioningProfile(
          appleProvisioningProfileInput: $input
          accountId: $accountId
          appleAppIdentifierId: $appleAppIdentifierId
        ) { id developerPortalIdentifier expiration status }
      }
    }
  `, {
    input: { appleProvisioningProfile: ppBase64, developerPortalIdentifier: appleProfilePortalId },
    accountId: EAS_ACCOUNT_ID,
    appleAppIdentifierId: EAS_APP_IDENTIFIER_ID,
  });
  const easPPId = createPPData?.appleProvisioningProfile?.createAppleProvisioningProfile?.id;
  if (!easPPId) { console.error('❌ Failed to create PP in EAS:', JSON.stringify(createPPData)); process.exit(1); }
  console.log(`✅ EAS provisioning profile: ${easPPId}`);

  // ── Step 8: Wire build credentials ────────────────────────────────────────
  console.log('🔗 Setting iOS app build credentials...');
  const existingAppStore = (iosCred.iosAppBuildCredentialsList || []).find(c => c.iosDistributionType === 'APP_STORE');
  if (existingAppStore) {
    console.log(`  Removing stale APP_STORE credentials ${existingAppStore.id}...`);
    await easGraphQL(`mutation($id: ID!) { iosAppBuildCredentials { deleteIosAppBuildCredentials(id: $id) { id } } }`, { id: existingAppStore.id });
  }
  const createCredsData = await easGraphQL(`
    mutation CreateIosAppBuildCredentials($input: IosAppBuildCredentialsInput!, $iosAppCredentialsId: ID!) {
      iosAppBuildCredentials {
        createIosAppBuildCredentials(
          iosAppBuildCredentialsInput: $input
          iosAppCredentialsId: $iosAppCredentialsId
        ) {
          id iosDistributionType
          distributionCertificate { id serialNumber validityNotAfter }
          provisioningProfile { id developerPortalIdentifier expiration status }
        }
      }
    }
  `, {
    input: {
      iosDistributionType: 'APP_STORE',
      distributionCertificateId: easCertId,
      provisioningProfileId: easPPId,
    },
    iosAppCredentialsId: EAS_IOS_CREDS_ID,
  });
  const buildCreds = createCredsData?.iosAppBuildCredentials?.createIosAppBuildCredentials;
  if (!buildCreds) { console.error('❌ Failed to create build credentials:', JSON.stringify(createCredsData)); process.exit(1); }

  // ── HARDENED final assertion: the cert we'll actually use is not deny-listed ──
  const finalSerial = buildCreds.distributionCertificate?.serialNumber;
  console.log('');
  console.log('✅ iOS build credentials ready:');
  console.log(`   ID:                ${buildCreds.id}`);
  console.log(`   Cert serial:       ${finalSerial}  ← THIS IS THE CERT WE WILL SIGN WITH`);
  console.log(`   Cert expires:      ${buildCreds.distributionCertificate?.validityNotAfter}`);
  console.log(`   Profile portal ID: ${buildCreds.provisioningProfile?.developerPortalIdentifier}`);
  console.log(`   Profile status:    ${buildCreds.provisioningProfile?.status}`);
  if (KNOWN_REVOKED_SERIALS.has(normSerial(finalSerial))) {
    console.error(`🚨 FINAL CHECK FAILED — selected cert serial ${finalSerial} is on the deny-list.`);
    console.error('   Either step 3 silently reused a bad cert OR Apple reused a serial.');
    console.error('   Manually revoke at developer.apple.com → Certificates, or extend KNOWN_REVOKED_SERIALS.');
    process.exit(1);
  }
  console.log('');
  console.log('🚀 Ready for eas build!');
}

main().catch(err => {
  console.error('❌ ci-setup-ios-creds failed:', err.message);
  process.exit(1);
});
