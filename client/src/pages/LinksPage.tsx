import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router"
import { Link2, Loader2, Plus, Search, Trash2 } from "lucide-react"
import { Page, PageHeader } from "@/components/layout/Page"
import { LinkRow } from "@/components/LinkRow"
import { EmptyState } from "@/components/EmptyState"
import { QrDialog } from "@/components/QrDialog"
import Dialog from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/contexts/auth"
import { useConfig } from "@/contexts/config"
import { useToast } from "@/contexts/toast"
import { del, get } from "@/lib/api"
import { formatNumber } from "@/lib/format"
import type { Domain, LinkItem, LinksResponse } from "@/lib/types"

const LIMIT = 20

export function LinksPage() {
  const { user } = useAuth()
  const { config } = useConfig()
  const toast = useToast()

  const [data, setData] = useState<LinksResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ownedDomains, setOwnedDomains] = useState<Domain[]>([])

  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [domain, setDomain] = useState("")
  const [sort, setSort] = useState("newest")
  const [page, setPage] = useState(1)

  const [qrLink, setQrLink] = useState<LinkItem | null>(null)
  const [deleting, setDeleting] = useState<LinkItem | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    if (!user) return
    let alive = true
    get<{ domains: Domain[] }>("/api/domains")
      .then((result) => {
        if (alive) setOwnedDomains(result.domains)
      })
      .catch(() => {
        /* filters fall back to built-in domains */
      })
    return () => {
      alive = false
    }
  }, [user])

  const domainOptions = (() => {
    const items: string[] = []
    for (const item of config?.domains ?? []) items.push(item.hostname)
    for (const item of ownedDomains) {
      if (!items.includes(item.hostname)) items.push(item.hostname)
    }
    return items
  })()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await get<LinksResponse>("/api/links", {
        page,
        limit: LIMIT,
        search: search || undefined,
        status: status === "all" ? undefined : status,
        domain: domain || undefined,
        sort,
      })
      setData(result)
      setError(null)
    } catch (err) {
      setError((err as Error).message || "Could not load your links.")
    } finally {
      setLoading(false)
    }
  }, [page, search, status, domain, sort])

  useEffect(() => {
    void load()
  }, [load])

  const confirmDelete = async () => {
    if (!deleting) return
    setDeleteBusy(true)
    try {
      await del(`/api/links/${deleting.id}`)
      toast.addToast("Link deleted", "success")
      setDeleting(null)
      if (data && data.links.length === 1 && page > 1) setPage(page - 1)
      else void load()
    } catch (err) {
      toast.addToast((err as Error).message || "Could not delete the link.", "error")
    } finally {
      setDeleteBusy(false)
    }
  }

  const filtersActive = Boolean(search || status !== "all" || domain || sort !== "newest")
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1
  const start = data && data.total > 0 ? (data.page - 1) * data.limit + 1 : 0
  const end = data ? Math.min(data.page * data.limit, data.total) : 0

  return (
    <Page width="xl">
      <PageHeader
        title="Links"
        description="Every link you own, with clicks and status at a glance."
        action={
          <Button asChild size="sm" className="gap-1.5">
            <Link to="/">
              <Plus className="size-3.5" />
              New link
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
        <div className="relative col-span-2 sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search slug, destination or label…"
            className="h-9 pl-9"
          />
        </div>
        <Select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} className="h-9 sm:w-32" aria-label="Filter by status">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="disabled">Disabled</option>
        </Select>
        <Select value={domain} onChange={(event) => { setDomain(event.target.value); setPage(1) }} className="h-9 sm:w-44" aria-label="Filter by domain">
          <option value="">All domains</option>
          {domainOptions.map((hostname) => (
            <option key={hostname} value={hostname}>
              {hostname}
            </option>
          ))}
        </Select>
        <Select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1) }} className="col-span-2 h-9 sm:w-40" aria-label="Sort links">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="clicks">Most clicks</option>
          <option value="last_clicked">Last clicked</option>
          <option value="expiry">Expiring soon</option>
        </Select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
          <p className="text-[11px] font-medium text-muted-foreground">
            {data ? `${formatNumber(data.total)} ${data.total === 1 ? "link" : "links"}` : "Loading links…"}
          </p>
          {loading && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
        </div>

        {error ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-medium">Could not load links</p>
            <p className="mt-1 text-xs text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => void load()}>
              Try again
            </Button>
          </div>
        ) : loading && !data ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3 px-4 py-3.5">
                <Skeleton className="hidden size-9 rounded-xl sm:block" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-2.5 w-2/3" />
                  <Skeleton className="h-2 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : data && data.links.length > 0 ? (
          <div className="divide-y divide-border">
            {data.links.map((link) => (
              <LinkRow key={link.id} link={link} onDelete={setDeleting} onQr={setQrLink} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={filtersActive ? Search : Link2}
            title={filtersActive ? "No links match these filters" : "No links yet"}
            description={
              filtersActive
                ? "Try a different search, status or domain — or clear the filters to see everything."
                : "Shorten your first link and it will show up here with clicks, status and expiry."
            }
            className="rounded-none border-0"
            action={
              filtersActive ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchInput("")
                    setSearch("")
                    setStatus("all")
                    setDomain("")
                    setSort("newest")
                    setPage(1)
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button asChild size="sm" className="gap-1.5">
                  <Link to="/">
                    <Plus className="size-3.5" />
                    Create a link
                  </Link>
                </Button>
              )
            }
          />
        )}

        {data && data.total > data.limit && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5">
            <p className="text-[10px] text-muted-foreground">
              Showing {formatNumber(start)}–{formatNumber(end)} of {formatNumber(data.total)}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="xs"
                disabled={page <= 1 || loading}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Previous
              </Button>
              <span className="text-[10px] text-muted-foreground">
                Page {data.page} of {pages}
              </span>
              <Button
                variant="outline"
                size="xs"
                disabled={page >= pages || loading}
                onClick={() => setPage((value) => Math.min(pages, value + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      <QrDialog
        open={qrLink !== null}
        onOpenChange={(open) => !open && setQrLink(null)}
        url={qrLink?.shortUrl ?? null}
        title="QR code"
      />

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => !open && !deleteBusy && setDeleting(null)}
        title="Delete this link?"
        description="The short code will stop working immediately. Click analytics stay in the database until the retention window ends, but they will no longer appear in your dashboard."
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
            <p className="truncate text-xs font-medium">{deleting?.shortUrl}</p>
            <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{deleting?.destination}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {formatNumber(deleting?.clicks ?? 0)} recorded clicks
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDeleting(null)} disabled={deleteBusy}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => void confirmDelete()} disabled={deleteBusy}>
              {deleteBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              Delete link
            </Button>
          </div>
        </div>
      </Dialog>
    </Page>
  )
}