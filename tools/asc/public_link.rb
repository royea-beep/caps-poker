# frozen_string_literal: true
#
# THE PUBLIC LINK — TURN IT OFF (OR BACK ON), AND PROVE IT FROM APPLE.
#
# ⚠️ WHY IT IS BEING TURNED OFF: every build behind it had expired, so a stranger who clicked it
# joined the external group and was offered NOTHING. That is worse than no link — a dead link
# fails visibly, this one succeeds and then shows an empty page, which reads as a broken product.
# Build 515 is attached now but parked at READY_FOR_BETA_SUBMISSION, and Beta App Review has NOT
# been requested: that queue carries Roye's name and he has not asked for it.
#
# ⚠️ A 204 IS NOT A RESULT. Apple accepted a PATCH once and still served a stale field. So this
# reads the group back afterwards and prints what Apple holds, and the exit code depends on the
# READ-BACK, never on the write's status code.
#
# ENV
#   ASC_APP_ID    required
#   LINK_ENABLED  "false" to disable (default), "true" to re-enable
#   GROUP_NAME    which external group; blank = the only external group on the app

require_relative "lib"

APP    = ENV.fetch("ASC_APP_ID")
WANT   = ENV["LINK_ENABLED"].to_s.strip.downcase == "true"
GNAME  = ENV["GROUP_NAME"].to_s.strip

tok = ASC.token

gcode, g = ASC.get("/v1/apps/#{APP}/betaGroups?limit=50", tok)
abort("::error::could not read beta groups: HTTP #{gcode} — an UNKNOWN, not a finding") unless gcode == 200

external = (g["data"] || []).reject { |x| x.dig("attributes", "isInternalGroup") }
external = external.select { |x| x.dig("attributes", "name") == GNAME } unless GNAME.empty?
abort("::error::no external beta group#{GNAME.empty? ? '' : " named #{GNAME}"} on this app") if external.empty?

def show(label, grp)
  a = grp["attributes"]
  puts "  #{label}"
  puts "    name                #{a['name']}"
  puts "    publicLinkEnabled   #{a['publicLinkEnabled'].inspect}"
  puts "    publicLink          #{a['publicLink'].inspect}"
  puts "    publicLinkLimit     #{a['publicLinkLimit'].inspect} (limitEnabled #{a['publicLinkLimitEnabled'].inspect})"
end

failed = false
external.each do |grp|
  puts "=== #{grp.dig('attributes', 'name')} — #{grp['id']} ==="
  show("BEFORE", grp)

  if grp.dig("attributes", "publicLinkEnabled") == WANT
    puts "  already #{WANT ? 'ENABLED' : 'DISABLED'}. Nothing to do."
    puts
    next
  end

  code, res = ASC.request(:patch, "/v1/betaGroups/#{grp['id']}", tok,
                          { data: { type: "betaGroups", id: grp["id"],
                                    attributes: { publicLinkEnabled: WANT } } })
  puts "  PATCH publicLinkEnabled=#{WANT} -> HTTP #{code}"
  puts "  ⚠️ #{(res.dig('errors', 0, 'detail') || res).to_s[0, 300]}" unless code.between?(200, 299)

  # ── READ BACK FROM APPLE. This, not the PATCH, is the result. ──────────────────────────────
  rcode, r = ASC.get("/v1/betaGroups/#{grp['id']}", tok)
  if rcode != 200
    puts "  ⚠️ could not read the group back: HTTP #{rcode} — the state is UNKNOWN, not confirmed"
    failed = true
    next
  end
  show("AFTER (read back from Apple)", r["data"])
  actual = r.dig("data", "attributes", "publicLinkEnabled")
  if actual == WANT
    puts "  ✅ Apple reports publicLinkEnabled = #{actual.inspect}."
    puts "     The link no longer resolves for anyone who has not already joined." unless WANT
  else
    puts "  ❌ Apple still reports publicLinkEnabled = #{actual.inspect}, wanted #{WANT.inspect}."
    failed = true
  end
  puts
end

# ⚠️ WHAT DISABLING DOES NOT DO, stated so nobody reports more than happened: it does not remove
# anyone who already joined, and it does not touch the builds attached to the group.
puts "=== TESTERS ON THIS APP (disabling a link removes nobody) ==="
tcode, t = ASC.get("/v1/betaTesters?filter[apps]=#{APP}&limit=200", tok)
if tcode == 200
  (t["data"] || []).each do |x|
    a = x["attributes"]
    puts "  #{(a['email'] || '(no email)').to_s.ljust(30)} invite=#{a['inviteType'].to_s.ljust(12)} state=#{a['state'].inspect}"
  end
  puts "  TOTAL #{(t['data'] || []).length}"
else
  puts "  ⚠️ could not read testers: HTTP #{tcode} (UNKNOWN)"
end

exit(failed ? 1 : 0)
