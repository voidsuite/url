import config from "../config.js"

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function shell(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex,nofollow" />
<title>${escapeHtml(title)} · Void Links</title>
<style>
  :root { color-scheme: dark; --bg:#151211; --card:#24211f; --fg:#fafaf9; --muted:#a8a29e; --line:rgba(250,250,249,.1); }
  * { box-sizing: border-box; }
  html,body { height:100%; }
  body { margin:0; display:grid; place-items:center; background:radial-gradient(1200px 600px at 50% -10%, rgba(250,250,249,.07), transparent 70%), var(--bg); color:var(--fg); font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Inter,sans-serif; padding:24px; }
  .card { width:100%; max-width:440px; text-align:center; }
  .logo { display:inline-flex; align-items:center; gap:10px; margin-bottom:28px; text-decoration:none; color:inherit; }
  .mark { width:40px; height:40px; border-radius:14px; display:grid; place-items:center; background:var(--fg); color:var(--bg); }
  .word { font-weight:600; letter-spacing:-.02em; font-size:15px; }
  .word span { color:var(--muted); }
  h1 { font-size:24px; line-height:1.2; letter-spacing:-.02em; margin:0 0 8px; }
  p { color:var(--muted); font-size:14px; line-height:1.6; margin:0 auto; max-width:360px; }
  .actions { margin-top:24px; display:flex; gap:8px; justify-content:center; flex-wrap:wrap; }
  a.btn { display:inline-flex; align-items:center; justify-content:center; height:38px; padding:0 16px; border-radius:12px; background:var(--fg); color:var(--bg); text-decoration:none; font-size:13px; font-weight:600; }
  a.ghost { background:transparent; color:var(--fg); border:1px solid var(--line); }
  .code { display:inline-block; margin-top:18px; padding:6px 10px; border-radius:8px; border:1px solid var(--line); color:var(--muted); font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12px; }
  footer { margin-top:36px; color:var(--muted); font-size:11px; }
  footer a { color:inherit; }
</style>
</head>
<body>
<main class="card">
  <a class="logo" href="${escapeHtml(config.appUrl)}">
    <span class="mark" aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L10.7 5.22"/><path d="M14 11a5 5 0 0 0-7.07 0L4.81 13.12a5 5 0 0 0 7.07 7.07l1.42-1.42"/></svg>
    </span>
    <span class="word">Void <span>Links</span></span>
  </a>
  ${body}
  <footer>Short links by <a href="${escapeHtml(config.appUrl)}">Void Links</a>${config.abuseContact ? ` · <a href="mailto:${escapeHtml(config.abuseContact)}">Report abuse</a>` : ""}</footer>
</main>
</body>
</html>`
}

export function notFoundPage(): string {
  return shell(
    "Link not found",
    `<h1>This link does not point anywhere.</h1>
     <p>The short code may be mistyped, deleted, or expired. Check the address and try again.</p>
     <div class="actions"><a class="btn" href="${escapeHtml(config.appUrl)}">Shorten a link</a></div>
     <div class="code">404 · not found</div>`
  )
}

export function gonePage(reason: "expired" | "disabled"): string {
  const copy =
    reason === "expired"
      ? {
          title: "This link has expired.",
          body: "The owner set an expiry date and it has passed. Ask them for a fresh link.",
          code: "410 · gone",
        }
      : {
          title: "This link is turned off.",
          body: "The owner disabled this short link. It may be re-enabled later.",
          code: "410 · disabled",
        }
  return shell(
    copy.title,
    `<h1>${copy.title}</h1>
     <p>${copy.body}</p>
     <div class="actions"><a class="btn" href="${escapeHtml(config.appUrl)}">Shorten a link</a></div>
     <div class="code">${copy.code}</div>`
  )
}

export function hostNotConfiguredPage(host: string): string {
  return shell(
    "Domain not connected",
    `<h1>This domain is not connected.</h1>
     <p><strong>${escapeHtml(host || "This host")}</strong> is not pointing at a verified Void Links domain yet. If you own it, add it in the dashboard and finish DNS verification.</p>
     <div class="actions"><a class="btn" href="${escapeHtml(config.appUrl)}/domains">Manage domains</a><a class="btn ghost" href="${escapeHtml(config.appUrl)}">Void Links</a></div>`
  )
}

export function serverErrorPage(): string {
  return shell(
    "Something went wrong",
    `<h1>Something went wrong.</h1>
     <p>We could not complete that request. Please try again in a moment.</p>
     <div class="actions"><a class="btn" href="${escapeHtml(config.appUrl)}">Go to Void Links</a></div>`
  )
}
