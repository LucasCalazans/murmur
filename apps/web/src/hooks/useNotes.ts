import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useApi } from '@/lib/api'

export type Note = {
  id: string
  owner_id: string
  title: string
  content: string
  tags: string[]
  created_at: string
  updated_at: string
}

export type NoteList = { items: Note[]; total: number }

interface ListParams {
  q?: string
  tag?: string
  sort?: 'updated_at' | 'created_at' | 'title'
  order?: 'asc' | 'desc'
}

export function useNotesList(params: ListParams = {}) {
  const api = useApi()
  return useQuery({
    queryKey: ['notes', params],
    queryFn: async () => {
      const { data } = await api.get<NoteList>('/notes', { params })
      return data
    },
  })
}

export function useNote(id: string | undefined) {
  const api = useApi()
  return useQuery({
    queryKey: ['note', id],
    queryFn: async () => {
      const { data } = await api.get<Note>(`/notes/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateNote() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<Pick<Note, 'title' | 'content' | 'tags'>>) => {
      const { data } = await api.post<Note>('/notes', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  })
}

export function useUpdateNote(id: string | undefined) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<Pick<Note, 'title' | 'content' | 'tags'>>) => {
      const { data } = await api.patch<Note>(`/notes/${id}`, payload)
      return data
    },
    onSuccess: (data) => {
      qc.setQueryData(['note', id], data)
      qc.invalidateQueries({ queryKey: ['notes'] })
    },
  })
}

export function useDeleteNote() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/notes/${id}`)
      return id
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  })
}
