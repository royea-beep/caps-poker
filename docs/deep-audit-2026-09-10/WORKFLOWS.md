# GitHub Actions workflows — 17 files on main, 19 registered, measured 2026-09-10

Source: `.github/workflows/` on `ef55640` and the GitHub Actions API (workflows list, per-workflow last run). Runs are counted by the API's `total_count`.

| file | display name | GitHub state | trigger | total runs | last run | last result | note |
|---|---|---|---|---|---|---|---|
| ios-testflight.yml | iOS TestFlight (Expo-free) | active | workflow_dispatch | 1,226 | 2026-09-07 | success | **THE live build pipeline** (build 515) |
| testflight-manage.yml | Manage TestFlight | active | workflow_dispatch (`action` choice list) | 31 in last 3 days | 2026-09-08 | success | ASC reads/writes: store-listing GET, public-link, export compliance |
| web-deploy.yml | Web Deploy (Vercel) | active | push main | — | 2026-09-09 10:47 | success | head_sha ef55640 → caps.ftable.co.il serves it (verified: bundle `index-cf4906c0….js`, 404s honest) |
| secret-scan.yml | secret-scan | active | push, pull_request | 60+ | 2026-09-09 | success | |
| ios-simulator-smoke.yml | iOS Simulator Smoke Test | active | push main | — | 2026-09-08 | success | |
| backstop-baseline.yml | Backstop Baseline (Linux) | active | workflow_dispatch | 9 | 2026-09-01 | success | the only correct way to regenerate `backstop_data/bitmaps_reference/` |
| replicate-vault-to-supabase.yml | Replicate Signing Vault to Supabase | active | schedule `17 4 1 * *` + dispatch | 1 | 2026-09-01 | **failure** (9s) | its ONLY run failed; next fire 2026-10-01; a "second system" backup that has never succeeded |
| restore-signing-vault.yml | Restore Signing Vault (manual) | active | workflow_dispatch | 2 | 2026-08-06 | success | |
| asc-cert-audit.yml | ASC Certificate Audit (read-only) | active | workflow_dispatch | 1 | 2026-08-06 | success | |
| asc-create-caps-profile.yml | ASC - Create CAPS profile (one-shot) | active | workflow_dispatch | 2 | 2026-08-06 | success | |
| asc-fetch-profile.yml | ASC - Fetch provisioning profile (one-shot) | active | workflow_dispatch | 1 | 2026-08-06 | success | |
| ios-testflight-free.yml | iOS TestFlight (FREE — macOS runner) | active | push tags `build-*` + workflow_dispatch | 59 | 2026-06-25 | success | dormant since June; superseded by ios-testflight.yml |
| ios-testflight-DISABLED.yml | iOS TestFlight (DISABLED 2026-05-22 …) | **active** | workflow_dispatch | 0 | never | — | KNOWN name-vs-content: dispatchable, named DISABLED; 0 runs |
| asc-submit.yml | Submit to App Store Review | active | workflow_dispatch | 3 | 2026-04-09 | **failure** | never succeeded; do not dispatch |
| delete-asc-version.yml | Delete ASC Version | active | workflow_dispatch | 1 | 2026-04-06 | success | destructive; one-shot |
| auto-fix-crashes.yml | Auto-Fix Crashes | **disabled_manually** (2026-05-14) | schedule */5 + dispatch | 1,106 | 2026-05-14 | success | |
| claude-fix.yml | Claude Auto-Fix | **disabled_manually** (2026-05-14) | repository_dispatch | 32 | 2026-04-03 | failure | |
| *(not on main)* asc-details.yml | ASC Build Details | active | push on `recovery/may4-clean` (deleted) | 1 | 2026-05-14 | success | ghost record; GitHub refuses dispatch ("no workflow_dispatch trigger" on any ref); cannot be deleted via API; holds no live surface |
| *(not on main)* asc-list.yml | ASC List Builds | active | push on `recovery/may4-clean` (deleted) | 1 | 2026-05-14 | success | same |

Three workflows show a last result of failure: `replicate-vault-to-supabase.yml` (the only one that will fire again on its own), `asc-submit.yml`, `claude-fix.yml` (disabled).
