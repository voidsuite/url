import { db, now } from "./connection.js"
import { uuid } from "../lib/ids.js"

export interface AuditInput {
  actorId?: string | null
  actorEmail?: string | null
  action: string
  targetType?: string | null
  targetId?: string | null
  meta?: Record<string, unknown> | null
  ip?: string | null
  ua?: string | null
}

const insertAudit = db.query(`
  INSERT INTO audit_log (id, actor_id, actor_email, action, target_type, target_id, meta, ip, ua, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

export function audit(input: AuditInput): void {
  try {
    insertAudit.run(
      uuid(),
      input.actorId ?? null,
      input.actorEmail ?? null,
      input.action,
      input.targetType ?? null,
      input.targetId ?? null,
      input.meta ? JSON.stringify(input.meta) : null,
      input.ip ?? null,
      input.ua ?? null,
      now()
    )
  } catch (err) {
    console.error("[audit] failed", err)
  }
}
