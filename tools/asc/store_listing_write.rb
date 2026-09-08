# frozen_string_literal: true
#
# THE APP STORE LISTING — THE WRITER. ONE FIELD PER RUN.
#
# ⚠️ THIS IS THE ONLY SCRIPT IN tools/asc/ THAT CHANGES ROYE'S PUBLIC LISTING. Read the three rules
# before changing a line of it.
#
# 1. ONE FIELD PER INVOCATION, ENFORCED BY THE TOOL AND NOT BY CARE. Apple offers no dry run, so
#    "find out whether the credential can write" and "write to the live listing" are the same act.
#    The smallest possible version of that act is one field. A run that wrote five fields and hit a
#    permission wall on the third would leave a half-filled listing, which is worse than an empty
#    one. So the field is an input, exactly one is accepted, and the caller decides to continue.
#
# 2. THE VERDICT COMES FROM A SEPARATE READ-BACK, NEVER FROM THE PATCH STATUS. An anonymous PATCH
#    on `leaderboard` returned HTTP 204 on 2026-09-08 and changed nothing — RLS matched zero rows —
#    and reporting that status code would have filed a catastrophic false positive. A 2xx is not a
#    write. This script PATCHes, then issues a FRESH GET, and its exit code depends only on whether
#    the value Apple serves back equals the value that was sent.
#
# 3. IT CANNOT SUBMIT, SELECT A BUILD, CHANGE A VERSION STATE, OR TOUCH PRICING. There is no code
#    here that posts an appStoreVersionSubmission, writes `appStoreState`, sets a build
#    relationship, or reaches a price endpoint. The field registry below is a closed list and an
#    unknown field is refused before any network call.
#
# ⚠️ AND THE ONE THING IT DELIBERATELY WILL NOT DO: set an age rating VALUE. `ageRatingOverride` is
# never written. The age-rating field answers the QUESTIONNAIRE — the same question a human answers
# in App Store Connect — and lets Apple compute the rating. A wrong age rating can get an app
# pulled; a computed one cannot be wrong for the answers given.
#
# Env: ASC_FIELD (required), ASC_APPLY ("true" writes; anything else is a read-only preview).

require_relative "lib"
require_relative "listing_copy"

APP_ID = ENV.fetch("ASC_APP_ID", "6760429619")
FIELD  = ENV.fetch("ASC_FIELD", "").strip
APPLY  = ENV.fetch("ASC_APPLY", "false").strip == "true"
LOCALE = ENV.fetch("ASC_LOCALE", "en-US")
TOK    = ASC.token

# ── the closed registry. An unknown field never reaches the network. ──────────────────────────
VERSION_LOC_FIELDS = {
  "description"      => "description",
  "keywords"         => "keywords",
  "promotional-text" => "promotionalText",
  "support-url"      => "supportUrl",
  "marketing-url"    => "marketingUrl",
  "whats-new"        => "whatsNew",
}.freeze

INFO_LOC_FIELDS = {
  "subtitle"    => "subtitle",
  "privacy-url" => "privacyPolicyUrl",
  "name"        => "name",
}.freeze

SPECIAL_FIELDS = %w[category age-rating].freeze

KNOWN = (VERSION_LOC_FIELDS.keys + INFO_LOC_FIELDS.keys + SPECIAL_FIELDS).freeze

def die(msg)
  puts "::error::#{msg}"
  exit 1
end

def get!(label, path)
  code, body = ASC.get(path, TOK)
  puts format("  READ  %-34s HTTP %-3s %s", label, code, path)
  die("read failed: #{label} HTTP #{code} #{body}") unless code == 200
  body
end

# Same as get!, named for the places where an unreadable answer must stop the run outright.
def read_or_die(label, path) = get!(label, path)

