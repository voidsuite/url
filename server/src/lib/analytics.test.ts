import { describe, expect, test } from "bun:test"
import { countryFromHeaders, languageFromHeaders, parseUserAgent } from "./analytics.js"

const CHROME_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
const SAFARI_IPAD =
  "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
const CHROME_ANDROID_TABLET =
  "Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
const CHROME_ANDROID_PHONE =
  "Mozilla/5.0 (Linux; Android 13; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
const GOOGLEBOT =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"

describe("parseUserAgent", () => {
  test("detects desktop Chrome on Windows", () => {
    expect(parseUserAgent(CHROME_WINDOWS)).toEqual({
      device: "desktop",
      browser: "Chrome",
      os: "Windows",
      isBot: false,
    })
  })

  test("detects iPhone Safari as mobile", () => {
    expect(parseUserAgent(SAFARI_IPHONE)).toEqual({
      device: "mobile",
      browser: "Safari",
      os: "iOS",
      isBot: false,
    })
  })

  test("detects iPad as tablet", () => {
    expect(parseUserAgent(SAFARI_IPAD).device).toBe("tablet")
    expect(parseUserAgent(SAFARI_IPAD).os).toBe("iOS")
  })

  test("distinguishes Android tablets from phones", () => {
    expect(parseUserAgent(CHROME_ANDROID_TABLET)).toMatchObject({
      device: "tablet",
      browser: "Chrome",
      os: "Android",
    })
    expect(parseUserAgent(CHROME_ANDROID_PHONE)).toMatchObject({
      device: "mobile",
      browser: "Chrome",
      os: "Android",
    })
  })

  test("flags bots and buckets them as other", () => {
    expect(parseUserAgent(GOOGLEBOT)).toMatchObject({ isBot: true, device: "other" })
  })

  test("handles a missing user agent", () => {
    expect(parseUserAgent(null)).toEqual({
      device: "other",
      browser: "Unknown",
      os: "Unknown",
      isBot: false,
    })
  })
})

describe("countryFromHeaders", () => {
  test("reads and normalizes edge country headers", () => {
    expect(countryFromHeaders(new Headers({ "cf-ipcountry": "us" }))).toBe("US")
    expect(countryFromHeaders(new Headers({ "x-vercel-ip-country": "gb" }))).toBe("GB")
    expect(countryFromHeaders(new Headers({ "x-country-code": "DE" }))).toBe("DE")
  })

  test("ignores missing and malformed values", () => {
    expect(countryFromHeaders(new Headers())).toBeNull()
    expect(countryFromHeaders(new Headers({ "cf-ipcountry": "USA" }))).toBeNull()
    expect(countryFromHeaders(new Headers({ "cf-ipcountry": "1" }))).toBeNull()
  })
})

describe("languageFromHeaders", () => {
  test("takes the first language tag", () => {
    expect(languageFromHeaders(new Headers({ "accept-language": "en-GB,en;q=0.9,de;q=0.8" }))).toBe("en-GB")
  })

  test("returns null when absent", () => {
    expect(languageFromHeaders(new Headers())).toBeNull()
  })
})