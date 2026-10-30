import { ShortenForm } from "@/components/ShortenForm"

export function HomePage() {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-10 sm:px-6">
      <div className="w-full max-w-2xl">
        <ShortenForm size="lg" autoFocus />
      </div>
    </div>
  )
}