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
const APPLE_CERT_PORTAL_ID = 'J4YQW7L9V2';      // Apple portal ID for cert serial 78DD1F12
const EAS_CERT_ID     = '8bf63564-2a8a-4724-830e-e8a0ed6d4902';
const EAS_ACCOUNT_ID  = '1c06cc8a-50cd-4eee-b8d1-2fdbd3683eef';
const EAS_APP_ID      = '114b97d5-5cb3-4798-9a97-8233a6a37c07';
const EAS_IOS_CREDS_ID = '039c8567-e3b9-4dcc-94af-2282c132738b';
const EAS_APP_IDENTIFIER_ID = 'bb6b0809-981f-4ff5-9179-34b611742160';
const BUNDLE_ID       = 'com.capspoker.app';
const TEAM_ID         = '3K9KJNGL9U';

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
  console.log('🍎 Testing Apple API key...');
  const testResp = await appleRequest('GET', '/v1/certificates?filter[certificateType]=DISTRIBUTION&limit=20', null, jwt);
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
  console.log(`✅ Apple API key valid — found ${certsData.data?.length ?? 0} distribution cert(s)`);

  // ── Step 2: Find cert J4YQW7L9V2 in Apple's list ──────────────────────
  let appleCertId = null;
  if (certsData.data) {
    for (const cert of certsData.data) {
      // J4YQW7L9V2 is the legacy portal ID, Apple's v1 API uses 'id' field
      const attrs = cert.attributes || {};
      const serial = attrs.serialNumber || '';
      console.log(`  cert: ${cert.id} serial=${serial} status=${attrs.certificateType}`);
      if (serial.toUpperCase().includes('78DD1F12')) {
        appleCertId = cert.id;
        console.log(`  ✅ Found valid cert: Apple ID=${cert.id} serial=${serial}`);
      }
    }
  }
  if (!appleCertId) {
    // Try by portal ID directly
    console.log(`⚠️  Cert 78DD1F12 not found in list — trying by portal ID ${APPLE_CERT_PORTAL_ID}`);
    appleCertId = APPLE_CERT_PORTAL_ID;
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

  // ── Step 7: Create iosAppBuildCredentials ─────────────────────────────
  console.log('🔗 Creating iOS app build credentials...');
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
      distributionCertificateId: EAS_CERT_ID,
      provisioningProfileId: easPPId,
    },
    iosAppCredentialsId: EAS_IOS_CREDS_ID,
  });
  const buildCreds = createCredsData?.iosAppBuildCredentials?.createIosAppBuildCredentials;
  if (!buildCreds) {
    console.error('❌ Failed to create iOS app build credentials in EAS');
    console.error(JSON.stringify(createCredsData, null, 2));
    process.exit(1);
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
