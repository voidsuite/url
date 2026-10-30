/**
 * Void Links gateway — serves the built client (client/dist), the API and the
 * host-aware redirect path.
 *
 *   /api/auth/*      VoidAuth OAuth proxy (PKCE, httpOnly session cookie)
 *   /api/links/*     create, manage and analyse short links
 *   /api/domains/*   custom domain management + DNS verification
 *   /api/tokens/*    personal API tokens
 *   /api/stats/*     account-wide analytics
 *   /api/qr          public QR images
 *   /:slug           redirect on any verified short domain
 */

import { Hono } from "hono"
import type { Context } from "hono"
import type { AppEnv } from "./types.js"
import { cors } from "hono/cors"
import path from "node:path"
import { fileURLToPath } from "node:url"
import config, { hostFromHeader } from "./config.js"
import authRoutes from "./routes/auth.js"
import linkRoutes from "./routes/links.js"
import domainRoutes from "./routes/domains.js"
import tokenRoutes from "./routes/tokens.js"
import statsRoutes from "./routes/stats.js"
import configRoutes from "./routes/config.js"
import qrRoutes from "./routes/qr.js"
import redirectRoutes from "./routes/redirect.js"
import { originGuard, securityHeaders } from "./middleware/origin.js"
import { startSweeper } from "./jobs/sweeper.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST_DIR = path.resolve(__dirname, "../../client/dist")

const app = new Hono<AppEnv>()

app.use(
  "*",
  cors({
    origin: config.allowedOrigins,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Anon-Id"],
    exposeHeaders: ["Content-Length", "Retry-After", "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
    credentials: true,
    maxAge: 86400,
  })
)

app.use("*", securityHeaders)
app.use("/api/*", originGuard)

app.use("*", async (c, next) => {
  const host = hostFromHeader(c.req.header("host"))
  const isAppHost = config.isProduction
    ? host === config.appHost
    : host === config.appHost || host === "localhost" || host === "127.0.0.1" || host === "::1"
  c.set("isAppHost", isAppHost)
  const reqPath = c.req.path

  // Only the public app origin serves the API and UI. Short-only domains
  // (void.hm, custom domains) are redirect surfaces and nothing else.
  if (!isAppHost) {
    if (reqPath === "/health" || reqPath === "/api/health") {
      await next()
      return
    }
    if (reqPath.startsWith("/api/")) {
      return c.json({ error: "Not found" }, 404)
    }
    if (reqPath === "/") {
      return c.redirect(config.appUrl, 302)
    }
    if (!reqPath.startsWith("/") || reqPath.split("/").filter(Boolean).length > 1) {
      return c.json({ error: "Not found" }, 404)
    }
  }
  await next()
})

app.use("*", async (c, next) => {
  await next()
  const res = c.res
  if (res.status >= 400) {
    const body = await res.clone().text().catch(() => "")
    console.log(`[http] ${c.req.method} ${c.req.path} -> ${res.status} ${body.slice(0, 180)}`)
  } else {
    console.log(`[http] ${c.req.method} ${c.req.path} -> ${res.status}`)
  }
})

app.route("/api/auth", authRoutes)
app.route("/api/links", linkRoutes)
app.route("/api/domains", domainRoutes)
app.route("/api/tokens", tokenRoutes)
app.route("/api/stats", statsRoutes)
app.route("/api/qr", qrRoutes)
app.route("/api", configRoutes)
app.route("/", redirectRoutes)

app.get("/health", (c) => c.json({ status: "ok", service: "voidlinks" }))
app.get("/api/health", (c) => c.json({ status: "ok", service: "voidlinks" }))

app.get("/robots.txt", (c) => {
  c.header("Content-Type", "text/plain; charset=utf-8")
  return c.body("User-agent: *\nDisallow: /\n")
})

const MIME_TYPES: Record<string, string> = {
  html: "text/html",
  css: "text/css",
  js: "application/javascript",
  mjs: "application/javascript",
  json: "application/json",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  webp: "image/webp",
  avif: "image/avif",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  txt: "text/plain",
  map: "application/json",
  webmanifest: "application/manifest+json",
}

async function serveIndex(c: Context<AppEnv>) {
  const index = Bun.file(path.join(DIST_DIR, "index.html"))
  if (await index.exists()) {
    return new Response(index, {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" },
    })
  }
  if (!config.isProduction) return c.redirect(config.appUrl, 302)
  return c.json({ error: "Client build not found" }, 500)
}

app.get("/", async (c) => {
  if (c.get("isAppHost") !== true) return c.redirect(config.appUrl, 302)
  return serveIndex(c)
})

app.get("*", async (c) => {
  const reqPath = c.req.path
  if (reqPath.startsWith("/api")) return c.json({ error: "Not found" }, 404)
  if (c.get("isAppHost") !== true) return c.json({ error: "Not found" }, 404)

  const filePath = reqPath === "/" ? "/index.html" : reqPath
  const ext = filePath.split(".").pop()?.toLowerCase() || ""
  const file = Bun.file(path.join(DIST_DIR, filePath))
  if (await file.exists()) {
    return new Response(file, {
      headers: {
        "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
        "Cache-Control": ext === "html" ? "no-cache" : "public, max-age=31536000, immutable",
      },
    })
  }
  return serveIndex(c)
})

app.onError((err, c) => {
  console.error("[voidlinks] unhandled error", err)
  if (c.req.path.startsWith("/api/")) return c.json({ error: "Internal server error" }, 500)
  return c.json({ error: "Internal server error" }, 500)
})

console.log(
  `[voidlinks] gateway starting on :${config.port} (${config.appUrl}) short domains=${config.shortDomains
    .map((domain) => domain.hostname)
    .join(",")}`
)
startSweeper()

export default {
  port: config.port,
  fetch: app.fetch,
  maxRequestBodySize: 256 * 1024,
}
