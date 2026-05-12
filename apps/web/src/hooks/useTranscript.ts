import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useApi } from '@/lib/api'

export type TranscriptStatus = 'pending' | 'running' | 'done' | 'failed'

export type Transcript = {
  id: string
  audio_id: string
  status: TranscriptStatus
  text: string
  segments: Array<{ id: number; start: number; end: number; text: string }> | null
  language: string
  model_size: string
  error_message: string
  created_at: string
  started_at: string | null
  completed_at: string | null
}

export function useAudioTranscript(audioId: string | undefined) {
  const api = useApi()
  return useQuery({
    queryKey: ['transcript', { audioId }],
    queryFn: async () => {
      const { data } = await api.get<Transcript | null>(`/audio/${audioId}/transcript`)
      return data
    },
    enabled: !!audioId,
    // Poll a cada 2s enquanto pending/running.
    refetchInterval: (q) => {
      const t = q.state.data
      if (t && (t.status === 'pending' || t.status === 'running')) return 2000
      return false
    },
  })
}

export function useStartTranscription() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (audioId: string) => {
      const { data } = await api.post<Transcript>(`/audio/${audioId}/transcribe`)
      return data
    },
    onSuccess: (data) => {
      qc.setQueryData(['transcript', { audioId: data.audio_id }], data)
    },
  })
}

export function useUpdateTranscript() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) => {
      const { data } = await api.patch<Transcript>(`/transcripts/${id}`, { text })
      return data
    },
    onSuccess: (data) => {
      qc.setQueryData(['transcript', { audioId: data.audio_id }], data)
    },
  })
}
