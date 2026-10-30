/**
 * /api/auth/* — VoidAuth OAuth proxy with PKCE.
 * Signing in is optional: every public shortening flow works without it.
 */

import { Hono } from "hono"
import { deleteCookie, getCookie, setCookie } from "hono/cookie"
import config from "../config.js"
import {
  createSession,
  deleteSessionById,
  getCookieName,
  getSession,
  getSessionCookieOptions,
  updateSessionTokens,
} from "../db/sessions.js"
import { storePkceState, takePkceVerifier } from "../db/pkce.js"
import {
  authorizeUrl,
  buildAuthorizeParams,
  decodeJwtPayload,
  exchangeCode,
  refreshTokens,
  revokeToken,
  validateBearerToken,
} from "../lib/oauth.js"
import { syncProfile, upsertUser, userDto, type StoredUser } from "../db/users.js"
import { claimAnonymousLinks } from "../db/links.js"
import { audit } from "../db/audit.js"
import { authRequired, clientIp, getAuth } from "../middleware/auth.js"

const PKCE_STATE_COOKIE = "voidurl_pkce_state"
const ANON_PATTERN = /^[a-zA-Z0-9-]{16,64}$/

function stateCookieOptions(): Record<string, string | boolean | number> {
  return {
    httpOnly: true,
    sameSite: "Lax",
    secure: config.appUrl.startsWith("https://"),
    path: "/",
    maxAge: 10 * 60,
  }
}

function roleFromTokens(tokens: { user?: { role?: string }; idToken?: string }): string | undefined {
  if (tokens.user?.role) return tokens.user.role
  if (tokens.idToken) {
    const payload = decodeJwtPayload(tokens.idToken)
    if (payload && typeof payload.role === "string") return payload.role
  }
  return undefined
}

function pictureFromTokens(tokens: { user?: { picture?: string }; idToken?: string }): string | undefined {
  if (tokens.user?.picture) return tokens.user.picture
  if (tokens.idToken) {
    const payload = decodeJwtPayload(tokens.idToken)
    if (payload && typeof payload.picture === "string") return payload.picture
  }
  return undefined
}

async function refreshProfile(user: StoredUser, accessToken: string): Promise<StoredUser> {
  try {
    const info = await validateBearerToken(accessToken, !user.picture)
    if (info.id !== user.id) return user
    return syncProfile(user.id, info.role, info.picture) ?? user
  } catch {
    return user
  }
}

function normalizeAnonId(value: unknown): string | null {
  return typeof value === "string" && ANON_PATTERN.test(value) ? value : null
}

const auth = new Hono()

// GET /api/auth/login → { authUrl } (starts PKCE, binds state to this browser)
auth.get("/login", async (c) => {
  const { params, verifier, state } = buildAuthorizeParams()
  storePkceState(state, verifier)
  setCookie(c, PKCE_STATE_COOKIE, state, stateCookieOptions())
  return c.json({ authUrl: authorizeUrl(params) })
})