def patch!(label, path, payload)
  code, body = ASC.request(:patch, path, TOK, payload)
  puts format("  PATCH %-34s HTTP %-3s %s", label, code, path)
  # ⚠️ The status is PRINTED, never TRUSTED. The read-back below is the verdict.
  # ⚠️ AND WHEN APPLE REFUSES, PRINT WHAT APPLE SAID. The first category attempt came back
  # HTTP 409 and this function threw the reason away, which would have produced "the credential
  # cannot set a category" — a failed write reported as a permission finding, with the actual
  # cause unread. Apple's `errors` array carries a title, a detail and often the exact field.
  unless code.between?(200, 299)
    Array(body["errors"]).each_with_index do |e, i|
      puts "    APPLE SAYS [#{i}] #{e['status']} #{e['code']}"
      puts "      title:  #{e['title']}"
      puts "      detail: #{e['detail']}"
      puts "      source: #{e['source'].inspect}" if e["source"]
    end
    puts "    (raw: #{body.to_json[0, 600]})" if Array(body["errors"]).empty?
  end
  [code, body]
end

die("ASC_FIELD is required. Known fields: #{KNOWN.join(', ')}") if FIELD.empty?
die("unknown field #{FIELD.inspect}. Known fields: #{KNOWN.join(', ')}") unless KNOWN.include?(FIELD)

puts "=" * 100
puts "APP STORE LISTING WRITER — field #{FIELD} — locale #{LOCALE} — app #{APP_ID}"
puts APPLY ? "MODE: APPLY (this run writes to the live listing)" : "MODE: PREVIEW ONLY (no write)"
puts "=" * 100
puts

# ── resolve every id fresh. Nothing is hardcoded; the ids are printed so they can be checked. ──
puts "RESOLVING RECORDS"
infos = get!("appInfos", "/v1/apps/#{APP_ID}/appInfos?limit=10")
app_infos = infos["data"] || []
die("no appInfo on this app") if app_infos.empty?
# The editable appInfo is the one that is not already on the store. There is exactly one here;
# if that ever stops being true this refuses rather than picking.
die("expected exactly 1 appInfo, got #{app_infos.size}") unless app_infos.size == 1
APP_INFO_ID = app_infos.first["id"]
puts "  appInfo                        #{APP_INFO_ID}"

vers = get!("appStoreVersions", "/v1/apps/#{APP_ID}/appStoreVersions?limit=10")
editable = (vers["data"] || []).select do |v|
  st = (v["attributes"] || {})["appStoreState"] || (v["attributes"] || {})["appVersionState"]
  %w[PREPARE_FOR_SUBMISSION DEVELOPER_REJECTED REJECTED METADATA_REJECTED].include?(st)
end
die("no editable appStoreVersion (nothing in PREPARE_FOR_SUBMISSION)") if editable.empty?
die("expected exactly 1 editable version, got #{editable.size}") unless editable.size == 1
VERSION_ID = editable.first["id"]
VERSION_STR = (editable.first["attributes"] || {})["versionString"]
VERSION_STATE = (editable.first["attributes"] || {})["appStoreState"] || (editable.first["attributes"] || {})["appVersionState"]
puts "  appStoreVersion                #{VERSION_ID}  (#{VERSION_STR}, #{VERSION_STATE})"

def loc_id(list, locale, label)
  hit = (list["data"] || []).find { |l| (l["attributes"] || {})["locale"] == locale }
  hit && hit["id"]
end

info_locs = get!("appInfoLocalizations", "/v1/appInfos/#{APP_INFO_ID}/appInfoLocalizations?limit=50")
INFO_LOC_ID = loc_id(info_locs, LOCALE, "appInfoLocalization")
puts "  appInfoLocalization #{LOCALE}       #{INFO_LOC_ID.inspect}"

ver_locs = get!("versionLocalizations", "/v1/appStoreVersions/#{VERSION_ID}/appStoreVersionLocalizations?limit=50")
VER_LOC_ID = loc_id(ver_locs, LOCALE, "appStoreVersionLocalization")
puts "  appStoreVersionLocalization    #{VER_LOC_ID.inspect}"
puts

