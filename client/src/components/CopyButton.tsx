import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { copyText } from "@/lib/api"
import { useToast } from "@/contexts/toast"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export function CopyButton({
  value,
  label = "Copy link",
  className,
  size = "sm",
  variant = "outline",
  toast = true,
  onCopied,
}: {
  value: string
  label?: string
  className?: string
  size?: "xs" | "sm" | "default" | "icon-sm" | "icon"
  variant?: "default" | "outline" | "secondary" | "ghost"
  toast?: boolean
  onCopied?: () => void
}) {
  const [copied, setCopied] = useState(false)
  const toastCtx = useToast()

  const copy = async (event: React.MouseEvent) => {
    event.stopPropagation()
    event.preventDefault()
    const ok = await copyText(value)
    if (ok) {
      setCopied(true)
      onCopied?.()
      if (toast) toastCtx.addToast("Copied to clipboard", "success", 2200)
      window.setTimeout(() => setCopied(false), 1800)
    } else {
      toastCtx.addToast("Could not copy — select the link and copy manually.", "error")
    }
  }

  if (size === "icon-sm" || size === "icon") {
    return (
      <button
        type="button"
        onClick={copy}
        className={cn(
          "flex items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          size === "icon-sm" ? "size-8" : "size-9",
          className,
        )}
        aria-label={copied ? "Copied" : label}
        title={copied ? "Copied" : label}
      >
        {copied ? <Check className="size-4 text-green-500 animate-pop" /> : <Copy className="size-4" />}
      </button>
    )
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={copy}
      className={cn("gap-1.5", className)}
      aria-live="polite"
    >
      {copied ? <Check className="size-3.5 text-green-500 animate-pop" /> : <Copy className="size-3.5" />}
      {copied ? "Copied" : label}
    </Button>
  )
}
