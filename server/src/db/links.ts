import { db, now } from "./connection.js"
import config, { publicBaseForHost } from "../config.js"
import { randomSlug, uuid } from "../lib/ids.js"

export type LinkStatus = "active" | "expired" | "disabled"

export interface LinkRow {
  id: string
  user_id: string | null
  domain_id: string
  slug: string
  destination: string
  title: string | null
  is_active: number
  expires_at: number | null
  anon_id: string | null
  click_count: number
  last_clicked_at: number | null
  created_at: number
  updated_at: number
  deleted_at: number | null
  domain_hostname: string
  domain_is_system: number
  domain_status: string
  owner_name: string | null
  owner_email: string | null
}

export interface LinkDto {
  id: string
  slug: string
  shortUrl: string
  destination: string
  title: string | null
  status: LinkStatus
  isActive: boolean
  expiresAt: number | null
  clicks: number
  lastClickedAt: number | null
  createdAt: number
  updatedAt: number
  domain: {
    id: string
    hostname: string
    isSystem: boolean
  }
  owner?: {
    id: string
    name: string
    email: string
  }
}

export class SlugTakenError extends Error {
  constructor() {
    super("That slug is already in use on this domain.")
  }
}

const LINK_SELECT = `
  SELECT l.*, d.hostname AS domain_hostname, d.is_system AS domain_is_system,
         d.status AS domain_status, u.name AS owner_name, u.email AS owner_email
  FROM links l
  JOIN domains d ON d.id = l.domain_id
  LEFT JOIN users u ON u.id = l.user_id
`

const selectById = db.query(`${LINK_SELECT} WHERE l.id = ? AND l.deleted_at IS NULL`)
const selectBySlug = db.query(
  `${LINK_SELECT} WHERE l.domain_id = ? AND l.slug = ? AND l.deleted_at IS NULL`
)
const insertLink = db.query(`
  INSERT INTO links (id, user_id, domain_id, slug, destination, title, is_active, expires_at, anon_id, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
`)
const countUserLinks = db.query(
  "SELECT COUNT(*) AS count FROM links WHERE user_id = ? AND deleted_at IS NULL"
)
const softDelete = db.query("UPDATE links SET deleted_at = ? WHERE id = ?")
const claim = db.query(`
  UPDATE links SET user_id = ?, updated_at = ?
  WHERE anon_id = ? AND user_id IS NULL AND deleted_at IS NULL
`)
const countDomainLinks = db.query(
  "SELECT COUNT(*) AS count FROM links WHERE domain_id = ? AND deleted_at IS NULL"
)

export function statusOf(link: LinkRow): LinkStatus {
  if (link.is_active !== 1) return "disabled"
  if (link.expires_at !== null && link.expires_at <= now()) return "expired"
  return "active"
}

export function linkDto(link: LinkRow): LinkDto {
  const base = publicBaseForHost(link.domain_hostname)
  return {
    id: link.id,
    slug: link.slug,
    shortUrl: `${base}/${link.slug}`,
    destination: link.destination,
    title: link.title,
    status: statusOf(link),
    isActive: link.is_active === 1,
    expiresAt: link.expires_at,
    clicks: link.click_count,
    lastClickedAt: link.last_clicked_at,
    createdAt: link.created_at,
    updatedAt: link.updated_at,
    domain: {
      id: link.domain_id,
      hostname: link.domain_hostname,
      isSystem: link.domain_is_system === 1,
    },
    ...(link.user_id
      ? {
          owner: {
            id: link.user_id,
            name: link.owner_name || "",
            email: link.owner_email || "",
          },
        }
      : {}),
  }
}

export function getLinkById(id: string): LinkRow | null {
  return (selectById.get(id) as LinkRow | null) ?? null
}

export function getLinkBySlug(domainId: string, slug: string): LinkRow | null {
  return (selectBySlug.get(domainId, slug) as LinkRow | null) ?? null
}

export function countLinksForUser(userId: string): number {
  const row = countUserLinks.get(userId) as { count: number }
  return Number(row.count) || 0
}

function isUniqueError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  return /UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE/i.test(message)
}

export interface CreateLinkInput {
  userId: string | null
  domainId: string
  destination: string
  title?: string | null
  slug?: string | null
  expiresAt?: number | null
  anonId?: string | null
}

export function createLink(input: CreateLinkInput): LinkRow {
  const customSlug = Boolean(input.slug)
  const slugValue = input.slug || randomSlug()
  const id = uuid()
  const timestamp = now()

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const slug = attempt === 0 ? slugValue : randomSlug(attempt > 4 ? 9 : 7)
    try {
      insertLink.run(
        id,
        input.userId,
        input.domainId,
        slug,
        input.destination,
        input.title?.trim() || null,
        input.expiresAt ?? null,
        input.anonId ?? null,
        timestamp,
        timestamp
      )
      return getLinkById(id) as LinkRow
    } catch (err) {
      if (!isUniqueError(err)) throw err
      if (customSlug) throw new SlugTakenError()
    }
  }
  throw new Error("Could not generate a unique short code. Please try again.")
}

