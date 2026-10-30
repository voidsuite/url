import { useMemo, useState } from "react"
import { Download, ExternalLink, QrCode } from "lucide-react"
import Dialog from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CopyButton } from "@/components/CopyButton"
import { useToast } from "@/contexts/toast"

export function QrDialog({
  open,
  onOpenChange,
  url,
  title = "QR code",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  url: string | null
  title?: string
}) {
  const toast = useToast()
  const [downloading, setDownloading] = useState(false)

  const parts = useMemo(() => {
    if (!url) return null
    try {
      const parsed = new URL(url)
      return { host: parsed.hostname, slug: parsed.pathname.replace(/^\//, "") }
    } catch {
      return null
    }
  }, [url])

  const imageUrl =
    parts?.host && parts.slug
      ? `/api/qr?domain=${encodeURIComponent(parts.host)}&slug=${encodeURIComponent(parts.slug)}&size=640`
      : null

  const download = async () => {
    if (!imageUrl || !parts) return
    setDownloading(true)
    try {
      const response = await fetch(imageUrl)
      if (!response.ok) throw new Error("Could not generate the QR code")
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = objectUrl
      anchor.download = `voidlinks-${parts.slug}.svg`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(objectUrl)
      toast.addToast("QR code downloaded", "success")
    } catch (err) {
      toast.addToast((err as Error).message || "Could not download the QR code.", "error")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description="Print it, post it, or drop it in a slide."
    >
      {url && imageUrl ? (
        <div className="space-y-4">
          <div className="qr-frame mx-auto max-w-[280px]">
            <img src={imageUrl} alt={`QR code for ${url}`} width={640} height={640} />
          </div>
          <div className="flex items-center justify-center gap-2">
            <CopyButton value={url} size="sm" label="Copy link" />
            <Button variant="outline" size="sm" asChild className="gap-1.5">
              <a href={imageUrl} download={`voidlinks-${parts?.slug || "qr"}.svg`} onClick={(event) => {
                event.preventDefault()
                void download()
              }}>
                <Download className="size-3.5" />
                {downloading ? "Preparing…" : "Download SVG"}
              </a>
            </Button>
          </div>
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <QrCode className="size-3.5" />
            <span className="truncate">{url}</span>
            <a
              href={url}
              target="_blank"
              rel="noreferrer noopener"
              className="ml-1 inline-flex items-center gap-0.5 underline underline-offset-2 hover:text-foreground"
            >
              Open <ExternalLink className="size-3" />
            </a>
          </div>
        </div>
      ) : (
        <div className="dot-grid flex h-48 items-center justify-center rounded-xl border border-dashed border-border text-xs text-muted-foreground">
          No link selected
        </div>
      )}
    </Dialog>
  )
}
