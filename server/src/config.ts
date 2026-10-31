/**
 * Void Links configuration — env driven only. Generated short links are built
 * exclusively from SHORT_DOMAINS; custom domains are added at runtime and are
 * always https outside development.
 */

const int = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value || "", 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

const bool = (value: string | undefined, fallback = false) =>
  value === undefined ? fallback : ["1", "true", "yes", "on"].includes(value.toLowerCase())

const trim = (value: string | undefined) => (value || "").trim()

const originOf = (value: string): string | null => {
  try {
    const url = new URL(value.trim())
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    return url.origin
  } catch {
    return null
  }
}

const hostOf = (value: string): string => {
  try {
    return new URL(value).hostname.toLowerCase().replace(/\.$/, "")
  } catch {
    return ""
  }
}

const isLoopback = (hostname: string) =>
  hostname === "localhost" ||
  hostname.endsWith(".localhost") ||
  hostname === "127.0.0.1" ||
  hostname === "::1" ||
  hostname === "[::1]"

const port = int(process.env.PORT, 3008)
const nodeEnv = trim(process.env.NODE_ENV) || "development"
const appUrl = (originOf(trim(process.env.APP_URL)) || `http://localhost:5190`).replace(/\/+$/, "")
// Production if explicitly set, or if the public app origin is https.
const isProduction = nodeEnv === "production" || appUrl.startsWith("https://")

const defaultShortDomains = isProduction
  ? "https://v0id.cc,https://void.hm"
  : `http://localhost:${port}`

const rawShortDomains = trim(process.env.SHORT_DOMAINS) || defaultShortDomains
const shortDomainOrigins = Array.from(
  new Set(
    rawShortDomains
      .split(",")
      .map((entry) => originOf(entry))
      .filter((entry): entry is string => Boolean(entry))
  )
)

if (shortDomainOrigins.length === 0) {
  throw new Error("SHORT_DOMAINS must contain at least one http(s) origin")
}

if (isProduction) {
  for (const origin of shortDomainOrigins) {
    const host = hostOf(origin)
    if (!origin.startsWith("https://") || isLoopback(host)) {
      throw new Error(
        `Refusing to start: production short domains must be public https origins (got ${origin}). ` +
          "Generated links may never point at localhost in production."
      )
    }
  }
  if (isLoopback(hostOf(appUrl))) {
    throw new Error("Refusing to start: APP_URL must not be localhost in production")
  }
}

const defaultDomainHost =
  trim(process.env.DEFAULT_SHORT_DOMAIN) || hostOf(shortDomainOrigins[0]) || "localhost"

const allowedOrigins = Array.from(
  new Set(
    [
      appUrl,
      ...(!isProduction ? ["http://localhost:5190", `http://localhost:${port}`] : []),
      ...trim(process.env.ALLOWED_ORIGINS)
        .split(",")
        .map((entry) => originOf(entry))
        .filter((entry): entry is string => Boolean(entry)),
    ].filter(Boolean)
  )
)

const config = {
  port,
  nodeEnv,
  isProduction,
  appUrl,
  appHost: hostOf(appUrl),
  allowedOrigins,
  voidauthUrl: (trim(process.env.VOIDAUTH_URL) || "https://auth.stwupid.tech").replace(/\/+$/, ""),
  clientId: trim(process.env.VOIDURL_CLIENT_ID) || "voidurl",
  clientSecret: trim(process.env.VOIDURL_CLIENT_SECRET),
  oauthScopes: trim(process.env.VOIDAUTH_SCOPES) || "openid profile email read write role",
  sessionCookie: "voidurl_sid",
  sessionTtlDays: int(process.env.SESSION_TTL_DAYS, 30),
  dataDir: trim(process.env.DATA_DIR) || "./data",
  trustProxy: bool(process.env.TRUST_PROXY, false),
  ipHashSecret: trim(process.env.IP_HASH_SECRET) || "voidlinks-dev-secret",
  shortDomains: shortDomainOrigins.map((origin) => ({
    origin,
    hostname: hostOf(origin),
    isDefault: hostOf(origin) === defaultDomainHost,
  })),
  defaultDomainHost,
  limits: {
    anonPerMinute: int(process.env.ANON_LINKS_PER_MINUTE, 3),
    anonPerHour: int(process.env.ANON_LINKS_PER_HOUR, 12),
    anonPerDay: int(process.env.ANON_LINKS_PER_DAY, 40),
    authPerHour: int(process.env.AUTH_LINKS_PER_HOUR, 120),
    maxLinksPerUser: int(process.env.MAX_LINKS_PER_USER, 5000),
    maxCustomDomainsPerUser: int(process.env.MAX_CUSTOM_DOMAINS_PER_USER, 5),
    maxUrlLength: int(process.env.MAX_URL_LENGTH, 4096),
  },
  analytics: {
    clickRetentionDays: int(process.env.CLICK_RETENTION_DAYS, 365),
    defaultDays: int(process.env.ANALYTICS_DEFAULT_DAYS, 30),
    maxDays: 365,
  },
  domains: {
    txtPrefix: trim(process.env.DOMAIN_TXT_PREFIX) || "_voidurl",
    cnameTarget:
      trim(process.env.DOMAIN_CNAME_TARGET) || hostOf(shortDomainOrigins[0]) || "v0id.cc",
    // Optional A-record target shown when a user verifies by TXT instead of CNAME.
    aTarget: trim(process.env.DOMAIN_A_TARGET),
    allowUnverified: bool(process.env.ALLOW_UNVERIFIED_DOMAINS, !isProduction),
  },
  provisioning: {
    // Creates a per-domain nginx vhost and Let's Encrypt certificate once DNS
    // points here. Enabled by default in production; the helper script must
    // exist on the host.
    enabled: bool(process.env.DOMAIN_PROVISION_ENABLED, isProduction),
    script: trim(process.env.DOMAIN_PROVISION_SCRIPT) || "/usr/local/bin/voidurl-domain",
  },
  smtp: {
    host: trim(process.env.SMTP_HOST),
    port: int(process.env.SMTP_PORT, 587),
    secure: bool(process.env.SMTP_SECURE, false),
    user: trim(process.env.SMTP_USER),
    pass: trim(process.env.SMTP_PASS),
    from: trim(process.env.SMTP_FROM) || trim(process.env.SMTP_USER),
    fromName: trim(process.env.SMTP_FROM_NAME) || "Void Links",
    // Extra recipients (for example the operator) copied on domain events.
    notify: trim(process.env.NOTIFY_EMAIL)
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  },
  abuseContact: trim(process.env.ABUSE_CONTACT) || "",
  blockedHosts: trim(process.env.BLOCKED_HOSTS)
    .split(",")
    .map((entry) => entry.trim().toLowerCase().replace(/\.$/, ""))
    .filter(Boolean),
} as const

export function isSecure(): boolean {
  return config.appUrl.startsWith("https://")
}

export function hostFromHeader(host: string | undefined): string {
  if (!host) return ""
  return host
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/\.$/, "")
}

export function publicBaseForHost(hostname: string): string {
  const builtin = config.shortDomains.find((domain) => domain.hostname === hostname)
  if (builtin) return builtin.origin
  if (hostname.endsWith(".localhost")) return `http://${hostname}:${config.port}`
  return `https://${hostname}`
}

export default config
