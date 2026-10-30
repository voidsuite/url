import type { Context } from "hono"
import config from "../config.js"
import { consumeAll, type RateLimitRule } from "../db/rate-limits.js"
import { clientIp, getAuth, hashIp } from "./auth.js"

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function creationLimit(c: Context): {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: number
  scope: string
  key: string
} {
  const principal = getAuth(c)
  const ipKey = `create:${hashIp(clientIp(c))}`
  const rules: RateLimitRule[] = principal
    ? [{ scope: "hour", limit: config.limits.authPerHour, windowMs: HOUR }]
    : [
        { scope: "minute", limit: config.limits.anonPerMinute, windowMs: MINUTE },
        { scope: "hour", limit: config.limits.anonPerHour, windowMs: HOUR },
        { scope: "day", limit: config.limits.anonPerDay, windowMs: DAY },
      ]
  const key = principal ? `create:user:${principal.user.id}` : ipKey
  const result = consumeAll(key, rules)
  return { ...result, key }
}

export function readLimit(c: Context, scope: string, limit = 120): boolean {
  const principal = getAuth(c)
  const key = principal ? `read:${principal.user.id}` : `read:${hashIp(clientIp(c))}`
  return consumeAll(key, [{ scope, limit, windowMs: MINUTE }]).allowed
}

export function applyRateHeaders(
  c: Context,
  result: { limit: number; remaining: number; resetAt: number }
): void {
  c.header("X-RateLimit-Limit", String(result.limit))
  c.header("X-RateLimit-Remaining", String(result.remaining))
  c.header("X-RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)))
}

export function retryAfterSeconds(resetAt: number): number {
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
}
