import { createHash } from "node:crypto"
import { db, now } from "./connection.js"
import config, { publicBaseForHost } from "../config.js"
import type { LinkRow } from "./links.js"

export interface ClickInput {
  linkId: string
  domainId: string
  ip: string
  userAgent: string | null
  referrer: string | null
  referrerHost: string | null
  country: string | null
  device: string
  browser: string
  os: string
  language: string | null
  isBot: boolean
  clickedAt: number
}

export interface TimePoint {
  date: string
  clicks: number
  uniques: number
}

export interface BreakdownItem {
  label: string
  value: number
}

export interface RecentClick {
  id: number
  clickedAt: number
  country: string | null
  referrerHost: string | null
  device: string
  browser: string
  os: string
  isBot: boolean
}

export interface Metrics {
  summary: {
    clicks: number
    uniques: number
    bots: number
    lastClickedAt: number | null
  }
  series: TimePoint[]
  previousClicks: number
  referrers: BreakdownItem[]
  countries: BreakdownItem[]
  devices: BreakdownItem[]
  browsers: BreakdownItem[]
  recent: RecentClick[]
}

const insertClick = db.query(`
  INSERT INTO clicks (link_id, domain_id, clicked_at, visitor_hash, country, referrer, referrer_host, device, browser, os, language, is_bot)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)
const bumpLink = db.query(
  "UPDATE links SET click_count = click_count + 1, last_clicked_at = ? WHERE id = ?"
)
const prune = db.query("DELETE FROM clicks WHERE clicked_at < ?")

const DAY = 24 * 60 * 60 * 1000

export function visitorHash(ip: string, userAgent: string | null, dayStart: number): string {
  return createHash("sha256")
    .update(`${config.ipHashSecret}|${ip}|${userAgent || ""}|${dayStart}`)
    .digest("hex")
    .slice(0, 32)
}

export function recordClick(input: ClickInput): void {
  const dayStart = Math.floor(input.clickedAt / DAY) * DAY
  insertClick.run(
    input.linkId,
    input.domainId,
    input.clickedAt,
    visitorHash(input.ip, input.userAgent, dayStart),
    input.country,
    input.referrer,
    input.referrerHost,
    input.device,
    input.browser,
    input.os,
    input.language,
    input.isBot ? 1 : 0
  )
  if (!input.isBot) {
    bumpLink.run(input.clickedAt, input.linkId)
  }
}

function startOfUtcDay(timestamp: number): number {
  const date = new Date(timestamp)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

function dayKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10)
}

export function rangeStart(days: number): number {
  const count = Math.min(Math.max(days, 1), config.analytics.maxDays)
  return startOfUtcDay(now()) - (count - 1) * DAY
}

function fillSeries(rows: { day: string; clicks: number; uniques: number }[], days: number, start: number): TimePoint[] {
  const map = new Map(rows.map((row) => [row.day, row]))
  const series: TimePoint[] = []
  for (let index = 0; index < days; index += 1) {
    const date = dayKey(start + index * DAY)
    const row = map.get(date)
    series.push({
      date,
      clicks: Number(row?.clicks ?? 0),
      uniques: Number(row?.uniques ?? 0),
    })
  }
  return series
}

function breakdown(
  table: string,
  column: string,
  condition: string,
  params: (string | number)[],
  emptyLabel = "Unknown"
): BreakdownItem[] {
  const rows = db
    .query(
      `SELECT COALESCE(NULLIF(${column}, ''), '${emptyLabel}') AS label, COUNT(*) AS value
       FROM ${table} WHERE ${condition} GROUP BY label ORDER BY value DESC LIMIT 8`
    )
    .all(...params) as { label: string; value: number }[]
  return rows.map((row) => ({ label: row.label, value: Number(row.value) }))
}

export function getLinkMetrics(link: LinkRow, days: number): Metrics {
  const count = Math.min(Math.max(days, 1), config.analytics.maxDays)
  const start = rangeStart(count)
  const previousStart = start - count * DAY

  const summary = db
    .query(
      `SELECT COUNT(*) AS clicks, COUNT(DISTINCT visitor_hash) AS uniques
       FROM clicks WHERE link_id = ? AND is_bot = 0 AND clicked_at >= ?`
    )
    .get(link.id, start) as { clicks: number; uniques: number }
  const bots = db
    .query("SELECT COUNT(*) AS count FROM clicks WHERE link_id = ? AND is_bot = 1 AND clicked_at >= ?")
    .get(link.id, start) as { count: number }
  const previous = db
    .query(
      "SELECT COUNT(*) AS count FROM clicks WHERE link_id = ? AND is_bot = 0 AND clicked_at >= ? AND clicked_at < ?"
    )
    .get(link.id, previousStart, start) as { count: number }

  const seriesRows = db
    .query(
      `SELECT strftime('%Y-%m-%d', clicked_at / 1000, 'unixepoch') AS day,
              COUNT(*) AS clicks, COUNT(DISTINCT visitor_hash) AS uniques
       FROM clicks WHERE link_id = ? AND is_bot = 0 AND clicked_at >= ?
       GROUP BY day ORDER BY day ASC`
    )
    .all(link.id, start) as { day: string; clicks: number; uniques: number }[]

  return {
    summary: {
      clicks: Number(summary.clicks) || 0,
      uniques: Number(summary.uniques) || 0,
      bots: Number(bots.count) || 0,
      lastClickedAt: link.last_clicked_at,
    },
    series: fillSeries(seriesRows, count, start),
    previousClicks: Number(previous.count) || 0,
    referrers: breakdown(
      "clicks",
      "referrer_host",
      "link_id = ? AND is_bot = 0 AND clicked_at >= ?",
      [link.id, start],
      "Direct"
    ),
    countries: breakdown(
      "clicks",
      "country",
      "link_id = ? AND is_bot = 0 AND clicked_at >= ?",
      [link.id, start]
    ),
    devices: breakdown(
      "clicks",
      "device",
      "link_id = ? AND is_bot = 0 AND clicked_at >= ?",
      [link.id, start]
    ),
    browsers: breakdown(
      "clicks",
      "browser",
      "link_id = ? AND is_bot = 0 AND clicked_at >= ?",
      [link.id, start]
    ),
    recent: db
      .query(
        `SELECT id, clicked_at AS clickedAt, country, referrer_host AS referrerHost,
                device, browser, os, is_bot AS isBot
         FROM clicks WHERE link_id = ? AND is_bot = 0
         ORDER BY clicked_at DESC LIMIT 20`
      )
      .all(link.id) as RecentClick[],
  }
}

export interface Overview {
  stats: {
    links: number
    activeLinks: number
    clicks: number
    uniques: number
    clicksInRange: number
    previousClicks: number
    bots: number
    topCountry: string | null
  }
  series: TimePoint[]
  topLinks: {
    id: string
    slug: string
    shortUrl: string
    destination: string
    clicks: number
    lastClickedAt: number | null
  }[]
  recent: (RecentClick & { linkId: string; slug: string; shortUrl: string })[]
}

export function getOverview(userId: string, days: number): Overview {
  const count = Math.min(Math.max(days, 1), config.analytics.maxDays)
  const start = rangeStart(count)
  const previousStart = start - count * DAY

  const linkCounts = db
    .query(
      `SELECT COUNT(*) AS links,
              SUM(CASE WHEN is_active = 1 AND (expires_at IS NULL OR expires_at > ?) THEN 1 ELSE 0 END) AS active,
              COALESCE(SUM(click_count), 0) AS clicks
       FROM links WHERE user_id = ? AND deleted_at IS NULL`
    )
    .get(now(), userId) as { links: number; active: number; clicks: number }

  const summary = db
    .query(
      `SELECT COUNT(*) AS clicks, COUNT(DISTINCT c.visitor_hash) AS uniques,
              SUM(CASE WHEN c.is_bot = 1 THEN 1 ELSE 0 END) AS bots
       FROM clicks c JOIN links l ON l.id = c.link_id
       WHERE l.user_id = ? AND l.deleted_at IS NULL AND c.clicked_at >= ?`
    )
    .get(userId, start) as { clicks: number; uniques: number; bots: number }

  const previous = db
    .query(
      `SELECT COUNT(*) AS count FROM clicks c JOIN links l ON l.id = c.link_id
       WHERE l.user_id = ? AND l.deleted_at IS NULL AND c.is_bot = 0 AND c.clicked_at >= ? AND c.clicked_at < ?`
    )
    .get(userId, previousStart, start) as { count: number }

  const seriesRows = db
    .query(
      `SELECT strftime('%Y-%m-%d', c.clicked_at / 1000, 'unixepoch') AS day,
              COUNT(*) AS clicks, COUNT(DISTINCT c.visitor_hash) AS uniques
       FROM clicks c JOIN links l ON l.id = c.link_id
       WHERE l.user_id = ? AND l.deleted_at IS NULL AND c.is_bot = 0 AND c.clicked_at >= ?
       GROUP BY day ORDER BY day ASC`
    )
    .all(userId, start) as { day: string; clicks: number; uniques: number }[]

  const topCountryRow = db
    .query(
      `SELECT country FROM clicks c JOIN links l ON l.id = c.link_id
       WHERE l.user_id = ? AND l.deleted_at IS NULL AND c.is_bot = 0 AND c.clicked_at >= ?
         AND country IS NOT NULL
       GROUP BY country ORDER BY COUNT(*) DESC LIMIT 1`
    )
    .get(userId, start) as { country: string } | null

  const topLinks = db
    .query(
      `SELECT l.id, l.slug, l.destination, l.click_count AS clicks, l.last_clicked_at AS lastClickedAt,
              d.hostname
       FROM links l JOIN domains d ON d.id = l.domain_id
       WHERE l.user_id = ? AND l.deleted_at IS NULL
       ORDER BY l.click_count DESC, l.created_at DESC LIMIT 5`
    )
    .all(userId) as {
    id: string
    slug: string
    destination: string
    clicks: number
    lastClickedAt: number | null
    hostname: string
  }[]

  const recent = db
    .query(
      `SELECT c.id, c.clicked_at AS clickedAt, c.country, c.referrer_host AS referrerHost,
              c.device, c.browser, c.os, c.is_bot AS isBot,
              l.id AS linkId, l.slug, d.hostname
       FROM clicks c JOIN links l ON l.id = c.link_id JOIN domains d ON d.id = l.domain_id
       WHERE l.user_id = ? AND l.deleted_at IS NULL AND c.is_bot = 0
       ORDER BY c.clicked_at DESC LIMIT 8`
    )
    .all(userId) as (RecentClick & { linkId: string; slug: string; hostname: string })[]

  return {
    stats: {
      links: Number(linkCounts.links) || 0,
      activeLinks: Number(linkCounts.active) || 0,
      clicks: Number(linkCounts.clicks) || 0,
      uniques: Number(summary.uniques) || 0,
      clicksInRange: Number(summary.clicks) || 0,
      previousClicks: Number(previous.count) || 0,
      bots: Number(summary.bots) || 0,
      topCountry: topCountryRow?.country || null,
    },
    series: fillSeries(seriesRows, count, start),
    topLinks: topLinks.map((row) => ({
      id: row.id,
      slug: row.slug,
      shortUrl: `${publicBaseForHost(row.hostname)}/${row.slug}`,
      destination: row.destination,
      clicks: Number(row.clicks) || 0,
      lastClickedAt: row.lastClickedAt,
    })),
    recent: recent.map((row) => ({
      ...row,
      shortUrl: `${publicBaseForHost(row.hostname)}/${row.slug}`,
    })),
  }
}

export function pruneClicks(days = config.analytics.clickRetentionDays): number {
  return prune.run(now() - days * DAY).changes
}
