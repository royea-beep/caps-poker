# frozen_string_literal: true
#
# WHICH BUILDS CAN THIS APPLE ID ACTUALLY INSTALL — AND THROUGH WHICH GROUP.
#
# ⚠️ THIS EXISTS BECAUSE `internalBuildState` IS NOT PROOF THAT A GIVEN TESTER CAN INSTALL.
# Build 515 was VALID and IN_BETA_TESTING while the phone read "No TestFlight builds are
# available for this app". Both statements were true at the same time. `build-state` asks
# "is this build installable by SOMEBODY internal"; that is a different question from
# "is this build installable by ROYE", and the second one is the one the phone answers.
#
# ENTITLEMENT IS PER-TESTER-PER-GROUP, NOT PER-BUILD:
#
#     builds this tester can install
#       = builds served by every group this tester BELONGS TO
#       + builds this tester is assigned to INDIVIDUALLY
#       - builds that have EXPIRED
#
# A tester in an external group sees only what that external group serves, no matter how
# healthy a build looks on the internal side. That is the whole bug.
#
# ⚠️ EVERY TESTER RECORD ON THE APP IS READ, NOT ONLY THE ONE MATCHING THE EMAIL.
# Accepting a PUBLIC LINK creates its OWN tester record — anonymous, no email — and that
# record, not the emailed one, can be what the device is bound to. Filtering by email would
# have hidden the exact row that explains the phone.
#
# ⚠️ AND A FAILED READ IS AN UNKNOWN, NEVER A FINDING. Same rule as lib.rb.

require_relative "lib"

raw   = ENV["TESTER_EMAIL"].to_s.strip
EMAIL = raw.empty? ? "royearguan@gmail.com" : raw
APP   = ENV.fetch("ASC_APP_ID")
WANT  = ENV["BUILD_NUMBER"].to_s.strip

# ⚠️ ATTACHING A BUILD TO AN EXTERNAL GROUP DOES NOT DELIVER IT. Apple parks it at
# READY_FOR_BETA_SUBMISSION until Beta App Review passes, and only then does the group actually
# serve it. Treating the attachment as delivery would repeat this sprint's whole mistake one
# level down: a relationship that exists, an entitlement that does not.
DELIVERING = %w[READY_FOR_BETA_TESTING IN_BETA_TESTING].freeze

tok = ASC.token

def build_line(b)
  a = b["attributes"]
  "#{a['version'].to_s.rjust(4)}  v#{a['preReleaseVersion'] || ''}" \
    "#{a['processingState'].to_s.ljust(12)} expired=#{a['expired'].to_s.ljust(6)} " \
    "expires=#{a['expirationDate']}"
end

# ── 1. THE GROUPS, AND WHAT EACH ONE SERVES ────────────────────────────────────────────────
gcode, g = ASC.get("/v1/apps/#{APP}/betaGroups?limit=50", tok)
abort("⚠️ could not read beta groups: HTTP #{gcode} — this is an UNKNOWN, not a finding") unless gcode == 200

groups = {}
puts "=== BETA GROUPS ON THIS APP, AND THE BUILDS EACH ONE SERVES ==="
(g["data"] || []).each do |grp|
  ga = grp["attributes"]
  bc, b = ASC.get("/v1/builds?filter[betaGroups]=#{grp['id']}&limit=30&sort=-uploadedDate" \
                  "&include=buildBetaDetail", tok)
  serves = nil
  if bc == 200
    inc = b["included"] || []
    serves = (b["data"] || []).map do |bd|
      rel = bd.dig("relationships", "buildBetaDetail", "data")
      det = rel && inc.find { |i| i["type"] == "buildBetaDetails" && i["id"] == rel["id"] }
      bd.merge("betaDetail" => det && det["attributes"])
    end
  end
  groups[grp["id"]] = {
    "name" => ga["name"], "internal" => ga["isInternalGroup"],
    "all_builds" => ga["hasAccessToAllBuilds"], "serves" => serves
  }
  puts "  #{ga['name']} — #{ga['isInternalGroup'] ? 'INTERNAL' : 'EXTERNAL'} — " \
       "hasAccessToAllBuilds=#{ga['hasAccessToAllBuilds'].inspect} — id #{grp['id']}"
  if serves.nil?
    puts "    ⚠️ builds it serves: could not read (HTTP #{bc}) — UNKNOWN, not 'none'"
  elsif serves.empty?
    puts "    builds it serves: NONE"
  else
    serves.each do |bd|
      ba = bd["attributes"]
      st = ga["isInternalGroup"] ? bd.dig("betaDetail", "internalBuildState") \
                                 : bd.dig("betaDetail", "externalBuildState")
      flag = if ba["expired"] then "  ← EXPIRED, a phone cannot install it"
             elsif !DELIVERING.include?(st) then "  ← #{st} — attached but NOT yet delivered"
             else "" end
      puts "    #{ba['version'].to_s.rjust(5)}  #{ba['processingState'].to_s.ljust(11)} " \
           "expired=#{ba['expired'].to_s.ljust(5)} #{st.to_s.ljust(26)} expires #{ba['expirationDate']}#{flag}"
    end
  end
