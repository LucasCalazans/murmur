import { useCallback, useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'
import { BubbleToolbar } from './BubbleToolbar'
import { EditorToolbar, type ToolbarCommand } from './EditorToolbar'
import { MarkdownPreview } from './MarkdownPreview'
import {
  applyEdit,
  bold,
  bulletList,
  codeBlock,
  heading,
  image,
  inlineCode,
  italic,
  link,
  orderedList,
  quote,
  strikethrough,
  type EditState,
} from './markdown-commands'

interface Props {
  value: string
  onChange: (next: string) => void
  placeholder?: string
}

/**
 * Editor markdown moderno:
 *  - Painel esquerdo é uma textarea que ocupa 100% da área — clique em qualquer
 *    lugar foca o cursor.
 *  - Painel direito mostra preview ao vivo (react-markdown + GFM).
 *  - Toolbar minimalista no topo com comandos estruturais.
 *  - BubbleToolbar aparece sobre a seleção quando o usuário marca texto.
 *  - Atalhos: ⌘B, ⌘I, ⌘K.
 */
export function MarkdownEditor({ value, onChange, placeholder }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [textarea, setTextarea] = useState<HTMLTextAreaElement | null>(null)

  // Mantém um ref nativo + state — state força re-render do BubbleToolbar quando o ref muda.
  useEffect(() => {
    setTextarea(textareaRef.current)
  }, [])

  const runCommand = useCallback(
    (cmd: ToolbarCommand) => {
      const ta = textareaRef.current
      if (!ta) return

      const state: EditState = {
        value: ta.value,
        selectionStart: ta.selectionStart,
        selectionEnd: ta.selectionEnd,
      }

      const handlers: Record<ToolbarCommand, (s: EditState) => ReturnType<typeof bold>> = {
        bold,
        italic,
        strike: strikethrough,
        code: inlineCode,
        codeBlock,
        h1: heading(1),
        h2: heading(2),
        bulletList,
        orderedList,
        quote,
        link: (s) => link(s),
        image: (s) => image(s),
      }
      const result = handlers[cmd](state)
      onChange(result.value)
      // Aguarda re-render pra setar a seleção certinha no DOM.
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          applyEdit(textareaRef.current, result)
        }
      })
    },
    [onChange],
  )

  // Atalhos de teclado.
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const meta = e.metaKey || e.ctrlKey
    if (!meta) return
    const map: Record<string, ToolbarCommand> = {
      b: 'bold',
      i: 'italic',
      k: 'link',
    }
    const cmd = map[e.key.toLowerCase()]
    if (cmd) {
      e.preventDefault()
      runCommand(cmd)
    }
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 overflow-hidden flex flex-col">
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-zinc-800 bg-zinc-900/40">
        <EditorToolbar onCommand={runCommand} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 min-h-[400px]">
        {/* Painel de edição — clicar em QUALQUER lugar foca o textarea. */}
        <label
          htmlFor="markdown-textarea"
          className="relative flex border-r border-zinc-800 bg-zinc-950 cursor-text"
        >
          <textarea
            id="markdown-textarea"
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder ?? 'Comece a escrever em markdown…'}
            spellCheck={false}
            className={cn(
              'w-full min-h-[400px] resize-none bg-transparent text-sm text-zinc-100',
              'px-4 py-3 leading-relaxed font-mono',
              'placeholder:text-zinc-600',
              'focus:outline-none',
            )}
          />
        </label>

        {/* Preview */}
        <div className="px-5 py-4 overflow-auto bg-zinc-950">
          <MarkdownPreview content={value} />
        </div>
      </div>

      <BubbleToolbar textarea={textarea} onCommand={runCommand} />
    </div>
  )
}
