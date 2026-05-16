#!/usr/bin/env node
/**
 * CAPS one-time manual-signing bootstrap.
 *
 * Goal: produce three GitHub secrets so the iOS workflow can use
 *       CODE_SIGN_STYLE=Manual instead of auto-creating dev certs each build.
 *
 * What this script does (no Apple Developer Portal interactive UI required):
 *   1. Talk to App Store Connect API via ASC API key.
 *   2. Locate (or create) an IOS_DISTRIBUTION certificate.
 *   3. Bundle the locally-generated private key + the Apple-issued cert into a
 *      password-protected .p12.
 *   4. Locate (or create) an iOS App Store provisioning profile for
 *      com.capspoker.app, attached to that cert.
 *   5. Print base64 blobs + the cert's "Common Name" (needed for xcodebuild's
 *      CODE_SIGN_IDENTITY).
 *
 * Inputs (env):
 *   APPLE_API_KEY_PATH  - absolute path to AuthKey_<id>.p8
 *   APPLE_API_KEY_ID    - the key id (e.g. HH732W7XQJ)
 *   APPLE_API_ISSUER_ID - issuer UUID
 *   BUNDLE_ID           - com.capspoker.app
 *   TEAM_ID             - 3K9KJNGL9U
 *   P12_PASSWORD        - chosen password for the produced .p12
 *
 * Outputs (stdout): three base64 blocks + metadata, marked with === sentinels
 * so a wrapper can extract them. Nothing secret is logged outside those blocks.
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { execSync } = require('child_process');

const KEY_PATH    = process.env.APPLE_API_KEY_PATH;
const KEY_ID      = process.env.APPLE_API_KEY_ID;
const ISSUER_ID   = process.env.APPLE_API_ISSUER_ID;
const BUNDLE_ID   = process.env.BUNDLE_ID;
const TEAM_ID     = process.env.TEAM_ID;
const P12_PASSWORD = process.env.P12_PASSWORD;

for (const [name, value] of Object.entries({ KEY_PATH, KEY_ID, ISSUER_ID, BUNDLE_ID, TEAM_ID, P12_PASSWORD })) {
  if (!value) { console.error(`Missing env: ${name}`); process.exit(1); }
}

const P8 = fs.readFileSync(KEY_PATH, 'utf8').trim();

// ─── Apple JWT ───────────────────────────────────────────────────────────────
function generateJwt() {
  const now = Math.floor(Date.now() / 1000);
  const header  = Buffer.from(JSON.stringify({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss: ISSUER_ID, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' })).toString('base64url');
  const sig = crypto.createSign('SHA256').update(`${header}.${payload}`).sign({ key: P8, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${header}.${payload}.${sig}`;
}

function appleRequest(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.appstoreconnect.apple.com',
      path: urlPath, method,
      headers: {
        Authorization: `Bearer ${generateJwt()}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }, res => {
      let out = '';
      res.on('data', c => out += c);
      res.on('end', () => resolve({ status: res.statusCode, body: out }));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Apple API timeout')); });
    if (data) req.write(data);
    req.end();
  });
}

// ─── 1. Verify auth ──────────────────────────────────────────────────────────
async function verifyAuth() {
  const r = await appleRequest('GET', '/v1/users?limit=1');
  if (r.status !== 200) throw new Error(`Auth failed: HTTP ${r.status} ${r.body.slice(0, 300)}`);
  console.error('✓ ASC API auth OK');
}

// ─── 2. List existing certificates ───────────────────────────────────────────
async function listCerts() {
  const r = await appleRequest('GET', '/v1/certificates?limit=200');
  if (r.status !== 200) throw new Error(`List certs failed: ${r.status} ${r.body.slice(0, 300)}`);
  return JSON.parse(r.body).data || [];
}

// ─── 3. Generate CSR ─────────────────────────────────────────────────────────
function generateCSR() {
  const tmp = os.tmpdir();
  const keyFile = path.join(tmp, 'caps-dist.key.pem');
  const csrFile = path.join(tmp, 'caps-dist.csr.pem');
  const subj = `/C=US/O=${TEAM_ID}/CN=Apple Distribution: Roye Arguan`;
  execSync(`openssl genrsa -out "${keyFile}" 2048`, { stdio: 'pipe' });
  execSync(`openssl req -new -key "${keyFile}" -out "${csrFile}" -subj "${subj}"`, { stdio: 'pipe' });
  const privateKeyPem = fs.readFileSync(keyFile, 'utf8');
  const csrPem = fs.readFileSync(csrFile, 'utf8');
  return { privateKeyPem, csrPem, keyFile, csrFile };
}

// ─── 4. Create a Distribution cert via ASC ───────────────────────────────────
async function createDistributionCert(csrPem) {
  const csrContent = csrPem.replace(/-----BEGIN CERTIFICATE REQUEST-----/, '')
                            .replace(/-----END CERTIFICATE REQUEST-----/, '')
                            .replace(/\s+/g, '');
  const r = await appleRequest('POST', '/v1/certificates', {
    data: {
      type: 'certificates',
      attributes: { certificateType: 'IOS_DISTRIBUTION', csrContent }
    }
  });
  if (r.status !== 201) throw new Error(`Create cert failed: ${r.status} ${r.body.slice(0, 500)}`);
  return JSON.parse(r.body).data;
}

// ─── 5. Find Apple bundle id record ──────────────────────────────────────────
async function findBundleId() {
  const r = await appleRequest('GET', `/v1/bundleIds?filter[identifier]=${encodeURIComponent(BUNDLE_ID)}&limit=1`);
  if (r.status !== 200) throw new Error(`Bundle lookup failed: ${r.status} ${r.body.slice(0, 300)}`);
  const arr = JSON.parse(r.body).data || [];
  if (!arr.length) throw new Error(`Bundle ${BUNDLE_ID} not found in ASC. Register it first.`);
  return arr[0];
}

// ─── 6. Create/replace a provisioning profile linked to the new cert ─────────
async function listProfiles() {
  const r = await appleRequest('GET', '/v1/profiles?limit=200');
  if (r.status !== 200) throw new Error(`List profiles failed: ${r.status} ${r.body.slice(0, 300)}`);
  return JSON.parse(r.body).data || [];
}

async function deleteProfile(profileId) {
  const r = await appleRequest('DELETE', `/v1/profiles/${profileId}`);
  if (r.status !== 204) throw new Error(`Delete profile ${profileId} failed: ${r.status} ${r.body.slice(0, 300)}`);
}

async function createProfile(bundleObjId, certObjId, profileName) {
  const r = await appleRequest('POST', '/v1/profiles', {
    data: {
      type: 'profiles',
      attributes: {
        name: profileName,
        profileType: 'IOS_APP_STORE',
      },
      relationships: {
        bundleId:     { data: { type: 'bundleIds', id: bundleObjId } },
        certificates: { data: [{ type: 'certificates', id: certObjId }] },
      },
    },
  });
  if (r.status !== 201) throw new Error(`Create profile failed: ${r.status} ${r.body.slice(0, 500)}`);
  return JSON.parse(r.body).data;
}

// ─── 7. Build .p12 from private-key + cert ───────────────────────────────────
function buildP12(privateKeyFile, certBase64) {
  const tmp = os.tmpdir();
  const certPemFile = path.join(tmp, 'caps-dist.cer.pem');
  const p12File = path.join(tmp, 'caps-dist.p12');

  // Apple returns certificateContent as base64 of DER. Wrap in PEM headers for openssl.
  const pem = '-----BEGIN CERTIFICATE-----\n'
    + certBase64.match(/.{1,64}/g).join('\n')
    + '\n-----END CERTIFICATE-----\n';
  fs.writeFileSync(certPemFile, pem);

  execSync(
    `openssl pkcs12 -export -legacy ` +
    `-inkey "${privateKeyFile}" ` +
    `-in "${certPemFile}" ` +
    `-out "${p12File}" ` +
    `-name "Apple Distribution: Roye Arguan" ` +
    `-passout pass:${P12_PASSWORD}`,
    { stdio: 'pipe' }
  );
  return p12File;
}

// ─── 8. Read cert subject CN (needed for CODE_SIGN_IDENTITY) ─────────────────
function readCertCN(certPemFile) {
  const out = execSync(`openssl x509 -in "${certPemFile}" -noout -subject`, { stdio: ['pipe', 'pipe', 'pipe'] }).toString();
  // Output looks like: subject=C = US, O = 3K9KJNGL9U, OU = ..., CN = Apple Distribution: ...
  const m = out.match(/CN\s*=\s*([^,\n]+)/);
  return m ? m[1].trim() : 'Apple Distribution';
}

// ─── Main ────────────────────────────────────────────────────────────────────
(async () => {
  await verifyAuth();

  const existing = await listCerts();
  const distExisting = existing.filter(c =>
    ['IOS_DISTRIBUTION', 'DISTRIBUTION'].includes(c.attributes.certificateType)
  );
  console.error(`Existing dist certs: ${distExisting.length}`);

  // Revoke any existing dist certs first — we don't have their private keys
  // (this script is the only path that retains the private key), and Apple
  // rejects new-cert creation when one is already current.
  for (const c of distExisting) {
    console.error(`  revoking existing dist cert id=${c.id} expires=${c.attributes.expirationDate}`);
    const del = await appleRequest('DELETE', `/v1/certificates/${c.id}`);
    if (del.status !== 204) {
      console.error(`    FAILED to revoke ${c.id}: ${del.status} ${del.body.slice(0, 200)}`);
    }
  }

  console.error('Generating CSR + key pair locally…');
  const { csrPem, keyFile } = generateCSR();

  console.error('Submitting CSR to Apple ASC API…');
  const cert = await createDistributionCert(csrPem);
  const certId = cert.id;
  const certContent = cert.attributes.certificateContent; // base64 DER
  console.error(`✓ Created cert id=${certId} type=${cert.attributes.certificateType} expires=${cert.attributes.expirationDate}`);

  console.error('Bundling private key + cert into .p12…');
  const p12File = buildP12(keyFile, certContent);

  // Re-derive CN by reading our PEM file (matches what xcodebuild looks for)
  const certPemFile = path.join(os.tmpdir(), 'caps-dist.cer.pem');
  const cn = readCertCN(certPemFile);

  // Provisioning profile
  console.error(`Looking up bundle ${BUNDLE_ID}…`);
  const bundle = await findBundleId();
  console.error(`✓ Bundle obj id ${bundle.id}`);

  const PROFILE_NAME = 'Caps Poker App Store (Manual)';
  console.error(`Reconciling provisioning profile "${PROFILE_NAME}"…`);
  const profiles = await listProfiles();
  const stale = profiles.filter(p =>
    p.attributes.name === PROFILE_NAME ||
    (p.attributes.profileType === 'IOS_APP_STORE' && p.attributes.name?.startsWith('Caps Poker App Store'))
  );
  for (const p of stale) {
    console.error(`  deleting stale profile "${p.attributes.name}" (${p.id})`);
    await deleteProfile(p.id);
  }

  const profile = await createProfile(bundle.id, certId, PROFILE_NAME);
  const profileContent = profile.attributes.profileContent; // base64 of .mobileprovision
  const profileUuid = profile.attributes.uuid;
  console.error(`✓ Created profile name="${PROFILE_NAME}" uuid=${profileUuid}`);

  // Emit secrets-block (parseable by wrapper)
  const p12Base64 = fs.readFileSync(p12File).toString('base64');
  const lines = [
    '=== BEGIN_SECRETS ===',
    `DIST_CERT_CN=${cn}`,
    `PROVISIONING_PROFILE_NAME=${PROFILE_NAME}`,
    `PROVISIONING_PROFILE_UUID=${profileUuid}`,
    'DIST_CERT_P12_BASE64<<BLOB',
    p12Base64,
    'BLOB',
    'PROVISIONING_PROFILE_BASE64<<BLOB',
    profileContent,
    'BLOB',
    '=== END_SECRETS ===',
  ];
  process.stdout.write(lines.join('\n') + '\n');

  // Best-effort cleanup of intermediate files
  for (const f of [keyFile, certPemFile, p12File]) {
    try { fs.unlinkSync(f); } catch {}
  }
})().catch(err => {
  console.error('BOOTSTRAP FAILED:', err.message);
  process.exit(1);
});
