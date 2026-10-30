import { useMemo, useState } from "react"
import { formatDayShort, formatNumber } from "@/lib/format"
import type { TimePoint } from "@/lib/types"
import { cn } from "@/lib/utils"

const WIDTH = 640
const HEIGHT = 200
const PAD_X = 10
const PAD_TOP = 14
const PAD_BOTTOM = 26

export function ClicksChart({
  data,
  className,
  height = HEIGHT,
}: {
  data: TimePoint[]
  className?: string
  height?: number
}) {
  const [hover, setHover] = useState<number | null>(null)

  const chart = useMemo(() => {
    const max = Math.max(1, ...data.map((point) => point.clicks))
    const innerWidth = WIDTH - PAD_X * 2
    const innerHeight = height - PAD_TOP - PAD_BOTTOM
    const step = data.length > 1 ? innerWidth / (data.length - 1) : 0
    const points = data.map((point, index) => {
      const x = PAD_X + index * step
      const y = PAD_TOP + innerHeight - (point.clicks / max) * innerHeight
      return { ...point, x, y }
    })
    const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ")
    const area = points.length
      ? `${line} L${points[points.length - 1].x.toFixed(2)},${PAD_TOP + innerHeight} L${points[0].x.toFixed(2)},${PAD_TOP + innerHeight} Z`
      : ""
    const total = data.reduce((sum, point) => sum + point.clicks, 0)
    const uniques = data.reduce((sum, point) => sum + point.uniques, 0)
    return { max, innerWidth, innerHeight, points, line, area, total, uniques }
  }, [data, height])

  const hovered = hover !== null ? chart.points[hover] : null
  const tooltipLeft = hovered ? Math.min(92, Math.max(8, (hovered.x / WIDTH) * 100)) : 0
  const labelIndexes = data.length > 0 ? [0, Math.floor((data.length - 1) / 2), data.length - 1] : []

  return (
    <div className={cn("w-full", className)}>
      <div className="mb-2 flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-semibold tabular-nums">{formatNumber(chart.total)}</span>
          <span className="text-[11px] text-muted-foreground">clicks</span>
          <span className="ml-1 text-[11px] text-muted-foreground">·</span>
          <span className="text-[11px] text-muted-foreground">{formatNumber(chart.uniques)} unique</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="inline-block size-1.5 rounded-full bg-foreground/70" /> Clicks
          <span className="ml-1 inline-block size-1.5 rounded-full bg-foreground/25" /> Unique
        </div>
      </div>

      <div className="relative select-none">
        <svg
          viewBox={`0 0 ${WIDTH} ${height}`}
          className="w-full overflow-visible"
          role="img"
          aria-label="Clicks over time"
          style={{ height }}
          onMouseLeave={() => setHover(null)}
        >
          {[0, 0.33, 0.66, 1].map((fraction) => {
            const y = PAD_TOP + chart.innerHeight * fraction
            return (
              <line
                key={fraction}
                x1={PAD_X}
                x2={WIDTH - PAD_X}
                y1={y}
                y2={y}
                stroke="var(--border)"
                strokeWidth="1"
                strokeDasharray={fraction === 1 ? undefined : "3 5"}
              />
            )
          })}

          {chart.area && <path d={chart.area} fill="var(--foreground)" fillOpacity={0.08} />}
          {chart.line && (
            <path
              d={chart.line}
              fill="none"
              stroke="var(--foreground)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.82"
            />
          )}

          {hovered && (
            <g className="chart-crosshair">
              <line
                x1={hovered.x}
                x2={hovered.x}
                y1={PAD_TOP}
                y2={PAD_TOP + chart.innerHeight}
                stroke="var(--muted-foreground)"
                strokeWidth="1"
                strokeDasharray="3 4"
                opacity="0.6"
              />
              <circle cx={hovered.x} cy={hovered.y} r="4" fill="var(--foreground)" stroke="var(--card)" strokeWidth="2" />
            </g>
          )}

          {data.map((point, index) => {
            const step = data.length > 1 ? chart.innerWidth / (data.length - 1) : chart.innerWidth
            return (
              <rect
                key={point.date}
                x={chart.points[index].x - step / 2}
                y={PAD_TOP}
                width={Math.max(step, 8)}
                height={chart.innerHeight}
                fill="transparent"
                onMouseEnter={() => setHover(index)}
              />
            )
          })}

          {labelIndexes.map((index) => {
            const point = chart.points[index]
            if (!point) return null
            const anchor = index === 0 ? "start" : index === data.length - 1 ? "end" : "middle"
            return (
              <text
                key={`label-${index}`}
                x={point.x}
                y={height - 6}
                textAnchor={anchor}
                fill="var(--muted-foreground)"
                fontSize="10"
              >
                {formatDayShort(point.date)}
              </text>
            )
          })}
        </svg>

        {hovered && (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-border bg-popover px-2.5 py-1.5 text-[10px] shadow-lg"
            style={{ left: `${tooltipLeft}%` }}
          >
            <p className="font-medium">{formatDayShort(hovered.date)}</p>
            <p className="mt-0.5 text-muted-foreground">
              {formatNumber(hovered.clicks)} clicks · {formatNumber(hovered.uniques)} unique
            </p>
          </div>
        )}

        {chart.total === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rounded-full border border-border bg-card/80 px-3 py-1 text-[11px] text-muted-foreground backdrop-blur">
              No clicks in this range yet
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
