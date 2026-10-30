import { db, now } from "./connection.js"
import { hashToken, tokenPrefix, uuid } from "../lib/ids.js"

export interface ApiTokenRow {
  id: string
  user_id: string
  name: string
  token_hash: string
  prefix: string
  scopes: string
  last_used_at: number | null
  expires_at: number | null
  revoked_at: number | null
  created_at: number
}

export const API_TOKEN_SCOPES = ["links:read", "links:write", "stats:read"] as const

const insert = db.query(`
  INSERT INTO api_tokens (id, user_id, name, token_hash, prefix, scopes, expires_at, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`)
const selectByHash = db.query("SELECT * FROM api_tokens WHERE token_hash = ?")
const selectForUser = db.query(
  "SELECT * FROM api_tokens WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at DESC"
)
const revoke = db.query("UPDATE api_tokens SET revoked_at = ? WHERE id = ? AND user_id = ?")
const touch = db.query("UPDATE api_tokens SET last_used_at = ? WHERE id = ?")
const deleteRevoked = db.query("DELETE FROM api_tokens WHERE revoked_at IS NOT NULL AND revoked_at < ?")

export function createApiToken(
  userId: string,
  name: string,
  scopes: string[],
  expiresInDays: number | null
): { token: string; row: ApiTokenRow } {
  const secret = `vlk_${crypto.randomUUID().replace(/-/g, "")}${crypto
    .randomUUID()
    .replace(/-/g, "")}`
  const id = uuid()
  const expiresAt = expiresInDays ? now() + expiresInDays * 24 * 60 * 60 * 1000 : null
  insert.run(id, userId, name.trim(), hashToken(secret), tokenPrefix(secret), scopes.join(" "), expiresAt, now())
  return {
    token: secret,
    row: db.query("SELECT * FROM api_tokens WHERE id = ?").get(id) as ApiTokenRow,
  }
}

export function getApiToken(token: string): { row: ApiTokenRow; scopes: string[] } | null {
  if (!token.startsWith("vlk_")) return null
  const row = selectByHash.get(hashToken(token)) as ApiTokenRow | null
  if (!row || row.revoked_at) return null
  if (row.expires_at !== null && row.expires_at <= now()) return null
  return { row, scopes: row.scopes.split(/[\s,]+/).filter(Boolean) }
}

export function touchApiToken(id: string): void {
  touch.run(now(), id)
}

export function listApiTokens(userId: string): ApiTokenRow[] {
  return selectForUser.all(userId) as ApiTokenRow[]
}

export function revokeApiToken(id: string, userId: string): boolean {
  return revoke.run(now(), id, userId).changes > 0
}

export function tokenDto(row: ApiTokenRow) {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    scopes: row.scopes.split(/[\s,]+/).filter(Boolean),
    lastUsedAt: row.last_used_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }
}

export function pruneTokens(days = 30): number {
  return deleteRevoked.run(now() - days * 24 * 60 * 60 * 1000).changes
}