# ── work out the target, the current value and the intended value ─────────────────────────────
if VERSION_LOC_FIELDS.key?(FIELD)
  die("no #{LOCALE} appStoreVersionLocalization") if VER_LOC_ID.nil?
  target_path = "/v1/appStoreVersionLocalizations/#{VER_LOC_ID}"
  target_type = "appStoreVersionLocalizations"
  target_id   = VER_LOC_ID
  attribute   = VERSION_LOC_FIELDS[FIELD]
  intended    = ListingCopy.fetch(FIELD)
elsif INFO_LOC_FIELDS.key?(FIELD)
  die("no #{LOCALE} appInfoLocalization") if INFO_LOC_ID.nil?
  target_path = "/v1/appInfoLocalizations/#{INFO_LOC_ID}"
  target_type = "appInfoLocalizations"
  target_id   = INFO_LOC_ID
  attribute   = INFO_LOC_FIELDS[FIELD]
  intended    = ListingCopy.fetch(FIELD)
end

# ────────────────────────────────────────────────────────────────────────────────────────────
# THE SIMPLE CASE: one attribute on one localization record.
# ────────────────────────────────────────────────────────────────────────────────────────────
unless SPECIAL_FIELDS.include?(FIELD)
  before = get!("before", target_path)
  was = (before.dig("data", "attributes") || {})[attribute]
  puts
  puts "BEFORE  #{attribute} = #{was.inspect}"
  puts "INTEND  #{attribute} = #{intended.inspect}"
  puts "        (#{intended.length} characters)"
  puts

  unless APPLY
    puts "PREVIEW ONLY — nothing written. Re-run with apply=true to write this one field."
    exit 0
  end

  patch!("write #{attribute}", target_path,
         { data: { type: target_type, id: target_id, attributes: { attribute => intended } } })

  # ⚠️ A SEPARATE REQUEST. Not the PATCH's own response body — Apple has served a stale field back
  # from a write it accepted before, and the response to a write is not evidence that a later read
  # will agree with it.
  puts
  after = get!("read-back", target_path)
  now = (after.dig("data", "attributes") || {})[attribute]
  puts
  puts "AFTER   #{attribute} = #{now.inspect}"
  puts

  if now == intended
    puts "✅ LANDED — Apple serves back exactly what was sent."
    puts "   To revert this one field: set it to #{was.inspect} on #{target_path}"
    exit 0
  else
    puts "❌ DID NOT LAND. Apple serves #{now.inspect}, not what was sent."
    puts "   This is the answer the sprint was looking for: the credential cannot write this field."
    exit 1
  end
end

