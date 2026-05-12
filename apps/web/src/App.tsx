import { useEffect, useState } from 'react'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

type Health = { status: string; service?: string; env?: string }

export default function App() {
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    axios
      .get<Health>(`${API_URL}/health`)
      .then((r) => setHealth(r.data))
      .catch((e) => setError(e?.message ?? 'erro ao chamar /health'))
  }, [])

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-xl w-full space-y-6">
        <header className="space-y-2">
          <h1 className="text-4xl font-semibold tracking-tight">Murmur</h1>
          <p className="text-zinc-400">
            Notas pessoais com gravação de áudio, transcrição local e análise via IA.
          </p>
        </header>

        <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="text-sm uppercase tracking-wider text-zinc-500 mb-2">
            status da api
          </h2>
          {health && (
            <pre className="text-sm text-emerald-400">{JSON.stringify(health, null, 2)}</pre>
          )}
          {error && <p className="text-sm text-red-400">erro: {error}</p>}
          {!health && !error && <p className="text-sm text-zinc-500">conectando…</p>}
        </section>

        <footer className="text-xs text-zinc-600">
          fase 0 — bootstrap. próxima parada: auth (fase 1).
        </footer>
      </div>
    </main>
  )
}
