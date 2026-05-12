import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { cn } from '@/lib/utils'

/**
 * Preview de markdown estilizado pra Murmur (dark, próximo de docs).
 *
 * Usa GFM (tabelas, strikethrough, task lists, autolinks).
 */
export function MarkdownPreview({ content, className }: { content: string; className?: string }) {
  return (
    <div
      className={cn(
        'prose prose-invert prose-zinc max-w-none',
        'prose-headings:tracking-tight prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg',
        'prose-headings:font-semibold prose-h1:mt-0 prose-h2:mt-6 prose-h3:mt-4',
        'prose-p:text-zinc-300 prose-p:leading-relaxed',
        'prose-strong:text-zinc-100 prose-em:text-zinc-200',
        'prose-a:text-emerald-400 prose-a:no-underline hover:prose-a:underline',
        'prose-code:text-emerald-300 prose-code:bg-zinc-900 prose-code:px-1 prose-code:py-0.5 prose-code:rounded',
        'prose-code:before:content-none prose-code:after:content-none',
        'prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-zinc-800',
        'prose-blockquote:border-l-emerald-500 prose-blockquote:text-zinc-400 prose-blockquote:not-italic',
        'prose-li:text-zinc-300 prose-ul:my-2 prose-ol:my-2',
        'prose-hr:border-zinc-800',
        'prose-table:text-sm prose-th:text-zinc-200 prose-td:text-zinc-300',
        'prose-img:rounded-md prose-img:border prose-img:border-zinc-800',
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content || '*Sem conteúdo ainda.*'}
      </ReactMarkdown>
    </div>
  )
}
