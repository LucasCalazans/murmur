import { useUser } from '@clerk/clerk-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'

export function Settings() {
  const { user } = useUser()
  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Conta</CardTitle>
          <CardDescription>Gerenciada pela Clerk — clique no avatar pra editar.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-zinc-300 space-y-1">
          <div>nome: <span className="text-zinc-100">{user?.fullName ?? '—'}</span></div>
          <div>email: <span className="text-zinc-100">{user?.primaryEmailAddress?.emailAddress ?? '—'}</span></div>
        </CardContent>
      </Card>
    </div>
  )
}