# ────────────────────────────────────────────────────────────────────────────────────────────
# CATEGORY — relationships on the appInfo, and the category ids are RESOLVED, never guessed.
# ────────────────────────────────────────────────────────────────────────────────────────────
if FIELD == "category"
  # ⚠️ AN ID THAT EXISTS IS NOT AN ID IN THE RIGHT ROLE, AND THE FIRST VERSION OF THIS GOT IT WRONG.
  # It listed appCategories with include=subcategories, merged `data` and `included` into one pool,
  # found "GAMES_CARD" in it and reported `resolved primary GAMES_CARD`. The id was real. Its ROLE
  # was not: GAMES_CARD is a SUBCATEGORY of GAMES, never a top-level category. Apple refused with
  # HTTP 409 ENTITY_ERROR.RELATIONSHIP.INVALID pointing at BOTH /data/relationships/primaryCategory
  # and /data/relationships/secondaryCategory, and the read-back showed nothing changed.
  #
  # Apple's real model, and App Store Connect's own screen: ONE primary category (Games) plus up to
  # TWO subcategories. "Games › Card" and "Games › Strategy" are those two subcategories — they are
  # not a primary and a secondary. `secondaryCategory` is a whole different top-level category and
  # CAPS does not want one, so it is not written at all.
  #
  # So top-level categories are read with exists[parent]=false, and each id is checked against the
  # place it must come from: GAMES from `data`, the two subcategories from GAMES's own
  # `subcategories` relationship. Anything else refuses rather than guessing a second time.
  cats = read_or_die("appCategories (top level)",
                     "/v1/appCategories?filter[platforms]=IOS&exists[parent]=false&limit=50")
  tops = (cats["data"] || []).map { |c| c["id"] }
  puts "  top-level iOS categories (#{tops.size}): #{tops.join(', ')}"
  die("GAMES is not a top-level iOS category in Apple's own list — refusing to guess") unless tops.include?("GAMES")

  # ⚠️ THE SUBCATEGORIES COME FROM THEIR OWN ENDPOINT, NOT FROM AN `include`, AND THE FIRST VERSION
  # OF THIS CHECK GOT IT WRONG A SECOND TIME. Reading them through include=subcategories returned
  # exactly TEN ids and no GAMES_CARD, and the guard duly refused. But a relationship array inside
  # an include is PAGED — ten is the default page size, not the catalogue. "Apple does not offer
  # Card" and "I read the first page of Apple's list" are different sentences and a guard that
  # cannot tell them apart produces a confident wrong finding. So this asks the relationship
  # endpoint directly, with an explicit limit, and PRINTS THE COUNT so a truncation is visible.
  subs_body = read_or_die("GAMES subcategories", "/v1/appCategories/GAMES/subcategories?limit=200")
  sub_ids = (subs_body["data"] || []).map { |c| c["id"] }
  puts "  GAMES subcategories Apple offers (#{sub_ids.size}): #{sub_ids.join(', ')}"
  if subs_body.dig("links", "next")
    die("Apple paged the subcategory list (a `next` link is present) — refusing to decide from a partial list")
  end
  %w[GAMES_CARD GAMES_STRATEGY].each do |want|
    next if sub_ids.include?(want)
    die("#{want} is NOT among the #{sub_ids.size} subcategories Apple offers for GAMES — refusing to guess")
  end
  puts "  primary        GAMES"
  puts "  subcategory 1  GAMES_CARD"
  puts "  subcategory 2  GAMES_STRATEGY"
  puts "  secondaryCategory: NOT WRITTEN — CAPS wants one category with two subcategories."

  incl = "include=primaryCategory,primarySubcategoryOne,primarySubcategoryTwo,secondaryCategory"
  before = read_or_die("before", "/v1/appInfos/#{APP_INFO_ID}?#{incl}")
  rel = before.dig("data", "relationships") || {}
  rid = ->(k) { rel.dig(k, "data", "id") }
  puts
  puts "BEFORE  primary=#{rid.call('primaryCategory').inspect} sub1=#{rid.call('primarySubcategoryOne').inspect} " \
       "sub2=#{rid.call('primarySubcategoryTwo').inspect} secondary=#{rid.call('secondaryCategory').inspect}"
  puts "INTEND  primary=\"GAMES\" sub1=\"GAMES_CARD\" sub2=\"GAMES_STRATEGY\" secondary=(untouched)"
  puts

  unless APPLY
    puts "PREVIEW ONLY — nothing written."
    exit 0
  end

  patch!("write category + subcategories", "/v1/appInfos/#{APP_INFO_ID}",
         { data: { type: "appInfos", id: APP_INFO_ID,
                   relationships: {
                     primaryCategory:       { data: { type: "appCategories", id: "GAMES" } },
                     primarySubcategoryOne: { data: { type: "appCategories", id: "GAMES_CARD" } },
                     primarySubcategoryTwo: { data: { type: "appCategories", id: "GAMES_STRATEGY" } },
                   } } })

  puts
  after = read_or_die("read-back", "/v1/appInfos/#{APP_INFO_ID}?#{incl}")
  arel = after.dig("data", "relationships") || {}
  aid = ->(k) { arel.dig(k, "data", "id") }
  got = { primary: aid.call("primaryCategory"), sub1: aid.call("primarySubcategoryOne"), sub2: aid.call("primarySubcategoryTwo") }
  puts
  puts "AFTER   primary=#{got[:primary].inspect} sub1=#{got[:sub1].inspect} sub2=#{got[:sub2].inspect} " \
       "secondary=#{aid.call('secondaryCategory').inspect}"
  if got == { primary: "GAMES", sub1: "GAMES_CARD", sub2: "GAMES_STRATEGY" }
    puts "✅ LANDED — Apple serves back Games / Card / Strategy."
    exit 0
  else
    puts "❌ DID NOT LAND."
    exit 1
  end
