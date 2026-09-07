# BUILD 515 — BUILT, AND PROVEN INSTALLABLE

**YES. Build 515 is installable by an internal tester right now**, and that is Apple's answer,
not the upload log's.

**And Apple gave up the likely reason CAPS is missing from the second phone:**
`royearguan@gmail.com` is in state **`INVITED`**, not `INSTALLED`. The TestFlight invitation on
that account has never been accepted, on any device.

---

## §1 · Merged, bumped, built

| | |
|---|---|
| merged | `b8b7ae1` — no-fast-forward merge of 33 commits |
| confirmed on `origin/main` | `git ls-remote origin main` → `b8b7ae1a3a…`, byte-equal to local `main` |
| build number | `ios.buildNumber` **514 → 515**, read back from `origin/main`'s own `app.json` |
| icon on `origin/main` | `assets/icon.png` sha `e053fb9f6371` = the F full lockup, not the old C1 card |
| plugin | `./plugins/withResponsiveIcons` registered on `origin/main` |
| tests on merged main | **48 suites, 2,753 tests, all passing** |

The build ran from the merge commit and its **Expo Prebuild step succeeded**, which is what makes
the icon plugin fire inside the real build rather than only in a container.

### altool — the delivery line, quoted

```
UPLOAD SUCCEEDED with no errors
Delivery UUID: c986132d-71cc-48c5-b097-cf9118e2ecba
Transferred 24819184 bytes in 0.855 seconds (29.0MB/s, 232.317Mbps)
```

