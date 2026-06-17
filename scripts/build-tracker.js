#!/usr/bin/env node
/**
 * CAPS Build Tracker — source of truth for build numbers.
 * Iron Rule #26: never trust app.json buildNumber (EAS auto-increments in cloud).
 * Read-only: uses `eas build:list` / `eas update:list` only — NEVER `eas build`.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(cmd, fallback = null) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return fallback;
  }
}
function safeJSON(str, fallback = null) {
  try { return JSON.parse(str); } catch { return fallback; }
}
// EAS JSON can be a bare array or { updates: [...] } / { builds: [...] } depending on version.
function asList(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.currentPage)) return data.currentPage; // update:list --json
  if (data && Array.isArray(data.updates)) return data.updates;
  if (data && Array.isArray(data.builds)) return data.builds;
  return [];
}

const result = {
  timestamp: new Date().toISOString(),
  source: 'eas-cli',
  app_version: null,
  ios_build: null,
  android_versionCode: null,
  ios_build_status: null,
  latest_build_runtime: null,
  ota_runtime: null,
  ota_reaches_latest_build: null,
  runtime_version: null,
  latest_ota_hash: null,
  latest_ota_message: null,
  latest_ota_created_at: null,
  notes: [],
};

// 1. App version + runtime from app.json (version string is fine; build number is not)
try {
  const appJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'app.json'), 'utf8'));
  result.app_version = appJson.expo?.version ?? null;
  const rv = appJson.expo?.runtimeVersion;
  // runtimeVersion may be a string OR a policy object e.g. { policy: "appVersion" }
  if (typeof rv === 'string') result.runtime_version = rv;
  else if (rv?.policy === 'appVersion') result.runtime_version = result.app_version;
  else if (rv?.policy) result.runtime_version = `policy:${rv.policy}`;
} catch (e) {
  result.notes.push('app.json read failed: ' + e.message);
}

// 2. iOS build from EAS — report the latest FINISHED build (field name varies by eas-cli version)
const bn = (b) => b?.appBuildVersion ?? b?.iosBuildNumber ?? b?.buildVersion ?? b?.version ?? null;
const iosRaw = run('npx eas-cli build:list --platform ios --limit 10 --json --non-interactive', '');
const iosList = asList(safeJSON(iosRaw, []));
if (iosList.length) {
  const finished = iosList.find((b) => String(b.status).toUpperCase() === 'FINISHED');
  const chosen = finished ?? iosList[0];
  result.ios_build = bn(chosen);
  result.ios_build_status = chosen.status ?? null;
  result.latest_build_runtime = chosen.runtimeVersion ?? null;
  if (finished) {
    result.notes.push(`iOS FINISHED build: ${result.ios_build}. Latest overall: ${bn(iosList[0])} (${iosList[0].status}).`);
  } else {
    result.notes.push(`WARNING: no FINISHED iOS build in last 10 — latest is ${bn(iosList[0])} (${iosList[0].status}).`);
  }
} else {
  result.notes.push('eas build:list ios returned empty or failed (auth? free-tier?)');
}

// 3. Android versionCode from EAS
const andRaw = run('npx eas-cli build:list --platform android --limit 1 --json --non-interactive', '');
const andList = asList(safeJSON(andRaw, []));
if (andList.length) {
  const b = andList[0];
  result.android_versionCode = b.appBuildVersion ?? b.versionCode ?? null;
} else {
  result.notes.push('eas build:list android returned empty or failed');
}

// 4. Latest OTA from Expo Updates
const updRaw = run('npx eas-cli update:list --branch production --limit 1 --json --non-interactive', '');
const updList = asList(safeJSON(updRaw, []));
if (updList.length) {
  const u = updList[0];
  result.latest_ota_hash = u.group ?? u.id ?? null;
  result.latest_ota_message = u.message ?? null;
  result.latest_ota_created_at = u.createdAt ?? null;
  result.ota_runtime = u.runtimeVersion ?? null;
  if (!result.runtime_version && u.runtimeVersion) result.runtime_version = u.runtimeVersion;
} else {
  result.notes.push('eas update:list returned empty or failed');
}

// Runtime-mismatch guard: an OTA is ONLY delivered to builds whose runtimeVersion matches it.
if (result.latest_build_runtime && result.ota_runtime) {
  result.ota_reaches_latest_build = result.latest_build_runtime === result.ota_runtime;
  if (!result.ota_reaches_latest_build) {
    result.notes.push(`🚨 RUNTIME MISMATCH: latest OTA runtime ${result.ota_runtime} != latest FINISHED iOS build runtime ${result.latest_build_runtime} — the OTA will NOT reach that build. Ship a build at runtime ${result.ota_runtime} before relying on OTA delivery.`);
  }
}

console.log(JSON.stringify(result, null, 2));

const md = `# CAPS Current Build (auto-generated)

**Last refresh:** ${result.timestamp}

| Field | Value |
|-------|-------|
| App version | ${result.app_version ?? '?'} |
| iOS Build | **${result.ios_build ?? '?'}** (${result.ios_build_status ?? '?'}) |
| iOS build runtime | ${result.latest_build_runtime ?? '?'} |
| Android versionCode | ${result.android_versionCode ?? '?'} |
| Runtime version | ${result.runtime_version ?? '?'} |
| Latest OTA hash | \`${result.latest_ota_hash ?? '?'}\` |
| Latest OTA message | ${result.latest_ota_message ?? '?'} |
| OTA runtime | ${result.ota_runtime ?? '?'} |
| OTA reaches latest build? | ${result.ota_reaches_latest_build === null ? '?' : (result.ota_reaches_latest_build ? '✅ yes' : '❌ NO — runtime mismatch (OTA reaches no one)')} |
| OTA created at | ${result.latest_ota_created_at ?? '?'} |

## Iron Rule #26 reminder
NEVER trust app.json buildNumber. EAS auto-increments in the cloud. This file is the ONLY
source of truth besides the device's \`Application.nativeBuildVersion\`.

## Notes
${result.notes.map((n) => '- ' + n).join('\n')}
`;

const docsDir = path.join(process.cwd(), 'docs');
fs.mkdirSync(docsDir, { recursive: true });
fs.writeFileSync(path.join(docsDir, 'CURRENT-BUILD.md'), md);
console.error('\n✓ Wrote docs/CURRENT-BUILD.md');
