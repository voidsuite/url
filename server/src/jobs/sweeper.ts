/**
 * Background housekeeping: expired auth state, rate-limit buckets and old
 * click rows. Runs once after boot and then every six hours.
 */

import config from "../config.js"
import { prunePkceStates } from "../db/pkce.js"
import { pruneRateLimits } from "../db/rate-limits.js"
import { pruneClicks } from "../db/clicks.js"
import { pruneTokens } from "../db/tokens.js"
import { listDomainsForRecheck, setDomainVerification } from "../db/domains.js"
import { verifyDomainDns } from "../lib/domain-verify.js"

const SIX_HOURS = 6 * 60 * 60 * 1000

export async function runSweep(): Promise<void> {
  const started = Date.now()
  const pkce = prunePkceStates()
  const limits = pruneRateLimits()
  const clicks = pruneClicks(config.analytics.clickRetentionDays)
  const tokens = pruneTokens()

  let domainsChecked = 0
  if (!config.domains.allowUnverified) {
    const pending = listDomainsForRecheck(10)
    for (const domain of pending) {
      const result = await verifyDomainDns(domain.hostname, domain.verification_token || "")
      setDomainVerification(domain.id, result.ok ? "verified" : "failed", result.ok)
      domainsChecked += 1
    }
  }

  console.log(
    `[sweep] pkce=${pkce} limits=${limits} clicks=${clicks} tokens=${tokens} domains=${domainsChecked} in ${Date.now() - started}ms`
  )
}

export function startSweeper(): void {
  setTimeout(() => {
    void runSweep().catch((err) => console.error("[sweep] failed", err))
  }, 30_000).unref?.()
  setInterval(() => {
    void runSweep().catch((err) => console.error("[sweep] failed", err))
  }, SIX_HOURS).unref?.()
}
