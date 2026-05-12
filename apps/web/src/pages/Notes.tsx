import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Plus, Search, Trash2, Loader2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { NoteEditor } from '@/components/notes/NoteEditor'
import {
  useCreateNote,
  useDeleteNote,
  useNotesList,
  type Note,
} from '@/hooks/useNotes'
import { useDebounce } from '@/hooks/useDebounce'

function NotesListView() {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 300)
  const { data, isLoading } = useNotesList({ q: debouncedQuery || undefined })
  const create = useCreateNote()
  const remove = useDeleteNote()
  const navigate = useNavigate()

  const items = data?.items ?? []

  async function handleNew() {
    const note = await create.mutateAsync({ title: 'Nova nota', content: '', tags: [] })
    navigate(`/notes/${note.id}`)
  }

  async function handleDelete(note: Note, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Deletar "${note.title || 'nota sem título'}"?`)) return
    await remove.mutateAsync(note.id)
    toast.success('Nota deletada')
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Notas</h1>
        <Button onClick={handleNew} disabled={create.isPending}>
          {create.isPending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          Nova nota
        </Button>
      </header>

      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar nas notas…"
          className="pl-9"
        />
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="rounded-lg border border-dashed border-zinc-800 p-12 text-center">
          <p className="text-sm text-zinc-500">
            {debouncedQuery ? 'Nenhuma nota encontrada.' : 'Sem notas ainda. Clique em "Nova nota" pra começar.'}
          </p>
        </div>
      )}

      <ul className="space-y-2">
        {items.map((note) => (
          <li key={note.id}>
            <Link
              to={`/notes/${note.id}`}
              className="group flex items-start justify-between gap-4 rounded-md border border-zinc-800 bg-zinc-900/40 p-4 hover:border-zinc-700 hover:bg-zinc-900/70 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-zinc-100 truncate">
                  {note.title || 'Sem título'}
                </h3>
                <p className="text-sm text-zinc-500 line-clamp-2 mt-1">
                  {note.content || 'Sem conteúdo'}
                </p>
                <div className="flex items-center gap-3 mt-2 text-xs text-zinc-600">
                  <span>
                    {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true, locale: ptBR })}
                  </span>
                  {note.tags.length > 0 && (
                    <span className="flex gap-1">
                      {note.tags.map((t) => (
                        <span
                          key={t}
                          className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300"
                        >
                          {t}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={(e) => handleDelete(note, e)}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-opacity"
                aria-label="Deletar"
              >
                <Trash2 size={14} />
              </button>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function NoteDetailView() {
  const { id } = useParams<{ id: string }>()
  const total = useNotesList()
  const safeId = useMemo(() => id, [id])
  if (!safeId || total.isLoading) {
    return (
      <div className="p-6">
        <Skeleton className="h-10 w-1/3" />
      </div>
    )
  }
  return <NoteEditor id={safeId} />
}

export function Notes() {
  return (
    <Routes>
      <Route index element={<NotesListView />} />
      <Route path=":id" element={<NoteDetailView />} />
    </Routes>
  )
}

// Import inline para evitar import circular com App.tsx
import { Route, Routes } from 'react-router-dom'
