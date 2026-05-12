/**
 * Comportamento de listas no editor markdown.
 *
 * - Enter no fim de um item de lista → cria próximo item com mesmo prefixo
 *   (incremento automático em listas ordenadas).
 * - Enter num item vazio → remove o prefixo (sai da lista).
 * - Tab num item de lista → indenta 2 espaços.
 * - Shift+Tab num item de lista → desindenta 2 espaços.
 *
 * Funções retornam `null` quando o cursor não está numa lista — aí o handler
 * deixa o comportamento padrão da textarea fluir.
 */
import type { EditResult, EditState } from './markdown-commands'

const INDENT_UNIT = '  ' // 2 espaços por nível

// Captura: indent, marker, número (se ordenada), checkbox de task list, resto.
const LIST_RE =
  /^(?<indent>[ \t]*)(?<marker>(?<bullet>[-*+])|(?<num>\d+)\.)\s(?<task>\[[ xX]\]\s)?(?<rest>.*)$/

interface ListContext {
  indent: string
  marker: string       // ex.: "-", "*", "1."
  isOrdered: boolean
  num?: number         // só pra ordered
  task?: string        // "[ ] " ou "[x] " ou undefined
  rest: string
  /** Length do prefixo completo (indent + marker + " " + task). */
  prefixLength: number
}

function getCurrentLine(value: string, caret: number): { start: number; end: number; text: string } {
  const start = value.lastIndexOf('\n', caret - 1) + 1
  const endIdx = value.indexOf('\n', caret)
  const end = endIdx === -1 ? value.length : endIdx
  return { start, end, text: value.slice(start, end) }
}

function parseListLine(line: string): ListContext | null {
  const match = LIST_RE.exec(line)
  if (!match || !match.groups) return null
  const { indent, marker, num, task, rest } = match.groups
  const prefixLength = indent.length + marker.length + 1 + (task ? task.length : 0)
  return {
    indent,
    marker,
    isOrdered: num !== undefined,
    num: num !== undefined ? parseInt(num, 10) : undefined,
    task,
    rest,
    prefixLength,
  }
}

/**
 * Tenta tratar Enter dentro de uma lista. Retorna `null` se não estava em lista
 * (handler deve deixar o Enter padrão acontecer).
 */
export function handleListEnter(state: EditState): EditResult | null {
  const { value, selectionStart, selectionEnd } = state
  // Só age quando não há seleção (cursor único).
  if (selectionStart !== selectionEnd) return null

  const line = getCurrentLine(value, selectionStart)
  const ctx = parseListLine(line.text)
  if (!ctx) return null

  // Item vazio → sai da lista (remove o prefixo, deixa só o indent se houver).
  if (ctx.rest.trim() === '' && (!ctx.task || ctx.task === ctx.task)) {
    // Substitui a linha inteira pelo indent vazio.
    const before = value.slice(0, line.start)
    const after = value.slice(line.end)
    const newValue = before + after
    const cursor = before.length
    return { value: newValue, selectionStart: cursor, selectionEnd: cursor }
  }

  // Item com conteúdo → insere quebra + novo prefixo.
  const nextMarker = ctx.isOrdered ? `${(ctx.num ?? 0) + 1}.` : ctx.marker
  // Em task lists, próximo item começa desmarcado.
  const nextTask = ctx.task ? '[ ] ' : ''
  const insert = `\n${ctx.indent}${nextMarker} ${nextTask}`

  const newValue =
    value.slice(0, selectionStart) + insert + value.slice(selectionStart)
  const cursor = selectionStart + insert.length
  return { value: newValue, selectionStart: cursor, selectionEnd: cursor }
}

/**
 * Tab dentro de lista: indenta 2 espaços. Sem seleção ou multi-linha — opera
 * em todas as linhas que tocam a seleção.
 *
 * Retorna `null` se nenhuma das linhas tocadas é uma lista (deixa Tab padrão).
 */
export function handleListTab(state: EditState, shift: boolean): EditResult | null {
  const { value, selectionStart, selectionEnd } = state

  const firstLineStart = value.lastIndexOf('\n', selectionStart - 1) + 1
  const lastLineEndIdx = value.indexOf('\n', selectionEnd)
  const lastLineEnd = lastLineEndIdx === -1 ? value.length : lastLineEndIdx
  const block = value.slice(firstLineStart, lastLineEnd)
  const lines = block.split('\n')

  // Pelo menos uma linha precisa ser de lista — senão deixa Tab padrão.
  if (!lines.some((l) => parseListLine(l) !== null)) return null

  let totalDelta = 0
  const newLines = lines.map((line) => {
    const ctx = parseListLine(line)
    if (!ctx) {
      // Linha não-lista no meio do bloco — ainda indenta/desindenta.
      if (shift) {
        const trimmed = line.replace(/^ {1,2}/, '')
        totalDelta += trimmed.length - line.length
        return trimmed
      }
      totalDelta += INDENT_UNIT.length
      return INDENT_UNIT + line
    }
    if (shift) {
      const stripped = ctx.indent.replace(/ {1,2}$/, '')
      const newLine = stripped + line.slice(ctx.indent.length)
      totalDelta += newLine.length - line.length
      return newLine
    }
    const newLine = INDENT_UNIT + line
    totalDelta += INDENT_UNIT.length
    return newLine
  })

  const newBlock = newLines.join('\n')
  const newValue =
    value.slice(0, firstLineStart) + newBlock + value.slice(lastLineEnd)

  // Move o caret/seleção pra refletir o shift de offsets.
  let newStart = selectionStart
  let newEnd = selectionEnd
  if (shift) {
    // Desindentação pode encolher o offset da seleção também (até onde for indent).
    const firstLineDeltaMatch = INDENT_UNIT
    const firstLineOriginal = lines[0]
    const firstLineNew = newLines[0]
    const firstLineDelta = firstLineNew.length - firstLineOriginal.length
    newStart = Math.max(firstLineStart, selectionStart + firstLineDelta)
    newEnd = selectionEnd + totalDelta
    if (newEnd < newStart) newEnd = newStart
    void firstLineDeltaMatch
  } else {
    newStart = selectionStart + INDENT_UNIT.length
    newEnd = selectionEnd + totalDelta
  }
  return { value: newValue, selectionStart: newStart, selectionEnd: newEnd }
}
