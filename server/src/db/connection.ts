/**
 * SQLite connection. The schema is applied at module load so any module that
 * imports `db` can prepare statements immediately. Built-in short domains are
 * synced from configuration on boot.
 */

import { Database } from "bun:sqlite"
import { mkdirSync, readFileSync } from "node:fs"
import path from "node:path"
import config from "../config.js"
import { uuid } from "../lib/ids.js"

mkdirSync(config.dataDir, { recursive: true })

export const db = new Database(path.join(config.dataDir, "voidlinks.db"))
db.exec("PRAGMA journal_mode = WAL;")
db.exec("PRAGMA foreign_keys = ON;")

const schema = readFileSync(path.join(import.meta.dir, "schema.sql"), "utf8")
db.exec(schema)

// Keep built-in domains in sync with SHORT_DOMAINS. Custom domains are never
// touched. A configured domain that disappears is disabled, not deleted, so
// its analytics remain auditable.
const selectDomain = db.query("SELECT id, is_default FROM domains WHERE hostname = ? AND deleted_at IS NULL")
const insertDomain = db.query(`
  INSERT INTO domains (id, hostname, owner_user_id, is_system, is_default, status, verified_at, created_at)
  VALUES (?, ?, NULL, 1, ?, 'verified', ?, ?)
`)
const updateSystemDomain = db.query(`
  UPDATE domains SET is_system = 1, owner_user_id = NULL, is_default = ?, status = 'verified', verified_at = ?, deleted_at = NULL
  WHERE id = ?
`)
const disableSystemDomain = db.query(`
  UPDATE domains SET status = 'disabled', is_default = 0 WHERE is_system = 1 AND hostname = ?
`)

for (const domain of config.shortDomains) {
  const existing = selectDomain.get(domain.hostname) as { id: string; is_default: number } | null
  if (existing) {
    updateSystemDomain.run(domain.isDefault ? 1 : 0, Date.now(), existing.id)
  } else {
    insertDomain.run(
      uuid(),
      domain.hostname,
      domain.isDefault ? 1 : 0,
      Date.now(),
      Date.now()
    )
  }
}

const configuredHosts = new Set(config.shortDomains.map((domain) => domain.hostname))
const systemDomains = db
  .query("SELECT id, hostname FROM domains WHERE is_system = 1 AND deleted_at IS NULL")
  .all() as { id: string; hostname: string }[]
for (const domain of systemDomains) {
  if (!configuredHosts.has(domain.hostname)) disableSystemDomain.run(domain.hostname)
}

export function now(): number {
  return Date.now()
}

export function transaction<T>(fn: () => T): T {
  db.exec("BEGIN IMMEDIATE")
  try {
    const result = fn()
    db.exec("COMMIT")
    return result
  } catch (err) {
    try {
      db.exec("ROLLBACK")
    } catch {
      /* ignore */
    }
    throw err
  }
}
