import { describe, expect, test } from "bun:test"
import { qrSvg } from "./qr.js"

describe("qrSvg", () => {
  test("renders a sized SVG for a short link", async () => {
    const svg = await qrSvg("https://v0id.cc/abc1234", 256)
    expect(svg).toContain("<svg")
    expect(svg).toContain('width="256"')
    expect(svg).toContain("#1c1917")
  })
})