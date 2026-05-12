import { useRef, useState } from 'react'
import { Upload, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface Props {
  onUpload: (file: File) => void | Promise<void>
  disabled?: boolean
  accept?: string
}

const DEFAULT_ACCEPT = 'audio/*,.wav,.mp3,.m4a,.webm,.ogg,.flac,.mp4'

export function AudioUpload({ onUpload, disabled, accept = DEFAULT_ACCEPT }: Props) {
  const [dragging, setDragging] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setSubmitting(true)
    try {
      await onUpload(files[0])
    } finally {
      setSubmitting(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        handleFiles(e.dataTransfer.files)
      }}
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors',
        dragging
          ? 'border-emerald-500 bg-emerald-500/5'
          : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-700',
        (disabled || submitting) && 'opacity-50 pointer-events-none',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={disabled || submitting}
      />
      {submitting ? (
        <Loader2 size={20} className="text-zinc-400 animate-spin" />
      ) : (
        <Upload size={20} className="text-zinc-400" />
      )}
      <p className="text-sm text-zinc-400">
        {submitting ? 'Enviando…' : 'Solte aqui ou clique para enviar áudio'}
      </p>
      <p className="text-xs text-zinc-600">WAV, MP3, M4A, WebM, OGG, FLAC, MP4</p>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={(e) => {
          e.preventDefault()
          inputRef.current?.click()
        }}
        disabled={disabled || submitting}
      >
        Escolher arquivo
      </Button>
    </label>
  )
}
