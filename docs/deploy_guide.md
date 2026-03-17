# DEPLOY — caps.ftable.co.il

Before anything else:
- Check C:/Projects/ for any FTP, SSH, or cPanel credentials for ftable.co.il
- Check C:/Projects/chicle or any other project that deploys to ftable.co.il — find the deployment method and credentials used there
- Use those same credentials to deploy

## Task
Upload all contents of C:\Projects\Caps\dist\ (including .htaccess) to caps.ftable.co.il

Steps:
1. Find how ftable.co.il deployments work (check other projects in C:/Projects/)
2. Create subdomain caps.ftable.co.il pointing to public_html/caps (if not already exists)
3. Upload all files from C:\Projects\Caps\dist\ to that directory
4. Verify caps.ftable.co.il loads correctly

Try everything autonomously. Only ask ONE specific question if truly blocked.
Never give the user a list of commands to run.
