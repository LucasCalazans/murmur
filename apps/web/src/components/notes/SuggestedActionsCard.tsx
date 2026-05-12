import { useMemo, useState } from 'react'
import {
  Calendar,
  Check,
  Lightbulb,
  Loader2,
  Phone,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'

import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import {
  useDeleteAction,
  useGenerateActions,
  useSuggestedActions,
  useUpdateAction,
  type ActionStatus,
  type SuggestedAction,
} from '@/hooks/useSuggestedActions'

const TYPE_META: Record<string, { icon: LucideIcon; label: string; tone: string }> = {
  calendar_event: { icon: Calendar, label: 'Evento', tone: 'text-violet-400' },
  reminder: { icon: Calendar, label: 'Lembrete', tone: 'text-amber-400' },
  contact: { icon: Phone, label: 'Contato', tone: 'text-sky-400' },
  research: { icon: Search, label: 'Pesquisar', tone: 'text-emerald-400' },
  tip: { icon: Lightbulb, label: 'Dica', tone: 'text-yellow-400' },
  task: { icon: Sparkles, label: 'Ação', tone: 'text-zinc-300' },
}

function metaFor(type: string) {
  return TYPE_META[type] ?? TYPE_META.task
}

/**
 * Constrói URL pro Google Calendar a partir do payload de calendar_event.
 * Aceita ISO date no `start` ou texto livre (vira só `details`).
 */
function googleCalendarUrl(action: SuggestedAction): string | null {
  if (action.action_type !== 'calendar_event') return null
  const payload = action.payload ?? {}
  const start = typeof payload.start === 'string' ? payload.start : ''
  const end = typeof payload.end === 'string' ? payload.end : ''
  const location = typeof payload.location === 'string' ? payload.location : ''

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: action.title,
    details: action.description || action.source_text,
  })
  if (location) params.set('location', location)

  // Tenta extrair YYYYMMDDTHHMMSS de ISO; se não der, usa só details.
  const toGCalFormat = (s: string) => {
    const d = new Date(s)
    if (Number.isNaN(d.getTime())) return null
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  }
  const gStart = toGCalFormat(start)
  if (gStart) {
    const gEnd = toGCalFormat(end) ?? gStart
    params.set('dates', `${gStart}/${gEnd}`)
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

interface Props {
  noteId: string
}

export function SuggestedActionsCard({ noteId }: Props) {
  const list = useSuggestedActions(noteId)
  const generate = useGenerateActions(noteId)
  const update = useUpdateAction(noteId)
  const remove = useDeleteAction(noteId)
  const [showDismissed, setShowDismissed] = useState(false)

  const items = list.data?.items ?? []
  const filtered = useMemo(
    () => items.filter((a) => (showDismissed ? true : a.status !== 'dismissed')),
    [items, showDismissed],
  )

  async function handleGenerate() {
    try {
      await generate.mutateAsync()
      toast.success('Ações geradas')
    } catch (e) {
      const msg = (e as { response?: { data?: { detail?: { error?: { message?: string } } } } })
        .response?.data?.detail?.error?.message
      toast.error(msg ?? 'Falha ao gerar ações')
    }
  }

  async function setStatus(action: SuggestedAction, status: ActionStatus) {
    await update.mutateAsync({ id: action.id, status })
  }

  async function handleDelete(action: SuggestedAction) {
    if (!confirm(`Deletar a sugestão "${action.title}"?`)) return
    await remove.mutateAsync(action.id)
  }

  return (
    <section className="space-y-3 pt-4 border-t border-zinc-800">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <h2 className="text-sm uppercase tracking-wider text-zinc-500 flex items-center gap-2">
            <Sparkles size={14} className="text-emerald-400" />
            Ações sugeridas
          </h2>
          <p className="text-xs text-zinc-600">
            A IA lê o conteúdo + transcrições prontas e propõe próximos passos.
          </p>
        </div>
        <Button onClick={handleGenerate} disabled={generate.isPending}>
          {generate.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : items.length === 0 ? (
            <Sparkles size={14} />
          ) : (
            <RefreshCw size={14} />
          )}
          {generate.isPending
            ? 'Gerando…'
            : items.length === 0
            ? 'Sugerir Ações'
            : 'Gerar novamente'}
        </Button>
      </div>

      {!list.isLoading && filtered.length === 0 && !generate.isPending && (
        <p className="text-sm text-zinc-500 px-1">
          {items.length === 0
            ? 'Sem sugestões ainda. Clique em "Sugerir Ações" para a IA propor.'
            : 'Nada pendente. Marque exibir dispensadas pra ver as antigas.'}
        </p>
      )}

      <ul className="space-y-2">
        {filtered.map((action) => {
          const { icon: Icon, label, tone } = metaFor(action.action_type)
          const gcalUrl = googleCalendarUrl(action)
          const done = action.status === 'done'
          const dismissed = action.status === 'dismissed'

          return (
            <li
              key={action.id}
              className={cn(
                'rounded-md border border-zinc-800 bg-zinc-900/40 p-3 transition-opacity',
                done && 'opacity-60',
                dismissed && 'opacity-40',
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn('mt-0.5 shrink-0', tone)}>
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={cn('text-[10px] uppercase tracking-wider', tone)}>
                      {label}
                    </span>
                  </div>
                  <h3
                    className={cn(
                      'text-sm font-medium text-zinc-100',
                      done && 'line-through',
                    )}
                  >
                    {action.title}
                  </h3>
                  {action.description && (
                    <p className="text-sm text-zinc-400 leading-snug">
                      {action.description}
                    </p>
                  )}

                  {action.action_type === 'contact' && (
                    <ContactPayload payload={action.payload} />
                  )}
                  {action.action_type === 'research' && (
                    <ResearchPayload payload={action.payload} />
                  )}

                  {action.source_text && (
                    <blockquote className="text-xs text-zinc-500 border-l-2 border-zinc-700 pl-2 italic mt-1.5">
                      "{action.source_text}"
                    </blockquote>
                  )}

                  <div className="flex items-center gap-2 pt-1 text-xs text-zinc-500">
                    <span>
                      {formatDistanceToNow(new Date(action.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                    {gcalUrl && (
                      <>
                        <span>·</span>
                        <a
                          href={gcalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-400 hover:underline"
                        >
                          Adicionar no Google Calendar →
                        </a>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => setStatus(action, done ? 'pending' : 'done')}
                    className={cn(
                      'p-1.5 rounded hover:bg-zinc-800 transition-colors',
                      done
                        ? 'text-emerald-400 hover:text-zinc-400'
                        : 'text-zinc-500 hover:text-emerald-400',
                    )}
                    title={done ? 'Desmarcar (voltar pra pendente)' : 'Marcar como concluída'}
                    aria-label={done ? 'Desmarcar' : 'Marcar como concluída'}
                    aria-pressed={done}
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => setStatus(action, dismissed ? 'pending' : 'dismissed')}
                    className={cn(
                      'p-1.5 rounded hover:bg-zinc-800 transition-colors',
                      dismissed
                        ? 'text-amber-400 hover:text-zinc-400'
                        : 'text-zinc-500 hover:text-amber-400',
                    )}
                    title={dismissed ? 'Restaurar (voltar pra pendente)' : 'Dispensar'}
                    aria-label={dismissed ? 'Restaurar' : 'Dispensar'}
                    aria-pressed={dismissed}
                  >
                    <X size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(action)}
                    className="p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-zinc-800"
                    title="Deletar"
                    aria-label="Deletar"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      {items.some((a) => a.status === 'dismissed') && (
        <button
          onClick={() => setShowDismissed((v) => !v)}
          className="text-xs text-zinc-500 hover:text-zinc-300 underline-offset-2 hover:underline"
        >
          {showDismissed ? 'Esconder dispensadas' : 'Mostrar dispensadas'}
        </button>
      )}
    </section>
  )
}

function ContactPayload({ payload }: { payload: Record<string, unknown> }) {
  const name = typeof payload.name === 'string' ? payload.name : ''
  const phone = typeof payload.phone === 'string' ? payload.phone : ''
  const email = typeof payload.email === 'string' ? payload.email : ''
  const channel = typeof payload.channel === 'string' ? payload.channel : ''
  if (!name && !phone && !email) return null
  return (
    <div className="text-xs text-zinc-300 space-y-0.5 mt-1">
      {name && <div>👤 {name}</div>}
      {phone && (
        <div>
          📱{' '}
          <a href={`tel:${phone}`} className="text-emerald-400 hover:underline">
            {phone}
          </a>
        </div>
      )}
      {email && (
        <div>
          ✉️{' '}
          <a href={`mailto:${email}`} className="text-emerald-400 hover:underline">
            {email}
          </a>
        </div>
      )}
      {channel && <div className="text-zinc-500">via {channel}</div>}
    </div>
  )
}

function ResearchPayload({ payload }: { payload: Record<string, unknown> }) {
  const query = typeof payload.query === 'string' ? payload.query : ''
  if (!query) return null
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`
  return (
    <div className="text-xs mt-1">
      <a
        href={searchUrl}
        target="_blank"
        rel="noreferrer"
        className="text-emerald-400 hover:underline"
      >
        Pesquisar "{query}" →
      </a>
    </div>
  )
}
