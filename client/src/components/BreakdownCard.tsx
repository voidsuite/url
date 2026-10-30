import type { ReactNode } from "react"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { BreakdownItem } from "@/lib/types"

export function BreakdownCard({
  title,
  items,
  empty = "No data yet",
  renderLabel,
  icon,
  className,
}: {
  title: string
  items: BreakdownItem[]
  empty?: string
  renderLabel?: (label: string) => ReactNode
  icon?: ReactNode
  className?: string
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0)
  const max = Math.max(1, ...items.map((item) => item.value))

  return (
    <div className={cn("rounded-2xl border border-border bg-card p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold">{title}</h3>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      {items.length === 0 ? (
        <p className="mt-6 text-center text-[11px] text-muted-foreground">{empty}</p>
      ) : (
        <div className="mt-3 space-y-2.5">
          {items.slice(0, 6).map((item) => {
            const percent = total > 0 ? Math.round((item.value / total) * 100) : 0
            return (
              <div key={item.label}>
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="min-w-0 truncate text-muted-foreground">
                    {renderLabel ? renderLabel(item.label) : item.label}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {formatNumber(item.value)} <span className="text-muted-foreground">· {percent}%</span>
                  </span>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-foreground/70 transition-all duration-500"
                    style={{ width: `${Math.max(3, (item.value / max) * 100)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
