/**
 * Per-domain TLS provisioning.
 *
 * Arbitrary custom hostnames cannot use v0id.im's certificate, and nginx has no
 * matching vhost for them, so a verified domain would otherwise fall through to
 * whichever server block is first. This module shells out to a root-owned
 * helper that issues a Let's Encrypt certificate and writes an nginx vhost
 * proxying the hostname to the Void Links gateway.
 */

import { execFile } from "node:child_process"
import { promisify } from "node:util"
import config from "../config.js"

const execFileAsync = promisify(execFile)

export interface ProvisionResult {
  ok: boolean
  message: string
}

function failureMessage(err: unknown): string {
  if (typeof err === "object" && err !== null) {
    const candidate = err as { stderr?: string; stdout?: string; message?: string }
    const detail = (candidate.stderr || candidate.stdout || candidate.message || "").trim()
    if (detail) return detail.split("\n").slice(-6).join(" ").slice(0, 500)
  }
  return "TLS provisioning failed."
}

export async function provisionDomain(hostname: string): Promise<ProvisionResult> {
  if (!config.provisioning.enabled) {
    return { ok: true, message: "TLS provisioning is disabled; DNS verification only." }
  }
  try {
    const { stdout, stderr } = await execFileAsync(
      config.provisioning.script,
      ["provision", hostname],
      { timeout: 240_000, maxBuffer: 1024 * 1024 }
    )
    return { ok: true, message: (stdout || stderr || "TLS ready.").trim().slice(-500) }
  } catch (err) {
    return { ok: false, message: failureMessage(err) }
  }
}

export async function removeDomainProvisioning(hostname: string): Promise<ProvisionResult> {
  if (!config.provisioning.enabled) return { ok: true, message: "TLS provisioning is disabled." }
  try {
    const { stdout, stderr } = await execFileAsync(
      config.provisioning.script,
      ["remove", hostname],
      { timeout: 120_000, maxBuffer: 1024 * 1024 }
    )
    return { ok: true, message: (stdout || stderr || "Removed.").trim().slice(-500) }
  } catch (err) {
    return { ok: false, message: failureMessage(err) }
  }
}