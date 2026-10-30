/**
 * /api/links — public creation (rate limited) and authenticated management.
 */

import { Hono } from "hono"
import { z } from "zod"
import config from "../config.js"
import { authOptional, authRequired, clientIp, getAuth, hasScope } from "../middleware/auth.js"
import { applyRateHeaders, creationLimit, retryAfterSeconds } from "../middleware/rate-limit.js"
import {
  countLinksForDomain,
  createLink,
  deleteLink,
  getLinkById,
  linkDto,
  listLinks,
  maxLinksReached,
  SlugTakenError,
  statusOf,
  updateLink,
  type LinkRow,
} from "../db/links.js"
import { getDomainByHostname, isDomainUsable, listPublicDomains, type DomainRow } from "../db/domains.js"
import { getLinkMetrics } from "../db/clicks.js"
import { isReservedSlug, isValidSlug, normalizeSlug } from "../lib/ids.js"
import { normalizeDestination, UrlValidationError } from "../lib/url.js"
import { audit } from "../db/audit.js"

const links = new Hono()

const createSchema = z.object({
  destination: z.string().min(1).max(config.limits.maxUrlLength),
  domain: z.string().max(253).optional(),
  slug: z.string().max(32).optional(),
  title: z.string().max(120).optional(),
  expiresInHours: z.number().int().min(1).max(24 * 365 * 10).nullable().optional(),
  anonId: z.string().max(64).optional(),
})

const updateSchema = z.object({
  destination: z.string().min(1).max(config.limits.maxUrlLength).optional(),
  slug: z.string().max(32).optional(),
  title: z.string().max(120).nullable().optional(),
  isActive: z.boolean().optional(),
  expiresInHours: z.number().int().min(1).max(24 * 365 * 10).nullable().optional(),
  domain: z.string().max(253).optional(),
})

function ownedBy(link: LinkRow, userId: string): boolean {
  return link.user_id === userId
}

function canManage(link: LinkRow, userId: string, isAdmin: boolean): boolean {
  return isAdmin || ownedBy(link, userId)
}

function resolveDomainForCreate(
  hostname: string | undefined,
  userId: string | null
): DomainRow {
  const domain = hostname ? getDomainByHostname(hostname) : getDefaultDomain()
  if (!isDomainUsable(domain)) throw new UrlValidationError("That short domain is not available.")
  if (domain.is_system !== 1) {
    if (!userId) throw new UrlValidationError("Sign in to use a custom domain.")
    if (domain.owner_user_id !== userId) throw new UrlValidationError("That domain is not yours.")
  }
  return domain
}

function getDefaultDomain(): DomainRow | null {
  const publicDomains = listPublicDomains()
  return (
    publicDomains.find((domain) => domain.hostname === config.defaultDomainHost) ||
    publicDomains[0] ||
    null
  )
}

function sameShortDomain(destination: string): boolean {
  try {
    const host = new URL(destination).hostname.toLowerCase()
    return config.shortDomains.some((domain) => domain.hostname === host)
  } catch {
    return false
  }
}

