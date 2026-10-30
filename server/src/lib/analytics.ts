export type DeviceKind = "desktop" | "mobile" | "tablet" | "other"

export interface ParsedUserAgent {
  device: DeviceKind
  browser: string
  os: string
  isBot: boolean
}

const BOT_PATTERN =
  /bot|crawler|spider|headless|preview|slurp|facebookexternalhit|whatsapp|telegrambot|discordbot|slackbot|twitterbot|linkedinbot|embedly|pinterest|ahrefs|semrush|bingpreview|google-inspectiontool|yandex|baiduspider|duckduckbot|petalbot|applebot/i

export function parseUserAgent(ua: string | undefined | null): ParsedUserAgent {
  const value = (ua || "").trim()
  if (!value) return { device: "other", browser: "Unknown", os: "Unknown", isBot: false }

  const isBot = BOT_PATTERN.test(value)

  let browser = "Other"
  if (/Edg\//i.test(value)) browser = "Edge"
  else if (/OPR\/|Opera/i.test(value)) browser = "Opera"
  else if (/SamsungBrowser/i.test(value)) browser = "Samsung Internet"
  else if (/Firefox\/|FxiOS\//i.test(value)) browser = "Firefox"
  else if (/CriOS\/|Chrome\//i.test(value)) browser = "Chrome"
  else if (/Safari\//i.test(value)) browser = "Safari"
  else if (/MSIE|Trident/i.test(value)) browser = "Internet Explorer"

  let os = "Other"
  if (/Windows NT/i.test(value)) os = "Windows"
  else if (/Android/i.test(value)) os = "Android"
  else if (/iPhone|iPad|iPod/i.test(value)) os = "iOS"
  else if (/Mac OS X|Macintosh/i.test(value)) os = "macOS"
  else if (/CrOS/i.test(value)) os = "ChromeOS"
  else if (/Linux/i.test(value)) os = "Linux"

  let device: DeviceKind = "desktop"
  if (/iPad|Tablet|PlayBook|Silk/i.test(value) || (/Android/i.test(value) && !/Mobile/i.test(value))) {
    device = "tablet"
  } else if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(value)) {
    device = "mobile"
  }
  if (isBot) device = "other"

  return { device, browser, os, isBot }
}

export function countryFromHeaders(headers: Headers): string | null {
  const code =
    headers.get("cf-ipcountry") ||
    headers.get("x-vercel-ip-country") ||
    headers.get("x-country-code") ||
    ""
  const normalized = code.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(normalized)) return null
  return normalized
}

export function languageFromHeaders(headers: Headers): string | null {
  const header = headers.get("accept-language") || ""
  const first = header.split(",")[0]?.trim()
  if (!first) return null
  const language = first.split(";")[0]?.trim().slice(0, 20)
  return language || null
}
