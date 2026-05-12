import { useEffect, useState } from 'react'
import axios from 'axios'
import { SignedIn, SignedOut, SignIn, SignUp, UserButton } from '@clerk/clerk-react'
import { Route, Routes, Navigate } from 'react-router-dom'

import { useApi } from './lib/api'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

type Health = { status: string; service?: string; env?: string }
type Me = {
  id: string
  clerk_user_id: string
  email: string
  role: 'owner' | 'editor' | 'viewer'
  created_at: string
  updated_at: string
}

function HealthCard() {
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    axios
      .get<Health>(`${API_URL}/health`)
      .then((r) => setHealth(r.data))
      .catch((e) => setError(e?.message ?? 'erro ao chamar /health'))
  }, [])

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <h2 className="text-sm uppercase tracking-wider text-zinc-500 mb-2">status da api</h2>
      {health && (
        <pre className="text-sm text-emerald-400">{JSON.stringify(health, null, 2)}</pre>
      )}
      {error && <p className="text-sm text-red-400">erro: {error}</p>}
      {!health && !error && <p className="text-sm text-zinc-500">conectando…</p>}
    </section>
  )
}

function MeCard() {
  const api = useApi()
  const [me, setMe] = useState<Me | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<Me>('/auth/me')
      .then((r) => setMe(r.data))
      .catch((e) => {
        const detail = e?.response?.data?.detail?.error?.message
        setError(detail ?? e?.message ?? 'erro ao chamar /auth/me')
      })
  }, [api])

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <h2 className="text-sm uppercase tracking-wider text-zinc-500 mb-2">seu usuário</h2>
      {me && <pre className="text-sm text-emerald-400">{JSON.stringify(me, null, 2)}</pre>}
      {error && <p className="text-sm text-red-400">erro: {error}</p>}
      {!me && !error && <p className="text-sm text-zinc-500">carregando…</p>}
    </section>
  )
}

function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-xl w-full space-y-6">
        <header className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-4xl font-semibold tracking-tight">Murmur</h1>
            <p className="text-zinc-400">
              Notas pessoais com gravação de áudio, transcrição local e análise via IA.
            </p>
          </div>
          <SignedIn>
            <UserButton />
          </SignedIn>
        </header>

        <HealthCard />

        <SignedIn>
          <MeCard />
        </SignedIn>

        <SignedOut>
          <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
            <p className="text-sm text-zinc-400">
              Você não está logado. Vá pra <a className="text-emerald-400 underline" href="/sign-in">/sign-in</a>.
            </p>
          </section>
        </SignedOut>

        <footer className="text-xs text-zinc-600">fase 1 — auth via clerk.</footer>
      </div>
    </main>
  )
}

function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-md">{children}</div>
    </main>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
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
    </Routes>
  )
}