links.post("/", authOptional, async (c) => {
  const principal = getAuth(c)
  const limit = creationLimit(c)
  applyRateHeaders(c, limit)
  if (!limit.allowed) {
    c.header("Retry-After", String(retryAfterSeconds(limit.resetAt)))
    return c.json(
      {
        error: principal
          ? "You are creating links very quickly. Try again in a moment."
          : "You have reached the anonymous limit. Sign in for a higher limit, or try again later.",
        retryAfter: retryAfterSeconds(limit.resetAt),
        scope: limit.scope,
      },
      429
    )
  }

  const body = await c.req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: "Enter a valid URL." }, 400)
  const input = parsed.data

  let destination: string
  try {
    destination = normalizeDestination(input.destination, { maxLength: config.limits.maxUrlLength })
    if (sameShortDomain(destination)) {
      throw new UrlValidationError("That URL already points at a Void Links short domain.")
    }
  } catch (err) {
    return c.json({ error: err instanceof UrlValidationError ? err.message : "Enter a valid URL." }, 400)
  }

  if (principal && maxLinksReached(principal.user.id)) {
    return c.json(
      { error: `You have reached the ${config.limits.maxLinksPerUser.toLocaleString()} link limit.` },
      403
    )
  }

  let domain: DomainRow
  try {
    domain = resolveDomainForCreate(input.domain, principal?.user.id ?? null)
  } catch (err) {
    return c.json({ error: (err as Error).message }, 403)
  }

  let slug: string | null = null
  if (input.slug?.trim()) {
    if (!principal) {
      return c.json({ error: "Sign in to choose a custom slug." }, 403)
    }
    slug = normalizeSlug(input.slug)
    if (!isValidSlug(slug)) {
      return c.json(
        { error: "Use 3–32 lowercase letters, numbers, hyphens or underscores." },
        400
      )
    }
    if (isReservedSlug(slug)) return c.json({ error: "That slug is reserved." }, 409)
  }

  const expiresAt =
    input.expiresInHours && input.expiresInHours > 0
      ? Date.now() + input.expiresInHours * 60 * 60 * 1000
      : null

  const anonId =
    !principal && input.anonId && /^[a-zA-Z0-9-]{16,64}$/.test(input.anonId)
      ? input.anonId
      : null

  try {
    const link = createLink({
      userId: principal?.user.id ?? null,
      domainId: domain.id,
      destination,
      title: input.title ?? null,
      slug,
      expiresAt,
      anonId,
    })
    audit({
      actorId: principal?.user.id ?? null,
      actorEmail: principal?.user.email ?? null,
      action: "link.created",
      targetType: "link",
      targetId: link.id,
      meta: { domain: domain.hostname, slug: link.slug, anonymous: !principal },
      ip: clientIp(c),
      ua: c.req.header("user-agent") || null,
    })
    return c.json(
      {
        link: linkDto(link),
        claimable: !principal,
      },
      201
    )
  } catch (err) {
    if (err instanceof SlugTakenError) return c.json({ error: err.message }, 409)
    throw err
  }
})

links.get("/", authRequired, async (c) => {
  const principal = getAuth(c)
  if (!hasScope(principal, "links:read")) return c.json({ error: "Not permitted" }, 403)

  const query = c.req.query()
  const status = (["all", "active", "expired", "disabled"] as const).includes(
    query.status as "all"
  )
    ? (query.status as "all" | "active" | "expired" | "disabled")
    : "all"
  const sort = (["newest", "oldest", "clicks", "last_clicked", "expiry"] as const).includes(
    query.sort as "newest"
  )
    ? (query.sort as "newest" | "oldest" | "clicks" | "last_clicked" | "expiry")
    : "newest"

  const data = listLinks({
    userId: principal.user.id,
    page: Number(query.page) || 1,
    limit: Number(query.limit) || 20,
    search: query.search?.trim() || undefined,
    status,
    domain: query.domain?.trim() || undefined,
    sort,
  })

  return c.json({
    links: data.links.map(linkDto),
    total: data.total,
    page: data.page,
    limit: data.limit,
  })
})

links.get("/:id", authRequired, async (c) => {
  const principal = getAuth(c)
  if (!hasScope(principal, "links:read")) return c.json({ error: "Not permitted" }, 403)
  const link = getLinkById(c.req.param("id"))
  if (!link || !canManage(link, principal.user.id, principal.user.is_admin === 1)) {
    return c.json({ error: "Link not found" }, 404)
  }
  return c.json({ link: linkDto(link) })
})

links.get("/:id/metrics", authRequired, async (c) => {
  const principal = getAuth(c)
  if (!hasScope(principal, "stats:read")) return c.json({ error: "Not permitted" }, 403)
  const link = getLinkById(c.req.param("id"))
  if (!link || !canManage(link, principal.user.id, principal.user.is_admin === 1)) {
    return c.json({ error: "Link not found" }, 404)
  }
  const days = Math.min(
    Math.max(Number(c.req.query("days")) || config.analytics.defaultDays, 1),
    config.analytics.maxDays
  )
  return c.json({
    link: linkDto(link),
    metrics: getLinkMetrics(link, days),
    days,
  })
})

