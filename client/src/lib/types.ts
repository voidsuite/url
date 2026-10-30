export type LinkStatus = "active" | "expired" | "disabled"

export interface User {
  id: string
  email: string
  name: string
  picture: string | null
  role: string
  isAdmin: boolean
  createdAt: number
}

export interface Domain {
  id: string
  hostname: string
  url: string
  isSystem: boolean
  isDefault: boolean
  status: "verified" | "pending" | "failed" | "disabled"
  verifiedAt: number | null
  createdAt: number
  dns: {
    txtName: string
    txtValue: string | null
    cnameTarget: string
  }
}

export interface PublicDomain {
  id: string
  hostname: string
  url: string
  isDefault: boolean
}

export interface RuntimeConfig {
  appUrl: string
  isProduction: boolean
  domains: PublicDomain[]
  defaultDomain: string
  customDomainLimit: number
  maxUrlLength: number
  anonLimits: {
    perMinute: number
    perHour: number
    perDay: number
  }
  analytics: {
    defaultDays: number
    maxDays: number
    retentionDays: number
  }
  dns: {
    txtPrefix: string
    cnameTarget: string
    allowUnverified: boolean
  }
  abuseContact: string
}

export interface LinkItem {
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

export interface LinksResponse {
  links: LinkItem[]
  total: number
  page: number
  limit: number
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

export type DeviceKind = "desktop" | "mobile" | "tablet" | "other"

export interface RecentClick {
  id: number
  clickedAt: number
  country: string | null
  referrerHost: string | null
  device: DeviceKind | string
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

export interface LinkMetricsResponse {
  link: LinkItem
  metrics: Metrics
  days: number
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
  recent: (RecentClick & {
    linkId: string
    slug: string
    shortUrl: string
  })[]
  days: number
}

export interface ApiTokenRecord {
  id: string
  name: string
  prefix: string
  scopes: string[]
  lastUsedAt: number | null
  expiresAt: number | null
  createdAt: number
}

export interface AuthResponse {
  user: User
  scopes?: string[]
  source?: string
  claimed?: number
}

export interface CreateLinkResponse {
  link: LinkItem
  claimable: boolean
}

export interface LinkResponse {
  link: LinkItem
}

export interface DomainsResponse {
  domains: Domain[]
}

export interface DomainResponse {
  domain: Domain | null
  ok?: boolean
  method?: string
  message?: string
}

export interface TokensResponse {
  tokens: ApiTokenRecord[]
}

export interface CreateTokenResponse {
  token: string
  apiToken: ApiTokenRecord
}

export interface ClaimResponse {
  claimed: number
}
