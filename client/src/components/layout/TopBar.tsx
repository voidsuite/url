import { useEffect, useRef, useState } from "react"
import { Link, NavLink, useLocation, useNavigate } from "react-router"
import {
  ChevronDown,
  LayoutDashboard,
  Link2,
  LogIn,
  LogOut,
  Settings,
  ShieldCheck,
  Globe2,
} from "lucide-react"
import { useAuth } from "@/contexts/auth"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { VoidLogo } from "@/components/VoidLogo"
import { ThemeToggle } from "@/components/ThemeToggle"
import { Button } from "@/components/ui/button"
import { initials } from "@/lib/format"
import { cn } from "@/lib/utils"

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/links", label: "Links", icon: Link2 },
  { to: "/domains", label: "Domains", icon: Globe2 },
]

export function TopBar() {
  const { user, isAdmin, logout, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [signingIn, setSigningIn] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const close = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [menuOpen])

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  const signInNow = async () => {
    setSigningIn(true)
    try {
      await signIn()
    } finally {
      setSigningIn(false)
    }
  }

  const signOut = async () => {
    setMenuOpen(false)
    await logout()
    navigate("/", { replace: true })
  }

  return (
    <header className="shrink-0 bg-transparent">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2.5 sm:px-6 sm:py-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-5">
          <Link to="/" className="shrink-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
            <VoidLogo />
          </Link>
          {user && (
            <nav className="flex items-center gap-0.5 sm:gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition-colors sm:px-2.5",
                      isActive
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                    )
                  }
                >
                  <item.icon className="size-4" />
                  <span className="hidden md:inline">{item.label}</span>
                </NavLink>
              ))}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5">
          <ThemeToggle />
          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((value) => !value)}
                className="flex items-center gap-1 rounded-full p-0.5 outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring/50"
                aria-label="Account menu"
                aria-expanded={menuOpen}
              >
                <Avatar className="size-7">
                  <AvatarImage src={user.picture || undefined} alt={user.name} />
                  <AvatarFallback className="text-[10px]">
                    {initials(user.name, user.email.charAt(0).toUpperCase())}
                  </AvatarFallback>
                </Avatar>
                <ChevronDown className="hidden size-3.5 text-muted-foreground sm:block" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-60 animate-slide-down overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                  <div className="border-b border-border px-3 py-2.5">
                    <p className="truncate text-xs font-medium">{user.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{user.email}</p>
                    {isAdmin && (
                      <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        <ShieldCheck className="size-2.5" /> Admin
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate("/settings")}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-muted/50"
                  >
                    <Settings className="size-3.5" />
                    Settings & API
                  </button>
                  {isAdmin && (
                    <a
                      href="https://auth.stwupid.tech"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-muted/50"
                    >
                      <ShieldCheck className="size-3.5" />
                      VoidAuth account
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => void signOut()}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-destructive transition-colors hover:bg-destructive/10"
                  >
                    <LogOut className="size-3.5" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="ml-1 h-8 gap-1.5 rounded-full px-3 text-xs"
              onClick={() => void signInNow()}
              disabled={signingIn}
            >
              <LogIn className="size-3.5" />
              <span className="hidden sm:inline">{signingIn ? "Opening…" : "Sign in"}</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
