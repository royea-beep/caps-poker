# Security Debt — CAPS Poker

**Logged:** 2026-05-21 (file dated to the May 18–19 leaked-key incident).
**Status:** two items intentionally deferred to a dedicated security session. Both require a human action and were **not** executed during the OTA/cleanup session.

---

## Context

- Local `main` carries a **scrubbed** history: `git filter-repo` removed the `web-dist*` web bundles that contained an inlined Anthropic API key. Local HEAD = `e45a65c` (`chore(security): ignore *_pw.js + web-dist*`).
- `origin/main` still carries the **un-scrubbed** history: **79 `web-dist` files** + **8 commits** touching them, including the inlined key.
- Local and origin diverged by **525 ↔ 525** commits (common ancestor `117624d`, 2026-03-13). Same commit messages, different SHAs — a full history rewrite, so a normal `git push origin main` is **rejected (non-fast-forward)**.

---

## Debt item 1 — Publish the scrubbed history (force-push `main`)

Goal: remove the leaked key from origin's history.

**Blocked by:** `main` branch protection (`allow_force_pushes: false`), and force-push is a security-sensitive rewrite of public history.

**Steps (dedicated session):**
1. GitHub → repo **Settings → Branches → `main` rule → enable "Allow force pushes"** (temporary).
2. `git -C C:\projects\POKER\Caps push --force-with-lease origin main`
3. Verify CI: `gh run list --limit 1`
4. Verify tree clean:
   `gh api "repos/royea-beep/caps-poker/git/trees/main?recursive=1" --jq '.tree[].path' | Select-String -Pattern 'web-dist|cpanel_pw'` → **must be empty**
5. Re-disable "Allow force pushes".

⚠️ Force-push rewrites public `main`; anyone on old SHAs must re-clone. Solo repo → low blast radius.

---

## Debt item 2 — Rotate the Anthropic API key

The leaked key (`...api03`) was never rotated and is **still live**. It remains recoverable from origin history (and any forks/caches) until **both** item 1 and rotation are done.

**Blocked by:** needs a new key created at console.anthropic.com (no admin key available in the automation environment).

**Steps (dedicated session):**
1. console.anthropic.com → create a new API key.
2. `npx supabase secrets set ANTHROPIC_API_KEY=<new-key> --project-ref gxrpunvhjcrzqnitbqah`
3. Smoke-probe the `anthropic-proxy` edge function → expect `PROXY_OK`.
4. Disable / delete the old `...api03` key at console.anthropic.com.

---

## Already done (this session)

- OTA **v2.0.2** shipped — eas update group `c97944fd-6028-42e5-a5e5-837765fd618f`, runtime 2.7.0, android+ios.
- Deleted debug edge function `check-anthropic-key` (a key-validity oracle).
- `.gitignore` now ignores `*_pw.js` + `web-dist*` (commit `e45a65c`, local only until item 1 lands).

---

## Note

The two items are independent but **both** are required for true containment:
scrubbing origin without rotating leaves the key live; rotating without scrubbing leaves a dead key in history (lower risk, but untidy).
