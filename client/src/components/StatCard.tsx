import type { LucideIcon } from "lucide-react"
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  trend,
  className,
}: {
  label: string
  value: string | number
  hint?: string
  icon?: LucideIcon
  trend?: number | null
  className?: string
}) {
  const trendValue = trend === null || trend === undefined ? null : trend
  const TrendIcon = trendValue === null || trendValue === 0 ? Minus : trendValue > 0 ? ArrowUpRight : ArrowDownRight

  return (
    <div className={cn("rounded-2xl border border-border bg-card px-4 py-3.5", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <span className="flex size-7 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
            <Icon className="size-3.5" />
          </span>
        )}
      </div>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      <div className="mt-1 flex min-h-4 items-center gap-1.5">
        {trendValue !== null && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
              trendValue > 0
                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                : trendValue < 0
                  ? "bg-destructive/10 text-destructive"
                  : "bg-muted text-muted-foreground",
            )}
          >
            <TrendIcon className="size-2.5" />
            {trendValue > 0 ? "+" : ""}
            {trendValue}%
          </span>
        )}
        {hint && <span className="truncate text-[10px] text-muted-foreground">{hint}</span>}
      </div>
    </div>
  )
}
