import { useCallback, useEffect, useState, type FormEvent } from "react"
import { Globe2, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react"
import { Page, PageHeader } from "@/components/layout/Page"
import { DomainStatusBadge } from "@/components/StatusBadge"
import { CopyButton } from "@/components/CopyButton"
import Dialog from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useConfig } from "@/contexts/config"
import { useToast } from "@/contexts/toast"
import { del, get, post } from "@/lib/api"
import { formatDate } from "@/lib/format"
import type { Domain, DomainResponse, DomainsResponse } from "@/lib/types"

function DnsRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-2 rounded-lg border border-border bg-background px-2.5 py-2">
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-0.5 break-all font-mono text-[11px] leading-relaxed">{value}</p>
        {hint && <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>}
      </div>
      <CopyButton value={value} size="icon-sm" label={`Copy ${label}`} toast={false} />
    </div>
  )
}

export function DomainsPage() {
  const { config } = useConfig()
  const toast = useToast()

  const [domains, setDomains] = useState<Domain[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [addOpen, setAddOpen] = useState(false)
  const [hostname, setHostname] = useState("")
  const [adding, setAdding] = useState(false)

  const [verifying, setVerifying] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Domain | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await get<DomainsResponse>("/api/domains")
      setDomains(result.domains)
      setError(null)
    } catch (err) {
      setError((err as Error).message || "Could not load your domains.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const customDomains = domains.filter((domain) => !domain.isSystem)
  const limit = config?.customDomainLimit ?? 5

  const addDomain = async (event: FormEvent) => {
    event.preventDefault()
    const value = hostname.trim()
    if (!value || adding) return
    setAdding(true)
    try {
      const result = await post<{ domain: Domain }>("/api/domains", { hostname: value })
      setAddOpen(false)
      setHostname("")
      toast.addToast(
        result.domain.status === "verified"
          ? `${result.domain.hostname} is connected`
          : `${result.domain.hostname} added — finish DNS verification`,
        "success",
      )
      void load()
    } catch (err) {
      toast.addToast((err as Error).message || "Could not add that domain.", "error")
    } finally {
      setAdding(false)
    }
  }

  const verify = async (domain: Domain) => {
    setVerifying(domain.id)
    try {
      const result = await post<DomainResponse>(`/api/domains/${domain.id}/verify`)
      toast.addToast(
        result.message || (result.ok ? "Domain verified" : "DNS records are not visible yet."),
        result.ok ? "success" : "error",
      )
      void load()
    } catch (err) {
      toast.addToast((err as Error).message || "Could not check DNS.", "error")
    } finally {
      setVerifying(null)
    }
  }

  const removeDomain = async () => {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    try {
      await del(`/api/domains/${deleteTarget.id}`)
      toast.addToast("Domain disconnected", "success")
      setDeleteTarget(null)
      void load()
    } catch (err) {
      toast.addToast((err as Error).message || "Could not disconnect the domain.", "error")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Page width="xl">
      <PageHeader
        title="Domains"
        description={`Shorten on your own brand. ${customDomains.length} of ${limit} custom domains used.`}
        action={
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setAddOpen(true)}
            disabled={customDomains.length >= limit}
          >
            <Plus className="size-3.5" />
            Add domain
          </Button>
        }
      />

      {error ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <p className="text-sm font-medium">Could not load domains</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      ) : loading && domains.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {domains.map((domain) => (
            <div key={domain.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground">
                  <Globe2 className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <a
                      href={domain.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="truncate text-sm font-semibold hover:underline"
                    >
                      {domain.hostname}
                    </a>
                    <DomainStatusBadge status={domain.status} />
                    {domain.isDefault && <Badge variant="outline">Default</Badge>}
                    {domain.isSystem && <Badge variant="secondary">Built-in</Badge>}
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{domain.url}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {domain.isSystem
                      ? "Managed by Void Links — always available."
                      : domain.verifiedAt
                        ? `Verified ${formatDate(domain.verifiedAt)} · Added ${formatDate(domain.createdAt)}`
                        : `Added ${formatDate(domain.createdAt)} — waiting for DNS`}
                  </p>
                </div>
                {!domain.isSystem && (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => void verify(domain)}
                      disabled={verifying === domain.id}
                    >
                      {verifying === domain.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="size-3.5" />
                      )}
                      Check DNS
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setDeleteTarget(domain)}
                      aria-label="Disconnect domain"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )}
              </div>

              {!domain.isSystem && (
                <div className="mt-3 space-y-2 rounded-xl border border-border bg-muted/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <p className="text-[11px] font-medium">DNS records</p>
                    <span className="text-[10px] text-muted-foreground">Add these at your registrar</span>
                  </div>
                  <DnsRow
                    label="CNAME (recommended)"
                    value={domain.dns.cnameTarget}
                    hint={`Create ${domain.hostname} → ${domain.dns.cnameTarget}. This both routes short links and verifies ownership.`}
                  />
                  <DnsRow label="TXT name (optional)" value={domain.dns.txtName} />
                  <DnsRow label="TXT value (optional)" value={domain.dns.txtValue ?? "Unavailable"} />
                  {domain.dns.aTarget && (
                    <DnsRow
                      label="A record (only with TXT)"
                      value={domain.dns.aTarget}
                      hint={`If you verify by TXT instead, point ${domain.hostname} at this address too.`}
                    />
                  )}
                  <p className="text-[10px] leading-relaxed text-muted-foreground">
                    Use the CNAME alone, or the TXT + A pair when your provider cannot put a CNAME on this
                    hostname. After DNS propagates click Check DNS — the HTTPS certificate is issued
                    automatically, and we email you when the domain is live.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Connect a domain"
        description="Use a hostname you control, like links.example.com. You will add DNS records next."
      >
        <form onSubmit={(event) => void addDomain(event)} className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="domain-hostname" className="text-xs font-medium">
              Hostname
            </label>
            <Input
              id="domain-hostname"
              value={hostname}
              onChange={(event) => setHostname(event.target.value)}
              placeholder="links.example.com"
              autoComplete="off"
              spellCheck={false}
              required
            />
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Enter a domain only — no protocol, path or port. You will get a TXT and CNAME record to publish.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setAddOpen(false)} disabled={adding}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="gap-1.5" disabled={adding || !hostname.trim()}>
              {adding ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
              Add domain
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !deleting && !open && setDeleteTarget(null)}
        title="Disconnect this domain?"
        description="All links on this domain must be moved or deleted first. This cannot be undone."
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
            <p className="truncate text-xs font-medium">{deleteTarget?.hostname}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">{deleteTarget?.url}</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={() => void removeDomain()}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              Disconnect
            </Button>
          </div>
        </div>
      </Dialog>
    </Page>
  )
}