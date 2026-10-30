import { cn } from "@/lib/utils"

type LogoSize = "sm" | "md" | "lg"

const sizes: Record<LogoSize, { box: string; icon: string; text: string }> = {
  sm: { box: "size-7 rounded-lg", icon: "size-4", text: "text-sm" },
  md: { box: "size-9 rounded-xl", icon: "size-5", text: "text-base" },
  lg: { box: "size-12 rounded-2xl", icon: "size-6", text: "text-lg" },
}

export function VoidLogo({
  size = "sm",
  showWordmark = true,
  className,
}: {
  size?: LogoSize
  showWordmark?: boolean
  className?: string
}) {
  const s = sizes[size]
  return (
    <span className={cn("inline-flex select-none items-center gap-2.5", className)}>
      <span
        className={cn(
          "relative flex shrink-0 items-center justify-center bg-primary text-primary-foreground shadow-sm shadow-primary/30",
          s.box,
        )}
      >
        <svg viewBox="0 0 24 24" fill="none" className={s.icon} aria-hidden="true">
          <path
            d="M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L10.7 5.22"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M14 11a5 5 0 0 0-7.07 0L4.81 13.12a5 5 0 0 0 7.07 7.07l1.42-1.42"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {showWordmark && (
        <span className={cn("font-semibold tracking-tight", s.text)}>
          Void <span className="text-muted-foreground">Links</span>
        </span>
      )}
    </span>
  )
}
