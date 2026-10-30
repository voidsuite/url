import { describe, expect, test } from "bun:test"
import { normalizeDestination, sanitizeReferrer, UrlValidationError } from "./url.js"

describe("normalizeDestination", () => {
  test("adds https to a bare hostname", () => {
    expect(normalizeDestination("example.com")).toBe("https://example.com/")
  })

  test("keeps valid http and https URLs, including query and hash", () => {
    expect(normalizeDestination("http://example.com/path?x=1#section")).toBe(
      "http://example.com/path?x=1#section",
    )
    expect(normalizeDestination("  https://example.com/a  ")).toBe("https://example.com/a")
  })

  test("rejects non-http protocols", () => {
    expect(() => normalizeDestination("ftp://example.com/file")).toThrow(UrlValidationError)
    expect(() => normalizeDestination("mailto:hello@example.com")).toThrow(UrlValidationError)
    expect(() => normalizeDestination("javascript:alert(1)")).toThrow(UrlValidationError)
  })

  test("rejects empty input and control characters", () => {
    expect(() => normalizeDestination("   ")).toThrow(UrlValidationError)
    expect(() => normalizeDestination("https://exa\u0000mple.com")).toThrow(UrlValidationError)
  })

  test("rejects embedded credentials", () => {
    expect(() => normalizeDestination("https://user:pass@example.com")).toThrow(UrlValidationError)
  })

  test("rejects localhost and private network hosts", () => {
    for (const value of [
      "http://localhost:3000",
      "http://127.0.0.1",
      "http://10.0.0.5",
      "http://192.168.1.10",
      "http://172.16.4.2",
      "http://169.254.169.254",
      "http://printer.local",
      "http://[::1]",
    ]) {
      expect(() => normalizeDestination(value)).toThrow(UrlValidationError)
    }
  })

  test("enforces the configured maximum length", () => {
    expect(() =>
      normalizeDestination(`https://example.com/${"a".repeat(40)}`, { maxLength: 40 }),
    ).toThrow(UrlValidationError)
  })
})

describe("sanitizeReferrer", () => {
  test("returns a normalized hostname without www", () => {
    expect(sanitizeReferrer("https://www.example.com/post?x=1")).toEqual({
      referrer: "https://www.example.com/post?x=1",
      host: "example.com",
    })
  })

  test("rejects missing, malformed and non-http referrers", () => {
    expect(sanitizeReferrer(undefined)).toEqual({ referrer: null, host: null })
    expect(sanitizeReferrer("not a url")).toEqual({ referrer: null, host: null })
    expect(sanitizeReferrer("mailto:hello@example.com")).toEqual({ referrer: null, host: null })
  })
})