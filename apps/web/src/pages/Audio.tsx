import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import { AudioPlayer } from '@/components/audio/AudioPlayer'
import { AudioRecorder } from '@/components/audio/AudioRecorder'
import { AudioUpload } from '@/components/audio/AudioUpload'
import { TranscriptCard } from '@/components/audio/TranscriptCard'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAudioList, useDeleteAudio, useUploadAudio } from '@/hooks/useAudio'

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function Audio() {
  const list = useAudioList()
  const upload = useUploadAudio()
  const remove = useDeleteAudio()

  async function handleRecorded(blob: Blob, mimeType: string) {
    const ext = mimeType.includes('webm')
      ? 'webm'
      : mimeType.includes('mp4')
      ? 'mp4'
      : mimeType.includes('ogg')
      ? 'ogg'
      : 'audio'
    try {
      await upload.mutateAsync({ blob, filename: `recording.${ext}` })
      toast.success('Áudio gravado e convertido pra WAV')
    } catch (e) {
      toast.error(getErrorMessage(e, 'Falha ao enviar'))
    }
  }

  async function handleUploaded(file: File) {
    try {
      await upload.mutateAsync({ blob: file, filename: file.name })
      toast.success('Áudio enviado e convertido pra WAV')
    } catch (e) {
      toast.error(getErrorMessage(e, 'Falha ao enviar'))
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Deletar este áudio?')) return
    await remove.mutateAsync(id)
    toast.success('Áudio deletado')
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Áudios</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Grave direto ou faça upload — tudo padronizado pra WAV 16kHz mono.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <AudioRecorder onComplete={handleRecorded} disabled={upload.isPending} />
        <AudioUpload onUpload={handleUploaded} disabled={upload.isPending} />
      </div>

      <section className="space-y-2">
        <h2 className="text-sm uppercase tracking-wider text-zinc-500">Seus áudios</h2>
        {list.isLoading && <Skeleton className="h-16 w-full" />}
        {!list.isLoading && (list.data?.items.length ?? 0) === 0 && (
          <p className="text-sm text-zinc-500">Nenhum áudio ainda.</p>
        )}
        <ul className="space-y-3">
          {list.data?.items.map((a) => (
            <li key={a.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs text-zinc-500">
                  <span className="text-zinc-300">{formatDuration(a.duration_seconds)}</span>
                  {' · '}
                  {(a.file_size_bytes / 1024).toFixed(1)} KB
                  {' · '}
                  {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                </div>
                <button
                  onClick={() => handleDelete(a.id)}
                  className="p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-zinc-800"
                  aria-label="Deletar"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <AudioPlayer audioId={a.id} />
              <TranscriptCard audioId={a.id} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function getErrorMessage(e: unknown, fallback: string): string {
  if (typeof e === 'object' && e && 'response' in e) {
    // axios error
    const detail = (e as { response?: { data?: { detail?: { error?: { message?: string } } } } })
      .response?.data?.detail?.error?.message
    if (detail) return detail
  }
  if (e instanceof Error) return e.message
  return fallback
}
