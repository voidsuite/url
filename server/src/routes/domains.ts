/**
 * /api/domains — custom domain management with DNS verification.
 */

import { Hono } from "hono"
import { authRequired, clientIp, getAuth, hasScope } from "../middleware/auth.js"
import { countLinksForDomain } from "../db/links.js"
import {
  createCustomDomain,
  deleteCustomDomain,
  domainDto,
  getDomainById,
  listDomainsForUser,
  listOwnedDomains,
  setDomainVerification,
} from "../db/domains.js"
import { isValidDomainHostname, verifyDomainDns } from "../lib/domain-verify.js"
import { audit } from "../db/audit.js"

const domains = new Hono()

domains.get("/", authRequired, async (c) => {
  const principal = getAuth(c)
  if (!hasScope(principal, "links:read")) return c.json({ error: "Not permitted" }, 403)
  const rows = listDomainsForUser(principal.user.id)
  return c.json({ domains: rows.map(domainDto) })
})

domains.post("/", authRequired, async (c) => {
  const principal = getAuth(c)
  if (!hasScope(principal, "links:write")) return c.json({ error: "Not permitted" }, 403)
  const body = await c.req.json().catch(() => null)
  const raw = typeof body?.hostname === "string" ? body.hostname : ""
  const validation = isValidDomainHostname(raw)
  if (!validation.ok) return c.json({ error: validation.error }, 400)

  const existing = listOwnedDomains(principal.user.id).find(
    (domain) => domain.hostname === validation.hostname
  )
  if (existing) return c.json({ error: "That domain is already connected.", domain: domainDto(existing) }, 409)

  try {
    const domain = createCustomDomain({
      hostname: validation.hostname,
      ownerUserId: principal.user.id,
    })
    audit({
      actorId: principal.user.id,
      actorEmail: principal.user.email,
      action: "domain.created",
      targetType: "domain",
      targetId: domain.id,
      meta: { hostname: domain.hostname, autoVerified: domain.status === "verified" },
      ip: clientIp(c),
      ua: c.req.header("user-agent") || null,
    })
    return c.json({ domain: domainDto(domain) }, 201)
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400)
  }
})

domains.post("/:id/verify", authRequired, async (c) => {
  const principal = getAuth(c)
  if (!hasScope(principal, "links:write")) return c.json({ error: "Not permitted" }, 403)
  const domain = getDomainById(c.req.param("id"))
  if (!domain || domain.owner_user_id !== principal.user.id) {
    return c.json({ error: "Domain not found" }, 404)
  }
  if (domain.status === "disabled") return c.json({ error: "This domain is disabled." }, 409)

  const result = await verifyDomainDns(domain.hostname, domain.verification_token || "")
  const updated = setDomainVerification(
    domain.id,
    result.ok ? "verified" : "failed",
    result.ok
  )
  audit({
    actorId: principal.user.id,
    actorEmail: principal.user.email,
    action: "domain.verified",
    targetType: "domain",
    targetId: domain.id,
    meta: { hostname: domain.hostname, ok: result.ok, method: result.method },
    ip: clientIp(c),
    ua: c.req.header("user-agent") || null,
  })
  return c.json({
    domain: updated ? domainDto(updated) : null,
    ok: result.ok,
    method: result.method,
    message: result.message,
  })
})

domains.delete("/:id", authRequired, async (c) => {
  const principal = getAuth(c)
  if (!hasScope(principal, "links:write")) return c.json({ error: "Not permitted" }, 403)
  const domain = getDomainById(c.req.param("id"))
  if (!domain || domain.owner_user_id !== principal.user.id || domain.is_system === 1) {
    return c.json({ error: "Domain not found" }, 404)
  }
  const links = countLinksForDomain(domain.id)
  if (links > 0) {
    return c.json(
      {
        error: `Move or delete the ${links} link${links === 1 ? "" : "s"} on this domain first.`,
        links,
      },
      409
    )
  }
  deleteCustomDomain(domain.id, principal.user.id)
  audit({
    actorId: principal.user.id,
    actorEmail: principal.user.email,
    action: "domain.deleted",
    targetType: "domain",
    targetId: domain.id,
    meta: { hostname: domain.hostname },
    ip: clientIp(c),
    ua: c.req.header("user-agent") || null,
  })
  return c.json({ ok: true })
})

export default domains
