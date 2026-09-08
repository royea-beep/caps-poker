# frozen_string_literal: true
#
# THE LISTING COPY — PARSED FROM THE PACK AT RUNTIME, NEVER RETYPED HERE.
#
# ⚠️ ONE SOURCE OF TRUTH, ON PURPOSE. docs/listing/LISTING-PACK-2026-09-08.md is the document Roye
# reviews and the document a human would paste from. If this file held its own copy of the strings,
# the two would drift the first time a word changed and nobody would know which one shipped — the
# same shape as a filename that stops matching its bytes, which has cost this project six times.
# So the pack is READ and PARSED. Editing the pack changes what gets written; there is no second
# place to remember.
#
# ⚠️ THE DESCRIPTION IS UNWRAPPED, AND THAT IS NOT COSMETIC. The pack is markdown, hard-wrapped at
# about 100 columns for reading. Apple renders a description literally: every one of those wrap
# newlines would appear mid-sentence on the App Store page. So prose lines are rejoined, while the
# things that are DELIBERATE line breaks — blank lines, "•" bullets and the all-caps section
# headings — are preserved exactly.
#
# tests/listing-copy.test.ts pins the parse: it re-derives every field and fails if the pack stops
# yielding what Apple is sent.

require "json"

module ListingCopy
  PACK = File.expand_path("../../docs/listing/LISTING-PACK-2026-09-08.md", __dir__)

  # Apple's own limits. A value over its limit is refused HERE, before the PATCH goes out.
  LIMITS = {
    "description"      => 4000,
    "keywords"         => 100,
    "promotional-text" => 170,
    "subtitle"         => 30,
    "name"             => 30,
    "whats-new"        => 4000,
  }.freeze

  def self.pack_text
    @pack_text ||= File.read(PACK, encoding: "UTF-8")
  end

  def self.fenced_blocks
    @fenced_blocks ||= pack_text.scan(/```\n(.*?)\n```/m).map { |m| m[0] }
  end

  # Rejoin wrapped prose; keep blank lines, bullets and ALL-CAPS headings as their own lines.
  def self.unwrap(text)
    out = []
    cur = nil
    heading = /\A[A-Z0-9 ,'’&-]+\z/
    flush = lambda do
      out << cur unless cur.nil?
      cur = nil
    end
    text.split("\n").each do |raw|
      line = raw.rstrip
      if line.strip.empty?
        flush.call
        out << ""
      elsif line.start_with?("•")
        flush.call
        cur = line
      elsif heading.match?(line.strip)
        flush.call
        out << line.strip
      else
        cur = cur.nil? ? line.strip : "#{cur} #{line.strip}"
      end
    end
    flush.call
    out.join("\n").strip
  end

  def self.app_name
    m = pack_text.match(/\*\*Name \(30 max\):\*\* `([^`]+)`/)
    raise "pack: name not found" if m.nil?
    m[1]
  end

  def self.subtitle
    m = pack_text.match(/\*\*Subtitle \(30 max\):\*\* `([^`]+)`/)
    raise "pack: subtitle not found" if m.nil?
    m[1]
  end

  # ⚠️ Fenced blocks are addressed by ORDER and then VERIFIED BY CONTENT, so a new block inserted
  # into the pack cannot silently shift the description into the keywords field.
  def self.block!(index, must_start_with)
    b = fenced_blocks[index]
    raise "pack: block #{index} missing" if b.nil?
    got = b.strip
    unless got.start_with?(must_start_with)
      raise "pack: block #{index} does not start with #{must_start_with.inspect} (got #{got[0, 60].inspect})"
    end
    got
  end

  def self.values
    @values ||= {
      "description"      => unwrap(block!(0, "CAPS is multi-board poker.")),
      "promotional-text" => block!(1, "Four cards on every board."),
      "keywords"         => block!(2, "multiboard,omaha"),
      "whats-new"        => block!(3, "• A new look for the table"),
      "privacy-url"      => block!(4, "https://caps.ftable.co.il/privacy.html"),
      "subtitle"         => subtitle,
      "name"             => app_name,

      # ⚠️ THE SUPPORT URL IS THE LANDING PAGE, AND THAT IS A COMPROMISE, NOT A CHOICE.
      # The pack recommends a dedicated https://caps.ftable.co.il/support.html. Measured today it
      # returns HTTP 404 — the page does not exist. landing.html returns HTTP 200 and does carry
      # the contact address caps@ftable.co.il, so it is honest and reachable; it is also marketing,
      # and Apple has rejected support URLs that only sell. Reported, not hidden.
      "support-url"      => "https://caps.ftable.co.il/landing.html",
      "marketing-url"    => "https://caps.ftable.co.il/landing.html",
    }.freeze
  end

  def self.fetch(field)
    v = values[field]
    raise "no copy defined for field #{field.inspect}" if v.nil?
    limit = LIMITS[field]
    if limit && v.length > limit
      raise "#{field} is #{v.length} characters, over Apple's limit of #{limit} — refusing to send"
    end
    v
  end
end

if $PROGRAM_NAME == __FILE__
  ListingCopy.values.each do |k, v|
    lim = ListingCopy::LIMITS[k]
    puts "#{k}: #{v.length} chars#{lim ? " (limit #{lim})" : ""}"
    puts v.lines.map { |l| "    #{l}" }.join
    puts
  end
end