**24,819,184 bytes** (≈23.7 MiB). Xcode 26.3, `MARKETING_VERSION 2.7.0`, `BUILD_NUMBER 515`.
Run [34107249013](https://github.com/royea-beep/caps-poker/actions/runs/34107249013), 14 minutes,
every step green.

⚠️ **One correction to something I said mid-run.** I reported the archive step "running long, ~28
minutes". That was wrong — the API was serving me stale job state. The real timestamps show archive
`09:42:10 → 09:52:04`, under ten minutes, and the whole run inside the normal range.

### `verify_jwt` — checked, unchanged

Three Edge Function *sources* ride in the merge, but merging source does not deploy, and
**nothing was deployed this sprint**. Live state read back from Supabase:

| function | version | `verify_jwt` | intended |
|---|---|---|---|
| `analyze-bug-report` | 22 | **true** | true — the DB trigger sends the anon JWT |
| `retriage-pending` | 11 | **false** | false |
| `telegram-bot-handler` | 29 | **false** | false |
| `resolve-hand` | 11 | **false** | false — settles multiplayer with no user session |

No drift. The trap that broke the report pipeline once did not fire.

---

## §2 · THE PROOF — what Apple actually holds

Read over raw REST with a self-signed ES256 JWT, **not** the Spaceship model wrapper.

### Build 515

| field | value | reads as |
|---|---|---|
| `processingState` | **VALID** | processing finished and passed |
| `expired` | **false** | expires 2026-12-06 |
| `usesNonExemptEncryption` | **false** | **export compliance ANSWERED** — not the null that holds a build in limbo |
| `internalBuildState` | **IN_BETA_TESTING** | Apple sets this only when a build is live to internal testers |
| `externalBuildState` | READY_FOR_BETA_SUBMISSION | external would need Beta App Review; irrelevant for internal |
| `minOsVersion` | 15.1 | the second phone must be on iOS 15.1 or later |
| `uploadedDate` | 2026-09-07T02:54:18-07:00 | |

### Attached to the internal group — proven, not assumed

```
Internal Testers — INTERNAL — hasAccessToAllBuilds: true
```

Build 515 is directly attached, and that group takes every build with no Beta App Review wait.

### What Apple says about each tester

| tester | invite | state | groups |
|---|---|---|---|
| `aviavitan2211@gmail.com` | EMAIL | **INSTALLED** | Internal Testers, Friends |
| **`royearguan@gmail.com`** | EMAIL | **INVITED** | Internal Testers, Friends |
| `ftable.aa@gmail.com` | EMAIL | **INSTALLED** | Internal Testers, Friends |
| *(anonymous)* | PUBLIC_LINK | **INSTALLED** | Friends |
| `amitayar@gmail.com` | EMAIL | **INVITED** | Internal Testers, Friends |

### The verdict

```
IS IT INSTALLABLE BY AN INTERNAL TESTER RIGHT NOW?
  YES — build 515 is VALID, not expired, export compliance answered,
        and internalBuildState is IN_BETA_TESTING.
```

Nothing blocked it, so nothing needed fixing.

### ⚠️ My first verdict said NO, and it was my bug

The first run reported `NO — not attached to any INTERNAL beta group`. That was false, and it was
the exact failure this action exists to prevent: **a failed read presented as a finding.**

`GET /v1/builds/{id}/betaGroups` returns **HTTP 403** — *"The relationship 'betaGroups' does not
allow 'GET_RELATED'. Allowed operations are: CREATE, DELETE."* Apple exposes that edge only from
the group side. My query failed, the list came back empty, and my verdict turned an empty list
into a negative.

Fixed two ways, both committed:
1. Query it the way Apple allows — `GET /v1/betaGroups?filter[builds]={id}`.
2. **Separate BLOCKERS from UNKNOWNS.** A blocker is something Apple *said*. Anything unreadable
   prints as `(unknown, not a blocker)` and can never suppress a YES.

---

## §3 · What Roye does

### The likely reason the second phone is empty

`royearguan@gmail.com` is **`INVITED`**, never `INSTALLED`. Apple has no record of any device on
that Apple ID ever installing CAPS. Two accounts on the same groups *are* `INSTALLED`
(`aviavitan2211@` and `ftable.aa@`), so the pipeline plainly works — this one account simply has
an outstanding invitation.

**Step 1 — accept the invitation on the second phone.**
Install TestFlight from the App Store, sign in as the Apple ID that owns the invite, and either
open the TestFlight invitation email and tap **View in TestFlight**, or open TestFlight and tap
**Redeem**. Once accepted, CAPS appears and build 515 is there immediately — the internal group has
access to all builds.

**Step 2 — if that Apple ID is not `royearguan@gmail.com`.** Read the phone's Apple ID:
**Settings → tap the name at the top → the email underneath.**

* Reads `royearguan@gmail.com` → the invitation above is the whole story.
* Reads something else → that address needs adding. Dispatch `testflight-manage.yml` with
  `action: add-tester` and that email; it checks for a duplicate first and prefers the internal
  group.
* Any Apple ID, no tester management: the **Friends** group has a public link,
  `https://testflight.apple.com/join/hD3KvZeC`. ⚠️ Friends is *external* and 515 is
  `READY_FOR_BETA_SUBMISSION`, meaning it has **not** been through Beta App Review — so the public
  link will not serve 515 today. Use it only as a last resort.

**Also check:** the phone must be on **iOS 15.1 or later**.

### What 515 contains that 514 did not

* **The F icon** — the responsive lockup and its config plugin. A 3× iPhone shows the full lockup
  (♠♥♦♣ / CAPS / POKER) at 180px; a 2× iPhone shows compact (♠♥♦♣ / CAPS) at 120px.
* **The Show tips switch** in Settings, and the fix that makes a dismissed tip stay dismissed.
* **The splash edge fix** — 514 showed faint side bars on short devices; 515 does not.
* **The notification colour** — was still the retired maroon `#1C0508`, now `#071C12`.
* **The adaptive icon background** — was maroon, now the felt `#003115`.
* **The i18n completion** — Settings, shared chrome, the Back control, and the English leaks.
* The referral truncation fix, the app-open auth gate, the multiplayer tie `outcome` field, the
  bug-report timeout, the loud triage failure, the catch-all 404 fix, the FIVE-O copy correction,
  and the leaked-token rotation.

### The five device-only checks he still owes

1. **The masthead typeface.** ⚠️ Playfair is **web-only** — no font files are bundled and
   `expo-font` is never imported, so on iOS the CAPS masthead renders in **Georgia**. Does it read
   as a masthead or as body text?
2. **The flat gold.** `#c9a84c` on the felt is 6.34:1 on paper. On a real OLED at low brightness,
   does it read as gold or as brown?
3. **The new F icon at real size.** On the home screen next to other apps — and note the 3× / 2×
   difference above is deliberate, not a bug.
4. **The felt and the beam.** The `LuxuryBackdrop` gradient and vignette — banding on a real panel
   is the thing a browser cannot show.
5. **The multiplayer label at largest Dynamic Type.** Settings → Accessibility → Display & Text
   Size → Larger Text, at maximum. The Play Online stadium's emoji and chevron are pinned with
   `allowFontScaling={false}`, but the label and subtitle scale — check nothing clips.

---

## Production unchanged

* **Economy** untouched. **Flags** untouched. **Winner cue** untouched. **Card sizes, the 83px arc
  and layout** untouched. **Security fixes** untouched.
* **No tester added, removed or modified.**
* **Nothing submitted for App Review.** No metadata, pricing or availability touched. Answering
  export compliance was not needed — Apple already had it as `false`.
* No Edge Function deployed; `verify_jwt` unchanged everywhere.
* The only database write was the handoff row.
