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
import { provisionDomain, removeDomainProvisioning } from "../lib/domain-provision.js"
import { sendDomainAddedEmail, sendDomainVerifiedEmail } from "../lib/mailer.js"
import { audit } from "../db/audit.js"

const domains = new Hono()

function notifyDomainAdded(domain: ReturnType<typeof domainDto>, email: string): void {
  if (!email) return
  void sendDomainAddedEmail({ to: email, hostname: domain.hostname, dns: domain.dns }).catch(
    (err) => console.error("[mail] domain-added notification failed", err)
  )
}

function notifyDomainVerified(hostname: string, email: string): void {
  if (!email) return
  void sendDomainVerifiedEmail({ to: email, hostname }).catch((err) =>
    console.error("[mail] domain-verified notification failed", err)
  )
}

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
    notifyDomainAdded(domainDto(domain), principal.user.email)
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
  const wasVerified = domain.status === "verified"
  let ok = result.ok
  let message = result.message
  let provisioningFailed = false

  // DNS is only the first half: the hostname also needs its own certificate and
  // nginx vhost, otherwise the request lands on an unrelated app. Provisioning
  // is idempotent, so re-running it also repairs domains verified before this
  // flow existed.
  if (ok) {
    const provision = await provisionDomain(domain.hostname)
    if (!provision.ok && !wasVerified) {
      ok = false
      provisioningFailed = true
      message = `DNS is correct, but TLS setup failed: ${provision.message} It will be retried automatically.`
    }
  }

  const nextStatus = ok ? "verified" : result.ok ? "pending" : "failed"
  const updated = setDomainVerification(domain.id, nextStatus, ok)
  audit({
    actorId: principal.user.id,
    actorEmail: principal.user.email,
    action: "domain.verified",
    targetType: "domain",
    targetId: domain.id,
    meta: {
      hostname: domain.hostname,
      ok,
      dnsOk: result.ok,
      method: result.method,
      provisioningFailed,
    },
    ip: clientIp(c),
    ua: c.req.header("user-agent") || null,
  })
  if (ok && !wasVerified) notifyDomainVerified(domain.hostname, principal.user.email)
  return c.json({
    domain: updated ? domainDto(updated) : null,
    ok,
    method: result.method,
    message,
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
  // Best-effort: drop the nginx vhost and certificate so a deleted domain stops
  // serving. Never block the response on certbot.
  void removeDomainProvisioning(domain.hostname).catch((err) =>
    console.error("[domains] failed to remove provisioning", err)
  )
  return c.json({ ok: true })
})

export default domains
