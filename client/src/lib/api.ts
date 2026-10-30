export class ApiError extends Error {
  status: number
  code?: string
  retryAfter?: number

  constructor(message: string, status: number, code?: string, retryAfter?: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
    this.retryAfter = retryAfter
  }
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown
  query?: Record<string, string | number | boolean | undefined | null>
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  if (!query) return path
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue
    params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

export function getAnonId(): string {
  const key = "voidlinks:anonId"
  try {
    const existing = localStorage.getItem(key)
    if (existing && /^[a-zA-Z0-9-]{16,64}$/.test(existing)) return existing
    const next = crypto.randomUUID()
    localStorage.setItem(key, next)
    return next
  } catch {
    return crypto.randomUUID()
  }
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, query, headers, ...rest } = options
  const response = await fetch(buildUrl(path, query), {
    ...rest,
    credentials: "include",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(headers as Record<string, string> | undefined),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const contentType = response.headers.get("content-type") || ""
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "")

  if (!response.ok) {
    const message =
      (data && typeof data === "object" && "error" in data && String((data as { error: unknown }).error)) ||
      `Request failed (${response.status})`
    const retryAfterHeader = response.headers.get("retry-after")
    const retryAfter =
      (data && typeof data === "object" && typeof (data as { retryAfter?: unknown }).retryAfter === "number"
        ? (data as { retryAfter: number }).retryAfter
        : undefined) ??
      (retryAfterHeader ? Number(retryAfterHeader) : undefined)
    if (response.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("voidlinks:unauthorized"))
    }
    throw new ApiError(
      message,
      response.status,
      data && typeof data === "object" ? (data as { code?: string }).code : undefined,
      Math.max(0, retryAfter || 0),
    )
  }

  return data as T
}

export const get = <T>(path: string, query?: RequestOptions["query"]) => api<T>(path, { method: "GET", query })
export const post = <T>(path: string, body?: unknown) => api<T>(path, { method: "POST", body })
export const patch = <T>(path: string, body?: unknown) => api<T>(path, { method: "PATCH", body })
export const del = <T>(path: string) => api<T>(path, { method: "DELETE" })

export async function startLogin(returnTo?: string): Promise<void> {
  const { authUrl } = await api<{ authUrl: string }>("/api/auth/login")
  const destination = returnTo ?? `${window.location.pathname}${window.location.search}`
  if (destination && !destination.startsWith("/oauth/callback")) {
    sessionStorage.setItem("voidlinks:returnTo", destination)
  }
  window.location.assign(authUrl)
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const area = document.createElement("textarea")
      area.value = text
      area.style.position = "fixed"
      area.style.opacity = "0"
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand("copy")
      document.body.removeChild(area)
      return ok
    } catch {
      return false
    }
  }
}

export function absoluteUrl(url: string | null | undefined): string {
  if (!url) return ""
  if (/^https?:\/\//i.test(url)) return url
  return `${window.location.origin}${url.startsWith("/") ? "" : "/"}${url}`
}

export interface RecentLink {
  id: string
  slug: string
  shortUrl: string
  destination: string
  domain: string
  createdAt: number
}

const RECENT_KEY = "voidlinks:recent"
const RECENT_LIMIT = 6

export function readRecentLinks(): RecentLink[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item): item is RecentLink => Boolean(item && typeof item.shortUrl === "string"))
      .slice(0, RECENT_LIMIT)
  } catch {
    return []
  }
}

export function rememberLink(link: RecentLink): RecentLink[] {
  const next = [link, ...readRecentLinks().filter((item) => item.shortUrl !== link.shortUrl)].slice(0, RECENT_LIMIT)
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    /* storage full or disabled */
  }
  return next
}

export function forgetRecentLink(shortUrl: string): RecentLink[] {
  const next = readRecentLinks().filter((item) => item.shortUrl !== shortUrl)
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  return next
}

export function clearRecentLinks(): void {
  try {
    localStorage.removeItem(RECENT_KEY)
  } catch {
    /* ignore */
  }
}
