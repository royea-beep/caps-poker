# frozen_string_literal: true
#
# AFTER THE UPLOAD, MAKE THE BUILD REACHABLE. THIS IS THE STEP ios-testflight.yml NEVER HAD.
#
# ⚠️ THE WORKFLOW SAYS SO IN ITS OWN HEADER: "dropped the ASC bundle-ID registration and beta-group
# distribution steps for this first run". They never came back. So every CAPS build since has
# landed in App Store Connect and stopped there. The INTERNAL group picked builds up anyway
# because it carries hasAccessToAllBuilds=true — which is exactly what made the gap invisible:
# the build looked healthy from the internal side while the external group still served whatever
# was last attached to it by hand, months ago.
#
# ⚠️ AN UPLOAD IS NOT A DISTRIBUTION. Three things have to be true before a phone offers Install,
# and altool does none of them:
#     1. processingState VALID          — Apple finishes processing minutes after the upload
#     2. usesNonExemptEncryption ANSWERED — a null holds the build in limbo indefinitely
#     3. attached to the groups that serve the testers you care about
# This script does all three, idempotently, and then READS BACK from Apple rather than trusting
# its own 200s.
#
# ⚠️ EXTERNAL ATTACHMENT IS NOT FREE. An external group's builds go through Beta App Review.
# That is a real review with a real wait, so it is opt-in via SUBMIT_BETA_REVIEW and this script
# says plainly what it did rather than presenting it as instant.
#
# ENV
#   ASC_APP_ID          required
#   BUILD_NUMBER        the build to distribute; blank = newest
#   DISTRIBUTE_GROUPS   comma-separated group names; blank = every group on the app
#   SUBMIT_BETA_REVIEW  "true" to create a betaAppReviewSubmission for external groups
#   WAIT_MINUTES        how long to wait for processing (default 30; 0 = do not wait)

require_relative "lib"

APP   = ENV.fetch("ASC_APP_ID")
WANT  = ENV["BUILD_NUMBER"].to_s.strip
WANTG = ENV["DISTRIBUTE_GROUPS"].to_s.split(",").map(&:strip).reject(&:empty?)
REVIEW = ENV["SUBMIT_BETA_REVIEW"].to_s.strip.downcase == "true"
WAITM = (ENV["WAIT_MINUTES"].to_s.strip.empty? ? "30" : ENV["WAIT_MINUTES"]).to_i

tok = ASC.token
failures = []

def find_build(tok, want)
  code, body = ASC.get("/v1/builds?filter[app]=#{ENV.fetch('ASC_APP_ID')}&limit=20" \
                       "&sort=-uploadedDate&include=buildBetaDetail", tok)
  return [nil, nil, "builds query failed: HTTP #{code}"] unless code == 200
  builds = body["data"] || []
  b = want.empty? ? builds.first : builds.find { |x| x.dig("attributes", "version") == want }
  return [nil, nil, "build #{want.empty? ? '(newest)' : want} is not in App Store Connect"] if b.nil?
  rel = b.dig("relationships", "buildBetaDetail", "data")
  det = rel && (body["included"] || []).find { |i| i["type"] == "buildBetaDetails" && i["id"] == rel["id"] }
  [b, det, nil]
end

# ── 1. FIND IT AND WAIT FOR PROCESSING ─────────────────────────────────────────────────────
build, detail, err = find_build(tok, WANT)
abort("::error::#{err}") if err

deadline = Time.now + (WAITM * 60)
while build.dig("attributes", "processingState") == "PROCESSING" && Time.now < deadline
  puts "build #{build.dig('attributes', 'version')} is PROCESSING — waiting 60s " \
       "(#{((deadline - Time.now) / 60).round} min left of the #{WAITM} min budget)"
  sleep 60
  tok = ASC.token
  build, detail, err = find_build(tok, WANT.empty? ? build.dig("attributes", "version") : WANT)
  abort("::error::#{err}") if err
end

