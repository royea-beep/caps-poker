#!/usr/bin/env node
/**
 * CI pre-build: Create fresh iOS provisioning profile + build credentials in EAS
 *
 * Uses Apple ASC API key (HH732W7XQJ) to:
 * 1. Verify the key is valid
 * 2. Get Apple bundle ID for com.capspoker.app
 * 3. Create a new provisioning profile using cert J4YQW7L9V2 (serial 78DD1F12, valid)
 * 4. Upload the PP to EAS via GraphQL
 * 5. Create iosAppBuildCredentials linking cert 8bf63564 + new PP
 *
 * Required env vars:
 *   EXPO_TOKEN          - EAS Bearer token
 *   APPLE_API_KEY_ID    - HH732W7XQJ
 *   APPLE_API_ISSUER_ID - 686f97b8-3f8a-40b7-a6cd-5293a3168439
 * Required file:
 *   AuthKey_HH732W7XQJ.p8 - in CWD
 */

'use strict';
const crypto = require('crypto');
const https = require('https');
const fs = require('fs');

// ─── Constants ───────────────────────────────────────────────────────────────
const APPLE_KEY_ID    = process.env.APPLE_API_KEY_ID;
const APPLE_ISSUER_ID = process.env.APPLE_API_ISSUER_ID;
const EXPO_TOKEN      = process.env.EXPO_TOKEN;

const EAS_API         = 'api.expo.dev';
const EAS_ACCOUNT_ID  = '1c06cc8a-50cd-4eee-b8d1-2fdbd3683eef';
const EAS_APP_ID      = '114b97d5-5cb3-4798-9a97-8233a6a37c07';
const EAS_IOS_CREDS_ID = '039c8567-e3b9-4dcc-94af-2282c132738b';
const EAS_APP_IDENTIFIER_ID = 'bb6b0809-981f-4ff5-9179-34b611742160';
const BUNDLE_ID       = 'com.capspoker.app';
const TEAM_ID         = '3K9KJNGL9U';

// ─── CSR generation ──────────────────────────────────────────────────────────
function generateCSR() {
  // Use OpenSSL (available on Ubuntu CI) for correct CSR generation.
  // Apple is strict about CSR format — manual DER encoding is error-prone.
  const { execSync } = require('child_process');
  const os = require('os');
  const path = require('path');

  const tmpDir = os.tmpdir();
  const keyFile = path.join(tmpDir, 'dist-cert-key.pem');
  const csrFile = path.join(tmpDir, 'dist-cert-csr.pem');
  const subject = `/C=US/O=${TEAM_ID}/CN=Apple Distribution: Roye Arguan`;

  try {
    // Generate RSA 2048 private key
    execSync(`openssl genrsa -out "${keyFile}" 2048`, { stdio: 'pipe' });
    // Generate CSR signed with SHA256
    execSync(`openssl req -new -key "${keyFile}" -out "${csrFile}" -subj "${subject}"`, { stdio: 'pipe' });

    const privateKeyPem = fs.readFileSync(keyFile, 'utf8');
    const csrPem = fs.readFileSync(csrFile, 'utf8');

    // Cleanup temp files
    try { fs.unlinkSync(keyFile); fs.unlinkSync(csrFile); } catch {}

    return { privateKeyPem, csrPem };
  } catch (e) {
    throw new Error('OpenSSL CSR generation failed: ' + e.message);
  }
}

