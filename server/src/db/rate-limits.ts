import { db, now } from "./connection.js"

export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: number
  scope: string
}

export interface RateLimitRule {
  scope: string
  limit: number
  windowMs: number
}

const selectBucket = db.query("SELECT window_start, count FROM rate_limits WHERE key = ?")
const insertBucket = db.query("INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)")
const updateBucket = db.query("UPDATE rate_limits SET count = ? WHERE key = ?")
const resetBucket = db.query("UPDATE rate_limits SET window_start = ?, count = 1 WHERE key = ?")
const prune = db.query("DELETE FROM rate_limits WHERE window_start < ?")

/**
 * Fixed-window counter. SQLite is synchronous and single-writer, so the
 * read-modify-write sequence is atomic within this process.
 */
export function consume(key: string, rule: RateLimitRule): RateLimitResult {
  const timestamp = now()
  const row = selectBucket.get(key) as { window_start: number; count: number } | null
  const resetAt = timestamp + rule.windowMs

  if (!row || timestamp - row.window_start >= rule.windowMs) {
    if (row) resetBucket.run(timestamp, key)
    else insertBucket.run(key, timestamp)
    return { allowed: true, limit: rule.limit, remaining: rule.limit - 1, resetAt, scope: rule.scope }
  }

  if (row.count >= rule.limit) {
    return {
      allowed: false,
      limit: rule.limit,
      remaining: 0,
      resetAt: row.window_start + rule.windowMs,
      scope: rule.scope,
    }
  }

  updateBucket.run(row.count + 1, key)
  return {
    allowed: true,
    limit: rule.limit,
    remaining: rule.limit - row.count - 1,
    resetAt: row.window_start + rule.windowMs,
    scope: rule.scope,
  }
}

/** Consume a stack of layered limits; returns the first exhausted rule. */
export function consumeAll(keyPrefix: string, rules: RateLimitRule[]): RateLimitResult {
  let last: RateLimitResult | null = null
  for (const rule of rules) {
    const result = consume(`${keyPrefix}:${rule.scope}`, rule)
    if (!result.allowed) return result
    last = result
  }
  return (
    last ?? {
      allowed: true,
      limit: 0,
      remaining: 0,
      resetAt: now(),
      scope: "none",
    }
  )
}

export function pruneRateLimits(maxAgeMs = 2 * 24 * 60 * 60 * 1000): number {
  return prune.run(now() - maxAgeMs).changes
}