a = build["attributes"]
puts "=== BUILD #{a['version']} ==="
puts "  id                       #{build['id']}"
puts "  processingState          #{a['processingState']}"
puts "  expired                  #{a['expired']}"
puts "  usesNonExemptEncryption  #{a['usesNonExemptEncryption'].inspect}"
puts "  internalBuildState       #{detail && detail.dig('attributes', 'internalBuildState')}"
puts "  externalBuildState       #{detail && detail.dig('attributes', 'externalBuildState')}"
puts

if a["processingState"] != "VALID"
  puts "::warning::processingState is #{a['processingState']}, not VALID — distribution below may be refused."
  failures << "build never reached VALID within #{WAITM} minutes"
end

# ── 2. EXPORT COMPLIANCE ───────────────────────────────────────────────────────────────────
if a["usesNonExemptEncryption"].nil?
  code, res = ASC.request(:patch, "/v1/builds/#{build['id']}", tok,
                          { data: { type: "builds", id: build["id"],
                                    attributes: { usesNonExemptEncryption: false } } })
  ok = code.between?(200, 299)
  puts "export compliance was UNANSWERED — PATCH usesNonExemptEncryption=false -> HTTP #{code}" \
       "#{ok ? " (now #{res.dig('data', 'attributes', 'usesNonExemptEncryption').inspect})" : ''}"
  failures << "could not answer export compliance (HTTP #{code})" unless ok
else
  puts "export compliance already answered (#{a['usesNonExemptEncryption'].inspect}) — nothing to do."
end
puts

# ── 3. ATTACH TO GROUPS ────────────────────────────────────────────────────────────────────
gcode, g = ASC.get("/v1/apps/#{APP}/betaGroups?limit=50", tok)
abort("::error::could not read beta groups: HTTP #{gcode}") unless gcode == 200
all = g["data"] || []
targets = WANTG.empty? ? all : all.select { |x| WANTG.include?(x.dig("attributes", "name")) }

if !WANTG.empty?
  missing = WANTG - all.map { |x| x.dig("attributes", "name") }
  unless missing.empty?
    puts "::error::group(s) not found on this app: #{missing.join(', ')}"
    failures << "named group(s) do not exist: #{missing.join(', ')}"
  end
end

puts "=== ATTACHING BUILD #{a['version']} TO #{targets.length} GROUP(S) ==="
external_touched = false
targets.each do |grp|
  ga = grp["attributes"]
  kind = ga["isInternalGroup"] ? "INTERNAL" : "EXTERNAL"

  # Already serving it? Ask from the group side — Apple forbids GET on builds->betaGroups.
  bc, b = ASC.get("/v1/builds?filter[betaGroups]=#{grp['id']}&limit=50", tok)
  if bc == 200 && (b["data"] || []).any? { |x| x["id"] == build["id"] }
    puts "  #{ga['name']} (#{kind}) — already serves build #{a['version']}. Nothing to do."
    next
  end

  code, res = ASC.post("/v1/betaGroups/#{grp['id']}/relationships/builds", tok,
                       { data: [{ type: "builds", id: build["id"] }] })
  if code.between?(200, 299)
    puts "  #{ga['name']} (#{kind}) — attached (HTTP #{code})."
    external_touched = true unless ga["isInternalGroup"]
  else
    detail_msg = (res.dig("errors", 0, "detail") || res).to_s[0, 300]
    puts "  #{ga['name']} (#{kind}) — ⚠️ attach failed HTTP #{code}: #{detail_msg}"
    failures << "#{ga['name']}: attach failed HTTP #{code}"
  end
end
puts

# ── 4. BETA APP REVIEW, ONLY IF ASKED ──────────────────────────────────────────────────────
# ⚠️ EXTERNAL TESTING NEEDS BETA APP REVIEW AND IT IS NOT INSTANT. Apple gives no SLA; in
# practice it is usually under 24 hours and can take a couple of days, and it can be REJECTED.
# Internal testing needs none of this, which is why internal is the route to prefer.
if REVIEW
  code, res = ASC.post("/v1/betaAppReviewSubmissions", tok,
                       { data: { type: "betaAppReviewSubmissions",
                                 relationships: { build: { data: { type: "builds", id: build["id"] } } } } })
  if code.between?(200, 299)
    puts "Beta App Review submitted for build #{a['version']} — state " \
         "#{res.dig('data', 'attributes', 'betaReviewState').inspect}. This is a REVIEW: expect hours"
    puts "to a couple of days, and it can be rejected. External testers get nothing until it passes."
  elsif code == 409
    puts "Beta App Review: already submitted (HTTP 409). Nothing to do."
  else
    puts "⚠️ Beta App Review submission failed HTTP #{code}: #{(res.dig('errors', 0, 'detail') || res).to_s[0, 300]}"
    failures << "beta app review submission failed HTTP #{code}"
  end
elsif external_touched
  puts "An EXTERNAL group was touched and SUBMIT_BETA_REVIEW is not true. External testers will"
  puts "not receive this build until it passes Beta App Review. Internal testers are unaffected."
end
puts

# ── 5. READ BACK FROM APPLE, NOT FROM THE 200s ─────────────────────────────────────────────
# ⚠️ A 200 IS NOT A RESULT. The whole point of this sprint was a build that was VALID and
# IN_BETA_TESTING and still unreachable, so the proof is what Apple serves afterwards.
puts "=== READ BACK — WHICH GROUPS SERVE BUILD #{a['version']} NOW ==="
serving = []
all.each do |grp|
  bc, b = ASC.get("/v1/builds?filter[betaGroups]=#{grp['id']}&limit=50", tok)
  if bc != 200
    puts "  #{grp.dig('attributes', 'name')} — ⚠️ could not read (HTTP #{bc}) — UNKNOWN, not a no"
    next
  end
  hit = (b["data"] || []).any? { |x| x["id"] == build["id"] }
  puts "  #{grp.dig('attributes', 'name')} (#{grp.dig('attributes', 'isInternalGroup') ? 'INTERNAL' : 'EXTERNAL'}) — " \
       "#{hit ? "SERVES build #{a['version']}" : 'does not serve it'}"
  serving << grp.dig("attributes", "name") if hit
end
puts
puts serving.empty? ? "RESULT: no group serves build #{a['version']}." \
                    : "RESULT: build #{a['version']} is served by #{serving.join(', ')}."

# ── 6. THE THING THAT WILL GO STALE AGAIN ──────────────────────────────────────────────────
# ⚠️ ALWAYS REPORTED, NEVER SILENTLY FIXED. An external group cannot be given a build without
# Beta App Review, so the pipeline must not quietly submit one on every push. But a public link
# that serves only EXPIRED builds is a real defect — a stranger who clicks it installs nothing —
# and it stayed invisible for months precisely because nothing said it out loud. So say it.
puts
puts "=== EXTERNAL GROUPS — ARE THEY STALE? ==="
all.reject { |grp| grp.dig("attributes", "isInternalGroup") }.each do |grp|
  bc, b = ASC.get("/v1/builds?filter[betaGroups]=#{grp['id']}&limit=50&sort=-uploadedDate", tok)
  if bc != 200
    puts "  #{grp.dig('attributes', 'name')} — ⚠️ could not read (HTTP #{bc}) — UNKNOWN"
    next
  end
  served = b["data"] || []
  live   = served.reject { |x| x.dig("attributes", "expired") }
  newest = served.first && served.first.dig("attributes", "version")
  if live.empty?
    puts "  #{grp.dig('attributes', 'name')} — ⚠️ SERVES NOTHING INSTALLABLE. Newest build attached " \
         "is #{newest || 'none'}, and every build it serves has expired."
    puts "     A tester in this group — including anyone arriving through its public link — gets"
    puts "     \"No TestFlight builds are available for this app\"."
    puts "     Fixing it means attaching a current build, which needs BETA APP REVIEW: usually"
    puts "     under a day, sometimes a couple of days, and it can be rejected. Run the"
    puts "     \"Manage TestFlight\" workflow with action=distribute and submit_beta_review=true."
  elsif newest != a["version"]
    puts "  #{grp.dig('attributes', 'name')} — newest attached build is #{newest}, not #{a['version']}."
  else
    puts "  #{grp.dig('attributes', 'name')} — current (serves #{a['version']})."
  end
end

unless failures.empty?
  puts
  puts "::error::distribution finished with problems:"
  failures.each { |f| puts "  - #{f}" }
  exit 1
end
