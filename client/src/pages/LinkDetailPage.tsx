import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import { Link, useNavigate, useParams } from "react-router"
import {
  ArrowLeft,
  Bot,
  Clock3,
  ExternalLink,
  Globe2,
  Link2,
  Loader2,
  MousePointerClick,
  Pencil,
  QrCode,
  Save,
  Trash2,
  Users,
} from "lucide-react"
import { Page } from "@/components/layout/Page"
import { StatCard } from "@/components/StatCard"
import { ClicksChart } from "@/components/ClicksChart"
import { BreakdownCard } from "@/components/BreakdownCard"
import { RangeTabs } from "@/components/RangeTabs"
import { QrDialog } from "@/components/QrDialog"
import { CopyButton } from "@/components/CopyButton"
import { StatusBadge } from "@/components/StatusBadge"
import Dialog from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useConfig } from "@/contexts/config"
import { useToast } from "@/contexts/toast"
import { del, get, patch } from "@/lib/api"
import {
  countryName,
  deviceLabel,
  expiryLabel,
  formatCompact,
  formatDate,
  formatDateTime,
  formatNumber,
  percentChange,
  relativeRange,
  relativeTime,
} from "@/lib/format"
import type { Domain, LinkItem, LinkMetricsResponse } from "@/lib/types"
import { cn } from "@/lib/utils"

function toLocalInput(ts: number): string {
  const date = new Date(ts - new Date(ts).getTimezoneOffset() * 60 * 1000)
  return date.toISOString().slice(0, 16)
}

