import { createHash } from "node:crypto"
import { getCookie } from "hono/cookie"
import { getConnInfo } from "hono/bun"
import type { Context, MiddlewareHandler } from "hono"
import config from "../config.js"
import { getCookieName, getSession, type SessionData } from "../db/sessions.js"
import { getUserById, type StoredUser } from "../db/users.js"
import { getApiToken, touchApiToken } from "../db/tokens.js"
import { audit } from "../db/audit.js"

export interface AuthPrincipal {
  user: StoredUser
  source: "cookie" | "api-token"
  session?: SessionData
  scopes: string[]
  apiTokenId?: string
}

export function getAuth(c: Context): AuthPrincipal {
  return c.get("auth") as AuthPrincipal
}

export function hasScope(principal: AuthPrincipal, scope: string): boolean {
  if (principal.user.is_admin === 1 || principal.user.role === "admin") return true
  if (principal.scopes.includes(scope)) return true
  if (principal.source === "api-token") {
    if (scope === "links:read" || scope === "stats:read") {
      return principal.scopes.includes(scope) || principal.scopes.includes("links:write")
    }
    return false
  }
  // Coarse VoidAuth scopes: read covers reading, write covers everything.
  if (scope === "links:read" || scope === "stats:read") {
    return principal.scopes.includes("read") || principal.scopes.includes("write")
  }
  return principal.scopes.includes("write")
}

function principalFromSession(session: SessionData): AuthPrincipal {
  return {
    user: session.user,
    source: "cookie",
    session,
    scopes: session.scope.split(/[\s,]+/).filter(Boolean),
  }
}

function principalFromHeader(c: Context): AuthPrincipal | null {
  const header = c.req.header("Authorization") || ""
  const match = /^Bearer\s+(.+)$/i.exec(header)
  if (!match) return null
  const token = getApiToken(match[1])
  if (!token) return null
  const user = getUserById(token.row.user_id)
  if (!user) return null
  touchApiToken(token.row.id)
  return {
    user,
    source: "api-token",
    scopes: token.scopes,
    apiTokenId: token.row.id,
  }
}

export const authRequired: MiddlewareHandler = async (c, next) => {
  const session = getSession(getCookie(c, getCookieName()))
  if (session) {
    c.set("auth", principalFromSession(session))
    await next()
    return
  }
  const headerPrincipal = principalFromHeader(c)
  if (headerPrincipal) {
    c.set("auth", headerPrincipal)
    await next()
    return
  }
  return c.json({ error: "Not authenticated" }, 401)
}

export const authOptional: MiddlewareHandler = async (c, next) => {
  const session = getSession(getCookie(c, getCookieName()))
  if (session) {
    c.set("auth", principalFromSession(session))
  } else {
    const headerPrincipal = principalFromHeader(c)
    if (headerPrincipal) c.set("auth", headerPrincipal)
  }
  await next()
}

export function requireScope(scope: string, message = "You do not have permission for this action."): MiddlewareHandler {
  return async (c, next) => {
    const principal = getAuth(c)
    if (!principal || !hasScope(principal, scope)) {
      audit({
        actorId: principal?.user.id,
        actorEmail: principal?.user.email,
        action: "permission.denied",
        targetType: "scope",
        targetId: scope,
        ip: clientIp(c),
        ua: c.req.header("user-agent") || null,
      })
      return c.json({ error: message }, 403)
    }
    await next()
  }
}

export function clientIp(c: Context): string {
  const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim()
  const real = c.req.header("x-real-ip")?.trim()
  let remote = ""
  try {
    remote = getConnInfo(c).remote.address || ""
  } catch {
    remote = ""
  }
  const loopback = remote === "127.0.0.1" || remote === "::1" || remote === "localhost"
  if (config.trustProxy || (!config.isProduction && loopback)) {
    if (forwarded) return forwarded
    if (real) return real
  }
  return remote || forwarded || real || "unknown"
}

export function hashIp(ip: string): string {
  return createHash("sha256").update(`${config.ipHashSecret}|${ip}`).digest("hex").slice(0, 24)
}
