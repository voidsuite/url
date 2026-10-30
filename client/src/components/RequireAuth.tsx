import type { ReactNode } from "react"
import { useLocation } from "react-router"
import { useAuth } from "@/contexts/auth"
import { SignInGate } from "@/components/SignInGate"

export function LoadingScreen({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="flex flex-col items-center gap-3">
        <svg className="size-6 animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  )
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <LoadingScreen label="Checking your session…" />
  if (!user) return <SignInGate next={`${location.pathname}${location.search}`} />
  return <>{children}</>
}
