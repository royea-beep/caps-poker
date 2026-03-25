VAMOS CAPS WEB-DEPLOY

Read MEMORY.md before starting.

Standing Orders:
- Try ALL actions autonomously first
- Check C:/Projects/ for credentials (FTP: ftableco / CPANEL_PASSWORD_REDACTED / ftable.co.il)
- Never give the user commands to run

---

## Context
- app.json web config: bundler=metro, output=single — correct
- caps.ftable.co.il is live (HTTPS 200) but serving an old/broken build
- dist/ currently contains iOS native bundle, not web build
- Need fresh web export and deploy

---

## TASK A — Web Export
Agent: web-exporter

A1. cd C:/Projects/Caps
A2. Run: npx expo export --platform web 2>&1
A3. Verify dist/ now contains index.html and _expo/static/js/web/ (not ios/)
A4. Check dist/index.html — does the script tag have type="module"?
    If NOT — add type="module" to the script tag manually

---

## TASK B — Deploy to caps.ftable.co.il
Agent: deployer

B1. Upload ALL contents of C:\Projects\Caps\dist\ to server via FTP:
    - Host: ftable.co.il
    - User: ftableco
    - Pass: CPANEL_PASSWORD_REDACTED
    - Target: /home/ftableco/public_html/caps/
    - Include .htaccess if exists, or create one:

    RewriteEngine On
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule ^ index.html [L]

B2. Verify deployment:
    curl -sk https://caps.ftable.co.il 2>&1 | grep -i "title\|caps\|expo" | head -5

---

## FINAL STEPS
1. git add -A && git commit -m "deploy: web export to caps.ftable.co.il"
2. Update MEMORY.md — add web deployment status
3. Report result table

VAMOS CAPS WEB-DEPLOY — END
