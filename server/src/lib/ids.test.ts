import { describe, expect, test } from "bun:test"
import { isReservedSlug, isValidSlug, normalizeSlug, randomSlug } from "./ids.js"

describe("randomSlug", () => {
  test("generates lowercase base-36 codes at the requested length", () => {
    for (const length of [7, 9]) {
      const slug = randomSlug(length)
      expect(slug).toHaveLength(length)
      expect(slug).toMatch(/^[0-9a-z]+$/)
    }
  })

  test("generates distinct values", () => {
    const values = new Set(Array.from({ length: 200 }, () => randomSlug()))
    expect(values.size).toBe(200)
  })
})

describe("normalizeSlug", () => {
  test("trims and lowercases", () => {
    expect(normalizeSlug("  My-Link  ")).toBe("my-link")
  })
})

describe("isValidSlug", () => {
  test("accepts readable alphanumeric slugs", () => {
    for (const slug of ["abc", "a1b", "my-link", "my_link", "launch2026", "a".repeat(32)]) {
      expect(isValidSlug(slug)).toBe(true)
    }
  })

  test("rejects invalid lengths, casing and separators", () => {
    for (const slug of [
      "",
      "a",
      "ab",
      "-abc",
      "abc-",
      "_abc",
      "abc_",
      "ab--cd",
      "ab__cd",
      "UPPER",
      "has space",
      "a".repeat(33),
    ]) {
      expect(isValidSlug(slug)).toBe(false)
    }
  })
})

describe("isReservedSlug", () => {
  test("matches reserved app routes case-insensitively", () => {
    expect(isReservedSlug("Dashboard")).toBe(true)
    expect(isReservedSlug("api")).toBe(true)
    expect(isReservedSlug("my-launch")).toBe(false)
  })
})