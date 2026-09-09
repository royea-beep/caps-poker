# frozen_string_literal: true
#
# THE APP STORE LISTING — READ ONLY. Nothing here writes, patches, posts or submits.
#
# ⚠️ WHY THIS EXISTS. Everything else in tools/asc/ is about TestFlight — who can install which
# build. This reads the OTHER surface: what a stranger sees on the App Store before they install.
# As of 2026-09-08 nobody on this project had ever opened it, while the icon, the home screen, the
# tab bar and the results screen were all replaced. A listing describes a product; if the product
# moved and the listing did not, the listing is a claim that is no longer true.
#
# ⚠️ EVERY CALL PRINTS ITS HTTP STATUS, AND THAT IS THE POINT (lib.rb's rule, restated):
# A FAILED READ IS AN UNKNOWN, NEVER A FINDING. "no screenshots" and "I could not ask about
# screenshots" are different sentences and this script must never merge them. Endpoints that do
# not exist on this API version are reported as the status Apple returned, not as an empty result.
#
# Run: ruby tools/asc/store_listing.rb    (needs APPLE_API_KEY_ID, APPLE_API_ISSUER_ID and the .p8)

require_relative "lib"

APP_ID = ENV.fetch("ASC_APP_ID", "6760429619")
TOK    = ASC.token
OUT    = { app_id: APP_ID, reads: [], listing: {} }

def read(label, path)
  code, body = ASC.get(path, TOK)
  OUT[:reads] << { label: label, path: path, http: code }
  puts format("READ %-38s HTTP %-3s  %s", label, code, path)
  [code, body]
end

def attrs(obj) = (obj || {})["attributes"] || {}

puts "=" * 100
puts "APP STORE LISTING — READ ONLY — app #{APP_ID}"
puts "=" * 100

# ── the app record ───────────────────────────────────────────────────────────────────────────
code, app = read("app", "/v1/apps/#{APP_ID}")
if code == 200
  a = attrs(app["data"])
  OUT[:listing][:app] = {
    name: a["name"], bundle_id: a["bundleId"], sku: a["sku"],
    primary_locale: a["primaryLocale"], content_rights: a["contentRightsDeclaration"],
    subscription_status_url: a["subscriptionStatusUrl"],
  }
end

# ── appInfo: categories, age rating, review state of the metadata itself ──────────────────────
code, infos = read("appInfos", "/v1/apps/#{APP_ID}/appInfos?include=primaryCategory,secondaryCategory,ageRatingDeclaration&limit=10")
info_ids = []
if code == 200
  included = (infos["included"] || []).each_with_object({}) { |i, h| h["#{i['type']}/#{i['id']}"] = i }
  OUT[:listing][:app_infos] = (infos["data"] || []).map do |i|
    info_ids << i["id"]
    rel = i["relationships"] || {}
    ref = ->(k) { rel.dig(k, "data") }
    prim = ref.call("primaryCategory"); sec = ref.call("secondaryCategory"); age = ref.call("ageRatingDeclaration")
    {
      id: i["id"],
      state: attrs(i)["appStoreState"] || attrs(i)["state"],
      app_store_age_rating: attrs(i)["appStoreAgeRating"],
      brazil_age_rating: attrs(i)["brazilAgeRating"] || attrs(i)["brazilAgeRatingV2"],
      kids_age_band: attrs(i)["kidsAgeBand"],
      primary_category: prim && (prim["id"]),
      secondary_category: sec && (sec["id"]),
      age_rating_declaration: age && attrs(included["appAgeRatingDeclarations/#{age['id']}"] || included["ageRatingDeclarations/#{age['id']}"]),
      age_rating_declaration_id: age && age["id"],
    }
  end
end

# ── age rating declaration, fetched directly so a missing `include` cannot hide it ────────────
OUT[:listing][:age_rating] = []
OUT[:listing][:app_infos]&.each do |i|
  next unless i[:age_rating_declaration_id]
  c, d = read("ageRatingDeclaration #{i[:id][0, 8]}", "/v1/appInfos/#{i[:id]}/ageRatingDeclaration")
  OUT[:listing][:age_rating] << { app_info: i[:id], http: c, declaration: (c == 200 ? attrs(d["data"]) : nil) }
