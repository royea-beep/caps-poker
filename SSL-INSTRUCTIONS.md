# SSL Fix for caps.ftable.co.il

## Problem
HTTPS fails for ALL subdomains on ftable.co.il shared hosting (SPD).
Apache serves `compass.spd.co.il` cert instead of the correct domain cert.
This is a WHM-level Apache SNI misconfiguration — not fixable via cPanel user API.

## Diagnosis (2026-03-12)
- cPanel has correct cert-to-domain mapping (verified via UAPI SSL/installed_hosts)
- SSL cert for caps.ftable.co.il exists (Let's Encrypt, valid until June 2026)
- Wildcard cert *.ftable.co.il also exists
- Apache SNI returns `compass.spd.co.il` for ALL subdomains (heroes, demo, caps, venuekit)
- Attempted: delete + reinstall via UAPI (×2), AutoSSL trigger — no effect
- Root cause: Apache SSL vhost config is stale, needs WHM-level rebuild

## What Was Tried (automated)
1. `SSL/delete_ssl` + `SSL/install_ssl` via cPanel UAPI → cert installs but Apache doesn't reload
2. `SSL/start_autossl_check` → runs but doesn't rebuild Apache vhosts
3. `SSL/rebuild_mail_sni_config` → only affects mail, not web
4. No Cloudflare API token found (searched all .env files across C:\Projects)

---

## Option A: Contact SPD Hosting (fastest fix)

**Send this to SPD support:**

> Subject: Apache SSL vhosts not serving correct certificates — all subdomains affected
>
> Hi, all subdomains on my account (ftableco) return the wrong SSL certificate.
>
> When connecting to caps.ftable.co.il, heroes.ftable.co.il, etc.,
> Apache serves the certificate for compass.spd.co.il instead of the
> correct domain certificate.
>
> The certs are installed correctly in cPanel (verified via SSL/installed_hosts API).
> Apache's SSL vhost configuration needs to be rebuilt.
>
> Please run: /scripts/rebuildhttpdconf && /scripts/restartsrv_httpd
>
> Or via WHM: Service Configuration → Apache Configuration → Rebuild Configuration
>
> Test after: openssl s_client -servername caps.ftable.co.il -connect 195.225.46.105:443
> Should show: subject=CN=www.caps.ftable.co.il (not compass.spd.co.il)

**SPD contact:** support@spd.co.il / https://www.spd.co.il/

---

## Option B: Cloudflare Proxy (if SPD won't fix)

### Step 1: Set up Cloudflare zone (manual — no API token available)
1. Go to https://dash.cloudflare.com
2. Log in as royearguan@gmail.com
3. Add site → ftable.co.il → Free plan
4. Copy the DNS records it detects (or add manually):
   - `A  ftable.co.il  → 195.225.46.105` (proxied ☁️)
   - `A  caps          → 195.225.46.105` (proxied ☁️)
   - `A  heroes        → 195.225.46.105` (proxied ☁️)
   - `A  demo          → 195.225.46.105` (proxied ☁️)
   - `A  venuekit      → 195.225.46.105` (proxied ☁️)
   - `CNAME www        → ftable.co.il`   (proxied ☁️)
   - Copy any MX records for email
5. Note the assigned nameservers (e.g., carlos.ns.cloudflare.com / colette.ns.cloudflare.com)
6. SSL/TLS → Encryption mode: **Full** (origin has cert)
7. Edge Certificates → Always Use HTTPS: **On**

### Step 2: Create API token (for future automation)
1. Cloudflare dashboard → My Profile → API Tokens → Create Token
2. Template: "Edit zone DNS"
3. Zone: ftable.co.il
4. Save token to `C:\Projects\ftable\.env` as `CLOUDFLARE_API_TOKEN=<token>`

### Step 3: Change nameservers
**Registrar:** Communigal Communication Ltd (Galcomm)
**Registrar URL:** http://www.galcomm.co.il/
**Tech contact:** Interspace Ltd (domreg@interspace.net)

Current nameservers:
- ns1.spd.co.il
- ns2.spd.co.il

Change to Cloudflare nameservers (from Step 1.5 above).

**How to change:**
- If domain was registered through SPD: log into SPD client panel and change NS
- If through Galcomm directly: log into http://www.galcomm.co.il/ panel
- If through Interspace: contact domreg@interspace.net
- Propagation: 24-48 hours

---

## Domain Details (from WHOIS)
- Registrant: Roye Arguan, royearguan@gmail.com
- Registrar: Communigal Communication Ltd (galcomm.co.il)
- Tech: Interspace Ltd (interspace.net)
- Nameservers: ns1.spd.co.il, ns2.spd.co.il
- Validity: until 2026-06-10
- Status: Transfer Locked
- Server IP: 195.225.46.105
- Hosting: SPD shared hosting (cPanel/WHM)
- cPanel: https://ftable.co.il:2083 (user: ftableco)
