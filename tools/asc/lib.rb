# frozen_string_literal: true
#
# APP STORE CONNECT — the shared client.
#
# ⚠️ RAW REST WITH A SELF-SIGNED ES256 JWT, NOT THE SPACESHIP MODEL WRAPPER, and that is
# deliberate: build.get_beta_groups raises NoMethodError on the Spaceship version fastlane
# installs, and it already cost one report. Asking a wrapper that may not expose the field that
# matters is how you get a confident answer to the wrong question.
#
# ⚠️ AND ONE HARD-WON RULE LIVES HERE: A FAILED READ IS AN UNKNOWN, NEVER A FINDING.
# `get` returns the status code alongside the body precisely so callers can tell "Apple said no"
# apart from "I could not ask". An earlier version of this code turned an HTTP 403 into an empty
# list and then reported "not attached to any internal beta group" — a failed read presented as a
# fact. Every caller here must keep those two apart.
#
# These scripts live in files rather than inside the workflow YAML because GitHub compiles a `run:`
# block as a single expression and caps it at 21,000 characters; inlining them broke the workflow.

require "jwt"
require "net/http"
require "json"
require "uri"
require "openssl"

module ASC
  HOST = "api.appstoreconnect.apple.com"

  def self.token
    key_id    = ENV.fetch("APPLE_API_KEY_ID")
    issuer_id = ENV.fetch("APPLE_API_ISSUER_ID")
    path      = File.expand_path("~/private_keys/AuthKey_#{key_id}.p8")
    raise "missing #{path}" unless File.exist?(path)
    JWT.encode(
      { iss: issuer_id, exp: Time.now.to_i + 900, aud: "appstoreconnect-v1" },
      OpenSSL::PKey::EC.new(File.read(path)), "ES256", { kid: key_id, typ: "JWT" }
    )
  end

  def self.request(method, path, tok, payload = nil)
    uri = URI("https://#{HOST}#{path}")
    klass = { get: Net::HTTP::Get, post: Net::HTTP::Post, patch: Net::HTTP::Patch }.fetch(method)
    req = klass.new(uri)
    req["Authorization"] = "Bearer #{tok}"
    req["Content-Type"] = "application/json"
    req.body = payload.to_json if payload
    res = Net::HTTP.start(uri.host, uri.port, use_ssl: true) { |h| h.request(req) }
    body = begin
      res.body.to_s.empty? ? {} : JSON.parse(res.body)
    rescue StandardError
      { "raw" => res.body }
    end
    [res.code.to_i, body]
  end

  def self.get(path, tok)  = request(:get, path, tok)
  def self.post(path, tok, payload) = request(:post, path, tok, payload)

  def self.esc(s) = URI.encode_www_form_component(s)
end
