import { randomBytes, randomUUID, createHash } from "node:crypto"

export function uuid(): string {
  return randomUUID()
}

export function newToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url")
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export function tokenPrefix(token: string): string {
  return token.slice(0, 12)
}

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz"

/** Short, URL-safe slugs. 7 base-36 characters ≈ 78 billion combinations. */
export function randomSlug(length = 7): string {
  const bytes = randomBytes(length)
  let out = ""
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[bytes[i] % ALPHABET.length]
  }
  return out
}

export function normalizeSlug(value: string): string {
  return value.trim().toLowerCase()
}

export function isValidSlug(value: string): boolean {
  if (!/^[a-z0-9][a-z0-9_-]{1,30}[a-z0-9]$/.test(value)) return false
  return !/[-_]{2,}/.test(value)
}

/**
 * Slugs that would collide with app routes, static assets or the API. Kept
 * lowercase; compare against normalizeSlug().
 */
export const RESERVED_SLUGS = new Set([
  "_next",
  "about",
  "admin",
  "analytics",
  "api",
  "app",
  "assets",
  "auth",
  "blog",
  "callback",
  "contact",
  "dashboard",
  "docs",
  "domains",
  "favicon.ico",
  "health",
  "home",
  "index",
  "legal",
  "links",
  "login",
  "logout",
  "manifest.json",
  "metrics",
  "new",
  "oauth",
  "pricing",
  "privacy",
  "qr",
  "register",
  "report",
  "robots.txt",
  "settings",
  "signin",
  "signup",
  "sitemap.xml",
  "static",
  "status",
  "support",
  "terms",
  "void",
])

export function isReservedSlug(value: string): boolean {
  return RESERVED_SLUGS.has(normalizeSlug(value))
}
