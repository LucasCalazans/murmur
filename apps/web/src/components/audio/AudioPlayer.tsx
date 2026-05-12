import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'

import { Skeleton } from '@/components/ui/Skeleton'
import { audioFileUrl } from '@/hooks/useAudio'

/**
 * `<audio src=...>` não dá pra enviar `Authorization: Bearer` direto.
 * Estratégia: fetch com Bearer, monta blob URL e plugamos no `<audio>`.
 */
export function AudioPlayer({ audioId }: { audioId: string }) {
  const { getToken } = useAuth()
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let createdUrl: string | null = null

    async function load() {
      try {
        const token = await getToken()
        const response = await fetch(audioFileUrl(audioId), {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const blob = await response.blob()
        createdUrl = URL.createObjectURL(blob)
        if (!cancelled) setSrc(createdUrl)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Falha ao carregar áudio')
      }
    }
    load()
    return () => {
      cancelled = true
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [audioId, getToken])

  if (error) return <p className="text-xs text-red-400">erro: {error}</p>
  if (!src) return <Skeleton className="h-10 w-full" />
  return (
    <audio
      controls
      src={src}
      className="w-full h-10 [&::-webkit-media-controls-panel]:bg-zinc-900"
    />
  )
}
