/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { get } from "@/lib/api"
import type { RuntimeConfig } from "@/lib/types"

interface ConfigContextValue {
  config: RuntimeConfig | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const ConfigContext = React.createContext<ConfigContextValue | undefined>(undefined)

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = React.useState<RuntimeConfig | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const refresh = React.useCallback(async () => {
    try {
      const data = await get<RuntimeConfig>("/api/config")
      setConfig(data)
      setError(null)
    } catch (err) {
      setError((err as Error).message || "Could not load configuration.")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  const value = React.useMemo<ConfigContextValue>(
    () => ({ config, loading, error, refresh }),
    [config, loading, error, refresh],
  )

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>
}

export function useConfig(): ConfigContextValue {
  const ctx = React.useContext(ConfigContext)
  if (!ctx) throw new Error("useConfig must be used within ConfigProvider")
  return ctx
}
