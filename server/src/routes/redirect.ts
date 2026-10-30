import { Hono } from "hono"
import type { AppEnv } from "../types.js"
import { getDomainByHostname, isDomainUsable } from "../db/domains.js"
import { getLinkBySlug, statusOf } from "../db/links.js"
import { countryFromHeaders, languageFromHeaders, parseUserAgent } from "../lib/analytics.js"
import { recordClick } from "../db/clicks.js"
import { clientIp } from "../middleware/auth.js"
import { isReservedSlug, normalizeSlug } from "../lib/ids.js"
import { gonePage, hostNotConfiguredPage, notFoundPage } from "../lib/pages.js"
import { sanitizeReferrer } from "../lib/url.js"
import { hostFromHeader } from "../config.js"

const redirect = new Hono<AppEnv>()

redirect.on(["GET", "HEAD"], "/:slug", async (c, next) => {
  const slug = normalizeSlug(c.req.param("slug"))
  const isAppHost = c.get("isAppHost") === true

  // Single-segment app routes are served by the SPA, not treated as codes.
  if (isAppHost && isReservedSlug(slug)) {
    await next()
    return
  }

  const host = hostFromHeader(c.req.header("host"))
  const domain = getDomainByHostname(host)
  if (!isDomainUsable(domain)) {
    c.header("Cache-Control", "no-store")
    return c.html(hostNotConfiguredPage(host), 404)
  }

  const link = getLinkBySlug(domain.id, slug)
  if (!link) {
    c.header("Cache-Control", "no-store")
    return c.html(notFoundPage(), 404)
  }

  const status = statusOf(link)
  if (status !== "active") {
    c.header("Cache-Control", "no-store")
    return c.html(gonePage(status === "expired" ? "expired" : "disabled"), 410)
  }

  if (c.req.method === "GET") {
    try {
      const userAgent = c.req.header("user-agent") || null
      const parsed = parseUserAgent(userAgent)
      const referrer = sanitizeReferrer(c.req.header("referer"))
      recordClick({
        linkId: link.id,
        domainId: domain.id,
        ip: clientIp(c),
        userAgent,
        referrer: referrer.referrer,
        referrerHost: referrer.host,
        country: countryFromHeaders(c.req.raw.headers),
        device: parsed.device,
        browser: parsed.browser,
        os: parsed.os,
        language: languageFromHeaders(c.req.raw.headers),
        isBot: parsed.isBot,
        clickedAt: Date.now(),
      })
    } catch (err) {
      console.error("[redirect] click tracking failed", err)
    }
  }

  c.header("Cache-Control", "no-store, max-age=0")
  c.header("X-Robots-Tag", "noindex, nofollow")
  return c.redirect(link.destination, 302)
})

export default redirect
