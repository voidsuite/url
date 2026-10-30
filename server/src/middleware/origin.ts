import type { MiddlewareHandler } from "hono"
import config from "../config.js"

/**
 * CSRF hardening for cookie-authenticated writes. SameSite=Lax already blocks
 * cross-site form POSTs; this rejects a forged Origin when one is present.
 * Requests without Origin (curl, server-to-server, API tokens) are allowed.
 */
export const originGuard: MiddlewareHandler = async (c, next) => {
  const method = c.req.method.toUpperCase()
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    await next()
    return
  }
  const origin = c.req.header("origin")
  if (origin) {
    const normalized = origin.replace(/\/+$/, "")
    if (!config.allowedOrigins.includes(normalized)) {
      return c.json({ error: "Origin not allowed" }, 403)
    }
  }
  await next()
}

export const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next()
  c.header("X-Content-Type-Options", "nosniff")
  c.header("Referrer-Policy", "no-referrer")
  c.header("X-Frame-Options", "DENY")
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
  if (config.isProduction) {
    c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
  }
}