// ─── Apple JWT ───────────────────────────────────────────────────────────────
function generateAppleJWT() {
  const p8 = fs.readFileSync('AuthKey_HH732W7XQJ.p8', 'utf8').trim();
  const now = Math.floor(Date.now() / 1000);
  const header  = Buffer.from(JSON.stringify({ alg: 'ES256', kid: APPLE_KEY_ID, typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss: APPLE_ISSUER_ID, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' })).toString('base64url');
  const sigInput = `${header}.${payload}`;
  const sign = crypto.createSign('SHA256');
  sign.update(sigInput);
  const sig = sign.sign({ key: p8, dsaEncoding: 'ieee-p1363' });
  return `${sigInput}.${sig.toString('base64url')}`;
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
function appleRequest(method, path, body, jwt) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.appstoreconnect.apple.com',
      path,
      method,
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data });
      });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Apple API timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function easGraphQL(query, variables) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query, variables });
    const options = {
      hostname: EAS_API,
      path: '/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${EXPO_TOKEN}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.errors) {
            reject(new Error(`EAS GraphQL error: ${parsed.errors[0].message}`));
          } else {
            resolve(parsed.data);
          }
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

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  if (!APPLE_KEY_ID || !APPLE_ISSUER_ID) {
    console.error('❌ APPLE_API_KEY_ID and APPLE_API_ISSUER_ID must be set');
    process.exit(1);
  }
  if (!EXPO_TOKEN) {
    console.error('❌ EXPO_TOKEN must be set');
    process.exit(1);
  }
  if (!fs.existsSync('AuthKey_HH732W7XQJ.p8')) {
    console.error('❌ AuthKey_HH732W7XQJ.p8 not found in current directory');
    process.exit(1);
  }

  console.log('🔑 Generating Apple ASC JWT...');
  const jwt = generateAppleJWT();

  // ── Step 1: Test Apple API key ──────────────────────────────────────────
  console.log('🍎 Testing Apple API key (listing all distribution certs)...');
  const testResp = await appleRequest('GET', '/v1/certificates?limit=20', null, jwt);
  if (testResp.status === 401) {
    console.error('❌ Apple API key HH732W7XQJ returned 401 Unauthorized');
    console.error('   → The key may be revoked in Apple Developer Portal');
    console.error('   → ACTION NEEDED: Create a new ASC API key at');
    console.error('     https://appstoreconnect.apple.com → Users and Access → Integrations → App Store Connect API');
    console.error('   → Update GitHub secrets: APPLE_API_KEY_BASE64, APPLE_API_KEY_ID');
    process.exit(1);
  }
  if (testResp.status !== 200) {
    console.error(`❌ Apple API returned unexpected status ${testResp.status}: ${testResp.body.slice(0, 200)}`);
    process.exit(1);
  }
  const certsData = JSON.parse(testResp.body);
  const certCount = certsData.data?.length ?? 0;
  console.log(`✅ Apple API key valid — found ${certCount} total cert(s)`);

  // ── Step 2: Find best cert from Apple's list ───────────────────────────
  let appleCertId = null;
  if (certsData.data && certCount > 0) {
    for (const cert of certsData.data) {
      const attrs = cert.attributes || {};
      const serial = (attrs.serialNumber || '').toUpperCase();
      const certType = attrs.certificateType || '';
      const expiry = attrs.expirationDate || attrs.expirationTimestamp || '';
      const name = attrs.name || '';
      console.log(`  cert: ${cert.id} type=${certType} serial=${serial} expires=${expiry} name="${name}"`);
      // Only use IOS_DISTRIBUTION certs
      const isDistrib = certType.includes('DISTRIBUTION') && !certType.includes('MAC');
      if (!isDistrib) continue;
      // Prefer 78DD1F12 (serial in EAS), fallback to any valid IOS_DISTRIBUTION cert
      if (serial.includes('78DD1F12') || serial.includes('40DCBD62')) {
        appleCertId = cert.id;
        console.log(`  ✅ Found preferred cert: Apple ID=${cert.id} type=${certType}`);
        break;
      }
      // Fallback: use first IOS_DISTRIBUTION cert found
      if (!appleCertId) {
        appleCertId = cert.id;
        console.log(`  → Using IOS_DISTRIBUTION cert: Apple ID=${cert.id}`);
      }
    }
  }
  let newCertPrivateKey = null;
  let appleCertContent = null;
  let appleCertSerial = null;
  let easCertId = null; // Will be set whether cert is new or existing

  if (!appleCertId) {
    console.log('⚠️  No IOS_DISTRIBUTION cert found — creating new one via Apple API...');
    console.log(`   Cert types currently in account: ${certsData.data?.map(c => c.attributes?.certificateType).join(', ') || 'none'}`);

    // Generate CSR
    const { privateKeyPem, csrPem } = generateCSR();
    newCertPrivateKey = privateKeyPem;
    console.log('✅ CSR generated');

    // Create IOS_DISTRIBUTION cert
    // Apple csrContent = base64-encoded DER (the content between PEM headers, no whitespace)
    const csrContent = csrPem
      .split('\n')
      .filter(l => l.trim() && !l.includes('-----'))
      .join('');
    const createCertBody = {
      data: {
        type: 'certificates',
        attributes: {
          certificateType: 'IOS_DISTRIBUTION',
          csrContent,
        },
      },
    };
    const createCertResp = await appleRequest('POST', '/v1/certificates', createCertBody, jwt);
    if (createCertResp.status !== 201 && createCertResp.status !== 200) {
      console.error(`❌ Failed to create IOS_DISTRIBUTION cert: ${createCertResp.status}`);
      const errBody = createCertResp.body.slice(0, 500);
      console.error(errBody);
      // Check if it's a limit issue
      if (errBody.includes('maximum') || errBody.includes('limit')) {
        console.error('');
        console.error('🚨 Apple Developer Portal has reached the maximum number of certificates.');
        console.error('   ACTION NEEDED: Go to https://developer.apple.com/account/resources/certificates/list');
        console.error('   and revoke one expired/unused Distribution certificate, then re-run the build.');
      } else if (errBody.includes('Invalid Certificate') || errBody.includes('ENTITY_ERROR')) {
        console.error('🚨 Apple rejected the CSR as "Invalid Certificate".');
        console.error('   This usually means the CSR format or signing was incorrect.');
      }
      process.exit(1);
    }
    const createdCert = JSON.parse(createCertResp.body);
    appleCertId = createdCert.data?.id;
    appleCertContent = createdCert.data?.attributes?.certificateContent;
    appleCertSerial = createdCert.data?.attributes?.serialNumber;
    if (!appleCertId) {
      console.error('❌ Cert created but no ID in response');
      process.exit(1);
    }
    console.log(`✅ Created new IOS_DISTRIBUTION cert: ${appleCertId} serial=${appleCertSerial}`);

    // Store the new cert in EAS so eas build can use it
    console.log('⬆️  Storing new cert in EAS...');
    if (!appleCertContent) {
      console.error('❌ No certificateContent in Apple response — cannot store in EAS');
      process.exit(1);
    }

    // Create a P12 from the cert + private key
    // For EAS, we need certP12 (base64 p12) and certPassword
    // Since we generated the private key, we can create the P12 with openssl
    // Store the private key + cert PEM for later
    fs.writeFileSync('/tmp/dist_cert.pem',
      `-----BEGIN CERTIFICATE-----\n${appleCertContent.match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----\n`);
    fs.writeFileSync('/tmp/dist_key.pem', newCertPrivateKey);

    const { execSync } = require('child_process');
    const p12Password = 'caps2026';
    execSync(`openssl pkcs12 -export -out /tmp/dist.p12 -inkey /tmp/dist_key.pem -in /tmp/dist_cert.pem -passout pass:${p12Password} -legacy`, { stdio: 'pipe' });
    const certP12Base64 = fs.readFileSync('/tmp/dist.p12').toString('base64');
    console.log('✅ P12 created');

    // Store cert in EAS
    const appleTeamQuery = await easGraphQL(`
      { account { byId(accountId: "${EAS_ACCOUNT_ID}") { appleTeamsPaginated(first: 5) { edges { node { id appleTeamIdentifier } } } } } }
    `, {});
    const teams = appleTeamQuery?.account?.byId?.appleTeamsPaginated?.edges || [];
    let appleTeamId = teams.find(t => t.node.appleTeamIdentifier === TEAM_ID)?.node?.id;
    if (!appleTeamId) {
      console.log('   Apple team not in EAS yet — creating...');
      const teamMutData = await easGraphQL(`
        mutation CreateAppleTeam($accountId: ID!, $teamId: String!, $teamName: String!) {
          appleTeam { createAppleTeam(accountId: $accountId, appleTeamInput: { appleTeamIdentifier: $teamId, appleTeamName: $teamName }) { id appleTeamIdentifier } }
        }
      `, { accountId: EAS_ACCOUNT_ID, teamId: TEAM_ID, teamName: 'CAPS Poker' });
      appleTeamId = teamMutData?.appleTeam?.createAppleTeam?.id;
    }
    console.log(`   EAS Apple team ID: ${appleTeamId}`);

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
        certPassword: p12Password,
        certPrivateSigningKey: newCertPrivateKey,
        developerPortalIdentifier: appleCertId,
        appleTeamId: appleTeamId,
      },
    });
    const newEasCertId = storeCertData?.appleDistributionCertificate?.createAppleDistributionCertificate?.id;
    if (!newEasCertId) {
      console.error('❌ Failed to store cert in EAS:', JSON.stringify(storeCertData));
      process.exit(1);
    }
    console.log(`✅ New cert stored in EAS: ${newEasCertId}`);
    easCertId = newEasCertId;
  } else {
    // Reusing existing Apple cert — look up its EAS cert record by Apple portal ID
    console.log(`🔍 Looking up EAS cert record for Apple cert ${appleCertId}...`);
    const appCredsData = await easGraphQL(`
      { app { byId(appId: "${EAS_APP_ID}") {
        iosAppCredentials {
          iosAppBuildCredentialsList {
            distributionCertificate { id developerPortalIdentifier serialNumber }
          }
        }
      }}}
    `, {});
    const buildCredsList = appCredsData?.app?.byId?.iosAppCredentials?.[0]?.iosAppBuildCredentialsList || [];
    for (const cred of buildCredsList) {
      if (cred.distributionCertificate?.developerPortalIdentifier === appleCertId) {
        easCertId = cred.distributionCertificate.id;
        console.log(`  ✅ Found EAS cert record: ${easCertId} (serial ${cred.distributionCertificate.serialNumber})`);
        break;
      }
    }
    if (!easCertId) {
      // Cert exists in Apple but not in EAS — we can't use it without the private key
      // Force creation of a new cert by deleting this one and creating fresh
      console.log(`  ⚠️  Apple cert ${appleCertId} not found in EAS — must create new cert`);
      console.log(`  🗑️  Deleting Apple cert ${appleCertId} to make room for a new one...`);
      const deleteResp = await appleRequest('DELETE', `/v1/certificates/${appleCertId}`, null, jwt);
      console.log(`  Delete status: ${deleteResp.status}`);

      // Now create fresh cert
      const { privateKeyPem, csrPem } = generateCSR();
      newCertPrivateKey = privateKeyPem;
      console.log('✅ CSR generated');
      const csrContent = csrPem.split('\n').filter(l => l.trim() && !l.includes('-----')).join('');
      const createCertResp2 = await appleRequest('POST', '/v1/certificates', {
        data: { type: 'certificates', attributes: { certificateType: 'IOS_DISTRIBUTION', csrContent } }
      }, jwt);
      if (createCertResp2.status !== 201 && createCertResp2.status !== 200) {
        console.error(`❌ Failed to create replacement cert: ${createCertResp2.status} ${createCertResp2.body.slice(0,300)}`);
        process.exit(1);
      }
      const newCertData = JSON.parse(createCertResp2.body);
      appleCertId = newCertData.data?.id;
      appleCertContent = newCertData.data?.attributes?.certificateContent;
      appleCertSerial = newCertData.data?.attributes?.serialNumber;
      console.log(`✅ Created replacement cert: ${appleCertId} serial=${appleCertSerial}`);

      // Store in EAS (reuse the P12 creation code path below by jumping to storage)
      // Set appleCertContent so P12 creation below works
    }
  }

  // If appleCertContent is set (delete+recreate path in else branch), store in EAS now
  if (appleCertContent && !easCertId) {
    console.log('⬆️  Storing replacement cert in EAS...');
    const { execSync: execSync2 } = require('child_process');
    const p12Pass2 = 'caps2026';
    fs.writeFileSync('/tmp/dist_cert.pem',
      `-----BEGIN CERTIFICATE-----\n${appleCertContent.match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----\n`);
    fs.writeFileSync('/tmp/dist_key.pem', newCertPrivateKey);
    execSync2(`openssl pkcs12 -export -out /tmp/dist.p12 -inkey /tmp/dist_key.pem -in /tmp/dist_cert.pem -passout pass:${p12Pass2} -legacy`, { stdio: 'pipe' });
    const certP12b64 = fs.readFileSync('/tmp/dist.p12').toString('base64');
    console.log('✅ P12 created');
    const tQ = await easGraphQL(`{ account { byId(accountId: "${EAS_ACCOUNT_ID}") { appleTeamsPaginated(first: 5) { edges { node { id appleTeamIdentifier } } } } } }`, {});
    let atId2 = (tQ?.account?.byId?.appleTeamsPaginated?.edges || []).find(t => t.node.appleTeamIdentifier === TEAM_ID)?.node?.id;
    if (!atId2) {
      const atM = await easGraphQL(`mutation($a:ID!,$t:String!,$n:String!){appleTeam{createAppleTeam(accountId:$a,appleTeamInput:{appleTeamIdentifier:$t,appleTeamName:$n}){id}}}`, { a: EAS_ACCOUNT_ID, t: TEAM_ID, n: 'CAPS Poker' });
      atId2 = atM?.appleTeam?.createAppleTeam?.id;
    }
    const sD = await easGraphQL(`mutation($a:ID!,$c:AppleDistributionCertificateInput!){appleDistributionCertificate{createAppleDistributionCertificate(accountId:$a,appleDistributionCertificateInput:$c){id serialNumber}}}`,
      { a: EAS_ACCOUNT_ID, c: { certP12: certP12b64, certPassword: p12Pass2, certPrivateSigningKey: newCertPrivateKey, developerPortalIdentifier: appleCertId, appleTeamId: atId2 } });
    easCertId = sD?.appleDistributionCertificate?.createAppleDistributionCertificate?.id;
    if (!easCertId) { console.error('❌ Failed to store replacement cert in EAS:', JSON.stringify(sD)); process.exit(1); }
    console.log(`✅ Replacement cert stored in EAS: ${easCertId}`);
  }

  if (!easCertId) {
    console.error('❌ easCertId not resolved — cannot create build credentials');
    process.exit(1);
  }

  // ── Step 3: Get Apple bundle ID ────────────────────────────────────────
  console.log(`🔍 Looking up Apple bundle ID for ${BUNDLE_ID}...`);
  const bundleResp = await appleRequest('GET', `/v1/bundleIds?filter[identifier]=${BUNDLE_ID}&filter[platform]=IOS`, null, jwt);
  if (bundleResp.status !== 200) {
    console.error(`❌ Failed to get bundle ID: ${bundleResp.status} ${bundleResp.body.slice(0, 200)}`);
    process.exit(1);
  }
  const bundleData = JSON.parse(bundleResp.body);
  if (!bundleData.data || bundleData.data.length === 0) {
    console.error(`❌ Bundle ID ${BUNDLE_ID} not found in Apple Developer Portal`);
    process.exit(1);
  }
  const appleBundleId = bundleData.data[0].id;
  console.log(`✅ Apple bundle ID: ${appleBundleId}`);

  // ── Step 4: Check for existing valid provisioning profiles ──────────────
  console.log('🔍 Checking existing provisioning profiles...');
  const profilesResp = await appleRequest('GET', `/v1/profiles?filter[bundleId]=${appleBundleId}&filter[profileType]=IOS_APP_STORE&limit=10`, null, jwt);
  let existingAppleProfileId = null;
  let existingAppleProfileData = null;
  if (profilesResp.status === 200) {
    const profilesData = JSON.parse(profilesResp.body);
    if (profilesData.data && profilesData.data.length > 0) {
      for (const p of profilesData.data) {
        const status = p.attributes?.profileState;
        console.log(`  profile: ${p.id} name="${p.attributes?.name}" status=${status}`);
        if (status === 'ACTIVE' || status === 'VALID') {
          existingAppleProfileId = p.id;
          existingAppleProfileData = p;
          console.log(`  ✅ Found active profile: ${p.id}`);
          break;
        }
      }
    }
  }

  // ── Step 5: Create or get provisioning profile ─────────────────────────
  let ppBase64 = null;
  let appleProfilePortalId = null;

  if (existingAppleProfileData?.attributes?.profileContent) {
    ppBase64 = existingAppleProfileData.attributes.profileContent;
    appleProfilePortalId = existingAppleProfileId;
    console.log(`✅ Using existing profile: ${existingAppleProfileId}`);
  } else {
    console.log('📝 Creating new provisioning profile...');
    const createBody = {
      data: {
        type: 'profiles',
        attributes: {
          name: `CAPS Poker Distribution ${Date.now()}`,
          profileType: 'IOS_APP_STORE',
        },
        relationships: {
          bundleId: { data: { type: 'bundleIds', id: appleBundleId } },
          certificates: { data: [{ type: 'certificates', id: appleCertId }] },
          devices: { data: [] },
        },
      },
    };
    const createResp = await appleRequest('POST', '/v1/profiles', createBody, jwt);
    if (createResp.status !== 201 && createResp.status !== 200) {
      console.error(`❌ Profile creation failed: ${createResp.status} ${createResp.body.slice(0, 500)}`);
      process.exit(1);
    }
    const created = JSON.parse(createResp.body);
    ppBase64 = created.data?.attributes?.profileContent;
    appleProfilePortalId = created.data?.id;
    if (!ppBase64) {
      console.error('❌ Profile created but no profileContent in response');
      console.error(createResp.body.slice(0, 500));
      process.exit(1);
    }
    console.log(`✅ Created provisioning profile: ${appleProfilePortalId}`);
  }

  // ── Step 6: Upload PP to EAS ───────────────────────────────────────────
  console.log('⬆️  Uploading provisioning profile to EAS...');
  const createPPData = await easGraphQL(`
    mutation CreateAppleProvisioningProfile(
      $input: AppleProvisioningProfileInput!
      $accountId: ID!
      $appleAppIdentifierId: ID!
    ) {
      appleProvisioningProfile {
        createAppleProvisioningProfile(
          appleProvisioningProfileInput: $input
          accountId: $accountId
          appleAppIdentifierId: $appleAppIdentifierId
        ) {
          id
          developerPortalIdentifier
          appleUUID
          expiration
          status
        }
      }
    }
  `, {
    input: {
      appleProvisioningProfile: ppBase64,
      developerPortalIdentifier: appleProfilePortalId,
    },
    accountId: EAS_ACCOUNT_ID,
    appleAppIdentifierId: EAS_APP_IDENTIFIER_ID,
  });
  const easPPId = createPPData?.appleProvisioningProfile?.createAppleProvisioningProfile?.id;
  if (!easPPId) {
    console.error('❌ Failed to create provisioning profile in EAS');
    console.error(JSON.stringify(createPPData, null, 2));
    process.exit(1);
  }
  console.log(`✅ EAS provisioning profile created: ${easPPId}`);

  // ── Step 7: Create or update iosAppBuildCredentials ──────────────────
  console.log(`🔗 Setting iOS app build credentials (cert=${easCertId})...`);

  // Check if APP_STORE build credentials already exist
  const existingBuildCredsData = await easGraphQL(`
    query GetIosAppBuildCredentials($iosAppCredentialsId: ID!) {
      iosAppCredentials {
        byId(id: $iosAppCredentialsId) {
          iosAppBuildCredentialsList {
            id
            iosDistributionType
            distributionCertificate { id serialNumber validityNotAfter }
            provisioningProfile { id developerPortalIdentifier expiration status }
          }
        }
      }
    }
  `, { iosAppCredentialsId: EAS_IOS_CREDS_ID });

  const existingBuildCredsList = existingBuildCredsData?.iosAppCredentials?.byId?.iosAppBuildCredentialsList || [];
  const existingAppStoreCreds = existingBuildCredsList.find(c => c.iosDistributionType === 'APP_STORE');

  let buildCreds;
  if (existingAppStoreCreds) {
    console.log(`🔄 Updating existing iOS app build credentials (id=${existingAppStoreCreds.id})...`);
    const updateCredsData = await easGraphQL(`
      mutation UpdateIosAppBuildCredentials(
        $input: IosAppBuildCredentialsInput!
        $id: ID!
      ) {
        iosAppBuildCredentials {
          updateIosAppBuildCredentials(
            iosAppBuildCredentialsInput: $input
            id: $id
          ) {
            id
            iosDistributionType
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
      id: existingAppStoreCreds.id,
    });
    buildCreds = updateCredsData?.iosAppBuildCredentials?.updateIosAppBuildCredentials;
    if (!buildCreds) {
      console.error('❌ Failed to update iOS app build credentials in EAS');
      console.error(JSON.stringify(updateCredsData, null, 2));
      process.exit(1);
    }
  } else {
    console.log(`🆕 Creating new iOS app build credentials...`);
    const createCredsData = await easGraphQL(`
      mutation CreateIosAppBuildCredentials(
        $input: IosAppBuildCredentialsInput!
        $iosAppCredentialsId: ID!
      ) {
        iosAppBuildCredentials {
          createIosAppBuildCredentials(
            iosAppBuildCredentialsInput: $input
            iosAppCredentialsId: $iosAppCredentialsId
          ) {
            id
            iosDistributionType
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
    buildCreds = createCredsData?.iosAppBuildCredentials?.createIosAppBuildCredentials;
    if (!buildCreds) {
      console.error('❌ Failed to create iOS app build credentials in EAS');
      console.error(JSON.stringify(createCredsData, null, 2));
      process.exit(1);
    }
  }
  console.log('✅ iOS build credentials ready:');
  console.log(`   Credentials ID: ${buildCreds.id}`);
  console.log(`   Cert serial: ${buildCreds.distributionCertificate?.serialNumber}`);
  console.log(`   Cert expires: ${buildCreds.distributionCertificate?.validityNotAfter}`);
  console.log(`   Profile portal ID: ${buildCreds.provisioningProfile?.developerPortalIdentifier}`);
  console.log(`   Profile expires: ${buildCreds.provisioningProfile?.expiration}`);
  console.log(`   Profile status: ${buildCreds.provisioningProfile?.status}`);
  console.log('');
  console.log('🚀 Ready for eas build!');
}

main().catch(err => {
  console.error('❌ ci-setup-ios-creds failed:', err.message);
  process.exit(1);
});