export function LinkDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const { config } = useConfig()

  const [days, setDays] = useState(30)
  const [data, setData] = useState<LinkMetricsResponse | null>(null)
  const [ownedDomains, setOwnedDomains] = useState<Domain[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [qrOpen, setQrOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editDestination, setEditDestination] = useState("")
  const [editSlug, setEditSlug] = useState("")
  const [editTitle, setEditTitle] = useState("")
  const [editDomain, setEditDomain] = useState("")
  const [editExpiry, setEditExpiry] = useState("")
  const [initialExpiry, setInitialExpiry] = useState("")
  const [editActive, setEditActive] = useState(true)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    if (!id) {
      setError("Link not found")
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const result = await get<LinkMetricsResponse>(`/api/links/${id}/metrics`, { days })
      setData(result)
      setError(null)
    } catch (err) {
      setError((err as Error).message || "Could not load this link.")
    } finally {
      setLoading(false)
    }
  }, [id, days])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    let alive = true
    get<{ domains: Domain[] }>("/api/domains")
      .then((result) => {
        if (alive) setOwnedDomains(result.domains)
      })
      .catch(() => {
        /* built-in domains still work */
      })
    return () => {
      alive = false
    }
  }, [])

  const domainOptions = useMemo(() => {
    const hosts = new Set<string>()
    for (const item of config?.domains ?? []) hosts.add(item.hostname)
    for (const item of ownedDomains) {
      if (!item.isSystem && item.status === "verified") hosts.add(item.hostname)
    }
    if (data) hosts.add(data.link.domain.hostname)
    return Array.from(hosts)
  }, [config, ownedDomains, data])

  const openEdit = () => {
    if (!data) return
    const link = data.link
    const expiry = link.expiresAt ? toLocalInput(link.expiresAt) : ""
    setEditDestination(link.destination)
    setEditSlug(link.slug)
    setEditTitle(link.title ?? "")
    setEditDomain(link.domain.hostname)
    setEditExpiry(expiry)
    setInitialExpiry(expiry)
    setEditActive(link.isActive)
    setEditOpen(true)
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!data || saving) return
    const link = data.link
    const payload: Record<string, unknown> = {}

    if (editDestination.trim() !== link.destination) payload.destination = editDestination.trim()
    if (editSlug.trim() !== link.slug) payload.slug = editSlug.trim()
    if (editTitle.trim() !== (link.title ?? "")) payload.title = editTitle.trim() || null
    if (editDomain !== link.domain.hostname) payload.domain = editDomain
    if (editActive !== link.isActive) payload.isActive = editActive

    if (editExpiry !== initialExpiry) {
      if (!editExpiry) {
        payload.expiresInHours = null
      } else {
        const next = new Date(editExpiry).getTime()
        if (!Number.isFinite(next) || next <= Date.now()) {
          toast.addToast("Choose an expiry in the future, or leave it empty.", "error")
          return
        }
        payload.expiresInHours = Math.max(1, Math.round((next - Date.now()) / (60 * 60 * 1000)))
      }
    }

    setSaving(true)
    try {
      await patch<{ link: LinkItem }>(`/api/links/${link.id}`, payload)
      toast.addToast("Link updated", "success")
      setEditOpen(false)
      void load()
    } catch (err) {
      toast.addToast((err as Error).message || "Could not update the link.", "error")
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!data || deleting) return
    setDeleting(true)
    try {
      await del(`/api/links/${data.link.id}`)
      toast.addToast("Link deleted", "success")
      navigate("/links", { replace: true })
    } catch (err) {
      toast.addToast((err as Error).message || "Could not delete the link.", "error")
    } finally {
      setDeleting(false)
    }
  }

  if (loading && !data) {
    return (
      <Page width="xl">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-28 rounded-2xl" />
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-24 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-2xl" />
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-44 rounded-2xl" />
            ))}
          </div>
        </div>
      </Page>
    )
  }

  if (error || !data) {
    return (
      <Page width="md">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
            <Link2 className="size-5" />
          </div>
          <p className="mt-4 text-sm font-semibold">This link could not be loaded</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">{error || "It may have been deleted."}</p>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Try again
            </Button>
            <Button size="sm" asChild>
              <Link to="/links">Back to links</Link>
            </Button>
          </div>
        </div>
      </Page>
    )
  }

  const link = data.link
  const metrics = data.metrics
  const shortLabel = `${link.domain.hostname}/${link.slug}`

  return (
    <Page width="xl">
      <Link
        to="/links"
        className="inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        All links
      </Link>

      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground">
            <Link2 className="size-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={link.shortUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="truncate text-lg font-semibold tracking-tight hover:underline"
              >
                {shortLabel}
              </a>
              <StatusBadge status={link.status} />
            </div>
            <a
              href={link.destination}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-0.5 block truncate text-xs text-muted-foreground hover:text-foreground"
            >
              {link.destination}
            </a>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
              {link.title && (
                <span className="rounded-full bg-muted/60 px-2 py-0.5 font-medium text-foreground/80">{link.title}</span>
              )}
              <span>Created {formatDate(link.createdAt)}</span>
              <span>{expiryLabel(link.expiresAt)}</span>
              <span>{formatNumber(link.clicks)} total clicks</span>
              <span>Last click {relativeTime(link.lastClickedAt)}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <CopyButton value={link.shortUrl} label="Copy" size="sm" />
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setQrOpen(true)}>
              <QrCode className="size-3.5" />
              QR
            </Button>
            <Button variant="outline" size="sm" asChild className="gap-1.5">
              <a href={link.shortUrl} target="_blank" rel="noreferrer noopener">
                <ExternalLink className="size-3.5" />
                Open
              </a>
            </Button>
            <Button variant="secondary" size="sm" className="gap-1.5" onClick={openEdit}>
              <Pencil className="size-3.5" />
              Edit
            </Button>
            <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="size-3.5" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <RangeTabs value={days} onChange={setDays} />
          <span className="text-[10px] text-muted-foreground">
            {formatCompact(metrics.summary.clicks)} clicks in the last {relativeRange(days)} ·{" "}
            {formatCompact(metrics.summary.bots)} bots filtered
          </span>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Clicks"
            value={formatCompact(metrics.summary.clicks)}
            hint={`${formatNumber(link.clicks)} all time`}
            icon={MousePointerClick}
            trend={percentChange(metrics.summary.clicks, metrics.previousClicks)}
          />
          <StatCard
            label="Unique visitors"
            value={formatCompact(metrics.summary.uniques)}
            hint="Daily rotating hash"
            icon={Users}
          />
          <StatCard
            label="Bot clicks"
            value={formatCompact(metrics.summary.bots)}
            hint="Filtered from totals"
            icon={Bot}
          />
          <StatCard
            label="Last click"
            value={relativeTime(metrics.summary.lastClickedAt)}
            hint={metrics.summary.lastClickedAt ? formatDateTime(metrics.summary.lastClickedAt) : "No clicks yet"}
            icon={Clock3}
          />
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">Clicks over time</h2>
              <p className="text-[11px] text-muted-foreground">Daily clicks and unique visitors for this link.</p>
            </div>
            <span className="text-[10px] text-muted-foreground">{relativeRange(days)}</span>
          </div>
          <ClicksChart data={metrics.series} height={220} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <BreakdownCard
            title="Referrers"
            items={metrics.referrers}
            icon={<Globe2 className="size-3.5" />}
            empty="No referrer data yet"
          />
          <BreakdownCard
            title="Countries"
            items={metrics.countries}
            renderLabel={countryName}
            icon={<Globe2 className="size-3.5" />}
            empty="No country data yet"
          />
          <BreakdownCard
            title="Devices"
            items={metrics.devices}
            renderLabel={deviceLabel}
            empty="No device data yet"
          />
          <BreakdownCard title="Browsers" items={metrics.browsers} empty="No browser data yet" />
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Recent clicks</h2>
            <span className="text-[10px] text-muted-foreground">Latest {metrics.recent.length}</span>
          </div>
          {metrics.recent.length === 0 ? (
            <p className="px-4 py-8 text-center text-[11px] text-muted-foreground">
              No clicks yet. Share the link to see activity here.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {metrics.recent.map((click) => (
                <div key={click.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
                    <MousePointerClick className="size-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium">{formatDateTime(click.clickedAt)}</p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {countryName(click.country)} · {click.referrerHost || "Direct"} · {click.browser} on {click.os} ·{" "}
                      {deviceLabel(click.device)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <QrDialog open={qrOpen} onOpenChange={setQrOpen} url={link.shortUrl} title="QR code for this link" />

      <Dialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit link"
        description="Changes go live immediately. Existing clicks are kept."
        className="max-w-lg"
      >
        <form onSubmit={(event) => void save(event)} className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="edit-destination" className="text-xs font-medium">
              Destination
            </label>
            <Input
              id="edit-destination"
              value={editDestination}
              onChange={(event) => setEditDestination(event.target.value)}
              placeholder="https://example.com/page"
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="edit-slug" className="text-xs font-medium">
                Slug
              </label>
              <div className="flex h-9 items-center rounded-xl border border-input pl-2.5 transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
                <span className="text-xs text-muted-foreground">/</span>
                <input
                  id="edit-slug"
                  value={editSlug}
                  onChange={(event) => setEditSlug(event.target.value)}
                  maxLength={32}
                  autoComplete="off"
                  spellCheck={false}
                  className="h-full min-w-0 flex-1 bg-transparent px-1.5 text-sm outline-none"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="edit-domain" className="text-xs font-medium">
                Domain
              </label>
              <Select id="edit-domain" value={editDomain} onChange={(event) => setEditDomain(event.target.value)}>
                {domainOptions.map((hostname) => (
                  <option key={hostname} value={hostname}>
                    {hostname}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="edit-title" className="text-xs font-medium">
              Label
            </label>
            <Input
              id="edit-title"
              value={editTitle}
              onChange={(event) => setEditTitle(event.target.value)}
              placeholder="Optional — only you see this"
              maxLength={120}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="edit-expiry" className="text-xs font-medium">
              Expires
            </label>
            <Input
              id="edit-expiry"
              type="datetime-local"
              value={editExpiry}
              onChange={(event) => setEditExpiry(event.target.value)}
            />
            <p className="text-[10px] text-muted-foreground">Leave empty for a link that never expires.</p>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 px-3 py-2.5">
            <div>
              <p className="text-xs font-medium">Link active</p>
              <p className="text-[10px] text-muted-foreground">Disabled links return a 410 page.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={editActive}
              onClick={() => setEditActive((value) => !value)}
              className={cn(
                "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                editActive ? "bg-primary" : "bg-muted",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 size-4 rounded-full bg-background transition-transform",
                  editActive ? "translate-x-[18px]" : "translate-x-0.5",
                )}
              />
            </button>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="gap-1.5" disabled={saving}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              Save changes
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => !deleting && setDeleteOpen(open)}
        title="Delete this link?"
        description="The short code stops working immediately and the link disappears from your history."
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
            <p className="truncate text-xs font-medium">{link.shortUrl}</p>
            <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{link.destination}</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => void remove()} disabled={deleting}>
              {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              Delete link
            </Button>
          </div>
        </div>
      </Dialog>
    </Page>
  )
}