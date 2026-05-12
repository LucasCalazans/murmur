import { useEffect, useRef, useState } from 'react'
import { Loader2, Mic, RefreshCw, AlertTriangle, Check } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { useAudioTranscript, useStartTranscription, useUpdateTranscript } from '@/hooks/useTranscript'
import { useDebounce } from '@/hooks/useDebounce'
import { cn } from '@/lib/utils'

const AUTOSAVE_MS = 1000

/**
 * Card que mostra estado da transcrição de um áudio:
 * - sem transcript → botão "Transcrever"
 * - pending/running → spinner + polling automático
 * - done → textarea editável com autosave
 * - failed → erro + botão "Tentar novamente"
 */
export function TranscriptCard({ audioId }: { audioId: string }) {
  const transcript = useAudioTranscript(audioId)
  const start = useStartTranscription()
  const update = useUpdateTranscript()

  const [text, setText] = useState<string>('')
  const [hydratedFor, setHydratedFor] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'pending' | 'saved'>('idle')
  const lastSyncedRef = useRef<string>('')

  // Sincroniza texto local quando carrega ou status muda pra done.
  useEffect(() => {
    if (!transcript.data) return
    if (transcript.data.status !== 'done') return
    if (hydratedFor === transcript.data.id) return
    setText(transcript.data.text)
    lastSyncedRef.current = transcript.data.text
    setHydratedFor(transcript.data.id)
  }, [transcript.data, hydratedFor])

  const debouncedText = useDebounce(text, AUTOSAVE_MS)

  useEffect(() => {
    if (!transcript.data || transcript.data.status !== 'done') return
    if (debouncedText === lastSyncedRef.current) return

    setSaveStatus('pending')
    update
      .mutateAsync({ id: transcript.data.id, text: debouncedText })
      .then(() => {
        lastSyncedRef.current = debouncedText
        setSaveStatus('saved')
      })
      .catch((e) => {
        setSaveStatus('idle')
        toast.error(e?.response?.data?.detail?.error?.message ?? 'Falha ao salvar transcrição')
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedText])

  async function handleStart() {
    try {
      await start.mutateAsync(audioId)
    } catch (e) {
      const msg = (e as { response?: { data?: { detail?: { error?: { message?: string } } } } })
        .response?.data?.detail?.error?.message
      toast.error(msg ?? 'Falha ao iniciar transcrição')
    }
  }

  const t = transcript.data

  // 1. Sem transcript ainda.
  if (!t) {
    return (
      <div className="text-xs text-zinc-500 flex items-center justify-between gap-3 px-1">
        <span>Sem transcrição.</span>
        <Button size="sm" variant="ghost" onClick={handleStart} disabled={start.isPending}>
          {start.isPending ? <Loader2 size={12} className="animate-spin" /> : <Mic size={12} />}
          Transcrever
        </Button>
      </div>
    )
  }

  // 2. Pending ou running.
  if (t.status === 'pending' || t.status === 'running') {
    return (
      <div className="text-xs text-zinc-400 flex items-center gap-2 px-1">
        <Loader2 size={12} className="animate-spin text-emerald-400" />
        <span>
          {t.status === 'pending' ? 'na fila…' : 'transcrevendo…'}
        </span>
      </div>
    )
  }

  // 3. Failed.
  if (t.status === 'failed') {
    return (
      <div className="text-xs space-y-2 px-1">
        <div className="flex items-center gap-2 text-red-400">
          <AlertTriangle size={12} />
          <span>Falhou: {t.error_message || 'erro desconhecido'}</span>
        </div>
        <Button size="sm" variant="ghost" onClick={handleStart} disabled={start.isPending}>
          <RefreshCw size={12} /> Tentar de novo
        </Button>
      </div>
    )
  }

  // 4. Done — editor inline.
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[10px] text-zinc-500">
        <span>
          {t.language ? `idioma: ${t.language} · ` : ''}
          modelo: {t.model_size}
          {' · '}
          {t.segments?.length ?? 0} segmentos
        </span>
        <SaveIndicator status={saveStatus} />
      </div>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="min-h-[120px] text-sm"
        placeholder="Transcrição vazia"
      />
    </div>
  )
}

function SaveIndicator({ status }: { status: 'idle' | 'pending' | 'saved' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1',
        status === 'saved' && 'text-emerald-400',
      )}
    >
      {status === 'pending' && (
        <>
          <Loader2 size={10} className="animate-spin" /> salvando…
        </>
      )}
      {status === 'saved' && (
        <>
          <Check size={10} /> salvo
        </>
      )}
    </span>
  )
}
