import { createBrowserRouter, RouterProvider } from "react-router"
import { AuthProvider } from "@/contexts/auth"
import { ConfigProvider } from "@/contexts/config"
import { ToastProvider } from "@/contexts/toast"
import { ThemeProvider } from "@/components/theme-provider"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { AppShell } from "@/components/layout/AppShell"
import { AppLayout } from "@/components/layout/AppLayout"
import { RequireAuth } from "@/components/RequireAuth"
import { HomePage } from "@/pages/HomePage"
import { DashboardPage } from "@/pages/DashboardPage"
import { LinksPage } from "@/pages/LinksPage"
import { LinkDetailPage } from "@/pages/LinkDetailPage"
import { DomainsPage } from "@/pages/DomainsPage"
import { SettingsPage } from "@/pages/SettingsPage"
import { OAuthCallbackPage } from "@/pages/OAuthCallbackPage"
import { NotFoundPage } from "@/pages/NotFoundPage"

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      {
        path: "dashboard",
        element: (
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        ),
      },
      {
        path: "links",
        element: (
          <RequireAuth>
            <LinksPage />
          </RequireAuth>
        ),
      },
      {
        path: "links/:id",
        element: (
          <RequireAuth>
            <LinkDetailPage />
          </RequireAuth>
        ),
      },
      {
        path: "domains",
        element: (
          <RequireAuth>
            <DomainsPage />
          </RequireAuth>
        ),
      },
      {
        path: "settings",
        element: (
          <RequireAuth>
            <SettingsPage />
          </RequireAuth>
        ),
      },
      { path: "oauth/callback", element: <OAuthCallbackPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
])

export function App() {
  return (
    <AppShell>
      <RouterProvider router={router} />
    </AppShell>
  )
}

export default function Root() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="voidlinks-theme">
      <AuthProvider>
        <ConfigProvider>
          <ErrorBoundary>
            <ToastProvider>
              <App />
            </ToastProvider>
          </ErrorBoundary>
        </ConfigProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}