import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("dot-grid flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 py-14 text-center", className)}>
      <div className="flex size-12 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground shadow-sm">
        <Icon className="size-5" />
      </div>
      <h3 className="mt-4 text-sm font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-balance text-xs leading-relaxed text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
