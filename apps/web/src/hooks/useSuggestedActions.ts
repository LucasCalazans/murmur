import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useApi } from '@/lib/api'

export type ActionStatus = 'pending' | 'done' | 'dismissed'

export type SuggestedAction = {
  id: string
  note_id: string
  action_type: string
  title: string
  description: string
  source_text: string
  payload: Record<string, unknown>
  status: ActionStatus
  created_at: string
  updated_at: string
}

export type SuggestedActionList = { items: SuggestedAction[] }

export function useSuggestedActions(noteId: string | undefined) {
  const api = useApi()
  return useQuery({
    queryKey: ['suggested-actions', noteId],
    queryFn: async () => {
      const { data } = await api.get<SuggestedActionList>(
        `/notes/${noteId}/suggested-actions`,
      )
      return data
    },
    enabled: !!noteId,
  })
}

export function useGenerateActions(noteId: string | undefined) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<SuggestedActionList>(
        `/notes/${noteId}/suggest-actions`,
      )
      return data
    },
    onSuccess: (data) => {
      qc.setQueryData(['suggested-actions', noteId], data)
    },
  })
}

export function useUpdateAction(noteId: string | undefined) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: { id: string; status?: ActionStatus; title?: string; description?: string }) => {
      const { data } = await api.patch<SuggestedAction>(
        `/suggested-actions/${id}`,
        payload,
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suggested-actions', noteId] })
    },
  })
}

export function useDeleteAction(noteId: string | undefined) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/suggested-actions/${id}`)
      return id
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suggested-actions', noteId] })
    },
  })
}
