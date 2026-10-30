import { Link } from "react-router"
import { ArrowUpRight, ExternalLink, Link2, QrCode, Trash2 } from "lucide-react"
import { CopyButton } from "@/components/CopyButton"
import { StatusBadge } from "@/components/StatusBadge"
import { formatCompact, relativeTime } from "@/lib/format"
import type { LinkItem } from "@/lib/types"

const iconButton =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

export function LinkRow({
  link,
  onDelete,
  onQr,
}: {
  link: LinkItem
  onDelete?: (link: LinkItem) => void
  onQr?: (link: LinkItem) => void
}) {
  const shortLabel = `${link.domain.hostname}/${link.slug}`

  return (
    <div className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/20">
      <div className="hidden size-9 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground sm:flex">
        <Link2 className="size-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <a
            href={link.shortUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="truncate text-sm font-medium hover:underline"
          >
            {shortLabel}
          </a>
          <StatusBadge status={link.status} />
        </div>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {link.title ? <span className="text-foreground/70">{link.title} · </span> : null}
          {link.destination}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] text-muted-foreground">
          <span className="tabular-nums">{formatCompact(link.clicks)} clicks</span>
          <span>Created {relativeTime(link.createdAt)}</span>
          {link.expiresAt && (
            <span className={link.status === "expired" ? "text-amber-600 dark:text-amber-400" : ""}>
              {link.status === "expired" ? "Expired" : "Expires"} {relativeTime(link.expiresAt)}
            </span>
          )}
          {link.lastClickedAt && <span>Last click {relativeTime(link.lastClickedAt)}</span>}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <CopyButton value={link.shortUrl} size="icon-sm" label="Copy short link" toast={false} />
        {onQr && (
          <button
            type="button"
            onClick={() => onQr(link)}
            className={`${iconButton} hidden sm:inline-flex`}
            aria-label="Show QR code"
            title="QR code"
          >
            <QrCode className="size-4" />
          </button>
        )}
        <a
          href={link.shortUrl}
          target="_blank"
          rel="noreferrer noopener"
          className={`${iconButton} hidden sm:inline-flex`}
          aria-label="Open short link"
          title="Open link"
        >
          <ExternalLink className="size-4" />
        </a>
        <Link to={`/links/${link.id}`} className={iconButton} aria-label="Link details" title="Details">
          <ArrowUpRight className="size-4" />
        </Link>
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(link)}
            className={`${iconButton} hover:bg-destructive/10 hover:text-destructive`}
            aria-label="Delete link"
            title="Delete link"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
    </div>
  )
}