import { db, now } from "./connection.js"
import config from "../config.js"

export interface StoredUser {
  id: string
  email: string
  name: string
  picture: string | null
  role: string
  is_admin: number
  created_at: number
  last_seen_at: number
}

export interface UserInput {
  id: string
  name: string
  email: string
  picture?: string | null
  role?: string
}

const insertUser = db.query(`
  INSERT INTO users (id, email, name, picture, role, is_admin, created_at, last_seen_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    email = excluded.email,
    name = excluded.name,
    picture = COALESCE(excluded.picture, users.picture),
    last_seen_at = excluded.last_seen_at
`)
const selectUser = db.query("SELECT * FROM users WHERE id = ?")
const updateRole = db.query("UPDATE users SET role = ?, is_admin = ? WHERE id = ?")
const updatePicture = db.query("UPDATE users SET picture = ? WHERE id = ?")
const touch = db.query("UPDATE users SET last_seen_at = ? WHERE id = ?")

export function upsertUser(input: UserInput): StoredUser {
  const existing = selectUser.get(input.id) as StoredUser | null
  const role = input.role || existing?.role || "user"
  const admin = input.role ? role === "admin" : existing?.is_admin === 1
  insertUser.run(
    input.id,
    input.email,
    input.name,
    input.picture ?? null,
    role,
    admin ? 1 : 0,
    existing?.created_at ?? now(),
    now()
  )
  if (input.role) updateRole.run(role, role === "admin" ? 1 : 0, input.id)
  return selectUser.get(input.id) as StoredUser
}

export function syncProfile(
  userId: string,
  role?: string | null,
  picture?: string | null
): StoredUser | null {
  const user = selectUser.get(userId) as StoredUser | null
  if (!user) return null
  if (role) updateRole.run(role, role === "admin" ? 1 : 0, userId)
  if (picture && picture !== user.picture) updatePicture.run(picture, userId)
  return selectUser.get(userId) as StoredUser
}

export function getUserById(id: string): StoredUser | null {
  return (selectUser.get(id) as StoredUser | null) ?? null
}

export function touchUser(id: string): void {
  touch.run(now(), id)
}

export function userIsAdmin(user: StoredUser): boolean {
  return user.is_admin === 1 || user.role === "admin"
}

export function userDto(user: StoredUser) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    picture: user.picture,
    role: user.role,
    isAdmin: userIsAdmin(user),
    createdAt: user.created_at,
  }
}

export type UserDto = ReturnType<typeof userDto>

export function countUsers(): number {
  const row = db.query("SELECT COUNT(*) AS count FROM users").get() as { count: number }
  return Number(row.count) || 0
}

export { config }
