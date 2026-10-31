/**
 * Transactional email for Void Links.
 *
 * SMTP is configured through environment variables (see .env.example). Domain
 * notifications are best-effort: a broken mail server must never make domain
 * management fail, so callers fire these off without awaiting them.
 */

import nodemailer, { type Transporter } from "nodemailer"
import config from "../config.js"

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")

export function isEmailConfigured(): boolean {
  const smtp = config.smtp
  return Boolean(smtp.host && smtp.user && smtp.pass && smtp.from)
}

let transporter: Transporter | null = null

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure || config.smtp.port === 465,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
      // Keep the notification path from hanging a request or the sweeper.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    })
  }
  return transporter
}

function recipients(to: string): string[] {
  const list = [to, ...config.smtp.notify].map((value) => value.trim()).filter(Boolean)
  return Array.from(new Set(list.map((value) => value.toLowerCase())))
}

export async function sendEmail(input: {
  to: string
  subject: string
  html: string
  text: string
}): Promise<boolean> {
  if (!isEmailConfigured()) return false
  const to = recipients(input.to)
  if (to.length === 0) return false
  await getTransporter().sendMail({
    from: `"${config.smtp.fromName}" <${config.smtp.from}>`,
    to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  })
  return true
}

function shell(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:24px;background:#151211;color:#fafaf9;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Inter,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#24211f;border:1px solid rgba(250,250,249,.08);border-radius:16px;">
    <tr><td style="padding:28px;">
      <p style="margin:0 0 20px;font-size:13px;font-weight:600;letter-spacing:.02em;color:#fafaf9;">Void <span style="color:#a8a29e;">Links</span></p>
      ${body}
      <p style="margin:28px 0 0;font-size:11px;line-height:1.6;color:#a8a29e;">You are receiving this because you own a custom domain on Void Links.</p>
    </td></tr>
  </table>
</body>
</html>`
}

const button = (href: string, label: string): string =>
  `<a href="${escapeHtml(href)}" style="display:inline-block;margin-top:18px;padding:10px 16px;border-radius:10px;background:#fafaf9;color:#151211;text-decoration:none;font-size:13px;font-weight:600;">${escapeHtml(label)}</a>`

const code = (value: string): string =>
  `<span style="display:inline-block;padding:2px 6px;border-radius:6px;background:#151211;border:1px solid rgba(250,250,249,.1);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;">${escapeHtml(value)}</span>`

export interface DomainEmailOptions {
  to: string
  hostname: string
  dns: {
    txtName: string
    txtValue: string | null
    cnameTarget: string
    aTarget?: string | null
  }
}

export async function sendDomainAddedEmail(options: DomainEmailOptions): Promise<boolean> {
  const { hostname, dns } = options
  const domainsUrl = `${config.appUrl}/domains`
  const subject = `Domain added: ${hostname}`
  const text = [
    `Your domain ${hostname} was added to Void Links.`,
    "",
    "Finish setup by publishing this DNS record:",
    `${hostname} CNAME ${dns.cnameTarget}`,
    "",
    dns.txtValue
      ? `Optional ownership TXT: ${dns.txtName} = ${dns.txtValue}`
      : "",
    dns.aTarget ? `If you verify by TXT, also point ${hostname} A ${dns.aTarget}.` : "",
    "",
    "Once DNS propagates, open Void Links and click Check DNS. TLS is issued automatically.",
    domainsUrl,
  ].filter(Boolean).join("\n")

  const html = shell(
    "Domain added",
    `<h1 style="margin:0 0 8px;font-size:20px;line-height:1.25;">Domain added</h1>
     <p style="margin:0;font-size:14px;line-height:1.6;color:#d6d3d1;"><strong style="color:#fafaf9;">${escapeHtml(hostname)}</strong> is now waiting for DNS.</p>
     <p style="margin:18px 0 6px;font-size:12px;font-weight:600;color:#fafaf9;">Recommended record</p>
     <p style="margin:0;font-size:13px;line-height:1.6;color:#d6d3d1;">CNAME ${code(hostname)} → ${code(dns.cnameTarget)}</p>
     <p style="margin:14px 0 0;font-size:12px;line-height:1.6;color:#a8a29e;">This single CNAME both proves ownership and routes traffic. It normally propagates within minutes.</p>
     ${dns.txtValue ? `<p style="margin:14px 0 0;font-size:12px;line-height:1.6;color:#a8a29e;">Prefer TXT verification? Publish ${code(dns.txtName)} = ${code(dns.txtValue)}${dns.aTarget ? ` and point ${code(hostname)} at ${code(dns.aTarget)}` : ""}.</p>` : ""}
     ${button(domainsUrl, "Finish setup")}`
  )

  return sendEmail({ to: options.to, subject, html, text })
}

export async function sendDomainVerifiedEmail(options: {
  to: string
  hostname: string
}): Promise<boolean> {
  const { hostname } = options
  const liveUrl = `https://${hostname}`
  const domainsUrl = `${config.appUrl}/domains`
  const subject = `${hostname} is live on Void Links`
  const text = [
    `Good news — ${hostname} is verified and its HTTPS certificate is ready.`,
    "",
    `Your short links now work on ${liveUrl}.`,
    "",
    `Manage the domain: ${domainsUrl}`,
  ].join("\n")

  const html = shell(
    "Domain verified",
    `<h1 style="margin:0 0 8px;font-size:20px;line-height:1.25;">Your domain is live</h1>
     <p style="margin:0;font-size:14px;line-height:1.6;color:#d6d3d1;"><strong style="color:#fafaf9;">${escapeHtml(hostname)}</strong> is verified, and its HTTPS certificate is ready.</p>
     <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#d6d3d1;">Short links on this domain now resolve at <a href="${escapeHtml(liveUrl)}" style="color:#fafaf9;">${escapeHtml(hostname)}</a>.</p>
     ${button(liveUrl, "Open your domain")}
     <p style="margin:14px 0 0;font-size:12px;line-height:1.6;color:#a8a29e;">You can review DNS and manage this domain any time in Void Links.</p>
     ${button(domainsUrl, "Manage domains")}`
  )

  return sendEmail({ to: options.to, subject, html, text })
}