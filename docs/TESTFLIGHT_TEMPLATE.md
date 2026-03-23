# TestFlight Pipeline — Standard Template
## Updated: 2026-03-23 | Apple Team: 3K9KJNGL9U

---

## Architecture

```
git push main → GitHub Actions (ios-testflight.yml) → ubuntu-latest → EAS Cloud Build → TestFlight
```

**Caps uses Expo/React Native**
→ Uses EAS (Expo Application Services) for cloud builds + signing + submission.

---

## How it works

1. CI triggers on push to `main` or `workflow_dispatch`
2. Writes Apple API key from `APPLE_API_KEY_BASE64` secret to `./AuthKey_WTWALQMG5N.p8`
3. `eas build --platform ios --profile production --auto-submit`
   - EAS builds in the cloud (~10-15 min) on managed macOS
   - EAS manages signing credentials remotely (`credentialsSource: "remote"` in eas.json)
   - EAS Submit reads `./AuthKey_WTWALQMG5N.p8` to auto-submit to TestFlight
4. Key file cleaned up after build

---

## Required Secrets

| Secret | Value / Source | Set? |
|--------|----------------|------|
| `EXPO_TOKEN` | expo.dev → Account Settings → Access Tokens | ✅ |
| `APPLE_API_KEY_BASE64` | base64 of `AuthKey_WTWALQMG5N.p8` | ✅ |
| `APPLE_API_KEY_ID` | `WTWALQMG5N` | ✅ |
| `APPLE_API_ISSUER_ID` | `686f97b8-3f8a-40b7-a6cd-5293a3168439` | ✅ |

---

## How to add to a NEW Expo project

```bash
# 1. Copy workflow
cp .github/workflows/ios-testflight.yml /NEW_PROJECT/.github/workflows/

# 2. Set secrets (same values — shared Apple account)
gh secret set EXPO_TOKEN --repo royea-beep/NEW_PROJECT
gh secret set APPLE_API_KEY_BASE64 --body "$(cat AuthKey_WTWALQMG5N.p8 | base64 -w 0)" --repo royea-beep/NEW_PROJECT
gh secret set APPLE_API_KEY_ID --body "WTWALQMG5N" --repo royea-beep/NEW_PROJECT
gh secret set APPLE_API_ISSUER_ID --body "686f97b8-3f8a-40b7-a6cd-5293a3168439" --repo royea-beep/NEW_PROJECT

# 3. Update eas.json submit.production.ios with correct ascAppId
# 4. Run eas credentials --platform ios to store signing creds in EAS
# 5. Push → done
```

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `eas build` fails "project not found" | Run `eas init` locally to register the EAS project |
| Signing fails | Run `eas credentials --platform ios` locally to refresh stored creds |
| Submit fails | Check `AuthKey_WTWALQMG5N.p8` is valid and `ascAppId` is correct in eas.json |
| "non-interactive mode requires..." | Add `--non-interactive` flag (already in workflow) |

---

## Apple Account Info
- Team ID: `3K9KJNGL9U`
- ASC API Key ID: `WTWALQMG5N`
- ASC Issuer ID: `686f97b8-3f8a-40b7-a6cd-5293a3168439`
- Caps App ID (ASC): `6760429619`
