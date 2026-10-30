/**
 * /api/tokens — personal API tokens for scripts and CI.
 * Only browser sessions can mint tokens; an API token cannot create another.
 */

import { Hono } from "hono"
import { authRequired, getAuth } from "../middleware/auth.js"
import {
  API_TOKEN_SCOPES,
  createApiToken,
  listApiTokens,
  revokeApiToken,
  tokenDto,
} from "../db/tokens.js"
import { audit } from "../db/audit.js"
import { clientIp } from "../middleware/auth.js"

const tokens = new Hono()

tokens.get("/", authRequired, async (c) => {
  const principal = getAuth(c)
  if (principal.source !== "cookie") return c.json({ error: "Use a browser session to manage tokens." }, 403)
  return c.json({ tokens: listApiTokens(principal.user.id).map(tokenDto) })
})

tokens.post("/", authRequired, async (c) => {
  const principal = getAuth(c)
  if (principal.source !== "cookie") return c.json({ error: "Use a browser session to manage tokens." }, 403)
  const body = await c.req.json().catch(() => null)
  const name = typeof body?.name === "string" ? body.name.trim() : ""
  if (!name || name.length > 60) return c.json({ error: "Give the token a name (60 characters max)." }, 400)

  const requested = Array.isArray(body?.scopes) ? body.scopes.filter((s: unknown) => typeof s === "string") : []
  const scopes = requested.filter((scope: string) => (API_TOKEN_SCOPES as readonly string[]).includes(scope))
  if (scopes.length === 0) return c.json({ error: "Choose at least one scope." }, 400)

  const days = body?.expiresInDays
  const expiresInDays = days === null ? null : Number(days)
  if (expiresInDays !== null && (!Number.isFinite(expiresInDays) || expiresInDays < 1 || expiresInDays > 365)) {
    return c.json({ error: "Expiry must be between 1 and 365 days, or never." }, 400)
  }

  const { token, row } = createApiToken(principal.user.id, name, scopes, expiresInDays)
  audit({
    actorId: principal.user.id,
    actorEmail: principal.user.email,
    action: "token.created",
    targetType: "api_token",
    targetId: row.id,
    meta: { name, scopes, expiresInDays },
    ip: clientIp(c),
    ua: c.req.header("user-agent") || null,
  })
  return c.json({ token, apiToken: tokenDto(row) }, 201)
})

tokens.delete("/:id", authRequired, async (c) => {
  const principal = getAuth(c)
  if (principal.source !== "cookie") return c.json({ error: "Use a browser session to manage tokens." }, 403)
  const ok = revokeApiToken(c.req.param("id"), principal.user.id)
  if (!ok) return c.json({ error: "Token not found" }, 404)
  audit({
    actorId: principal.user.id,
    actorEmail: principal.user.email,
    action: "token.revoked",
    targetType: "api_token",
    targetId: c.req.param("id"),
    ip: clientIp(c),
    ua: c.req.header("user-agent") || null,
  })
  return c.json({ ok: true })
})

export default tokens
