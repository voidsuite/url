import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router"
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  Globe2,
  Link2,
  MousePointerClick,
  RefreshCw,
  Users,
} from "lucide-react"
import { Page, PageHeader } from "@/components/layout/Page"
import { ShortenForm } from "@/components/ShortenForm"
import { StatCard } from "@/components/StatCard"
import { ClicksChart } from "@/components/ClicksChart"
import { RangeTabs } from "@/components/RangeTabs"
import { EmptyState } from "@/components/EmptyState"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/contexts/auth"
import { get } from "@/lib/api"
import {
  countryName,
  deviceLabel,
  firstName,
  formatCompact,
  formatNumber,
  percentChange,
  relativeRange,
  relativeTime,
} from "@/lib/format"
import type { Overview } from "@/lib/types"

export function DashboardPage() {
  const { user } = useAuth()
  const [days, setDays] = useState(30)
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const overview = await get<Overview>("/api/stats/overview", { days })
      setData(overview)
      setError(null)
    } catch (err) {
      setError((err as Error).message || "Could not load your dashboard.")
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    void load()
  }, [load])

  const greeting = user?.name ? `Welcome back, ${firstName(user.name)}` : "Welcome back"

  return (
    <Page width="xl">
      <PageHeader
        title={greeting}
        description="Your links at a glance — clicks, visitors and what is working."
        action={<RangeTabs value={days} onChange={setDays} />}
      />

      <ShortenForm size="md" onCreated={() => void load()} />

      {error ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <p className="text-sm font-medium">Could not load analytics</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={() => void load()}>
            <RefreshCw className="size-3.5" />
            Try again
          </Button>
        </div>
      ) : loading && !data ? (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-24 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-2xl" />
          <div className="grid gap-3 lg:grid-cols-2">
            <Skeleton className="h-56 rounded-2xl" />
            <Skeleton className="h-56 rounded-2xl" />
          </div>
        </div>
      ) : data && data.stats.links === 0 ? (
        <EmptyState
          icon={Link2}
          title="No links yet"
          description="Shorten your first link above. It will appear here with clicks, visitors and breakdowns as soon as people start using it."
        />
      ) : data ? (
        <>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Clicks"
              value={formatCompact(data.stats.clicksInRange)}
              hint={`${formatNumber(data.stats.clicks)} all time`}
              icon={MousePointerClick}
              trend={percentChange(data.stats.clicksInRange, data.stats.previousClicks)}
            />
            <StatCard
              label="Unique visitors"
              value={formatCompact(data.stats.uniques)}
              hint={`last ${relativeRange(days)}`}
              icon={Users}
            />
            <StatCard
              label="Active links"
              value={formatCompact(data.stats.activeLinks)}
              hint={`${formatNumber(data.stats.links)} total`}
              icon={Link2}
            />
            <StatCard
              label="Top country"
              value={countryName(data.stats.topCountry)}
              hint={`${formatNumber(data.stats.bots)} bot clicks filtered`}
              icon={Globe2}
            />
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">Clicks over time</h2>
                <p className="text-[11px] text-muted-foreground">Daily clicks and unique visitors.</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                <Bot className="size-3" />
                bots excluded
              </span>
            </div>
            <ClicksChart data={data.series} height={220} />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold">Top links</h2>
                <Button variant="ghost" size="xs" asChild className="gap-1 text-muted-foreground">
                  <Link to="/links">
                    View all <ArrowRight className="size-3" />
                  </Link>
                </Button>
              </div>
              {data.topLinks.length === 0 ? (
                <p className="px-4 py-8 text-center text-[11px] text-muted-foreground">No links yet.</p>
              ) : (
                <div className="divide-y divide-border">
                  {data.topLinks.map((link) => (
                    <Link
                      key={link.id}
                      to={`/links/${link.id}`}
                      className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/20"
                    >
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
                        <Link2 className="size-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-xs font-medium">
                            {link.shortUrl.replace(/^https?:\/\//, "")}
                          </span>
                          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                            {formatCompact(link.clicks)} clicks
                          </span>
                        </div>
                        <p className="truncate text-[10px] text-muted-foreground">{link.destination}</p>
                      </div>
                      <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" />
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold">Recent clicks</h2>
                <span className="text-[10px] text-muted-foreground">{relativeRange(days)}</span>
              </div>
              {data.recent.length === 0 ? (
                <p className="px-4 py-8 text-center text-[11px] text-muted-foreground">
                  No clicks yet. Share a link to see activity here.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {data.recent.slice(0, 6).map((click) => (
                    <Link
                      key={click.id}
                      to={`/links/${click.linkId}`}
                      className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/20"
                    >
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
                        <MousePointerClick className="size-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">
                          {click.shortUrl.replace(/^https?:\/\//, "")}
                        </p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {countryName(click.country)} · {click.referrerHost || "Direct"} · {deviceLabel(click.device)}
                        </p>
                      </div>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {relativeTime(click.clickedAt)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </Page>
  )
}