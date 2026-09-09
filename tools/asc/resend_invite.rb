# frozen_string_literal: true
#
# RESEND AN UNACCEPTED TESTFLIGHT INVITATION — the automatic fix.
#
# ⚠️ THIS ADDS, REMOVES AND MODIFIES NOTHING. The tester already exists; POST
# /v1/betaTesterInvitations only makes Apple send the invitation email again.
#
# ⚠️ AND THE TAP ON THE PHONE IS STILL REQUIRED. That tap is how Apple binds a tester to a device.
# It is not a gap in the automation and no API can do it. `state` stays INVITED until it happens.
#
# Verification re-reads the tester FROM APPLE rather than trusting the POST's 2xx.

require_relative "lib"

app_id = ENV.fetch("ASC_APP_ID")
email  = ENV.fetch("TESTER_EMAIL")
tok    = ASC.token

code, t = ASC.get("/v1/betaTesters?filter[apps]=#{app_id}&filter[email]=#{ASC.esc(email)}", tok)
abort("tester lookup failed: HTTP #{code} #{t}") unless code == 200
tester = (t["data"] || []).first
abort("#{email} is not a tester on this app — nothing to resend") if tester.nil?

puts "BEFORE  #{email}  state=#{tester.dig('attributes', 'state').inspect}  " \
     "inviteType=#{tester.dig('attributes', 'inviteType').inspect}"

pc, pr = ASC.post("/v1/betaTesterInvitations", tok, {
  data: { type: "betaTesterInvitations", relationships: {
    app:        { data: { type: "apps",        id: app_id } },
    betaTester: { data: { type: "betaTesters", id: tester["id"] } }
  } }
})
puts "POST /v1/betaTesterInvitations -> HTTP #{pc}"
unless pc.between?(200, 299)
  puts pr.inspect
  abort("resend failed")
end

sleep 5
_, t2 = ASC.get("/v1/betaTesters?filter[apps]=#{app_id}&filter[email]=#{ASC.esc(email)}", tok)
after = (t2["data"] || []).first
puts "AFTER (re-read from Apple)  state=#{after&.dig('attributes', 'state').inspect}  " \
     "inviteType=#{after&.dig('attributes', 'inviteType').inspect}"
puts
puts "The invitation email has been sent to #{email}."
puts "state stays INVITED until it is ACCEPTED ON A DEVICE. That tap cannot be done from an API."
