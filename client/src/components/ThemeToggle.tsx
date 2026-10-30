import { Moon, Sun } from "lucide-react"
import { useTheme } from "@/components/theme-provider"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const resolved = theme === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme
  const next = resolved === "dark" ? "light" : "dark"

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      title={`Switch to ${next} mode`}
      aria-label={`Switch to ${next} mode`}
    >
      {resolved === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  )
}
