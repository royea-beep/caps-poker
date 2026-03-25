VAMOS CAPS SSL

Read MEMORY.md and confirm Iron Rules 1-8 before starting.

Standing Orders:
- Try ALL actions autonomously first
- Check C:/Projects/ for any credentials, scripts, or SSL-related configs
- Check ALL projects under C:/Projects/ — not just the ones you checked before
- Search your memory for anything relevant to SSL on ftable.co.il
- Only escalate ONE specific question if truly blocked
- Never give the user a list of commands to run

---

## Context
caps.ftable.co.il was just deployed via FTP. Files are serving correctly on HTTP.
The problem: HTTPS shows NET::ERR_CERT_INVALID — SSL certificate not yet issued for the new subdomain.

---

## TASK A — Search ALL projects for SSL clues
Agent: ssl-researcher

A1. Search ALL projects under C:/Projects/ — not just ftable/chicle
A2. Look for:
    - Any SSL cert generation scripts
    - Any AutoSSL trigger commands
    - Any Let's Encrypt / certbot usage
    - Any cPanel SSL API calls
    - How other subdomains (heroes, demo, 90soccer etc.) got their SSL certs
A3. Check git history of all projects for SSL-related commits
A4. Report exactly what you find

---

## TASK B — Fix SSL for caps.ftable.co.il
Agent: ssl-fixer

Depends on Task A findings.

B1. Using the cPanel API (credentials: ftableco / same as used in deploy):
    - Check current SSL status for caps.ftable.co.il
    - Trigger AutoSSL to run for the new subdomain
    - Or install an existing wildcard cert if available (*.ftable.co.il)

B2. Try these cPanel API endpoints:
    - /execute/SSL/install_ssl — install cert
    - /execute/SSL/start_autossl_check — trigger AutoSSL
    - /json-api/cpanel?module=SSL&func=autossl_check

B3. Verify HTTPS works after fix:
    curl -sk -o /dev/null -w "%{http_code}" https://caps.ftable.co.il/

---

## FINAL STEPS
1. Report what fixed it
2. Update MEMORY.md

VAMOS CAPS SSL — END