end

# ── appInfoLocalizations: NAME, SUBTITLE, privacy policy URL ──────────────────────────────────
OUT[:listing][:info_localizations] = []
info_ids.each do |iid|
  c, loc = read("appInfoLocalizations #{iid[0, 8]}", "/v1/appInfos/#{iid}/appInfoLocalizations?limit=50")
  next unless c == 200
  (loc["data"] || []).each do |l|
    la = attrs(l)
    OUT[:listing][:info_localizations] << {
      app_info: iid, locale: la["locale"], name: la["name"], subtitle: la["subtitle"],
      privacy_policy_url: la["privacyPolicyUrl"], privacy_policy_text: la["privacyPolicyText"],
      privacy_choices_url: la["privacyChoicesUrl"],
    }
  end
end

# ── every App Store version, newest first ─────────────────────────────────────────────────────
code, vers = read("appStoreVersions", "/v1/apps/#{APP_ID}/appStoreVersions?limit=10")
version_ids = []
if code == 200
  OUT[:listing][:versions] = (vers["data"] || []).map do |v|
    version_ids << v["id"]
    va = attrs(v)
    { id: v["id"], version: va["versionString"], state: va["appStoreState"] || va["appVersionState"],
      platform: va["platform"], release_type: va["releaseType"], created: va["createdDate"],
      downloadable: va["downloadable"], earliest_release: va["earliestReleaseDate"] }
  end
end

# ── per-version localizations: DESCRIPTION, KEYWORDS, WHAT'S NEW, SUPPORT URL ─────────────────
OUT[:listing][:version_localizations] = []
OUT[:listing][:screenshots] = []
version_ids.each do |vid|
  c, locs = read("versionLocalizations #{vid[0, 8]}", "/v1/appStoreVersions/#{vid}/appStoreVersionLocalizations?limit=50")
  next unless c == 200
  (locs["data"] || []).each do |l|
    la = attrs(l)
    OUT[:listing][:version_localizations] << {
      version: vid, localization: l["id"], locale: la["locale"],
      description: la["description"], keywords: la["keywords"], whats_new: la["whatsNew"],
      promotional_text: la["promotionalText"], support_url: la["supportUrl"], marketing_url: la["marketingUrl"],
    }
    # ── screenshots, per localization, per device size ─────────────────────────────────────────
    sc, sets = read("screenshotSets #{la['locale']}", "/v1/appStoreVersionLocalizations/#{l['id']}/appScreenshotSets?limit=50")
    next unless sc == 200
    (sets["data"] || []).each do |s|
      ssa = attrs(s)
      pc, shots = read("screenshots #{ssa['screenshotDisplayType']}", "/v1/appScreenshotSets/#{s['id']}/appScreenshots?limit=50")
      list = pc == 200 ? (shots["data"] || []) : []
      OUT[:listing][:screenshots] << {
        version: vid, locale: la["locale"], display_type: ssa["screenshotDisplayType"],
        set_id: s["id"], http: pc, count: list.size,
        shots: list.map do |sh|
          sha = attrs(sh)
          img = sha["imageAsset"] || {}
          { id: sh["id"], file_name: sha["fileName"], file_size: sha["fileSize"],
            state: sha.dig("assetDeliveryState", "state"), uploaded: sha["uploaded"],
            width: img["width"], height: img["height"], template_url: img["templateUrl"] }
        end,
      }
    end
  end
end

# ── privacy: the parts the public API actually exposes, each with its status ───────────────────
OUT[:listing][:privacy] = {}
[["appDataUsages (filter)", "/v1/appDataUsages?filter[app]=#{APP_ID}&limit=50"],
 ["endUserLicenseAgreement", "/v1/apps/#{APP_ID}/endUserLicenseAgreement"],
 ["appEncryptionDeclarations", "/v1/apps/#{APP_ID}/appEncryptionDeclarations?limit=5"]].each do |label, path|
  c, b = read(label, path)
  OUT[:listing][:privacy][label] = { http: c, data: (c == 200 ? b["data"] : nil) }
end

puts
puts "=" * 100
puts "JSON"
puts "=" * 100
puts JSON.pretty_generate(OUT)
