import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          'w-full rounded-md bg-zinc-900 px-3 py-2 text-sm text-zinc-100',
          'border border-zinc-800 placeholder:text-zinc-500',
          'focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-zinc-700',
          'resize-vertical min-h-[80px]',
          className,
        )}
        {...props}
      />
    )
  },
)
