# frozen_string_literal: true
#
# CAPS vs 9SOCCER — why one reaches the phone and the other does not.
#
# Same device, same Apple ID, same TestFlight app: one project's builds arrive and the other's do
# not. That rules the device out. Whatever differs has to be in how the two apps are configured in
# App Store Connect, so this puts them side by side and prints what Apple holds.
#
# ⚠️ READ-ONLY, AND 9SOCCER IS READ AND NEVER WRITTEN. It is a different product.

require_relative "lib"

# ⚠️ AN EMPTY WORKFLOW INPUT ARRIVES AS "", NOT AS UNSET, so ENV.fetch's default never fired and
# the first run queried filter[email]= with nothing after it. Apple answered HTTP 400 and the one
# field that decides this whole question came back unreadable. Treat blank as absent.
raw = ENV["TESTER_EMAIL"].to_s.strip
EMAIL = raw.empty? ? "royearguan@gmail.com" : raw
CAPS_ID = ENV.fetch("ASC_APP_ID")
tok = ASC.token

code, apps = ASC.get("/v1/apps?limit=200", tok)
abort("apps query failed: HTTP #{code} #{apps}") unless code == 200
list = apps["data"] || []

puts "=== EVERY APP THIS KEY CAN SEE (#{list.length}) ==="
list.each do |a|
  at = a["attributes"]
  puts "  #{a['id'].to_s.ljust(12)} #{at['bundleId'].to_s.ljust(36)} #{at['name']}"
end
puts

# ⚠️ THERE ARE THREE SOCCER APPS ON THIS ACCOUNT — 9Soccer-Mascots, 9Soccer and 90Soccer — and the
# first run matched the first one it saw and compared against it. Picking one and calling it "the"
# 9soccer is a guess dressed as a comparison. So the tester state is now read for EVERY app the key
# can see, and the table below shows which apps this Apple ID has actually INSTALLED. That answers
# "what is different" without needing to know in advance which app reaches the phone.
puts "=== #{EMAIL} — STATE ON EVERY APP ==="
puts "  #{'app'.ljust(26)} #{'bundle'.ljust(34)} #{'state'.ljust(12)} groups"
summary = []
list.each do |a|
  tc, t = ASC.get("/v1/betaTesters?filter[apps]=#{a['id']}&filter[email]=#{ASC.esc(EMAIL)}&include=betaGroups", tok)
  if tc != 200
    puts "  #{a.dig('attributes', 'name').to_s[0, 25].ljust(26)} #{a.dig('attributes', 'bundleId').to_s.ljust(34)} ⚠️ HTTP #{tc} (unknown)"
    next
  end
  rec = (t["data"] || []).first
  if rec.nil?
    puts "  #{a.dig('attributes', 'name').to_s[0, 25].ljust(26)} #{a.dig('attributes', 'bundleId').to_s.ljust(34)} #{'NOT A TESTER'.ljust(12)}"
    next
  end
  inc = t["included"] || []
  gids = (rec.dig("relationships", "betaGroups", "data") || []).map { |d| d["id"] }
  gn = inc.select { |i| i["type"] == "betaGroups" && gids.include?(i["id"]) }
          .map { |i| "#{i.dig('attributes', 'name')}#{i.dig('attributes', 'isInternalGroup') ? '(int)' : '(ext)'}" }
  st = rec.dig("attributes", "state").to_s
  puts "  #{a.dig('attributes', 'name').to_s[0, 25].ljust(26)} #{a.dig('attributes', 'bundleId').to_s.ljust(34)} #{st.ljust(12)} #{gn.join(', ')}"
  summary << [a.dig("attributes", "name"), st]
end
puts
installed = summary.select { |_, st| st == "INSTALLED" }.map(&:first)
invited   = summary.select { |_, st| st == "INVITED"   }.map(&:first)
puts "  INSTALLED on: #{installed.empty? ? '(none)' : installed.join(', ')}"
puts "  INVITED (never accepted) on: #{invited.empty? ? '(none)' : invited.join(', ')}"
puts

caps = list.find { |a| a["id"] == CAPS_ID }
soccers = list.select do |a|
  "#{a.dig('attributes', 'name')} #{a.dig('attributes', 'bundleId')}".downcase =~ /soccer/
end

