/**
 * /api/qr — public QR images for any live short link. Looks up by domain+slug
 * so the anonymous result card can render a code without an account.
 */

import { Hono } from "hono"
import { getDomainByHostname, isDomainUsable } from "../db/domains.js"
import { getLinkBySlug, statusOf } from "../db/links.js"
import { qrSvg } from "../lib/qr.js"
import { publicBaseForHost } from "../config.js"
import { normalizeSlug } from "../lib/ids.js"
import { clientIp, hashIp } from "../middleware/auth.js"
import { consumeAll } from "../db/rate-limits.js"

const qr = new Hono()

qr.get("/", async (c) => {
  const hostname = (c.req.query("domain") || "").trim().toLowerCase()
  const slug = normalizeSlug(c.req.query("slug") || "")
  const size = Math.min(Math.max(Number(c.req.query("size")) || 512, 128), 1024)
  if (!hostname || !slug) return c.json({ error: "Missing domain or slug" }, 400)

  const limit = consumeAll(`qr:${hashIp(clientIp(c))}`, [
    { scope: "minute", limit: 120, windowMs: 60 * 1000 },
  ])
  if (!limit.allowed) return c.json({ error: "Too many requests" }, 429)

  const domain = getDomainByHostname(hostname)
  if (!isDomainUsable(domain)) return c.json({ error: "Unknown domain" }, 404)
  const link = getLinkBySlug(domain.id, slug)
  if (!link || statusOf(link) === "disabled") return c.json({ error: "Link not found" }, 404)

  const url = `${publicBaseForHost(domain.hostname)}/${link.slug}`
  const svg = await qrSvg(url, size)
  c.header("Content-Type", "image/svg+xml; charset=utf-8")
  c.header("Cache-Control", "public, max-age=3600")
  c.header("X-Robots-Tag", "noindex")
  return c.body(svg)
})

export default qr
