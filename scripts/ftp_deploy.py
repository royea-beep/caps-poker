"""Deploy dist/ to cPanel FTP — caps.ftable.co.il"""
import ftplib, os, sys

HOST = 'ftable.co.il'
USER = 'ftableco'
PASS = 'CPANEL_PASSWORD_REDACTED'
REMOTE_BASE = '/home/ftableco/public_html/caps'
LOCAL_BASE = os.path.join(os.path.dirname(__file__), '..', 'dist')

def mkdirs(ftp, remote_dir):
    parts = remote_dir.strip('/').split('/')
    path = ''
    for part in parts:
        path += '/' + part
        try:
            ftp.mkd(path)
        except ftplib.error_perm:
            pass  # already exists

def upload_dir(ftp, local_dir, remote_dir):
    mkdirs(ftp, remote_dir)
    for entry in os.listdir(local_dir):
        local_path = os.path.join(local_dir, entry)
        remote_path = remote_dir + '/' + entry
        if os.path.isdir(local_path):
            upload_dir(ftp, local_path, remote_path)
        else:
            with open(local_path, 'rb') as f:
                ftp.storbinary(f'STOR {remote_path}', f)
            print(f'  ok {remote_path}')

def main():
    local_base = os.path.abspath(LOCAL_BASE)
    if not os.path.isdir(local_base):
        print(f'ERROR: dist/ not found at {local_base}')
        sys.exit(1)

    print(f'Connecting to {HOST}...')
    with ftplib.FTP(HOST) as ftp:
        ftp.login(USER, PASS)
        ftp.set_pasv(True)
        print(f'Uploading {local_base} to {REMOTE_BASE}')
        upload_dir(ftp, local_base, REMOTE_BASE)
    print('Done.')

if __name__ == '__main__':
    main()
