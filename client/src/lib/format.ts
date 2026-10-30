export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "0"
  return new Intl.NumberFormat(undefined).format(value)
}

export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "0"
  if (Math.abs(value) < 1000) return String(value)
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value)
}

export function formatDate(ts: number | null | undefined): string {
  if (!ts) return "—"
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

export function formatDateTime(ts: number | null | undefined): string {
  if (!ts) return "—"
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function formatDayShort(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`)
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })
}

export function relativeTime(ts: number | null | undefined): string {
  if (!ts) return "—"
  const diff = ts - Date.now()
  const abs = Math.abs(diff)
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 365 * 24 * 60 * 60 * 1000],
    ["month", 30 * 24 * 60 * 60 * 1000],
    ["day", 24 * 60 * 60 * 1000],
    ["hour", 60 * 60 * 1000],
    ["minute", 60 * 1000],
  ]
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })
  for (const [unit, ms] of units) {
    if (abs >= ms || unit === "minute") {
      return formatter.format(Math.round(diff / ms), unit)
    }
  }
  return "just now"
}

export function expiryLabel(ts: number | null | undefined): string {
  if (!ts) return "Never expires"
  if (ts <= Date.now()) return "Expired"
  return `Expires ${relativeTime(ts)}`
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return Math.round(((current - previous) / previous) * 100)
}

export function initials(name: string | null | undefined, fallback = "?"): string {
  const value = (name || "").trim()
  if (!value) return fallback
  const parts = value.split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

export function firstName(name: string | null | undefined): string {
  return (name || "").trim().split(/\s+/)[0] || ""
}

export function hostnameOf(url: string | null | undefined): string {
  if (!url) return ""
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url.replace(/^https?:\/\//, "").split("/")[0] || ""
  }
}

export function truncateMiddle(value: string, max = 44): string {
  if (value.length <= max) return value
  const half = Math.floor((max - 1) / 2)
  return `${value.slice(0, half)}…${value.slice(-half)}`
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`
}

export function countryName(code: string | null | undefined): string {
  if (!code) return "Unknown"
  if (code === "Unknown") return code
  try {
    const names = new Intl.DisplayNames(undefined, { type: "region" })
    return names.of(code.toUpperCase()) || code
  } catch {
    return code
  }
}

export function relativeRange(days: number): string {
  if (days === 1) return "24 hours"
  if (days === 7) return "7 days"
  if (days === 30) return "30 days"
  if (days === 90) return "90 days"
  if (days === 365) return "12 months"
  return `${days} days`
}

export function deviceLabel(device: string): string {
  switch (device) {
    case "desktop":
      return "Desktop"
    case "mobile":
      return "Mobile"
    case "tablet":
      return "Tablet"
    default:
      return "Other"
  }
}
