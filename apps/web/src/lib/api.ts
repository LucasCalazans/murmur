import axios, { type AxiosInstance } from 'axios'
import { useAuth } from '@clerk/clerk-react'
import { useMemo } from 'react'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

/**
 * Hook que devolve uma instância de axios com o JWT atual da Clerk
 * anexado automaticamente em cada request via interceptor.
 *
 * Recria o cliente quando `getToken` muda — i.e., entre signed-in / signed-out.
 */
export function useApi(): AxiosInstance {
  const { getToken } = useAuth()

  return useMemo(() => {
    const client = axios.create({ baseURL: API_URL })
    client.interceptors.request.use(async (config) => {
      const token = await getToken()
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
      return config
    })
    return client
  }, [getToken])
}
