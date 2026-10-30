import { cn } from "@/lib/utils"

export function RangeTabs({
  value,
  onChange,
  ranges = [7, 30, 90],
}: {
  value: number
  onChange: (days: number) => void
  ranges?: readonly number[]
}) {
  return (
    <div className="inline-flex rounded-xl border border-border bg-card p-0.5">
      {ranges.map((range) => (
        <button
          key={range}
          type="button"
          onClick={() => onChange(range)}
          aria-pressed={value === range}
          className={cn(
            "rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors",
            value === range ? "bg-muted text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {range}d
        </button>
      ))}
    </div>
  )
}