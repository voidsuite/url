import { useCallback, useEffect, useState, type FormEvent } from "react"
import { useNavigate } from "react-router"
import {
  ExternalLink,
  KeyRound,
  Loader2,
  LogOut,
  Monitor,
  Moon,
  Plus,
  Sun,
  Trash2,
} from "lucide-react"
import { Page, PageHeader } from "@/components/layout/Page"
import { CopyButton } from "@/components/CopyButton"
import Dialog from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/contexts/auth"
import { useConfig } from "@/contexts/config"
import { useTheme } from "@/components/theme-provider"
import { useToast } from "@/contexts/toast"
import { del, get, post } from "@/lib/api"
import { formatDate, initials, relativeTime } from "@/lib/format"
import type { ApiTokenRecord, CreateTokenResponse, TokensResponse } from "@/lib/types"
import { cn } from "@/lib/utils"

const SCOPE_META = [
  { id: "links:read", label: "Read links", hint: "List links and read their analytics." },
  { id: "links:write", label: "Manage links", hint: "Create, edit and delete links. Includes read." },
  { id: "stats:read", label: "Read analytics", hint: "Account-wide click metrics." },
] as const

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const

export function SettingsPage() {
  const { user, logout } = useAuth()
  const { config } = useConfig()
  const { theme, setTheme } = useTheme()
  const toast = useToast()
  const navigate = useNavigate()

  const [tokens, setTokens] = useState<ApiTokenRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState("")
  const [scopes, setScopes] = useState<string[]>(["links:read"])
  const [expires, setExpires] = useState("90")
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<CreateTokenResponse | null>(null)

  const [revokeTarget, setRevokeTarget] = useState<ApiTokenRecord | null>(null)
  const [revoking, setRevoking] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await get<TokensResponse>("/api/tokens")
      setTokens(result.tokens)
      setError(null)
    } catch (err) {
      setError((err as Error).message || "Could not load your API tokens.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const toggleScope = (scope: string) => {
    setScopes((current) =>
      current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope],
    )
  }

  const createToken = async (event: FormEvent) => {
    event.preventDefault()
    if (creating) return
    if (!name.trim()) {
      toast.addToast("Give the token a name.", "error")
      return
    }
    if (scopes.length === 0) {
      toast.addToast("Choose at least one scope.", "error")
      return
    }
    setCreating(true)
    try {
      const result = await post<CreateTokenResponse>("/api/tokens", {
        name: name.trim(),
        scopes,
        expiresInDays: expires === "never" ? null : Number(expires),
      })
      setTokens((current) => [result.apiToken, ...current])
      setCreateOpen(false)
      setName("")
      setScopes(["links:read"])
      setExpires("90")
      setCreated(result)
    } catch (err) {
      toast.addToast((err as Error).message || "Could not create the token.", "error")
    } finally {
      setCreating(false)
    }
  }

  const revoke = async () => {
    if (!revokeTarget || revoking) return
    setRevoking(true)
    try {
      await del(`/api/tokens/${revokeTarget.id}`)
      toast.addToast("Token revoked", "success")
      setRevokeTarget(null)
      void load()
    } catch (err) {
      toast.addToast((err as Error).message || "Could not revoke the token.", "error")
    } finally {
      setRevoking(false)
    }
  }

  const signOut = async () => {
    await logout()
    navigate("/", { replace: true })
  }

  const appUrl = config?.appUrl ?? "https://v0id.cc"
  const example = `curl ${appUrl}/api/links \\
  -H "Authorization: Bearer vlk_..." \\
  -H "Content-Type: application/json" \\
  -d '{"destination":"https://example.com"}'`

  return (
    <Page width="lg">
      <PageHeader title="Settings" description="Your account, appearance and API access." />

      <div className="space-y-3">
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <Avatar className="size-11">
              <AvatarImage src={user?.picture || undefined} alt={user?.name} />
              <AvatarFallback className="text-sm">
                {initials(user?.name, user?.email?.charAt(0).toUpperCase() ?? "?")}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user?.name || "VoidAuth user"}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className="capitalize">
                  {user?.role || "user"}
                </Badge>
                {user?.isAdmin && <Badge>Admin</Badge>}
                <span className="text-[10px] text-muted-foreground">
                  Member since {formatDate(user?.createdAt)}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button variant="outline" size="sm" asChild className="gap-1.5">
                <a href="https://auth.stwupid.tech" target="_blank" rel="noreferrer noopener">
                  Manage account
                  <ExternalLink className="size-3.5" />
                </a>
              </Button>
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => void signOut()}>
                <LogOut className="size-3.5" />
                Sign out
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
          <div>
            <p className="text-sm font-medium">Appearance</p>
            <p className="text-[11px] text-muted-foreground">Light, dark, or follow your system.</p>
          </div>
          <div className="inline-flex rounded-xl border border-border bg-muted/20 p-0.5">
            {THEME_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTheme(option.value)}
                aria-pressed={theme === option.value}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors",
                  theme === option.value
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <option.icon className="size-3.5" />
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <section className="space-y-2">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">API tokens</h2>
              <p className="text-[11px] text-muted-foreground">
                Scoped tokens for scripts and CI. The secret is shown once.
              </p>
            </div>
            <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" />
              New token
            </Button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {loading ? (
              <div className="divide-y divide-border">
                {Array.from({ length: 2 }).map((_, index) => (
                  <div key={index} className="flex items-center gap-3 px-4 py-3">
                    <Skeleton className="size-8 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-1/3" />
                      <Skeleton className="h-2.5 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="px-4 py-8 text-center">
                <p className="text-xs text-muted-foreground">{error}</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => void load()}>
                  Try again
                </Button>
              </div>
            ) : tokens.length === 0 ? (
              <div className="dot-grid flex flex-col items-center justify-center px-6 py-10 text-center">
                <div className="flex size-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-sm">
                  <KeyRound className="size-4" />
                </div>
                <p className="mt-3 text-xs font-medium">No tokens yet</p>
                <p className="mt-1 max-w-xs text-[11px] leading-relaxed text-muted-foreground">
                  Create a token when you want to manage links from a script without a browser session.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {tokens.map((token) => (
                  <div key={token.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
                      <KeyRound className="size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-xs font-medium">{token.name}</p>
                        <span className="font-mono text-[10px] text-muted-foreground">{token.prefix}…</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {token.scopes.map((scope) => (
                          <Badge key={scope} variant="outline" className="font-mono text-[9px]">
                            {scope}
                          </Badge>
                        ))}
                      </div>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Created {formatDate(token.createdAt)} · Last used{" "}
                        {token.lastUsedAt ? relativeTime(token.lastUsedAt) : "never"} ·{" "}
                        {token.expiresAt ? `Expires ${formatDate(token.expiresAt)}` : "Never expires"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setRevokeTarget(token)}
                      aria-label={`Revoke ${token.name}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">Use a token</h2>
              <p className="text-[11px] text-muted-foreground">Send it as a Bearer header against the same API.</p>
            </div>
            <CopyButton value={example} size="xs" label="Copy example" toast={false} />
          </div>
          <pre className="mt-3 overflow-x-auto rounded-xl border border-border bg-muted/30 p-3 font-mono text-[11px] leading-relaxed">
            <code>{example}</code>
          </pre>
          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
            Tokens can only be created or revoked from a browser session, so a leaked token cannot mint more
            tokens. Revoke a token here if it is ever exposed.
          </p>
        </div>
      </div>

      <Dialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create an API token"
        description="Choose only the scopes this token needs."
      >
        <form onSubmit={(event) => void createToken(event)} className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="token-name" className="text-xs font-medium">
              Name
            </label>
            <Input
              id="token-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Deploy script"
              maxLength={60}
              required
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium">Scopes</p>
            <div className="space-y-1.5">
              {SCOPE_META.map((scope) => {
                const checked = scopes.includes(scope.id)
                return (
                  <label
                    key={scope.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2 transition-colors",
                      checked ? "border-foreground/20 bg-muted/40" : "border-border hover:bg-muted/20",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleScope(scope.id)}
                      className="mt-0.5 size-3.5 accent-foreground"
                    />
                    <span className="min-w-0">
                      <span className="block text-xs font-medium">{scope.label}</span>
                      <span className="block text-[10px] leading-relaxed text-muted-foreground">{scope.hint}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="token-expiry" className="text-xs font-medium">
              Expiry
            </label>
            <Select id="token-expiry" value={expires} onChange={(event) => setExpires(event.target.value)}>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="365">1 year</option>
              <option value="never">Never expires</option>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="gap-1.5" disabled={creating || !name.trim() || scopes.length === 0}>
              {creating ? <Loader2 className="size-3.5 animate-spin" /> : <KeyRound className="size-3.5" />}
              Create token
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={created !== null}
        onOpenChange={(open) => !open && setCreated(null)}
        title="Token created"
        description="Copy it now. For security, it will never be shown again."
      >
        {created && (
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {created.apiToken.name}
              </p>
              <p className="mt-1 break-all font-mono text-[11px] leading-relaxed">{created.token}</p>
            </div>
            <CopyButton value={created.token} label="Copy token" size="default" className="w-full" />
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setCreated(null)}>
                Done
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        open={revokeTarget !== null}
        onOpenChange={(open) => !revoking && !open && setRevokeTarget(null)}
        title="Revoke this token?"
        description="Any script using it will immediately lose access. This cannot be undone."
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
            <p className="truncate text-xs font-medium">{revokeTarget?.name}</p>
            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{revokeTarget?.prefix}…</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setRevokeTarget(null)} disabled={revoking}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={() => void revoke()}
              disabled={revoking}
            >
              {revoking ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              Revoke token
            </Button>
          </div>
        </div>
      </Dialog>
    </Page>
  )
}