import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Loader2 } from 'lucide-react'
import MDEditor from '@uiw/react-md-editor'
import { toast } from 'sonner'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { useDebounce } from '@/hooks/useDebounce'
import { useNote, useUpdateNote } from '@/hooks/useNotes'
import { cn } from '@/lib/utils'

const AUTOSAVE_MS = 800

type Status = 'idle' | 'pending' | 'saved'

export function NoteEditor({ id }: { id: string }) {
  const navigate = useNavigate()
  const { data: note, isLoading } = useNote(id)
  const update = useUpdateNote(id)

  const [title, setTitle] = useState<string>('')
  const [content, setContent] = useState<string>('')
  const [tagsInput, setTagsInput] = useState<string>('')
  const [hydrated, setHydrated] = useState(false)
  const [status, setStatus] = useState<Status>('idle')

  useEffect(() => {
    if (!note || hydrated) return
    setTitle(note.title)
    setContent(note.content)
    setTagsInput(note.tags.join(', '))
    setHydrated(true)
  }, [note, hydrated])

  const debouncedTitle = useDebounce(title, AUTOSAVE_MS)
  const debouncedContent = useDebounce(content, AUTOSAVE_MS)
  const debouncedTags = useDebounce(tagsInput, AUTOSAVE_MS)

  useEffect(() => {
    if (!hydrated || !note) return
    const tags = debouncedTags.split(',').map((t) => t.trim()).filter(Boolean)
    const dirty =
      debouncedTitle !== note.title ||
      debouncedContent !== note.content ||
      tags.join('|') !== note.tags.join('|')
    if (!dirty) return

    setStatus('pending')
    update
      .mutateAsync({ title: debouncedTitle, content: debouncedContent, tags })
      .then(() => setStatus('saved'))
      .catch((e) => {
        setStatus('idle')
        toast.error(e?.response?.data?.detail?.error?.message ?? 'Falha ao salvar')
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedTitle, debouncedContent, debouncedTags, hydrated])

  if (isLoading || !note) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/notes')}>
          <ArrowLeft size={14} /> Notas
        </Button>
        <SaveIndicator status={status} />
      </div>

      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título"
        className="!h-12 !text-lg font-medium border-zinc-900 bg-transparent"
      />

      <Input
        value={tagsInput}
        onChange={(e) => setTagsInput(e.target.value)}
        placeholder="Tags separadas por vírgula (ex.: pessoal, ideias)"
        className="text-xs"
      />

      <div data-color-mode="dark">
        <MDEditor
          value={content}
          onChange={(v) => setContent(v ?? '')}
          height={500}
          preview="live"
          textareaProps={{ placeholder: 'Comece a escrever em markdown…' }}
        />
      </div>
    </div>
  )
}

function SaveIndicator({ status }: { status: Status }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs text-zinc-500',
        status === 'saved' && 'text-emerald-400',
      )}
    >
      {status === 'pending' && (
        <>
          <Loader2 size={12} className="animate-spin" /> salvando…
        </>
      )}
      {status === 'saved' && (
        <>
          <Check size={12} /> salvo
        </>
      )}
      {status === 'idle' && <span className="opacity-0">—</span>}
    </span>
  )
}