end

# ────────────────────────────────────────────────────────────────────────────────────────────
# AGE RATING — ANSWER THE QUESTIONNAIRE. NEVER SET A RATING.
# ────────────────────────────────────────────────────────────────────────────────────────────
if FIELD == "age-rating"
  decl = get!("ageRatingDeclaration", "/v1/appInfos/#{APP_INFO_ID}/ageRatingDeclaration")
  decl_id = decl.dig("data", "id")
  die("no ageRatingDeclaration on this appInfo") if decl_id.nil?
  attrs = decl.dig("data", "attributes") || {}

  puts
  puts "THE QUESTIONNAIRE AS APPLE HOLDS IT TODAY (#{attrs.keys.size} questions):"
  attrs.keys.sort.each { |k| puts format("  %-46s %s", k, attrs[k].inspect) }
  puts

  # ⚠️ THE KEY MUST EXIST ON THIS API VERSION. If Apple has renamed the question, this refuses
  # rather than inventing a field name — a wrong age rating can get an app pulled.
  unless attrs.key?("gamblingSimulated")
    die("this API version does not expose `gamblingSimulated` — refusing to guess a question name. Leave it for the dashboard.")
  end
  if attrs.key?("ageRatingOverride")
    puts "  (ageRatingOverride is #{attrs['ageRatingOverride'].inspect} and is NOT written by this script.)"
  end

  intended_answer = "FREQUENT_OR_INTENSE"
  puts
  puts "BEFORE  gamblingSimulated = #{attrs['gamblingSimulated'].inspect}"
  puts "INTEND  gamblingSimulated = #{intended_answer.inspect}   (the honest answer; Apple computes the rating)"
  puts

  unless APPLY
    puts "PREVIEW ONLY — nothing written."
    exit 0
  end

  code, body = patch!("answer gamblingSimulated", "/v1/ageRatingDeclarations/#{decl_id}",
                      { data: { type: "ageRatingDeclarations", id: decl_id,
                                attributes: { "gamblingSimulated" => intended_answer } } })
  puts "  (patch body: #{body.to_json[0, 400]})" unless code.between?(200, 299)

  puts
  after = get!("read-back declaration", "/v1/appInfos/#{APP_INFO_ID}/ageRatingDeclaration")
  now = (after.dig("data", "attributes") || {})["gamblingSimulated"]
  info_after = get!("read-back appInfo", "/v1/apps/#{APP_ID}/appInfos?limit=10")
  rating = (info_after["data"] || []).map { |i| (i["attributes"] || {})["appStoreAgeRating"] }
  puts
  puts "AFTER   gamblingSimulated  = #{now.inspect}"
  puts "        appStoreAgeRating  = #{rating.inspect}"
  puts

  if now == intended_answer
    puts "✅ THE QUESTION IS ANSWERED. Rating above is Apple's, computed — not set."
    puts "   ⚠️ If appStoreAgeRating is still null, Apple has not computed one yet: the remaining"
    puts "      questions may need answering too. That is a finding to report, not a thing to guess at."
    exit 0
  else
    puts "❌ THE ANSWER DID NOT LAND. Apple serves #{now.inspect}."
    exit 1
  end
end
