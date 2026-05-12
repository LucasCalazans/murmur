import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'h-10 w-full rounded-md bg-zinc-900 px-3 text-sm text-zinc-100',
          'border border-zinc-800 placeholder:text-zinc-500',
          'focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-zinc-700',
          'disabled:opacity-50',
          className,
        )}
        {...props}
      />
    )
  },
)
