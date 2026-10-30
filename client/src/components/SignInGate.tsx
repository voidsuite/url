import { BarChart3, Globe2, History, Link2, ShieldCheck } from "lucide-react"
import { useAuth } from "@/contexts/auth"
import { Button } from "@/components/ui/button"
import { VoidLogo } from "@/components/VoidLogo"
import { useState } from "react"

const perks = [
  { icon: History, title: "Every link in one place", text: "Search, filter and edit your full history." },
  { icon: BarChart3, title: "Clicks with context", text: "Referrers, countries, devices and unique visitors." },
  { icon: Globe2, title: "Your own domain", text: "Connect a custom domain and shorten on your brand." },
  { icon: Link2, title: "Custom slugs", text: "Reserve memorable codes like v0id.cc/launch." },
]

export function SignInGate({ next = "/dashboard" }: { next?: string }) {
  const { signIn } = useAuth()
  const [busy, setBusy] = useState(false)

  const start = async () => {
    setBusy(true)
    try {
      await signIn(next)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col items-center justify-center px-5 py-12 text-center">
      <VoidLogo size="lg" />
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Keep your links.</h1>
      <p className="mt-1.5 max-w-sm text-balance text-sm leading-relaxed text-muted-foreground">
        Shortening is always free without an account. Sign in when you want history, analytics, custom
        slugs and domains.
      </p>

      <div className="mt-7 w-full space-y-2 text-left">
        {perks.map((perk) => (
          <div key={perk.title} className="flex items-start gap-3 rounded-xl border border-border bg-card px-3.5 py-3">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/70 text-muted-foreground">
              <perk.icon className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium">{perk.title}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{perk.text}</p>
            </div>
          </div>
        ))}
      </div>

      <Button className="mt-6 h-10 w-full gap-1.5" onClick={() => void start()} disabled={busy}>
        {busy ? "Opening VoidAuth…" : "Sign in with VoidAuth"}
      </Button>
      <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
        <ShieldCheck className="size-3.5" />
        Sign-in happens on auth.stwupid.tech. Your password never touches this app.
      </p>
    </div>
  )
}
