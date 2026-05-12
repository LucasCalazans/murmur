import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useApi } from '@/lib/api'

export type Audio = {
  id: string
  user_id: string
  note_id: string | null
  original_format: string
  mime_type: string
  duration_seconds: number
  file_size_bytes: number
  created_at: string
}

export type AudioList = { items: Audio[]; total: number }

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

export function useAudioList(noteId?: string) {
  const api = useApi()
  return useQuery({
    queryKey: ['audio', { noteId }],
    queryFn: async () => {
      const { data } = await api.get<AudioList>('/audio', {
        params: noteId ? { note_id: noteId } : undefined,
      })
      return data
    },
  })
}

export function useUploadAudio() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ blob, noteId, filename }: { blob: Blob; noteId?: string; filename?: string }) => {
      const form = new FormData()
      form.append('file', blob, filename ?? 'recording.webm')
      if (noteId) form.append('note_id', noteId)
      const { data } = await api.post<Audio>('/audio', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['audio'] }),
  })
}

export function useDeleteAudio() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/audio/${id}`)
      return id
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['audio'] }),
  })
}

/**
 * URL pra `<audio>`. Como o endpoint exige Bearer JWT, o axios não dá pra usar
 * direto na tag. Usamos getToken e construímos a URL com token assinado por sessão.
 * Trade-off: pra MVP, baixamos via fetch+blob URL no consumidor.
 */
export function audioFileUrl(audioId: string) {
  return `${API_URL}/audio/${audioId}/file`
}
