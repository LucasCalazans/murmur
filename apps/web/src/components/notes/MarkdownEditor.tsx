import { useCallback, useEffect, useRef, useState } from 'react'

import { useUndoRedo } from '@/hooks/useUndoRedo'
import { cn } from '@/lib/utils'
import { BubbleToolbar } from './BubbleToolbar'
import { EditorToolbar, type ToolbarCommand } from './EditorToolbar'
import { handleListEnter, handleListTab } from './list-behavior'
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
  type EditResult,
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
 *  - Atalhos: ⌘B, ⌘I, ⌘K. Undo/Redo: ⌘Z, ⌘⇧Z, ⌘Y (history próprio).
 */
export function MarkdownEditor({ value, onChange, placeholder }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [textarea, setTextarea] = useState<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    setTextarea(textareaRef.current)
  }, [])

  const applySnapshot = useCallback(
    (snap: { value: string; selectionStart: number; selectionEnd: number }) => {
      onChange(snap.value)
      requestAnimationFrame(() => {
        const ta = textareaRef.current
        if (!ta) return
        ta.focus()
        ta.setSelectionRange(snap.selectionStart, snap.selectionEnd)
      })
    },
    [onChange],
  )

  const history = useUndoRedo({ apply: applySnapshot, externalValue: value })

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value
    onChange(next)
    history.record(
      {
        value: next,
        selectionStart: e.target.selectionStart,
        selectionEnd: e.target.selectionEnd,
      },
      // Permite coalescer digitação contínua em um único undo step.
      true,
    )
  }

  function commitProgrammaticEdit(result: EditResult) {
    onChange(result.value)
    requestAnimationFrame(() => {
      const ta = textareaRef.current
      if (ta) applyEdit(ta, result)
    })
    history.record(result, false)
  }

  const runCommand = useCallback(
    (cmd: ToolbarCommand) => {
      const ta = textareaRef.current
      if (!ta) return

      const state: EditState = {
        value: ta.value,
        selectionStart: ta.selectionStart,
        selectionEnd: ta.selectionEnd,
      }

      const handlers: Record<ToolbarCommand, (s: EditState) => EditResult> = {
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
      commitProgrammaticEdit(result)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onChange],
  )

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const ta = textareaRef.current
    if (!ta) return

    // Comportamento de lista — Enter continua o item, item vazio sai da lista.
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const state: EditState = {
        value: ta.value,
        selectionStart: ta.selectionStart,
        selectionEnd: ta.selectionEnd,
      }
      const result = handleListEnter(state)
      if (result) {
        e.preventDefault()
        commitProgrammaticEdit(result)
        return
      }
    }

    // Tab / Shift+Tab — aninha/desaninha item da lista.
    if (e.key === 'Tab' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const state: EditState = {
        value: ta.value,
        selectionStart: ta.selectionStart,
        selectionEnd: ta.selectionEnd,
      }
      const result = handleListTab(state, e.shiftKey)
      if (result) {
        e.preventDefault()
        commitProgrammaticEdit(result)
        return
      }
    }

    const meta = e.metaKey || e.ctrlKey
    if (!meta) return
    const key = e.key.toLowerCase()

    // Undo: ⌘Z (mas NÃO ⌘⇧Z)
    if (key === 'z' && !e.shiftKey) {
      e.preventDefault()
      history.undo()
      return
    }
    // Redo: ⌘⇧Z ou ⌘Y
    if ((key === 'z' && e.shiftKey) || key === 'y') {
      e.preventDefault()
      history.redo()
      return
    }

    const map: Record<string, ToolbarCommand> = {
      b: 'bold',
      i: 'italic',
      k: 'link',
    }
    const cmd = map[key]
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
        <label
          htmlFor="markdown-textarea"
          className="relative flex border-r border-zinc-800 bg-zinc-950 cursor-text"
        >
          <textarea
            id="markdown-textarea"
            ref={textareaRef}
            value={value}
            onChange={handleTextareaChange}
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

        <div className="px-5 py-4 overflow-auto bg-zinc-950">
          <MarkdownPreview content={value} />
        </div>
      </div>

      <BubbleToolbar textarea={textarea} onCommand={runCommand} />
    </div>
  )
}
