import {
  Bold,
  Code2,
  Heading1,
  Heading2,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
  TerminalSquare,
} from 'lucide-react'

import { cn } from '@/lib/utils'

export type ToolbarCommand =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'code'
  | 'codeBlock'
  | 'h1'
  | 'h2'
  | 'bulletList'
  | 'orderedList'
  | 'quote'
  | 'link'
  | 'image'

interface Props {
  onCommand: (cmd: ToolbarCommand) => void
  className?: string
}

interface Entry {
  cmd: ToolbarCommand
  icon: typeof Bold
  label: string
  shortcut?: string
}

const STRUCTURE: Entry[] = [
  { cmd: 'h1', icon: Heading1, label: 'Título 1' },
  { cmd: 'h2', icon: Heading2, label: 'Título 2' },
  { cmd: 'bulletList', icon: List, label: 'Lista' },
  { cmd: 'orderedList', icon: ListOrdered, label: 'Lista ordenada' },
  { cmd: 'quote', icon: Quote, label: 'Citação' },
  { cmd: 'codeBlock', icon: TerminalSquare, label: 'Bloco de código' },
]

const INLINE: Entry[] = [
  { cmd: 'bold', icon: Bold, label: 'Negrito', shortcut: '⌘B' },
  { cmd: 'italic', icon: Italic, label: 'Itálico', shortcut: '⌘I' },
  { cmd: 'strike', icon: Strikethrough, label: 'Tachado' },
  { cmd: 'code', icon: Code2, label: 'Código inline' },
]

const REFS: Entry[] = [
  { cmd: 'link', icon: Link2, label: 'Link', shortcut: '⌘K' },
  { cmd: 'image', icon: ImageIcon, label: 'Imagem' },
]

function Group({ entries, onCommand }: { entries: Entry[]; onCommand: Props['onCommand'] }) {
  return (
    <div className="flex items-center gap-0.5">
      {entries.map(({ cmd, icon: Icon, label, shortcut }) => (
        <button
          key={cmd}
          type="button"
          onClick={() => onCommand(cmd)}
          title={shortcut ? `${label} (${shortcut})` : label}
          aria-label={label}
          className={cn(
            'h-8 w-8 rounded-md flex items-center justify-center text-zinc-400',
            'hover:bg-zinc-800 hover:text-zinc-100 transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60',
          )}
        >
          <Icon size={15} strokeWidth={1.75} />
        </button>
      ))}
    </div>
  )
}

function Divider() {
  return <div className="h-5 w-px bg-zinc-800" />
}

export function EditorToolbar({ onCommand, className }: Props) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 rounded-lg',
        'bg-zinc-900/60 border border-zinc-800 backdrop-blur-sm',
        className,
      )}
    >
      <Group entries={STRUCTURE} onCommand={onCommand} />
      <Divider />
      <Group entries={INLINE} onCommand={onCommand} />
      <Divider />
      <Group entries={REFS} onCommand={onCommand} />
    </div>
  )
}