export interface ListLinksOptions {
  userId: string
  page?: number
  limit?: number
  search?: string
  status?: "all" | LinkStatus
  domain?: string
  sort?: "newest" | "oldest" | "clicks" | "last_clicked" | "expiry"
}

export function listLinks(options: ListLinksOptions): {
  links: LinkRow[]
  total: number
  page: number
  limit: number
} {
  const page = Math.max(options.page ?? 1, 1)
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100)
  const offset = (page - 1) * limit
  const where: string[] = ["l.user_id = ?", "l.deleted_at IS NULL"]
  const params: (string | number)[] = [options.userId]
  const timestamp = now()

  if (options.search) {
    where.push("(lower(l.slug) LIKE ? OR lower(l.destination) LIKE ? OR lower(COALESCE(l.title, '')) LIKE ?)")
    const query = `%${options.search.toLowerCase()}%`
    params.push(query, query, query)
  }
  if (options.status === "active") {
    where.push("l.is_active = 1 AND (l.expires_at IS NULL OR l.expires_at > ?)")
    params.push(timestamp)
  } else if (options.status === "expired") {
    where.push("l.expires_at IS NOT NULL AND l.expires_at <= ?")
    params.push(timestamp)
  } else if (options.status === "disabled") {
    where.push("l.is_active = 0")
  }
  if (options.domain) {
    where.push("d.hostname = ?")
    params.push(options.domain)
  }

  const orderBy =
    options.sort === "oldest"
      ? "l.created_at ASC"
      : options.sort === "clicks"
        ? "l.click_count DESC, l.created_at DESC"
        : options.sort === "last_clicked"
          ? "l.last_clicked_at IS NULL, l.last_clicked_at DESC"
          : options.sort === "expiry"
            ? "l.expires_at IS NULL, l.expires_at ASC"
            : "l.created_at DESC"

  const clause = where.join(" AND ")
  const links = db
    .query(`${LINK_SELECT} WHERE ${clause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as LinkRow[]
  const total = db
    .query(`SELECT COUNT(*) AS count FROM links l JOIN domains d ON d.id = l.domain_id WHERE ${clause}`)
    .get(...params) as { count: number }

  return { links, total: Number(total.count), page, limit }
}

export interface UpdateLinkInput {
  destination?: string
  slug?: string
  title?: string | null
  isActive?: boolean
  expiresAt?: number | null
  domainId?: string
}

export function updateLink(id: string, input: UpdateLinkInput): LinkRow {
  const existing = getLinkById(id)
  if (!existing) throw new Error("Link not found")

  const sets: string[] = []
  const params: (string | number | null)[] = []

  if (input.destination !== undefined) {
    sets.push("destination = ?")
    params.push(input.destination)
  }
  if (input.slug !== undefined) {
    sets.push("slug = ?")
    params.push(input.slug)
  }
  if (input.title !== undefined) {
    sets.push("title = ?")
    params.push(input.title?.trim() || null)
  }
  if (input.isActive !== undefined) {
    sets.push("is_active = ?")
    params.push(input.isActive ? 1 : 0)
  }
  if (input.expiresAt !== undefined) {
    sets.push("expires_at = ?")
    params.push(input.expiresAt)
  }
  if (input.domainId !== undefined) {
    sets.push("domain_id = ?")
    params.push(input.domainId)
  }
  if (sets.length === 0) return existing

  const nextDomain = input.domainId ?? existing.domain_id
  const nextSlug = input.slug ?? existing.slug
  if (nextDomain !== existing.domain_id || nextSlug !== existing.slug) {
    const conflict = getLinkBySlug(nextDomain, nextSlug)
    if (conflict && conflict.id !== id) throw new SlugTakenError()
  }

  sets.push("updated_at = ?")
  params.push(now(), id)
  try {
    db.query(`UPDATE links SET ${sets.join(", ")} WHERE id = ? AND deleted_at IS NULL`).run(...params)
  } catch (err) {
    if (isUniqueError(err)) throw new SlugTakenError()
    throw err
  }
  return getLinkById(id) as LinkRow
}

export function deleteLink(id: string): void {
  softDelete.run(now(), id)
}

export function claimAnonymousLinks(userId: string, anonId: string): number {
  return claim.run(userId, now(), anonId).changes
}

export function maxLinksReached(userId: string): boolean {
  return countLinksForUser(userId) >= config.limits.maxLinksPerUser
}

export function countLinksForDomain(domainId: string): number {
  const row = countDomainLinks.get(domainId) as { count: number }
  return Number(row.count) || 0
}