end
puts

# ── 2. EVERY TESTER RECORD ON THE APP ──────────────────────────────────────────────────────
tcode, t = ASC.get("/v1/betaTesters?filter[apps]=#{APP}&limit=200&include=betaGroups", tok)
abort("⚠️ could not read testers: HTTP #{tcode} — UNKNOWN, not a finding") unless tcode == 200

records = t["data"] || []
puts "=== EVERY TESTER RECORD ON THIS APP (#{records.length}) ==="
puts "  ⚠️ a PUBLIC_LINK acceptance makes its own record with no email — that is why this is"
puts "     the full list and not a filter[email] query."
records.each do |r|
  ra   = r["attributes"]
  gids = (r.dig("relationships", "betaGroups", "data") || []).map { |d| d["id"] }
  gn   = gids.map { |id| groups[id] ? "#{groups[id]['name']}(#{groups[id]['internal'] ? 'int' : 'ext'})" : id }
  puts "  #{(ra['email'] || '(no email — anonymous)').to_s.ljust(30)} " \
       "#{[ra['firstName'], ra['lastName']].compact.join(' ').to_s.ljust(16)} " \
       "invite=#{ra['inviteType'].to_s.ljust(12)} state=#{ra['state'].inspect.ljust(12)} " \
       "groups=#{gn.empty? ? 'NONE' : gn.join(', ')}"
end
puts

# ── 2b. IS AN "INTERNAL" TESTER ACTUALLY INTERNAL? ─────────────────────────────────────────
# ⚠️ THE BRIEF'S EXACT WARNING: do not assume the listing means the phone is treated as internal.
# Apple only serves internal builds to testers who are ALSO App Store Connect users on this team.
# A betaTester row can sit inside an internal group while the Apple ID behind it is not a team
# member — the row is real, the entitlement it implies is not. So the group listing is checked
# against the team roster, and a name that is in one but not the other is called out.
ucode, u = ASC.get("/v1/users?limit=200&include=visibleApps", tok)
asc_users = nil
if ucode == 200
  asc_users = (u["data"] || []).map do |x|
    xa = x["attributes"]
    vis = (x.dig("relationships", "visibleApps", "data") || []).map { |d| d["id"] }
    { "email" => xa["username"].to_s.downcase, "roles" => xa["roles"],
      "all_apps" => xa["allAppsVisible"], "apps" => vis }
  end
  puts "=== APP STORE CONNECT TEAM USERS (#{asc_users.length}) — WHO CAN BE AN INTERNAL TESTER ==="
  asc_users.each do |x|
    scope = x["all_apps"] ? "all apps" : (x["apps"].include?(APP) ? "this app" : "NOT this app")
    puts "  #{x['email'].ljust(30)} roles=#{Array(x['roles']).join(',').ljust(24)} sees #{scope}"
  end
else
  puts "=== APP STORE CONNECT TEAM USERS ==="
  puts "  ⚠️ could not read (HTTP #{ucode}) — whether the internal group's members are real team"
  puts "     users is an UNKNOWN, not a no."
end
puts

# ── 3. THE PROVER — WHAT CAN *THIS* APPLE ID INSTALL RIGHT NOW ─────────────────────────────
mine = records.select { |r| r.dig("attributes", "email").to_s.downcase == EMAIL.downcase }
anon = records.select { |r| r.dig("attributes", "email").to_s.strip.empty? }

puts "=== ENTITLEMENT FOR #{EMAIL} ==="
if mine.empty?
  puts "  ⚠️ NO TESTER RECORD CARRIES THIS EMAIL. The phone can only be bound through an"
  puts "     anonymous public-link record (#{anon.length} of those exist), and Apple does not"
  puts "     tell us which Apple ID owns one. That is an UNKNOWN, not a NO."
end

