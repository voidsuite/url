import config from "../config.js"

export class UrlValidationError extends Error {}

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /\.localhost$/i,
  /\.local$/i,
  /\.internal$/i,
  /\.lan$/i,
  /\.home$/i,
  /\.corp$/i,
  /\.private$/i,
]

function parseIpv4(hostname: string): number[] | null {
  const parts = hostname.split(".")
  if (parts.length !== 4) return null
  const numbers = parts.map((part) => Number(part))
  if (numbers.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null
  return numbers
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = parseIpv4(hostname)
  if (!parts) return false
  const [a, b] = parts
  if (a === 10) return true
  if (a === 127) return true
  if (a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  if (a >= 224) return true
  return false
}

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "")
  if (PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(host))) return true
  if (isPrivateIpv4(host)) return true
  if (host.startsWith("[") && host.endsWith("]")) {
    const inner = host.slice(1, -1)
    return inner === "::1" || inner.startsWith("fc") || inner.startsWith("fd") || inner.startsWith("fe80")
  }
  return false
}

/**
 * Accepts `example.com` or a full URL, returns a canonical http(s) URL.
 * We never fetch destinations, but blocking private hosts keeps short links
 * from being used to point at intranet services or confusing local targets.
 */
export function normalizeDestination(
  raw: string,
  options: { maxLength?: number } = {}
): string {
  const maxLength = options.maxLength ?? config.limits.maxUrlLength
  let value = (raw || "").trim()
  if (!value) throw new UrlValidationError("Paste a URL to shorten.")
  if (value.length > maxLength) {
    throw new UrlValidationError(`That URL is longer than the ${maxLength.toLocaleString()} character limit.`)
  }
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    throw new UrlValidationError("That URL contains control characters.")
  }
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    // Bare hostnames get https:// rather than an error. `mailto:` and other
    // schemes are still rejected below.
    value = `https://${value}`
  }

  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new UrlValidationError("That does not look like a valid URL.")
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UrlValidationError("Only http and https links can be shortened.")
  }
  if (url.username || url.password) {
    throw new UrlValidationError("URLs with embedded credentials are not allowed.")
  }
  if (!url.hostname) throw new UrlValidationError("That URL has no hostname.")
  if (isPrivateHostname(url.hostname)) {
    throw new UrlValidationError("Local and private network addresses cannot be shortened.")
  }
  if (config.blockedHosts.includes(url.hostname.toLowerCase())) {
    throw new UrlValidationError("That destination is not allowed.")
  }
  if (url.hostname.includes(" ")) throw new UrlValidationError("That URL has an invalid hostname.")

  return url.toString()
}

/** A display-safe hostname for UI + analytics. */
export function hostnameOf(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

export function sanitizeReferrer(raw: string | undefined | null): { referrer: string | null; host: string | null } {
  if (!raw) return { referrer: null, host: null }
  try {
    const url = new URL(raw)
    if (url.protocol !== "http:" && url.protocol !== "https:") return { referrer: null, host: null }
    return {
      referrer: url.toString().slice(0, 2048),
      host: url.hostname.replace(/^www\./, "").slice(0, 255) || null,
    }
  } catch {
    return { referrer: null, host: null }
  }
}

export function truncate(value: string, length: number): string {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value
}
