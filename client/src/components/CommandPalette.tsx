import { useEffect, useMemo, useState, type KeyboardEvent } from "react"
import { useNavigate } from "react-router"
import {
  Globe2,
  Home,
  LayoutDashboard,
  Link2,
  LogIn,
  LogOut,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  type LucideIcon,
} from "lucide-react"
import Dialog from "@/components/ui/dialog"
import { useAuth } from "@/contexts/auth"
import { useTheme } from "@/components/theme-provider"
import { readRecentLinks, type RecentLink } from "@/lib/api"
import { cn } from "@/lib/utils"

interface PaletteAction {
  id: string
  label: string
  hint?: string
  icon: LucideIcon
  keywords?: string
  run: () => void
}

export function CommandPalette() {
  const navigate = useNavigate()
  const { user, signIn, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const [recentLinks, setRecentLinks] = useState<RecentLink[]>([])

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    if (!open) return
    setQuery("")
    setActive(0)
    setRecentLinks(readRecentLinks())
  }, [open])

  const resolved =
    theme === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme

  const actions = useMemo<PaletteAction[]>(() => {
    const focusShorten = () => {
      navigate("/")
      window.setTimeout(() => {
        const input = document.getElementById("shorten-input") as HTMLInputElement | null
        input?.focus()
      }, 200)
    }

    const list: PaletteAction[] = [
      { id: "home", label: "Home", hint: "Public landing page", icon: Home, keywords: "landing shorten", run: () => navigate("/") },
      { id: "new", label: "Shorten a link", hint: "Create a new short link", icon: Plus, keywords: "create new", run: focusShorten },
    ]

    if (user) {
      list.push(
        { id: "dashboard", label: "Dashboard", hint: "Analytics overview", icon: LayoutDashboard, keywords: "stats overview", run: () => navigate("/dashboard") },
        { id: "links", label: "Links", hint: "History and editing", icon: Link2, keywords: "history manage", run: () => navigate("/links") },
        { id: "domains", label: "Domains", hint: "Custom domains and DNS", icon: Globe2, keywords: "dns custom", run: () => navigate("/domains") },
        { id: "settings", label: "Settings & API", hint: "Account and tokens", icon: Settings, keywords: "account token api", run: () => navigate("/settings") },
      )
    }

    list.push({
      id: "theme",
      label: resolved === "dark" ? "Switch to light mode" : "Switch to dark mode",
      hint: `Current: ${resolved}`,
      icon: resolved === "dark" ? Sun : Moon,
      keywords: "appearance theme color",
      run: () => setTheme(resolved === "dark" ? "light" : "dark"),
    })

    if (user) {
      list.push({
        id: "signout",
        label: "Sign out",
        hint: user.email,
        icon: LogOut,
        keywords: "logout",
        run: () => {
          void logout().then(() => navigate("/"))
        },
      })
    } else {
      list.push({
        id: "signin",
        label: "Sign in with VoidAuth",
        hint: "History, analytics and custom slugs",
        icon: LogIn,
        keywords: "login account",
        run: () => {
          void signIn()
        },
      })
    }

    for (const link of recentLinks) {
      list.push({
        id: `recent-${link.id}`,
        label: link.shortUrl,
        hint: link.destination,
        icon: Link2,
        keywords: "recent history",
        run: () => window.open(link.shortUrl, "_blank", "noopener,noreferrer"),
      })
    }

    return list
  }, [navigate, user, signIn, logout, setTheme, resolved, recentLinks])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return actions
    return actions.filter((action) =>
      `${action.label} ${action.hint ?? ""} ${action.keywords ?? ""}`.toLowerCase().includes(needle),
    )
  }, [actions, query])

  useEffect(() => {
    setActive(0)
  }, [query])

  const execute = (action: PaletteAction | undefined) => {
    if (!action) return
    setOpen(false)
    action.run()
  }

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActive((index) => Math.min(index + 1, filtered.length - 1))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActive((index) => Math.max(index - 1, 0))
    } else if (event.key === "Enter") {
      event.preventDefault()
      execute(filtered[active])
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title="Command menu"
      description="Jump to a page, action or recent link."
      className="p-4"
    >
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Search actions and links…"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            className="h-10 w-full rounded-xl border border-input bg-transparent pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </div>

        <div className="-mx-1 max-h-80 overflow-y-auto px-1 custom-scrollbar">
          {filtered.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-muted-foreground">No matches. Try another search.</p>
          ) : (
            <div className="space-y-0.5">
              {filtered.map((action, index) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => execute(action)}
                  onMouseEnter={() => setActive(index)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                    index === active ? "bg-muted text-foreground" : "text-foreground/80 hover:bg-muted/50",
                  )}
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-background/70 text-muted-foreground">
                    <action.icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">{action.label}</span>
                    {action.hint && (
                      <span className="block truncate text-[10px] text-muted-foreground">{action.hint}</span>
                    )}
                  </span>
                  {index === active && <span className="text-[10px] text-muted-foreground">↵</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border pt-2 text-[10px] text-muted-foreground">
          <span>↑↓ navigate · ↵ select · esc close</span>
          <span className="rounded border border-border px-1.5 py-0.5 font-medium">⌘K</span>
        </div>
      </div>
    </Dialog>
  )
}