entitled = {} # build version => [reasons]
mine.each do |r|
  ra   = r["attributes"]
  gids = (r.dig("relationships", "betaGroups", "data") || []).map { |d| d["id"] }
  puts "  record #{r['id']} — invite=#{ra['inviteType']} state=#{ra['state'].inspect}"
  if gids.empty?
    puts "    belongs to NO group — this record entitles nothing by itself"
  end
  gids.each do |gid|
    grp = groups[gid]
    next puts("    group #{gid} — ⚠️ not in the app's group list (UNKNOWN)") if grp.nil?
    if grp["serves"].nil?
      puts "    via #{grp['name']} — ⚠️ builds unreadable, entitlement through it is UNKNOWN"
      next
    end
    unexpired = grp["serves"].reject { |b| b.dig("attributes", "expired") }
    live = unexpired.select do |b|
      DELIVERING.include?(grp["internal"] ? b.dig("betaDetail", "internalBuildState")
                                          : b.dig("betaDetail", "externalBuildState"))
    end
    withheld = unexpired - live
    reason = if !grp["serves"].empty? && unexpired.empty? then "NONE (every build it serves has expired)"
             elsif live.empty? then "NONE"
             else live.map { |b| b.dig("attributes", "version") }.join(", ") end
    puts "    via #{grp['name']} (#{grp['internal'] ? 'INTERNAL' : 'EXTERNAL'}) — installable: #{reason}"
    withheld.each do |b|
      st = grp["internal"] ? b.dig("betaDetail", "internalBuildState") : b.dig("betaDetail", "externalBuildState")
      puts "      #{b.dig('attributes', 'version')} is ATTACHED to this group but NOT delivered — #{st}"
    end

    # ⚠️ AN INTERNAL GROUP ENTITLES NOTHING TO A NON-TEAM APPLE ID.
    if grp["internal"]
      if asc_users.nil?
        puts "      ⚠️ cannot confirm this Apple ID is an App Store Connect team user — the roster"
        puts "         read failed, so entitlement through an INTERNAL group is UNKNOWN, not proven."
      else
        me = asc_users.find { |x| x["email"] == EMAIL.downcase }
        if me.nil?
          puts "      ⚠️ #{EMAIL} IS NOT AN APP STORE CONNECT TEAM USER. Apple lists the tester in"
          puts "         this internal group, but internal builds are served to team members only."
          puts "         THE MEMBERSHIP IS REAL AND THE ENTITLEMENT IS NOT."
          next
        elsif !me["all_apps"] && !me["apps"].include?(APP)
          puts "      ⚠️ #{EMAIL} is a team user but this app is NOT in their visible apps."
          next
        end
      end
    end

    live.each { |b| (entitled[b.dig("attributes", "version")] ||= []) << grp["name"] }
  end
end

# Individually-assigned builds — the other half of entitlement.
unless WANT.empty?
  bc, bb = ASC.get("/v1/builds?filter[app]=#{APP}&limit=50&sort=-uploadedDate", tok)
  target = bc == 200 ? (bb["data"] || []).find { |x| x.dig("attributes", "version") == WANT } : nil
  if target
    ic, ib = ASC.get("/v1/betaTesters?filter[builds]=#{target['id']}&limit=200", tok)
    if ic == 200
      names = (ib["data"] || []).map { |x| x.dig("attributes", "email") || "(anonymous)" }
      puts "  individually assigned to build #{WANT}: #{names.empty? ? 'nobody' : names.join(', ')}"
      if names.any? { |n| n.to_s.downcase == EMAIL.downcase }
        (entitled[WANT] ||= []) << "individual assignment"
      end
    else
      puts "  ⚠️ individual assignment for build #{WANT}: could not read (HTTP #{ic}) — UNKNOWN"
    end
  end
end

puts
puts "=== VERDICT ==="
if entitled.empty?
  puts "  #{EMAIL} is entitled to install NOTHING right now."
else
  puts "  #{EMAIL} can install: " +
       entitled.map { |v, why| "#{v} (via #{why.uniq.join(' + ')})" }.join(", ")
end
unless WANT.empty?
  if entitled.key?(WANT)
    puts "  ✅ BUILD #{WANT} IS AMONG THEM — via #{entitled[WANT].uniq.join(' + ')}."
  else
    puts "  ❌ BUILD #{WANT} IS **NOT** AMONG THEM. Being VALID and IN_BETA_TESTING does not"
    puts "     entitle a tester who is not in a group that serves it."
  end
end
