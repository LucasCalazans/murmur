import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children?: ReactNode
  className?: string
}

export function Dialog({ open, onClose, title, description, children, className }: Props) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal
        className={cn(
          'relative w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-950 shadow-2xl',
          className,
        )}
      >
        {(title || description) && (
          <div className="flex items-start justify-between p-4 border-b border-zinc-800">
            <div>
              {title && <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>}
              {description && <p className="mt-1 text-xs text-zinc-500">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800"
              aria-label="Fechar"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}
