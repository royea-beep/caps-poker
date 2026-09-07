#!/usr/bin/env bash
# THE POST-UPLOAD DISTRIBUTION STEP, AS ONE FILE SO IT CAN BE RUN AND NOT MERELY READ.
#
# ⚠️ IT LIVES HERE RATHER THAN INLINE IN ios-testflight.yml FOR ONE REASON: a step that only ever
# runs at the end of a 20-minute archive is a step nobody can test. Extracted, the "Manage
# TestFlight" workflow can run THE SAME FILE on demand, so "the pipeline distributes" stops being
# a claim about YAML and becomes a job you can point at.
#
# ⚠️ THE BUILD NUMBER IS READ FROM app.json AND NEVER TYPED. Iron Rule 3: a number typed twice
# will eventually be typed differently, and the one place that must not happen is the build that
# gets handed to testers.
set -eu

gem list -i jwt >/dev/null 2>&1 || gem install jwt --no-document

BUILD="$(node -p "require('./app.json').expo.ios.buildNumber")"
if [ -z "$BUILD" ] || [ "$BUILD" = "undefined" ]; then
  echo "::error::could not read expo.ios.buildNumber from app.json"
  exit 1
fi
echo "distributing build $BUILD (read from app.json, not typed)"

BUILD_NUMBER="$BUILD" exec ruby tools/asc/ensure_distribution.rb
