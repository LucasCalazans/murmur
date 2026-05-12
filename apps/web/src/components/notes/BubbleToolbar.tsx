import { useEffect, useRef, useState } from 'react'
import { Bold, Code2, Italic, Link2, Strikethrough } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { ToolbarCommand } from './EditorToolbar'

interface Props {
  textarea: HTMLTextAreaElement | null
  onCommand: (cmd: ToolbarCommand) => void
}

interface Entry {
  cmd: ToolbarCommand
  icon: typeof Bold
  label: string
}

const ENTRIES: Entry[] = [
  { cmd: 'bold', icon: Bold, label: 'Negrito' },
  { cmd: 'italic', icon: Italic, label: 'Itálico' },
  { cmd: 'strike', icon: Strikethrough, label: 'Tachado' },
  { cmd: 'code', icon: Code2, label: 'Código' },
  { cmd: 'link', icon: Link2, label: 'Link' },
]

interface Position {
  top: number
  left: number
}

/**
 * Calcula a posição visual da seleção dentro do <textarea> espelhando o conteúdo
 * num <div> invisível com os mesmos estilos e medindo a posição do "ponto da seleção".
 *
 * É a técnica clássica do "textarea-caret-position": a única forma sem editor
 * customizado de saber em que x/y o caret/seleção está.
 */
function getSelectionRect(textarea: HTMLTextAreaElement): DOMRect | null {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  if (start === end) return null

  const computed = window.getComputedStyle(textarea)
  const mirror = document.createElement('div')
  // Copia propriedades relevantes pra renderizar idêntico ao textarea.
  const props = [
    'boxSizing', 'width', 'height', 'overflowX', 'overflowY',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'borderStyle',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize', 'fontSizeAdjust',
    'lineHeight', 'fontFamily',
    'textAlign', 'textTransform', 'textIndent', 'textDecoration',
    'letterSpacing', 'wordSpacing', 'tabSize',
    'whiteSpace', 'wordWrap', 'wordBreak',
  ]
  for (const p of props) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(mirror.style as any)[p] = (computed as any)[p]
  }
  mirror.style.position = 'absolute'
  mirror.style.visibility = 'hidden'
  mirror.style.whiteSpace = 'pre-wrap'
  mirror.style.wordWrap = 'break-word'
  mirror.style.top = '0'
  mirror.style.left = '-9999px'

  const text = textarea.value.substring(0, start)
  mirror.textContent = text

  const span = document.createElement('span')
  span.textContent = textarea.value.substring(start, end) || '.'
  mirror.appendChild(span)

  document.body.appendChild(mirror)
  const rect = span.getBoundingClientRect()
  const taRect = textarea.getBoundingClientRect()
  document.body.removeChild(mirror)

  // Ajusta pra coordenada absoluta na página, considerando o scroll do textarea.
  return new DOMRect(
    taRect.left + rect.left - mirror.scrollLeft,
    taRect.top + rect.top - textarea.scrollTop,
    rect.width,
    rect.height,
  )
}

export function BubbleToolbar({ textarea, onCommand }: Props) {
  const [pos, setPos] = useState<Position | null>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const mouseDownRef = useRef(false)

  useEffect(() => {
    if (!textarea) {
      setPos(null)
      return
    }

    function check() {
      if (!textarea) return setPos(null)
      // Não atualiza enquanto o usuário está arrastando — evita o bubble pular.
      if (mouseDownRef.current) return
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      if (start === end) {
        setPos(null)
        return
      }
      // Foco deve estar no textarea ou no bubble.
      const active = document.activeElement
      if (active !== textarea && !bubbleRef.current?.contains(active)) {
        setPos(null)
        return
      }
      const rect = getSelectionRect(textarea)
      if (!rect) {
        setPos(null)
        return
      }
      setPos({
        top: rect.top + window.scrollY - 44,
        left: rect.left + rect.width / 2 + window.scrollX,
      })
    }

    function handleMouseDown() {
      mouseDownRef.current = true
    }
    function handleMouseUp() {
      mouseDownRef.current = false
      // Pequeno delay pra browser atualizar selectionStart/End.
      setTimeout(check, 0)
    }
    function handleSelectionChange() {
      if (document.activeElement === textarea) check()
    }
    function handleBlur(e: FocusEvent) {
      // Só esconde se o foco saiu pro fora do bubble.
      const target = e.relatedTarget as Node | null
      if (target && bubbleRef.current?.contains(target)) return
      setPos(null)
    }
    function handleScroll() {
      check()
    }

    textarea.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('selectionchange', handleSelectionChange)
    textarea.addEventListener('blur', handleBlur)
    textarea.addEventListener('keyup', check)
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', check)

    return () => {
      textarea.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('selectionchange', handleSelectionChange)
      textarea.removeEventListener('blur', handleBlur)
      textarea.removeEventListener('keyup', check)
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', check)
    }
  }, [textarea])

  if (!pos) return null

  return (
    <div
      ref={bubbleRef}
      role="toolbar"
      // Previne perda de foco do textarea ao clicar nos botões.
      onMouseDown={(e) => e.preventDefault()}
      className={cn(
        'fixed z-50 -translate-x-1/2',
        'flex items-center gap-0.5 px-1 py-1 rounded-lg',
        'bg-zinc-950/95 border border-zinc-700 shadow-xl backdrop-blur',
        'murmur-bubble-in',
      )}
      style={{ top: pos.top, left: pos.left }}
    >
      {ENTRIES.map(({ cmd, icon: Icon, label }) => (
        <button
          key={cmd}
          type="button"
          onClick={() => onCommand(cmd)}
          title={label}
          aria-label={label}
          className="h-7 w-7 rounded-md flex items-center justify-center text-zinc-300 hover:bg-zinc-800 hover:text-emerald-400 transition-colors"
        >
          <Icon size={14} strokeWidth={1.75} />
        </button>
      ))}
    </div>
  )
}
