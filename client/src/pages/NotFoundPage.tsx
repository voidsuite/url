import { Link } from "react-router"
import { Page } from "@/components/layout/Page"
import { Button } from "@/components/ui/button"
import { VoidLogo } from "@/components/VoidLogo"

export function NotFoundPage() {
  return (
    <Page centered className="h-full">
      <div className="space-y-6 text-center">
        <VoidLogo size="lg" className="justify-center" />
        <div className="space-y-2">
          <p className="font-mono text-xs text-muted-foreground">404</p>
          <h1 className="text-2xl font-semibold tracking-tight">This page does not exist.</h1>
          <p className="text-sm text-muted-foreground">
            The address may be mistyped, or the link you followed has moved.
          </p>
        </div>
        <div className="flex flex-col justify-center gap-2 sm:flex-row">
          <Button asChild>
            <Link to="/">Back to Void Links</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/links">Your links</Link>
          </Button>
        </div>
      </div>
    </Page>
  )
}