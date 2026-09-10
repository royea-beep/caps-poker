# SOCIAL PROFILES — WHY I COULD NOT DO IT, AND THE HANDOVER THAT REPLACES IT
2026-09-09

**Nothing was changed on any social account.** No login was attempted, no credential was requested.

---

## ⚠️ THE PREMISE IS WRONG, AND I MEASURED IT RATHER THAN ASSERTING IT

The brief says: *"YOU run Playwright on his machine, where those accounts are already signed in."*

**I do not run on Roye's machine.** I run in an ephemeral cloud container. Three independent
measurements, in the order I made them:

**1. Where I actually am.**
```
host: vm      user: root      cwd: /home/user/caps-poker      Linux 6.18.44-fc-v24
```
A Linux VM with a fresh clone of the repo, reclaimed when the session ends. Not Windows, not
`C:\Projects\POKER\Caps`.

**2. There is no logged-in browser here.** `/root/.config/chromium` exists but contains **only a
`Crash Reports` folder** — no `Default` profile. A filesystem-wide search for `Cookies` and
`cookies.sqlite` returns **NONE**. Every Playwright context I opened reported **0 cookies**.

**3. The browser cannot even open the three sites.** Loaded for real, all three threw:
```
facebook   net::ERR_CONNECTION_RESET   0 cookies
instagram  net::ERR_CONNECTION_RESET   0 cookies
tiktok     net::ERR_CONNECTION_RESET   0 cookies
page text: "This site can't be reached — The connection was reset … ERR_CONNECTION_RESET"
```
⚠️ **And `curl` reaches all three with HTTP 200.** That is the same browser-versus-curl split
already recorded in this project's notes for Supabase and `caps.ftable.co.il`: the container's
*browser* is network-restricted even where `curl` is not. So "the sites are unreachable" would have
been the wrong finding — the sites are reachable, **the browser is not allowed to reach them**, and
there is no session in any case.

Screenshots of all three failures: `docs/social/session-probe-2026-09-09/`.

**I also will not ask for the account passwords.** Handling credentials for someone's live social
accounts is not something to route through a session transcript, and a two-factor prompt would land
on his phone regardless. This is a boundary I am choosing, not one the container imposed.

⚠️ **A correction to my own wording last sprint.** I wrote that the social accounts were "not
reachable from here", which conflated two things. The accurate statement: the handles and bios are
**not recorded in this repository**, and this container has **no session and no browser network
path** to them. The previous sprint's phrasing was right by accident.

---

## WHAT EACH ACCOUNT ALREADY HAS — I COULD NOT READ IT

**Unknown, and stated as unknown.** I never loaded a single profile. Anything I said about the
current state of these accounts would be invention. The brief's own instruction — *"Check what each
already has before writing. Do not overwrite something Roye chose without reporting it"* — is
therefore impossible for me to honour, which is the second reason this is a handover rather than an
attempt.

---

## THE HANDOVER — every field, ready to paste

Handle `capspokerapp` on all three · contact `caps@ftable.co.il` · link `https://caps.ftable.co.il`

### Name (all three)
```
CAPS Poker
```
⚠️ Exactly that casing — the store listing, the app and every page now agree on it.

### Bio (all three)
```
Multi-board poker. Four cards on every board.
Free · no download · no sign-up
```
⚠️ **Two notes on the bio as supplied.** It arrived as one run-on line — `every board.Free` — with
the break missing; it is written above as two lines. And **"no download" is true of the browser
version and not of the iOS app**, which is a download by definition. If the accounts will ever
point at the App Store, `Free · play in your browser · no sign-up` says the same thing without the
ambiguity. Roye's call; I have not chosen for him.

### Category
```
Video Game
```
⚠️ **Not Casino, not Gambling.** That classification invites review scrutiny the product does not
need — it has no real-money play, and the App Store age rating already declares simulated gambling
honestly.

### Images — measured from the files, not recalled

| platform | file | real size | circular-crop margin |
|---|---|---|---|
| Facebook profile | `docs/social/caps-profile-facebook-360.png` | 360×360 | 23.6% of radius, 0px outside |
| Facebook cover | `docs/social/caps-cover-facebook-1640x664.png` | 1640×664 | n/a |
| Instagram profile | `docs/social/caps-profile-instagram-320.png` | 320×320 | proof on record |
| TikTok profile | `docs/social/caps-profile-tiktok-200.png` | 200×200 | proof on record |
| spare, any platform | `docs/social/caps-profile-1024.png` | 1024×1024 | 24.0% of radius, 0px outside |

Every profile mark sits **entirely inside the circle** with margin to spare —
`docs/social/circular-crop-proof.json` records `outside_circle: 0` for each.

### Contact
```
caps@ftable.co.il
```
⚠️ **No phone number**, per the brief.

### What must NOT go on any of them
No player counts, no ratings, no store date, no "thousands of players". **25 devices have ever
played a hand.** Nothing in the copy above claims otherwise.

---

## THE CLICK PATHS

**Facebook** — `facebook.com/profile.php?id=61593891042796` → *Edit page info*: Name, Bio,
Category (`Video Game`), Contact email, Website. Profile and cover images are set from the page
header itself. ⚠️ A **page name change can take up to 3 days** and Facebook may refuse a second
change for a period afterwards.

**Instagram** — `instagram.com/capspokerapp` → *Edit profile*: Name, Bio, Link. Category shows only
on a Professional/Business account; if the account is Personal, the category field will not exist —
that is a switch, not a failure.

**TikTok** — `tiktok.com/@capspokerapp` → *Edit profile*: Name, Bio, Website.
⚠️ **TikTok gates several fields to the mobile app**, and it forced the app at signup. If the
website link or category is not editable on desktop, that is a phone tap, not a blocker.

---

## SO THAT A FUTURE SESSION DOES NOT RE-LITIGATE THIS

Anything requiring a **logged-in session on a third-party site** cannot be done from this
environment: no browser profile, no cookies, and the browser has no network path to those hosts
even though `curl` does. That is a property of the container, not of Playwright. A session running
on Roye's own machine, with his browser profile, would be a different matter entirely — but that is
not where this runs.
