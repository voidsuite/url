/**
 * /api/config — public, safe-to-expose runtime configuration for the UI.
 */

import { Hono } from "hono"
import config from "../config.js"
import { listPublicDomains } from "../db/domains.js"

const configRoutes = new Hono()

configRoutes.get("/config", (c) => {
  return c.json({
    appUrl: config.appUrl,
    isProduction: config.isProduction,
    domains: listPublicDomains().map((domain) => ({
      id: domain.id,
      hostname: domain.hostname,
      url: config.shortDomains.find((entry) => entry.hostname === domain.hostname)?.origin ?? `https://${domain.hostname}`,
      isDefault: domain.is_default === 1,
    })),
    defaultDomain: config.defaultDomainHost,
    customDomainLimit: config.limits.maxCustomDomainsPerUser,
    maxUrlLength: config.limits.maxUrlLength,
    anonLimits: {
      perMinute: config.limits.anonPerMinute,
      perHour: config.limits.anonPerHour,
      perDay: config.limits.anonPerDay,
    },
    analytics: {
      defaultDays: config.analytics.defaultDays,
      maxDays: config.analytics.maxDays,
      retentionDays: config.analytics.clickRetentionDays,
    },
    dns: {
      txtPrefix: config.domains.txtPrefix,
      cnameTarget: config.domains.cnameTarget,
      allowUnverified: config.domains.allowUnverified,
    },
    abuseContact: config.abuseContact,
  })
})

export default configRoutes