def dump(label, app, tok, email)
  return puts("==================== #{label}: NOT FOUND ====================") if app.nil?

  at = app["attributes"]
  puts "==================== #{label} ===================="
  puts "  name / bundle          #{at['name']} / #{at['bundleId']}"
  puts "  app id                 #{app['id']}"
  puts "  sku                    #{at['sku']}"
  puts "  primaryLocale          #{at['primaryLocale']}"
  puts "  contentRights          #{at['contentRightsDeclaration'].inspect}"

  puts "  --- BETA GROUPS ---"
  gcode, g = ASC.get("/v1/apps/#{app['id']}/betaGroups?limit=50", tok)
  if gcode != 200
    puts "    ⚠️ could not read: HTTP #{gcode} (unknown, not a finding)"
  elsif (g["data"] || []).empty?
    puts "    NONE"
  else
    (g["data"] || []).each do |grp|
      ga = grp["attributes"]
      puts "    #{ga['name']}"
      puts "      id                    #{grp['id']}"
      puts "      isInternalGroup       #{ga['isInternalGroup']}"
      puts "      hasAccessToAllBuilds  #{ga['hasAccessToAllBuilds'].inspect}"
      puts "      publicLinkEnabled     #{ga['publicLinkEnabled'].inspect}"
      puts "      publicLink            #{ga['publicLink'].inspect}"
      puts "      createdDate           #{ga['createdDate']}"
      bcode, b = ASC.get("/v1/builds?filter[betaGroups]=#{grp['id']}&limit=5&sort=-uploadedDate", tok)
      if bcode == 200
        vs = (b["data"] || []).map { |x| x.dig("attributes", "version") }
        puts "      BUILDS IT SERVES      #{vs.empty? ? 'NONE' : vs.join(', ')}"
      else
        puts "      BUILDS IT SERVES      ⚠️ could not read: HTTP #{bcode} (unknown)"
      end
    end
  end

  puts "  --- TESTER #{email} ---"
  tcode, t = ASC.get("/v1/betaTesters?filter[apps]=#{app['id']}&filter[email]=#{ASC.esc(email)}&include=betaGroups", tok)
  if tcode != 200
    puts "    ⚠️ could not read: HTTP #{tcode} (unknown, not a finding)"
  elsif (t["data"] || []).empty?
    puts "    ⚠️ NOT A TESTER ON THIS APP"
  else
    inc = t["included"] || []
    (t["data"] || []).each do |x|
      xa = x["attributes"]
      gids = (x.dig("relationships", "betaGroups", "data") || []).map { |d| d["id"] }
      gn = inc.select { |i| i["type"] == "betaGroups" && gids.include?(i["id"]) }
              .map { |i| i.dig("attributes", "name") }
      puts "    tester id    #{x['id']}"
      puts "    name         #{[xa['firstName'], xa['lastName']].compact.join(' ')}"
      puts "    inviteType   #{xa['inviteType'].inspect}"
      puts "    STATE        #{xa['state'].inspect}   <- INSTALLED = the invite was accepted on a device; INVITED = it never was"
      puts "    groups       #{gn.join(', ')}"
    end
  end

  puts "  --- NEWEST BUILDS ---"
  bcode, b = ASC.get("/v1/builds?filter[app]=#{app['id']}&limit=3&sort=-uploadedDate&include=buildBetaDetail", tok)
  if bcode != 200
    puts "    ⚠️ could not read: HTTP #{bcode} (unknown, not a finding)"
  else
    inc = b["included"] || []
    (b["data"] || []).each do |bd|
      ba = bd["attributes"]
      rel = bd.dig("relationships", "buildBetaDetail", "data")
      da = rel && inc.find { |i| i["type"] == "buildBetaDetails" && i["id"] == rel["id"] }&.dig("attributes")
      puts "    build #{ba['version']}  processing=#{ba['processingState']}  expired=#{ba['expired']}  " \
           "compliance=#{ba['usesNonExemptEncryption'].inspect}  minOs=#{ba['minOsVersion']}"
      puts "      internalBuildState  #{da && da['internalBuildState']}"
      puts "      externalBuildState  #{da && da['externalBuildState']}"
      g2c, g2 = ASC.get("/v1/betaGroups?filter[builds]=#{bd['id']}&limit=20", tok)
      names = if g2c == 200
                (g2["data"] || []).map { |x| "#{x.dig('attributes', 'name')}#{x.dig('attributes', 'isInternalGroup') ? '(int)' : '(ext)'}" }
              else
                ["⚠️ could not read HTTP #{g2c}"]
              end
      puts "      attached to groups  #{names.empty? ? 'NONE' : names.join(', ')}"
    end
  end
  puts
end

dump("CAPS", caps, tok, EMAIL)
soccers.each { |a| dump("SOCCER: #{a.dig('attributes', 'name')}", a, tok, EMAIL) }
