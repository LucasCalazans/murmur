import { SignedIn, SignedOut, SignIn, SignUp } from '@clerk/clerk-react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { AppShell } from '@/components/layout/AppShell'
import { Audio } from '@/pages/Audio'
import { Dashboard } from '@/pages/Dashboard'
import { Notes } from '@/pages/Notes'
import { Settings } from '@/pages/Settings'

function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-zinc-950">
      <div className="w-full max-w-md">{children}</div>
    </main>
  )
}

export default function App() {
  return (
    <Routes>
      {/* Rotas públicas de auth — Clerk renderiza seus próprios componentes. */}
      <Route
        path="/sign-in/*"
        element={
          <AuthLayout>
            <SignedOut>
              <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
            </SignedOut>
            <SignedIn>
              <Navigate to="/" replace />
            </SignedIn>
          </AuthLayout>
        }
      />
      <Route
        path="/sign-up/*"
        element={
          <AuthLayout>
            <SignedOut>
              <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
            </SignedOut>
            <SignedIn>
              <Navigate to="/" replace />
            </SignedIn>
          </AuthLayout>
        }
      />

      {/* Tudo protegido vai pelo AppShell. */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppShell>
              <Routes>
                <Route index element={<Dashboard />} />
                <Route path="notes/*" element={<Notes />} />
                <Route path="audio/*" element={<Audio />} />
                <Route path="settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AppShell>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}
