#!/usr/bin/env python3
"""
Encode a .mobileprovision file and update GitHub Secret for Caps Poker.

Usage:
  py -3.11 scripts/update_profile_secret.py <path-to-profile.mobileprovision>
"""

import base64
import subprocess
import sys
from pathlib import Path

GITHUB_REPO = "royea-beep/caps-poker"


def main():
    if len(sys.argv) < 2:
        print("Usage: py -3.11 scripts/update_profile_secret.py <path-to-profile.mobileprovision>")
        sys.exit(1)

    profile_path = Path(sys.argv[1])
    if not profile_path.exists():
        print(f"ERROR: File not found: {profile_path}")
        sys.exit(1)

    print(f"Encoding: {profile_path.name} ({profile_path.stat().st_size} bytes)")

    with open(profile_path, "rb") as f:
        profile_b64 = base64.b64encode(f.read()).decode()

    r = subprocess.run(
        ["gh", "secret", "set", "PROVISIONING_PROFILE_BASE64",
         "--repo", GITHUB_REPO, "--body", profile_b64],
        capture_output=True, text=True
    )
    if r.returncode != 0:
        print(f"ERROR: {r.stderr}")
        sys.exit(1)
    print(f"  OK: PROVISIONING_PROFILE_BASE64 updated")

    print("\nDONE! Trigger the build:")
    print("  gh workflow run 'iOS TestFlight' --repo royea-beep/caps-poker")


if __name__ == "__main__":
    main()
