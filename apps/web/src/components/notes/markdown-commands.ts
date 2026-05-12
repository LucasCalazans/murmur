/**
 * Comandos de manipulação de markdown sobre um <textarea>.
 *
 * Cada comando recebe `selectionStart/End` + `value`, retorna o novo `value` e
 * a nova posição/seleção que o cursor deve ficar.
 */

export interface EditState {
  value: string
  selectionStart: number
  selectionEnd: number
}

export interface EditResult {
  value: string
  selectionStart: number
  selectionEnd: number
}

function wrapInline(state: EditState, marker: string): EditResult {
  const { value, selectionStart, selectionEnd } = state
  const before = value.slice(0, selectionStart)
  const selected = value.slice(selectionStart, selectionEnd)
  const after = value.slice(selectionEnd)

  // Toggle: se já está envolvido por marker, remove.
  if (
    before.endsWith(marker) &&
    after.startsWith(marker) &&
    selected.length > 0
  ) {
    const newBefore = before.slice(0, -marker.length)
    const newAfter = after.slice(marker.length)
    return {
      value: newBefore + selected + newAfter,
      selectionStart: newBefore.length,
      selectionEnd: newBefore.length + selected.length,
    }
  }

  const inserted = selected || ''
  const newValue = `${before}${marker}${inserted}${marker}${after}`
  if (!inserted) {
    // Sem seleção: cursor fica entre os markers.
    const cursor = before.length + marker.length
    return { value: newValue, selectionStart: cursor, selectionEnd: cursor }
  }
  return {
    value: newValue,
    selectionStart: before.length + marker.length,
    selectionEnd: before.length + marker.length + inserted.length,
  }
}

function prefixLines(state: EditState, prefix: string, smartList = false): EditResult {
  const { value, selectionStart, selectionEnd } = state
  const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1
  const lineEndIdx = value.indexOf('\n', selectionEnd)
  const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx
  const before = value.slice(0, lineStart)
  const block = value.slice(lineStart, lineEnd)
  const after = value.slice(lineEnd)

  const lines = block.split('\n')
  let counter = 1
  const newLines = lines.map((line) => {
    const p = smartList ? `${counter++}. ` : prefix
    // Remove se já tem o mesmo prefixo (toggle simples).
    if (line.startsWith(p) || (smartList && /^\d+\.\s/.test(line))) {
      return line.replace(/^(#+\s|>\s|-\s|\*\s|\d+\.\s)/, '')
    }
    return p + line
  })
  // Re-numerar lista ordenada após toggles.
  if (smartList) {
    counter = 1
    for (let i = 0; i < newLines.length; i++) {
      if (/^\d+\.\s/.test(newLines[i])) {
        newLines[i] = newLines[i].replace(/^\d+\./, `${counter++}.`)
      }
    }
  }
  const newBlock = newLines.join('\n')
  const newValue = before + newBlock + after
  return {
    value: newValue,
    selectionStart: lineStart,
    selectionEnd: lineStart + newBlock.length,
  }
}

export const bold = (s: EditState) => wrapInline(s, '**')
export const italic = (s: EditState) => wrapInline(s, '*')
export const strikethrough = (s: EditState) => wrapInline(s, '~~')
export const inlineCode = (s: EditState) => wrapInline(s, '`')

export function heading(level: 1 | 2 | 3) {
  const marker = '#'.repeat(level) + ' '
  return (s: EditState) => prefixLines(s, marker)
}

export const bulletList = (s: EditState) => prefixLines(s, '- ')
export const orderedList = (s: EditState) => prefixLines(s, '', true)
export const quote = (s: EditState) => prefixLines(s, '> ')

export function link(s: EditState, url = 'https://'): EditResult {
  const { value, selectionStart, selectionEnd } = s
  const selected = value.slice(selectionStart, selectionEnd) || 'texto'
  const inserted = `[${selected}](${url})`
  const newValue = value.slice(0, selectionStart) + inserted + value.slice(selectionEnd)
  // Seleciona o URL pra usuário sobrescrever rapidinho.
  const urlStart = selectionStart + selected.length + 3
  const urlEnd = urlStart + url.length
  return { value: newValue, selectionStart: urlStart, selectionEnd: urlEnd }
}

export function image(s: EditState, url = 'https://'): EditResult {
  const { value, selectionStart, selectionEnd } = s
  const alt = value.slice(selectionStart, selectionEnd) || 'imagem'
  const inserted = `![${alt}](${url})`
  const newValue = value.slice(0, selectionStart) + inserted + value.slice(selectionEnd)
  const urlStart = selectionStart + alt.length + 4
  return { value: newValue, selectionStart: urlStart, selectionEnd: urlStart + url.length }
}

export function codeBlock(s: EditState): EditResult {
  const { value, selectionStart, selectionEnd } = s
  const selected = value.slice(selectionStart, selectionEnd)
  const wrap = `\`\`\`\n${selected}\n\`\`\``
  const newValue = value.slice(0, selectionStart) + wrap + value.slice(selectionEnd)
  const inner = selectionStart + 4
  return { value: newValue, selectionStart: inner, selectionEnd: inner + selected.length }
}

export function applyEdit(
  textarea: HTMLTextAreaElement,
  edit: EditResult,
): void {
  // Define `selectionStart` antes de mudar o valor pra que o browser preserve foco.
  textarea.value = edit.value
  textarea.focus()
  textarea.setSelectionRange(edit.selectionStart, edit.selectionEnd)
}
