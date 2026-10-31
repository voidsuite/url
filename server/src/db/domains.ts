import { db, now } from "./connection.js"
import config, { publicBaseForHost } from "../config.js"
import { newToken, uuid } from "../lib/ids.js"

export type DomainStatus = "verified" | "pending" | "failed" | "disabled"

export interface DomainRow {
  id: string
  hostname: string
  owner_user_id: string | null
  is_system: number
  is_default: number
  status: DomainStatus
  verification_token: string | null
  verified_at: number | null
  last_checked_at: number | null
  created_at: number
  deleted_at: number | null
}

export interface DomainDto {
  id: string
  hostname: string
  url: string
  isSystem: boolean
  isDefault: boolean
  status: DomainStatus
  verifiedAt: number | null
  createdAt: number
  dns: {
    txtName: string
    txtValue: string | null
    cnameTarget: string
    aTarget: string | null
  }
}

const selectById = db.query("SELECT * FROM domains WHERE id = ?")
const selectByHost = db.query(
  "SELECT * FROM domains WHERE hostname = ? AND deleted_at IS NULL"
)
const selectPublic = db.query(
  "SELECT * FROM domains WHERE is_system = 1 AND status = 'verified' AND deleted_at IS NULL ORDER BY is_default DESC, hostname ASC"
)
const selectForUser = db.query(`
  SELECT * FROM domains
  WHERE deleted_at IS NULL AND (owner_user_id = ? OR (is_system = 1 AND status = 'verified'))
  ORDER BY is_default DESC, is_system DESC, hostname ASC
`)
const selectOwned = db.query(
  "SELECT * FROM domains WHERE owner_user_id = ? AND deleted_at IS NULL ORDER BY created_at ASC"
)
const countOwned = db.query(
  "SELECT COUNT(*) AS count FROM domains WHERE owner_user_id = ? AND deleted_at IS NULL"
)
const selectForRecheck = db.query(`
  SELECT * FROM domains
  WHERE deleted_at IS NULL AND is_system = 0 AND status IN ('pending', 'failed')
  ORDER BY COALESCE(last_checked_at, 0) ASC LIMIT ?
`)
const insert = db.query(`
  INSERT INTO domains (id, hostname, owner_user_id, is_system, is_default, status, verification_token, verified_at, last_checked_at, created_at)
  VALUES (?, ?, ?, 0, 0, ?, ?, ?, ?, ?)
`)
const updateStatus = db.query(
  "UPDATE domains SET status = ?, verified_at = ?, last_checked_at = ? WHERE id = ?"
)
const softDelete = db.query(
  "UPDATE domains SET deleted_at = ?, status = 'disabled', is_default = 0 WHERE id = ?"
)

export function getDomainById(id: string): DomainRow | null {
  return (selectById.get(id) as DomainRow | null) ?? null
}

export function getDomainByHostname(hostname: string): DomainRow | null {
  return (selectByHost.get(hostname.toLowerCase().replace(/\.$/, "")) as DomainRow | null) ?? null
}

export function listPublicDomains(): DomainRow[] {
  return selectPublic.all() as DomainRow[]
}

export function listDomainsForUser(userId: string): DomainRow[] {
  return selectForUser.all(userId) as DomainRow[]
}

export function listOwnedDomains(userId: string): DomainRow[] {
  return selectOwned.all(userId) as DomainRow[]
}

export function listDomainsForRecheck(limit = 10): DomainRow[] {
  return selectForRecheck.all(limit) as DomainRow[]
}

export function countOwnedDomains(userId: string): number {
  const row = countOwned.get(userId) as { count: number }
  return Number(row.count) || 0
}

export function domainDto(domain: DomainRow): DomainDto {
  return {
    id: domain.id,
    hostname: domain.hostname,
    url: publicBaseForHost(domain.hostname),
    isSystem: domain.is_system === 1,
    isDefault: domain.is_default === 1,
    status: domain.status,
    verifiedAt: domain.verified_at,
    createdAt: domain.created_at,
    dns: {
      txtName: `${config.domains.txtPrefix}.${domain.hostname}`,
      txtValue: domain.verification_token,
      cnameTarget: config.domains.cnameTarget,
      aTarget: config.domains.aTarget || null,
    },
  }
}

export interface CreateDomainInput {
  hostname: string
  ownerUserId: string
}

export function createCustomDomain(input: CreateDomainInput): DomainRow {
  const hostname = input.hostname.trim().toLowerCase().replace(/\.$/, "")
  if (countOwnedDomains(input.ownerUserId) >= config.limits.maxCustomDomainsPerUser) {
    throw new Error(`You can add up to ${config.limits.maxCustomDomainsPerUser} custom domains.`)
  }
  if (getDomainByHostname(hostname)) {
    throw new Error("That domain is already connected.")
  }

  const autoVerify = config.domains.allowUnverified
  const id = uuid()
  const token = `voidurl-verify=${newToken(24)}`
  insert.run(
    id,
    hostname,
    input.ownerUserId,
    autoVerify ? "verified" : "pending",
    token,
    autoVerify ? now() : null,
    now(),
    now()
  )
  return getDomainById(id) as DomainRow
}

export function setDomainVerification(
  id: string,
  status: DomainStatus,
  verified: boolean
): DomainRow | null {
  updateStatus.run(status, verified ? now() : null, now(), id)
  return getDomainById(id)
}

export function deleteCustomDomain(id: string, ownerUserId: string): boolean {
  const domain = getDomainById(id)
  if (!domain || domain.owner_user_id !== ownerUserId || domain.is_system === 1) return false
  softDelete.run(now(), id)
  return true
}

export function isDomainUsable(domain: DomainRow | null): domain is DomainRow {
  return Boolean(
    domain && domain.deleted_at === null && (domain.is_system === 1 || domain.status === "verified")
  )
}
