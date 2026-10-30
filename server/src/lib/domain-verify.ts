import { resolveCname, resolveTxt } from "node:dns/promises"
import config from "../config.js"

export interface DomainVerifyResult {
  ok: boolean
  method: "txt" | "cname" | "dev" | null
  message: string
}

const normalizeTarget = (value: string) =>
  value.trim().toLowerCase().replace(/\.$/, "")

export function isValidDomainHostname(raw: string): { ok: true; hostname: string } | { ok: false; error: string } {
  const input = raw.trim().toLowerCase()
  if (!input) return { ok: false, error: "Enter a domain name." }
  if (input.includes("/") || input.includes("?") || input.includes("#") || input.includes("@")) {
    return { ok: false, error: "Enter a hostname only, without a path or protocol." }
  }
  let url: URL
  try {
    url = new URL(`https://${input}`)
  } catch {
    return { ok: false, error: "That does not look like a valid domain." }
  }
  const hostname = url.hostname.replace(/\.$/, "")
  if (hostname !== input.replace(/\.$/, "")) {
    return { ok: false, error: "Enter a hostname only, without a path or port." }
  }
  if (hostname.length > 253) return { ok: false, error: "That hostname is too long." }
  if (!/^[a-z0-9.-]+$/.test(hostname)) {
    return { ok: false, error: "Use letters, numbers, dots and hyphens only." }
  }
  if (!hostname.includes(".")) {
    return { ok: false, error: "Use a fully qualified domain, like links.example.com." }
  }
  if (hostname.startsWith("-") || hostname.endsWith("-") || hostname.includes("..")) {
    return { ok: false, error: "That hostname is not valid." }
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return { ok: false, error: "Use a domain name, not an IP address." }
  }
  const loopback = hostname === "localhost" || hostname.endsWith(".localhost")
  if (config.isProduction && loopback) {
    return { ok: false, error: "Localhost domains cannot be used in production." }
  }
  if (!loopback && !hostname.includes(".")) {
    return { ok: false, error: "Use a fully qualified domain, like links.example.com." }
  }
  return { ok: true, hostname }
}

export async function verifyDomainDns(hostname: string, token: string): Promise<DomainVerifyResult> {
  if (config.domains.allowUnverified) {
    return {
      ok: true,
      method: "dev",
      message: "Verified automatically because ALLOW_UNVERIFIED_DOMAINS is enabled.",
    }
  }

  const txtName = `${config.domains.txtPrefix}.${hostname}`
  const [txtResult, cnameResult] = await Promise.allSettled([
    resolveTxt(txtName),
    resolveCname(hostname),
  ])

  if (txtResult.status === "fulfilled") {
    const values = txtResult.value.map((parts) => parts.join(""))
    if (values.some((value) => value.trim() === token)) {
      return { ok: true, method: "txt", message: `TXT record found at ${txtName}.` }
    }
  }

  if (cnameResult.status === "fulfilled") {
    const targets = cnameResult.value.map(normalizeTarget)
    const expected = normalizeTarget(config.domains.cnameTarget)
    if (targets.includes(expected)) {
      return {
        ok: true,
        method: "cname",
        message: `CNAME points at ${config.domains.cnameTarget}.`,
      }
    }
  }

  return {
    ok: false,
    method: null,
    message: `No matching TXT record at ${txtName} and no CNAME to ${config.domains.cnameTarget} yet. DNS can take a few minutes to propagate.`,
  }
}
