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

def patch!(label, path, payload)
  code, body = ASC.request(:patch, path, TOK, payload)
  puts format("  PATCH %-34s HTTP %-3s %s", label, code, path)
  # ⚠️ The status is PRINTED, never TRUSTED. The read-back below is the verdict.
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
  cats = get!("appCategories", "/v1/appCategories?filter[platforms]=IOS&include=subcategories&limit=50")
  subs = (cats["included"] || []).select { |i| i["type"] == "appCategories" }
  all  = ((cats["data"] || []) + subs)
  find = lambda do |id|
    hit = all.find { |c| c["id"] == id }
    die("category #{id} not offered by Apple for IOS — refusing to guess an id") if hit.nil?
    hit["id"]
  end
  primary   = find.call("GAMES_CARD")
  secondary = find.call("GAMES_STRATEGY")
  puts "  resolved primary   #{primary}"
  puts "  resolved secondary #{secondary}"

  before = get!("before", "/v1/appInfos/#{APP_INFO_ID}?include=primaryCategory,secondaryCategory")
  rel = before.dig("data", "relationships") || {}
  puts
  puts "BEFORE  primary=#{rel.dig('primaryCategory', 'data', 'id').inspect} secondary=#{rel.dig('secondaryCategory', 'data', 'id').inspect}"
  puts "INTEND  primary=#{primary.inspect} secondary=#{secondary.inspect}"
  puts

  unless APPLY
    puts "PREVIEW ONLY — nothing written."
    exit 0
  end

  patch!("write categories", "/v1/appInfos/#{APP_INFO_ID}",
         { data: { type: "appInfos", id: APP_INFO_ID,
                   relationships: {
                     primaryCategory:   { data: { type: "appCategories", id: primary } },
                     secondaryCategory: { data: { type: "appCategories", id: secondary } },
                   } } })

  puts
  after = get!("read-back", "/v1/appInfos/#{APP_INFO_ID}?include=primaryCategory,secondaryCategory")
  arel = after.dig("data", "relationships") || {}
  gotp = arel.dig("primaryCategory", "data", "id")
  gots = arel.dig("secondaryCategory", "data", "id")
  puts
  puts "AFTER   primary=#{gotp.inspect} secondary=#{gots.inspect}"
  if gotp == primary && gots == secondary
    puts "✅ LANDED."
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
