/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { get, getAnonId, post, startLogin } from "@/lib/api"
import type { AuthResponse, User } from "@/lib/types"

interface AuthContextValue {
  user: User | null
  loading: boolean
  isAdmin: boolean
  signIn: (returnTo?: string) => Promise<void>
  refresh: () => Promise<User | null>
  logout: () => Promise<void>
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null)
  const [loading, setLoading] = React.useState(true)

  const refresh = React.useCallback(async (): Promise<User | null> => {
    try {
      const data = await get<AuthResponse>("/api/auth/me")
      setUser(data.user)
      return data.user
    } catch {
      setUser(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  React.useEffect(() => {
    const onUnauthorized = () => setUser(null)
    window.addEventListener("voidlinks:unauthorized", onUnauthorized)
    return () => window.removeEventListener("voidlinks:unauthorized", onUnauthorized)
  }, [])

  const signIn = React.useCallback(async (returnTo?: string) => {
    await startLogin(returnTo)
  }, [])

  const logout = React.useCallback(async () => {
    try {
      await post("/api/auth/logout")
    } catch {
      /* clear locally regardless */
    }
    setUser(null)
  }, [])

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAdmin: user?.isAdmin === true || user?.role === "admin",
      signIn,
      refresh,
      logout,
    }),
    [user, loading, signIn, refresh, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}

/** Claim links created anonymously in this browser after signing in. */
export async function claimAnonymousLinks(): Promise<number> {
  try {
    const data = await post<{ claimed: number }>("/api/auth/claim", { anonId: getAnonId() })
    return data.claimed || 0
  } catch {
    return 0
  }
}
