import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { Link } from "react-router"
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ExternalLink,
  Globe2,
  Link2,
  Loader2,
  Lock,
  QrCode,
  Settings2,
  Share2,
  Sparkles,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { CopyButton } from "@/components/CopyButton"
import { QrDialog } from "@/components/QrDialog"
import { useAuth } from "@/contexts/auth"
import { useConfig } from "@/contexts/config"
import { useToast } from "@/contexts/toast"
import { ApiError, copyText, get, getAnonId, post, rememberLink } from "@/lib/api"
import { expiryLabel, relativeTime } from "@/lib/format"
import type { CreateLinkResponse, Domain, LinkItem } from "@/lib/types"
import { cn } from "@/lib/utils"

const EXPIRY_OPTIONS = [
  { value: "never", label: "Never expires" },
  { value: "1", label: "1 hour" },
  { value: "24", label: "24 hours" },
  { value: "168", label: "7 days" },
  { value: "720", label: "30 days" },
] as const

interface ShortenFormProps {
  size?: "lg" | "md"
  autoFocus?: boolean
  onCreated?: (link: LinkItem) => void
  className?: string
}

export function ShortenForm({ size = "lg", autoFocus = false, onCreated, className }: ShortenFormProps) {
  const { config } = useConfig()
  const { user, signIn } = useAuth()
  const toast = useToast()

  const inputRef = useRef<HTMLInputElement>(null)
  const [destination, setDestination] = useState("")
  const [domainHost, setDomainHost] = useState("")
  const [showOptions, setShowOptions] = useState(false)
  const [slug, setSlug] = useState("")
  const [title, setTitle] = useState("")
  const [expiry, setExpiry] = useState<string>("never")
  const [ownedDomains, setOwnedDomains] = useState<Domain[]>([])

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryAt, setRetryAt] = useState<number | null>(null)
  const [tick, setTick] = useState(() => Date.now())
  const [result, setResult] = useState<CreateLinkResponse | null>(null)
  const [qrOpen, setQrOpen] = useState(false)
  const [shared, setShared] = useState(false)

  // Signed-in users can shorten on their verified custom domains too.
  useEffect(() => {
    if (!user) {
      setOwnedDomains([])
      return
    }
    let alive = true
    get<{ domains: Domain[] }>("/api/domains")
      .then((data) => {
        if (alive) setOwnedDomains(data.domains)
      })
      .catch(() => {
        /* the built-in domains still work */
      })
    return () => {
      alive = false
    }
  }, [user])

  const domains = useMemo(() => {
    const items: { hostname: string; isDefault: boolean }[] = []
    for (const domain of config?.domains ?? []) {
      items.push({ hostname: domain.hostname, isDefault: domain.isDefault })
    }
    for (const domain of ownedDomains) {
      if (domain.isSystem || domain.status !== "verified") continue
      if (items.some((item) => item.hostname === domain.hostname)) continue
      items.push({ hostname: domain.hostname, isDefault: false })
    }
    return items
  }, [config, ownedDomains])

  useEffect(() => {
    if (domains.length === 0) return
    if (domains.some((domain) => domain.hostname === domainHost)) return
    const preferred =
      domains.find((domain) => domain.hostname === config?.defaultDomain) ||
      domains.find((domain) => domain.isDefault) ||
      domains[0]
    setDomainHost(preferred.hostname)
  }, [domains, domainHost, config?.defaultDomain])

  useEffect(() => {
    if (!retryAt) return
    const interval = window.setInterval(() => setTick(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [retryAt])

  const retryLeft = retryAt ? Math.max(0, Math.ceil((retryAt - tick) / 1000)) : 0

  useEffect(() => {
    if (retryAt && tick >= retryAt) {
      setRetryAt(null)
      setError(null)
    }
  }, [retryAt, tick])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting || retryLeft > 0) return
    const value = destination.trim()
    if (!value) {
      setError("Paste a link to shorten.")
      inputRef.current?.focus()
      return
    }

    setError(null)
    setSubmitting(true)
    try {
      const payload: {
        destination: string
        domain?: string
        slug?: string
        title?: string
        expiresInHours?: number
        anonId?: string
      } = { destination: value }
      if (domainHost) payload.domain = domainHost
      if (showOptions) {
        if (user && slug.trim()) payload.slug = slug.trim()
        if (title.trim()) payload.title = title.trim()
        if (expiry !== "never") payload.expiresInHours = Number(expiry)
      }
      if (!user) payload.anonId = getAnonId()

      const data = await post<CreateLinkResponse>("/api/links", payload)
      setResult(data)
      rememberLink({
        id: data.link.id,
        slug: data.link.slug,
        shortUrl: data.link.shortUrl,
        destination: data.link.destination,
        domain: data.link.domain.hostname,
        createdAt: data.link.createdAt,
      })
      onCreated?.(data.link)
      setDestination("")
      setSlug("")
      setTitle("")
      setExpiry("never")
      setShowOptions(false)
      toast.addToast("Short link ready", "success")
    } catch (err) {
      const apiError = err as ApiError
      if (apiError.status === 429 && apiError.retryAfter) {
        setRetryAt(Date.now() + apiError.retryAfter * 1000)
        setTick(Date.now())
      }
      setError(apiError.message || "Could not shorten that link. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const share = async () => {
    if (!result) return
    const url = result.link.shortUrl
    if (navigator.share) {
      try {
        await navigator.share({ title: result.link.title || "Void Links", url })
        setShared(true)
        window.setTimeout(() => setShared(false), 2000)
        return
      } catch {
        /* fall through to copy */
      }
    }
    const ok = await copyText(url)
    if (ok) {
      setShared(true)
      window.setTimeout(() => setShared(false), 2000)
      toast.addToast("Link copied to clipboard", "success", 2200)
    } else {
      toast.addToast("Could not share — copy the link manually.", "error")
    }
  }

  const dismissResult = () => {
    setResult(null)
    inputRef.current?.focus()
  }

  const tall = size === "lg"

  return (
    <div className={cn("w-full", className)}>
      <form onSubmit={(event) => void submit(event)}>
        <div className="rounded-2xl border border-border bg-card p-1.5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
            <div className="relative flex shrink-0 items-center rounded-xl sm:ml-0.5">
              <Globe2 className="pointer-events-none absolute left-2.5 size-3.5 text-muted-foreground" />
              <select
                value={domainHost}
                onChange={(event) => setDomainHost(event.target.value)}
                disabled={domains.length === 0}
                aria-label="Short domain"
                className={cn(
                  "h-11 max-w-[13rem] appearance-none truncate rounded-xl bg-transparent pl-8 pr-7 text-xs font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60",
                  tall && "sm:h-12",
                )}
              >
                {domains.length === 0 && <option value="">Loading…</option>}
                {domains.map((domain) => (
                  <option key={domain.hostname} value={domain.hostname}>
                    {domain.hostname}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-muted-foreground" />
            </div>

            <div className="hidden h-6 w-px shrink-0 bg-border sm:block" />

            <div className="relative min-w-0 flex-1">
              <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70" />
              <input
                ref={inputRef}
                id="shorten-input"
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
                autoFocus={autoFocus}
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                placeholder="Paste a long link…"
                aria-label="Destination URL"
                className={cn(
                  "w-full rounded-xl bg-transparent pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground/60",
                  tall ? "h-12 sm:h-13" : "h-11",
                )}
              />
            </div>

            <Button
              type="submit"
              disabled={submitting || retryLeft > 0}
              className={cn(
                "group h-11 shrink-0 gap-1.5 rounded-xl px-5 text-sm font-semibold shadow-sm",
                tall && "h-11 sm:h-12",
              )}
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {submitting ? "Shortening…" : retryLeft > 0 ? `Wait ${retryLeft}s` : "Shorten"}
            </Button>
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-1">
          <button
            type="button"
            onClick={() => setShowOptions((value) => !value)}
            className="inline-flex items-center gap-1.5 rounded-lg text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            aria-expanded={showOptions}
          >
            <Settings2 className="size-3.5" />
            {showOptions ? "Hide options" : "Custom slug, expiry & more"}
          </button>
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            {user ? (
              <>
                <Globe2 className="size-3" />
                {domainHost || "Choose a domain"}
              </>
            ) : (
              <>
                <Lock className="size-3" />
                No account needed · claim it later
              </>
            )}
          </span>
        </div>

        {showOptions && (
          <div className="mt-3 grid animate-slide-down gap-3 rounded-2xl border border-border bg-muted/20 p-3.5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="shorten-slug" className="text-xs font-medium">
                Custom slug
              </label>
              {user ? (
                <div className="flex h-9 items-center rounded-xl border border-input bg-transparent pl-2.5 transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
                  <span className="text-xs text-muted-foreground">/</span>
                  <input
                    id="shorten-slug"
                    value={slug}
                    onChange={(event) => setSlug(event.target.value)}
                    placeholder="launch"
                    maxLength={32}
                    autoComplete="off"
                    spellCheck={false}
                    className="h-full min-w-0 flex-1 bg-transparent px-1.5 text-sm outline-none placeholder:text-muted-foreground/50"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void signIn()}
                  className="flex h-9 w-full items-center gap-2 rounded-xl border border-dashed border-border px-2.5 text-left text-[11px] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                >
                  <Lock className="size-3.5" />
                  Sign in to pick your own slug
                </button>
              )}
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                3–32 characters. Letters, numbers, hyphens and underscores.
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="shorten-title" className="text-xs font-medium">
                Label
              </label>
              <Input
                id="shorten-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Spring campaign"
                maxLength={120}
                className="h-9"
              />
              <p className="text-[10px] leading-relaxed text-muted-foreground">Only visible to you in the dashboard.</p>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="shorten-expiry" className="text-xs font-medium">
                Link expires
              </label>
              <Select id="shorten-expiry" value={expiry} onChange={(event) => setExpiry(event.target.value)} className="h-9">
                {EXPIRY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mt-3 animate-slide-down rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-[11px] leading-relaxed text-destructive"
          >
            {error}
            {retryLeft > 0 && <span className="font-medium"> Try again in {retryLeft}s.</span>}
          </div>
        )}
      </form>

      {result && (
        <div className="mt-4 animate-slide-up rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-green-500/10 text-green-600 dark:text-green-400">
              <CheckCircle2 className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-muted-foreground">Short link ready</p>
              <a
                href={result.link.shortUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-0.5 block truncate text-lg font-semibold tracking-tight hover:underline"
              >
                {result.link.shortUrl}
              </a>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{result.link.destination}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                {result.link.title && <span className="truncate font-medium text-foreground/80">{result.link.title}</span>}
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="size-3" />
                  {expiryLabel(result.link.expiresAt)}
                </span>
                {result.link.expiresAt && <span>· {relativeTime(result.link.expiresAt)}</span>}
              </p>
            </div>
            <button
              type="button"
              onClick={dismissResult}
              className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Dismiss result"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <CopyButton value={result.link.shortUrl} label="Copy link" size="sm" />
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setQrOpen(true)}>
              <QrCode className="size-3.5" />
              QR code
            </Button>
            <Button variant="outline" size="sm" asChild className="gap-1.5">
              <a href={result.link.shortUrl} target="_blank" rel="noreferrer noopener">
                <ExternalLink className="size-3.5" />
                Open
              </a>
            </Button>
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => void share()}>
              <Share2 className="size-3.5" />
              {shared ? "Shared" : "Share"}
            </Button>
            {result.claimable ? (
              <Button size="sm" className="ml-auto gap-1.5" onClick={() => void signIn("/links")}>
                <Lock className="size-3.5" />
                Keep it
              </Button>
            ) : (
              <Button variant="ghost" size="sm" asChild className="ml-auto gap-1.5">
                <Link to={`/links/${result.link.id}`}>
                  Analytics
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            )}
          </div>

          {result.claimable && (
            <p className="mt-3 rounded-lg bg-muted/40 px-3 py-2 text-[10px] leading-relaxed text-muted-foreground">
              This link is saved to this browser. Sign in to keep it across devices, edit it, and unlock click analytics.
            </p>
          )}
        </div>
      )}

      <QrDialog
        open={qrOpen}
        onOpenChange={setQrOpen}
        url={result?.link.shortUrl ?? null}
        title="QR code for your link"
      />
    </div>
  )
}