links.patch("/:id", authRequired, async (c) => {
  const principal = getAuth(c)
  if (!hasScope(principal, "links:write")) return c.json({ error: "Not permitted" }, 403)
  const link = getLinkById(c.req.param("id"))
  if (!link || !canManage(link, principal.user.id, principal.user.is_admin === 1)) {
    return c.json({ error: "Link not found" }, 404)
  }

  const body = await c.req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: "Check the values and try again." }, 400)
  const input = parsed.data

  let destination: string | undefined
  if (input.destination !== undefined) {
    try {
      destination = normalizeDestination(input.destination, { maxLength: config.limits.maxUrlLength })
      if (sameShortDomain(destination)) {
        throw new UrlValidationError("That URL already points at a Void Links short domain.")
      }
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400)
    }
  }

  let slug: string | undefined
  if (input.slug !== undefined) {
    slug = normalizeSlug(input.slug)
    if (!isValidSlug(slug)) {
      return c.json({ error: "Use 3–32 lowercase letters, numbers, hyphens or underscores." }, 400)
    }
    if (isReservedSlug(slug)) return c.json({ error: "That slug is reserved." }, 409)
  }

  let domainId: string | undefined
  if (input.domain !== undefined) {
    const domain = getDomainByHostname(input.domain)
    if (!isDomainUsable(domain)) return c.json({ error: "That short domain is not available." }, 400)
    if (domain.is_system !== 1 && domain.owner_user_id !== principal.user.id) {
      return c.json({ error: "That domain is not yours." }, 403)
    }
    domainId = domain.id
  }

  const expiresAt =
    input.expiresInHours === undefined
      ? undefined
      : input.expiresInHours === null
        ? null
        : Date.now() + input.expiresInHours * 60 * 60 * 1000

  try {
    const updated = updateLink(link.id, {
      destination,
      slug,
      title: input.title,
      isActive: input.isActive,
      expiresAt,
      domainId,
    })
    audit({
      actorId: principal.user.id,
      actorEmail: principal.user.email,
      action: "link.updated",
      targetType: "link",
      targetId: link.id,
      ip: clientIp(c),
      ua: c.req.header("user-agent") || null,
    })
    return c.json({ link: linkDto(updated) })
  } catch (err) {
    if (err instanceof SlugTakenError) return c.json({ error: err.message }, 409)
    throw err
  }
})

links.delete("/:id", authRequired, async (c) => {
  const principal = getAuth(c)
  if (!hasScope(principal, "links:write")) return c.json({ error: "Not permitted" }, 403)
  const link = getLinkById(c.req.param("id"))
  if (!link || !canManage(link, principal.user.id, principal.user.is_admin === 1)) {
    return c.json({ error: "Link not found" }, 404)
  }
  if (link.domain_is_system !== 1) {
    // Deleting the link is fine; custom domains stay connected.
  }
  deleteLink(link.id)
  audit({
    actorId: principal.user.id,
    actorEmail: principal.user.email,
    action: "link.deleted",
    targetType: "link",
    targetId: link.id,
    meta: { domain: link.domain_hostname, slug: link.slug },
    ip: clientIp(c),
    ua: c.req.header("user-agent") || null,
  })
  return c.json({ ok: true })
})

links.get("/:id/delete-preview", authRequired, async (c) => {
  const principal = getAuth(c)
  const link = getLinkById(c.req.param("id"))
  if (!link || !canManage(link, principal.user.id, principal.user.is_admin === 1)) {
    return c.json({ error: "Link not found" }, 404)
  }
  return c.json({
    status: statusOf(link),
    clicks: link.click_count,
    domainLinks: countLinksForDomain(link.domain_id),
  })
})

// Exported for tests.
export { resolveDomainForCreate }

export default links
