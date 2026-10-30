import { cn } from "@/lib/utils"
import type { LinkStatus } from "@/lib/types"

const styles: Record<LinkStatus, { label: string; className: string; dot: string }> = {
  active: {
    label: "Active",
    className: "border-green-500/25 bg-green-500/10 text-green-600 dark:text-green-400",
    dot: "bg-green-500",
  },
  expired: {
    label: "Expired",
    className: "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  disabled: {
    label: "Disabled",
    className: "border-border bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/60",
  },
}

export function StatusBadge({ status, className }: { status: LinkStatus; className?: string }) {
  const meta = styles[status]
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
        meta.className,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  )
}

const domainStyles: Record<string, { label: string; className: string; dot: string }> = {
  verified: {
    label: "Verified",
    className: "border-green-500/25 bg-green-500/10 text-green-600 dark:text-green-400",
    dot: "bg-green-500",
  },
  pending: {
    label: "Pending",
    className: "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  failed: {
    label: "Check DNS",
    className: "border-destructive/25 bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
  disabled: {
    label: "Disabled",
    className: "border-border bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/60",
  },
}

export function DomainStatusBadge({ status, className }: { status: string; className?: string }) {
  const meta = domainStyles[status] ?? domainStyles.pending
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
        meta.className,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  )
}