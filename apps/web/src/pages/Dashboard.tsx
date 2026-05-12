import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { FileText, Mic } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useApi } from '@/lib/api'
import { useNotesList } from '@/hooks/useNotes'

type Me = {
  id: string
  email: string
  role: 'owner' | 'editor' | 'viewer'
}

export function Dashboard() {
  const { user } = useUser()
  const api = useApi()
  const [me, setMe] = useState<Me | null>(null)
  const notes = useNotesList({ sort: 'updated_at', order: 'desc' })

  useEffect(() => {
    api.get<Me>('/auth/me').then((r) => setMe(r.data)).catch(() => setMe(null))
  }, [api])

  const recent = notes.data?.items.slice(0, 5) ?? []

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Bem-vindo, {user?.firstName ?? me?.email ?? 'você'}
        </h1>
        <p className="text-sm text-zinc-500">
          Capture ideias, grave murmúrios, organize.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/notes"
          className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5 hover:bg-zinc-900/70 hover:border-zinc-700 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-zinc-100 flex items-center gap-2">
                <FileText size={16} className="text-emerald-400" /> Notas
              </h3>
              <p className="text-xs text-zinc-500 mt-1">
                {notes.data?.total ?? 0} no total
              </p>
            </div>
          </div>
        </Link>

        <Link
          to="/audio"
          className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5 hover:bg-zinc-900/70 hover:border-zinc-700 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-zinc-100 flex items-center gap-2">
                <Mic size={16} className="text-emerald-400" /> Áudios
              </h3>
              <p className="text-xs text-zinc-500 mt-1">Em construção</p>
            </div>
          </div>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Notas recentes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {recent.length === 0 && (
            <p className="text-sm text-zinc-500">Nenhuma nota ainda.</p>
          )}
          {recent.map((note) => (
            <Link
              key={note.id}
              to={`/notes/${note.id}`}
              className="block px-3 py-2 -mx-3 rounded text-sm text-zinc-300 hover:bg-zinc-800/50"
            >
              {note.title || 'Sem título'}
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
