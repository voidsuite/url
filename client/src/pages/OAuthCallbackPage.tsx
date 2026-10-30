import { useEffect, useRef, useState } from "react"
import { Link, useNavigate } from "react-router"
import { useAuth } from "@/contexts/auth"
import { useToast } from "@/contexts/toast"
import { getAnonId, post } from "@/lib/api"
import { Page } from "@/components/layout/Page"
import { Button } from "@/components/ui/button"
import { VoidLogo } from "@/components/VoidLogo"

export function OAuthCallbackPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { refresh } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const params = new URLSearchParams(window.location.search)
    const oauthError = params.get("error")
    if (oauthError) {
      setError(params.get("error_description") || oauthError)
      return
    }

    const code = params.get("code")
    const state = params.get("state")
    if (!code || !state) {
      setError("The sign-in response was missing its code. Please try again.")
      return
    }

    post<{ user: unknown; claimed: number }>("/api/auth/exchange", {
      code,
      state,
      keepMeLoggedIn: true,
      anonId: getAnonId(),
    })
      .then(async (result) => {
        await refresh()
        if (result.claimed > 0) {
          toast.addToast(
            `Signed in — claimed ${result.claimed} anonymous ${result.claimed === 1 ? "link" : "links"}.`,
            "success",
          )
        } else {
          toast.addToast("Signed in with VoidAuth", "success")
        }
        const returnTo = sessionStorage.getItem("voidlinks:returnTo")
        sessionStorage.removeItem("voidlinks:returnTo")
        const destination =
          returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") && !returnTo.startsWith("/oauth/callback")
            ? returnTo
            : "/dashboard"
        navigate(destination, { replace: true })
      })
      .catch((err: Error) => {
        setError(err.message || "Could not finish signing in.")
      })
  }, [navigate, refresh, toast])

  return (
    <Page centered className="h-full">
      <div className="space-y-6 text-center">
        <VoidLogo size="lg" className="justify-center" />
        {error ? (
          <>
            <div className="space-y-2">
              <h1 className="text-xl font-semibold">Sign-in failed</h1>
              <p className="mx-auto max-w-sm text-sm text-muted-foreground">{error}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Button asChild>
                <Link to="/">Back to Void Links</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link to="/dashboard">Try the dashboard</Link>
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <h1 className="text-xl font-semibold">Finishing sign-in…</h1>
              <p className="text-sm text-muted-foreground">
                Exchanging your VoidAuth code for a secure session.
              </p>
            </div>
            <svg className="mx-auto size-5 animate-spin text-muted-foreground" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </>
        )}
      </div>
    </Page>
  )
}