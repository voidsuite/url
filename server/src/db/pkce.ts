import { db, now } from "./connection.js"

const insertState = db.query(
  "INSERT INTO pkce_states (state, verifier, expires_at, created_at) VALUES (?, ?, ?, ?)"
)
const takeState = db.query("SELECT verifier FROM pkce_states WHERE state = ? AND expires_at > ?")
const deleteState = db.query("DELETE FROM pkce_states WHERE state = ?")
const deleteExpired = db.query("DELETE FROM pkce_states WHERE expires_at < ?")

export function storePkceState(state: string, verifier: string, ttlMs = 10 * 60 * 1000): void {
  insertState.run(state, verifier, now() + ttlMs, now())
}

export function takePkceVerifier(state: string): string | null {
  const row = takeState.get(state, now()) as { verifier: string } | null
  if (!row) return null
  deleteState.run(state)
  return row.verifier
}

export function prunePkceStates(): number {
  return deleteExpired.run(now()).changes
}
