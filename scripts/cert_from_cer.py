#!/usr/bin/env python3
"""
Build a p12 from a downloaded .cer file + private key, then update GitHub Secrets.

Usage:
  py -3.11 scripts/cert_from_cer.py <path-to-downloaded.cer>

Example:
  py -3.11 scripts/cert_from_cer.py C:/Users/royea/Downloads/distribution.cer
"""

import base64
import subprocess
import sys
from pathlib import Path

PROJECT_DIR = Path(__file__).parent.parent
CERTS_DIR = PROJECT_DIR / "certs"

PRIVATE_KEY = CERTS_DIR / "private.key"
P12_OUT = CERTS_DIR / "distribution.p12"
PEM_OUT = CERTS_DIR / "distribution.pem"

P12_PASSWORD = "caps2026"
GITHUB_REPO = "royea-beep/caps-poker"


def main():
    if len(sys.argv) < 2:
        print("Usage: py -3.11 scripts/cert_from_cer.py <path-to-downloaded.cer>")
        sys.exit(1)

    cer_path = Path(sys.argv[1])
    if not cer_path.exists():
        print(f"ERROR: File not found: {cer_path}")
        sys.exit(1)

    print("=" * 60)
    print("Caps Poker - Build p12 from new .cer + update GitHub Secrets")
    print("=" * 60)

    # Step 1: Verify the cert
    print(f"\n[1/4] Checking cert: {cer_path.name}")
    result = subprocess.run(
        ["openssl", "x509", "-inform", "DER", "-in", str(cer_path),
         "-noout", "-subject", "-dates"],
        capture_output=True, text=True
    )
    if result.returncode == 0:
        for line in result.stdout.strip().splitlines():
            print(f"  {line}")
    else:
        result = subprocess.run(
            ["openssl", "x509", "-in", str(cer_path), "-noout", "-subject", "-dates"],
            capture_output=True, text=True
        )
        if result.returncode == 0:
            for line in result.stdout.strip().splitlines():
                print(f"  {line}")
        else:
            print(f"  WARNING: Could not parse cert - {result.stderr.strip()}")

    # Step 2: Convert DER .cer -> PEM
    print(f"\n[2/4] Converting .cer to PEM")
    r = subprocess.run(
        ["openssl", "x509", "-inform", "DER", "-in", str(cer_path), "-out", str(PEM_OUT)],
        capture_output=True, text=True
    )
    if r.returncode != 0:
        import shutil
        shutil.copy(str(cer_path), str(PEM_OUT))
        print("  (Already PEM format - copied)")
    else:
        print(f"  Saved: {PEM_OUT}")

    # Step 3: Create p12 from private key + cert
    print(f"\n[3/4] Creating p12 (password: {P12_PASSWORD})")
    r = subprocess.run(
        ["openssl", "pkcs12", "-export",
         "-out", str(P12_OUT),
         "-inkey", str(PRIVATE_KEY),
         "-in", str(PEM_OUT),
         "-password", f"pass:{P12_PASSWORD}",
         "-legacy"],
        capture_output=True, text=True
    )
    if r.returncode != 0:
        r = subprocess.run(
            ["openssl", "pkcs12", "-export",
             "-out", str(P12_OUT),
             "-inkey", str(PRIVATE_KEY),
             "-in", str(PEM_OUT),
             "-password", f"pass:{P12_PASSWORD}"],
            capture_output=True, text=True
        )
    if r.returncode != 0:
        print(f"  ERROR: {r.stderr}")
        sys.exit(1)
    print(f"  Saved: {P12_OUT} ({P12_OUT.stat().st_size} bytes)")

    # Step 4: Update GitHub Secrets
    print(f"\n[4/4] Updating GitHub Secrets ({GITHUB_REPO})...")

    with open(P12_OUT, "rb") as f:
        p12_b64 = base64.b64encode(f.read()).decode()

    for secret_name, value in [
        ("DISTRIBUTION_P12_BASE64", p12_b64),
        ("DISTRIBUTION_P12_PASSWORD", P12_PASSWORD),
    ]:
        r = subprocess.run(
            ["gh", "secret", "set", secret_name, "--repo", GITHUB_REPO, "--body", value],
            capture_output=True, text=True
        )
        if r.returncode != 0:
            print(f"  ERROR setting {secret_name}: {r.stderr}")
            sys.exit(1)
        print(f"  OK: {secret_name} updated")

    print("\n" + "=" * 60)
    print("SUCCESS! Now create a provisioning profile.")
    print("\nStep 2 - New Provisioning Profile (1 min in browser):")
    print("  1. developer.apple.com -> Profiles -> + -> App Store")
    print("  2. Select App ID: com.ftable.caps (or Caps Poker bundle ID)")
    print("  3. Select the NEW Apple Distribution certificate")
    print("  4. Name: 'Caps AppStore' -> Generate -> Download")
    print("  5. Run:")
    print("     py -3.11 scripts/update_profile_secret.py <path-to-downloaded.mobileprovision>")
    print("=" * 60)


if __name__ == "__main__":
    main()
