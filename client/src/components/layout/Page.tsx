import * as React from "react"
import { cn } from "@/lib/utils"

interface PageProps {
  children: React.ReactNode
  className?: string
  centered?: boolean
  width?: "sm" | "md" | "lg" | "xl"
}

const widths: Record<NonNullable<PageProps["width"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-2xl",
  lg: "max-w-4xl",
  xl: "max-w-6xl",
}

export function Page({ children, className, centered = false, width = "md" }: PageProps) {
  return (
    <div
      className={cn(
        "min-h-full",
        centered ? "flex items-center justify-center p-4 sm:p-6" : "animate-page-in",
        className,
      )}
    >
      {centered ? (
        <div className={cn("w-full space-y-8", widths[width])}>{children}</div>
      ) : (
        <main className={cn("mx-auto w-full space-y-8 px-5 py-7 sm:px-8 sm:py-10", widths[width])}>
          {children}
        </main>
      )}
    </div>
  )
}

export interface PageHeaderProps {
  title: string
  description?: string
  action?: React.ReactNode
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 space-y-0.5">
        <h1 className="text-balance text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function Section({
  title,
  description,
  children,
  className,
  padded = true,
}: {
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <section className={cn("space-y-3", className)}>
      {(title || description) && (
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      )}
      <div
        className={cn(
          "overflow-hidden rounded-2xl border border-border bg-card",
          padded ? "divide-y divide-border" : "",
        )}
      >
        {children}
      </div>
    </section>
  )
}
