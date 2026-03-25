VAMOS CAPS FORCE-DEPLOY

Read MEMORY.md. Iron Rules 1-8 confirmed.
Standing Orders: Fix autonomously. Never give user commands.

## PROBLEM
Web site still shows GREEN boards instead of RED.
The theme.ts change was made but the web cache is serving old files.

## TASK — Force fresh deploy with cache busting

A1. Read constants/theme.ts — verify boardBg is #6B0000 and felt is #6B0000
    If not — fix it now.

A2. Read components/Board.tsx — verify it uses COLORS.boardBg for background
    If using hardcoded green — replace with COLORS.boardBg

A3. Read app/index.tsx — verify background is COLORS.background (#0a0a0a)
    If brown/espresso — change to COLORS.background

A4. Force cache bust — add a comment change to any component to force new bundle hash:
    In components/Board.tsx add: // v-red-boards at the top as a comment

A5. npx tsc --noEmit — 0 errors
A6. npx jest --silent — all pass
A7. npx expo export --platform web
A8. node scripts/fix-web-html.js

A9. Delete ALL old files from server before uploading new ones:
    Use FTP to delete /home/ftableco/public_html/caps/_expo/ directory first
    Then upload fresh dist/

    Use this Python script:
    ```python
    import ftplib, os, io
    HOST='ftable.co.il'; USER='ftableco'; PASS='CPANEL_PASSWORD_REDACTED'
    REMOTE_BASE='/home/ftableco/public_html/caps'
    LOCAL_BASE='C:/Projects/Caps/dist'

    def delete_dir(ftp, path):
        try:
            items = ftp.nlst(path)
            for item in items:
                try:
                    ftp.delete(item)
                except:
                    delete_dir(ftp, item)
            try: ftp.rmd(path)
            except: pass
        except: pass

    def mkdirs(ftp, path):
        parts=path.strip('/').split('/'); cur=''
        for p in parts:
            if not p: continue
            cur+='/'+p
            try: ftp.mkd(cur)
            except: pass

    def upload(ftp, ld, rd):
        mkdirs(ftp, rd)
        for item in os.listdir(ld):
            lp=os.path.join(ld,item); rp=rd+'/'+item
            if os.path.isdir(lp): upload(ftp,lp,rp)
            else:
                with open(lp,'rb') as f: ftp.storbinary(f'STOR {rp}',f)

    ftp=ftplib.FTP(HOST); ftp.login(USER,PASS); ftp.set_pasv(True)
    print('Deleting old _expo...')
    delete_dir(ftp, REMOTE_BASE+'/_expo')
    print('Uploading fresh files...')
    upload(ftp, LOCAL_BASE, REMOTE_BASE)
    ftp.storbinary('STOR '+REMOTE_BASE+'/.htaccess',
        io.BytesIO(b'RewriteEngine On\nRewriteCond %{REQUEST_FILENAME} !-f\nRewriteCond %{REQUEST_FILENAME} !-d\nRewriteRule ^ index.html [L]\n'))
    ftp.quit()
    print('Done.')
    ```

A10. Verify new bundle is live:
    curl -sk https://caps.ftable.co.il/index.html | grep "index-" | head -1

A11. git add -A && git commit -m "fix: force red boards deploy, cache bust"
A12. git push origin main
A13. Report the new bundle hash that is live

VAMOS CAPS FORCE-DEPLOY — END
