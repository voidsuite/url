import { describe, expect, test } from "bun:test"
import config, { hostFromHeader, publicBaseForHost } from "./config.js"

describe("hostFromHeader", () => {
  test("strips ports, proxies and trailing dots", () => {
    expect(hostFromHeader("Example.COM:443")).toBe("example.com")
    expect(hostFromHeader("a.example.com, proxy.internal")).toBe("a.example.com")
    expect(hostFromHeader("example.com.")).toBe("example.com")
  })

  test("handles a missing header", () => {
    expect(hostFromHeader(undefined)).toBe("")
    expect(hostFromHeader("")).toBe("")
  })
})

describe("publicBaseForHost", () => {
  test("uses the configured origin for built-in domains", () => {
    const builtin = config.shortDomains[0]
    expect(publicBaseForHost(builtin.hostname)).toBe(builtin.origin)
  })

  test("uses https for custom domains", () => {
    expect(publicBaseForHost("links.example.com")).toBe("https://links.example.com")
    expect(publicBaseForHost("brand.example.org")).toBe("https://brand.example.org")
  })
})

describe("configuration", () => {
  test("has at least one short domain and a default", () => {
    expect(config.shortDomains.length).toBeGreaterThan(0)
    expect(config.shortDomains.some((domain) => domain.isDefault)).toBe(true)
    expect(config.defaultDomainHost.length).toBeGreaterThan(0)
  })

  test("keeps the anonymous limits ordered minute < hour < day", () => {
    expect(config.limits.anonPerMinute).toBeLessThan(config.limits.anonPerHour)
    expect(config.limits.anonPerHour).toBeLessThan(config.limits.anonPerDay)
  })

  test("exposes a sane analytics window", () => {
    expect(config.analytics.defaultDays).toBeGreaterThanOrEqual(1)
    expect(config.analytics.maxDays).toBeGreaterThanOrEqual(config.analytics.defaultDays)
  })
})