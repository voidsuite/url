import { useEffect, useRef } from "react"
import { Outlet, useLocation } from "react-router"
import { TopBar } from "./TopBar"
import { CommandPalette } from "@/components/CommandPalette"

/**
 * Routed shell shared by every page: the top bar sits on the app frame and the
 * page content lives in a rounded, internally scrolling well.
 */
export function AppLayout() {
  const location = useLocation()
  const wellRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    wellRef.current?.scrollTo({ top: 0 })
  }, [location.pathname])

  return (
    <>
      <TopBar />
      <div className="min-h-0 flex-1 px-2 pb-2 sm:px-2.5 sm:pb-2.5">
        <div
          ref={wellRef}
          className="custom-scrollbar h-full overflow-y-auto rounded-xl border border-border/70 bg-background shadow-inner sm:rounded-2xl"
        >
          <Outlet />
        </div>
      </div>
      <CommandPalette />
    </>
  )
}