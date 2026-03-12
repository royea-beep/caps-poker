# SSL Fix for caps.ftable.co.il

## Problem
HTTPS fails for ALL subdomains on ftable.co.il shared hosting (SPD).
Apache serves `compass.spd.co.il` cert instead of the correct domain cert.
This is a WHM-level Apache SNI misconfiguration — not fixable via cPanel user API.

## Status (2026-03-12)
- cPanel has correct cert-to-domain mapping (verified via UAPI SSL/installed_hosts)
- SSL cert for caps.ftable.co.il exists (Let's Encrypt, valid until June 2026)
- Wildcard cert *.ftable.co.il also exists
- Apache SNI returns `compass.spd.co.il` for ALL subdomains (heroes, demo, caps, venuekit)
- Attempted: delete + reinstall via UAPI, AutoSSL check trigger — no effect

## Option A: Hosting Provider Fix (recommended)
Contact SPD hosting support and request:

1. **Rebuild Apache SSL vhost configuration**
   - WHM → Service Configuration → Apache Configuration → Rebuild Configuration
   - OR run `/scripts/rebuildhttpdconf && /scripts/restartsrv_httpd` on the server

2. **Verify SNI mapping** for all domains:
   - ftable.co.il → wildcard cert *.ftable.co.il
   - caps.ftable.co.il → www.caps.ftable.co.il cert
   - heroes.ftable.co.il → heroes.ftable.co.il cert

3. **Test**: `openssl s_client -servername caps.ftable.co.il -connect 195.225.46.105:443`
   Should show `subject=CN=www.caps.ftable.co.il`, NOT `compass.spd.co.il`

## Option B: Cloudflare Proxy (alternative)
If hosting provider won't fix:

1. **Create Cloudflare zone** for ftable.co.il at https://dash.cloudflare.com
   - Account: royearguan@gmail.com
   - Add site → ftable.co.il → Free plan

2. **Add DNS records** (copy from current):
   - A ftable.co.il → 195.225.46.105 (proxied)
   - A caps → 195.225.46.105 (proxied)
   - A heroes → 195.225.46.105 (proxied)
   - CNAME www → ftable.co.il (proxied)
   - MX records (copy from current)

3. **Change nameservers** at domain registrar:
   - Current: ns1.spd.co.il, ns2.spd.co.il
   - Change to: Cloudflare-assigned NS (shown after adding site)
   - Registrar: likely via SPD hosting panel or separate registrar
   - Check: https://www.whois.com/whois/ftable.co.il for registrar info

4. **SSL settings** in Cloudflare:
   - SSL/TLS → Encryption mode: Full (not Flexible — origin has cert)
   - Edge Certificates → Always Use HTTPS: On

5. **Wait** 24-48 hours for NS propagation

## Current Nameservers
- ns1.spd.co.il
- ns2.spd.co.il

## Server Details
- IP: 195.225.46.105
- Hosting: SPD shared hosting (cPanel/WHM)
- cPanel: https://ftable.co.il:2083 (user: ftableco)