// POST /api/auth/exchange — swap the code, create a session cookie, claim links
auth.post("/exchange", async (c) => {
  const body = await c.req.json().catch(() => null)
  const code = typeof body?.code === "string" ? body.code : undefined
  const state = typeof body?.state === "string" ? body.state : undefined
  const keepMeLoggedIn = body?.keepMeLoggedIn !== false
  const anonId = normalizeAnonId(body?.anonId)

  if (!code || !state) return c.json({ error: "Missing code or state" }, 400)

  const stateCookie = getCookie(c, PKCE_STATE_COOKIE)
  if (!stateCookie || stateCookie !== state) {
    return c.json({ error: "Invalid OAuth state" }, 400)
  }
  const verifier = takePkceVerifier(state)
  if (!verifier) return c.json({ error: "Invalid or expired state" }, 400)
  deleteCookie(c, PKCE_STATE_COOKIE)

  try {
    const tokens = await exchangeCode(code, verifier)
    let oidcUser = tokens.user
    if (!oidcUser?.id) {
      const info = await validateBearerToken(tokens.accessToken)
      oidcUser = {
        id: info.id,
        name: info.name,
        email: info.email,
        picture: info.picture,
        role: info.role,
      }
    }

    const user = upsertUser({
      id: oidcUser?.id || "",
      name: oidcUser?.name || "",
      email: oidcUser?.email || "",
      picture: oidcUser?.picture || pictureFromTokens(tokens),
      role: roleFromTokens(tokens),
    })

    const sessionId = createSession(
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          picture: user.picture,
          role: user.role,
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken || "",
        scope: tokens.scope || "",
      },
      keepMeLoggedIn
    )
    const cookieMaxAge = keepMeLoggedIn ? Math.max(1, config.sessionTtlDays) * 24 * 60 * 60 : undefined
    setCookie(c, getCookieName(), sessionId, getSessionCookieOptions(cookieMaxAge))

    const claimed = anonId ? claimAnonymousLinks(user.id, anonId) : 0

    audit({
      actorId: user.id,
      actorEmail: user.email,
      action: "auth.login",
      targetType: "user",
      targetId: user.id,
      meta: claimed ? { claimedLinks: claimed } : null,
      ip: clientIp(c),
      ua: c.req.header("user-agent") || null,
    })

    return c.json({ user: userDto(user), claimed })
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400)
  }
})

// POST /api/auth/claim — attach anonymous links created by this browser
auth.post("/claim", authRequired, async (c) => {
  const body = await c.req.json().catch(() => null)
  const anonId = normalizeAnonId(body?.anonId)
  if (!anonId) return c.json({ error: "Invalid anonymous id" }, 400)
  const principal = getAuth(c)
  const claimed = claimAnonymousLinks(principal.user.id, anonId)
  if (claimed > 0) {
    audit({
      actorId: principal.user.id,
      actorEmail: principal.user.email,
      action: "links.claimed",
      targetType: "anon",
      meta: { claimed },
      ip: clientIp(c),
      ua: c.req.header("user-agent") || null,
    })
  }
  return c.json({ claimed })
})

// POST /api/auth/refresh — refresh the VoidAuth token, extend the session
auth.post("/refresh", async (c) => {
  const sessionId = getCookie(c, getCookieName())
  if (!sessionId) return c.json({ error: "No session" }, 401)

  const session = getSession(sessionId)
  if (!session || !session.refreshToken) {
    if (sessionId) deleteCookie(c, getCookieName())
    return c.json({ error: "Session expired" }, 401)
  }

  try {
    const tokens = await refreshTokens(session.refreshToken, session.scope)
    updateSessionTokens(
      sessionId,
      tokens.accessToken,
      tokens.refreshToken || session.refreshToken,
      tokens.scope || session.scope
    )
    const user = syncProfile(session.user.id, roleFromTokens(tokens)) || session.user
    const cookieMaxAge = session.keepMeLoggedIn
      ? Math.max(1, config.sessionTtlDays) * 24 * 60 * 60
      : undefined
    setCookie(c, getCookieName(), sessionId, getSessionCookieOptions(cookieMaxAge))
    return c.json({ ok: true, user: userDto(user) })
  } catch {
    deleteSessionById(sessionId)
    deleteCookie(c, getCookieName())
    return c.json({ error: "Session expired" }, 401)
  }
})

// GET /api/auth/me — current user, refreshing role/avatar quietly
auth.get("/me", authRequired, async (c) => {
  const principal = getAuth(c)
  const session = principal.session
  if (!session) {
    // API-token requests have no session; return the token owner.
    return c.json({ user: userDto(principal.user), scopes: principal.scopes, source: principal.source })
  }
  const user = await refreshProfile(principal.user, session.accessToken)
  return c.json({ user: userDto(user), scopes: principal.scopes, source: principal.source })
})

// POST /api/auth/logout — revoke token, clear the session cookie
auth.post("/logout", async (c) => {
  const sessionId = getCookie(c, getCookieName())
  if (sessionId) {
    const session = getSession(sessionId)
    if (session) {
      if (session.accessToken) await revokeToken(session.accessToken)
      deleteSessionById(sessionId)
    }
    deleteCookie(c, getCookieName())
  }
  return c.json({ ok: true })
})

export default auth
