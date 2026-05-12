import { useCallback, useEffect, useRef } from 'react'

interface Snapshot {
  value: string
  selectionStart: number
  selectionEnd: number
}

interface History {
  stack: Snapshot[]
  index: number
  // Timestamp do último push — pra coalescer typing rápido em uma única entrada.
  lastPushAt: number
}

const COALESCE_WINDOW_MS = 600
const MAX_HISTORY = 200

interface Options {
  /**
   * Aplica o snapshot — chamado em undo/redo. Tipicamente:
   * - chama `onChange(snap.value)`
   * - re-define `selectionStart/End` no textarea após o re-render
   */
  apply: (snap: Snapshot) => void
  /**
   * Se o `externalValue` mudar e for diferente do último valor que conhecemos
   * (i.e., hidratou da rede), reseta o histórico com ele como base.
   */
  externalValue: string
}

export interface UndoRedoApi {
  /** Registra uma nova mudança. `coalesce=true` permite agrupar com a anterior (typing). */
  record: (snap: Snapshot, coalesce: boolean) => void
  undo: () => boolean
  redo: () => boolean
  canUndo: () => boolean
  canRedo: () => boolean
}

/**
 * Pilha de histórico de edições.
 *
 * Como a textarea é controlled (React), o undo nativo do browser não funciona —
 * o `value` é sempre sobrescrito pelo state. Mantemos a nossa pilha e
 * interceptamos os atalhos no nível do componente pai.
 */
export function useUndoRedo({ apply, externalValue }: Options): UndoRedoApi {
  const historyRef = useRef<History>({
    stack: [{ value: externalValue, selectionStart: 0, selectionEnd: 0 }],
    index: 0,
    lastPushAt: 0,
  })
  // Último valor que NÓS produzimos — usado pra detectar mudanças externas.
  const lastKnownRef = useRef<string>(externalValue)

  useEffect(() => {
    if (externalValue !== lastKnownRef.current) {
      historyRef.current = {
        stack: [{ value: externalValue, selectionStart: 0, selectionEnd: 0 }],
        index: 0,
        lastPushAt: 0,
      }
      lastKnownRef.current = externalValue
    }
  }, [externalValue])

  const record = useCallback((snap: Snapshot, coalesce: boolean) => {
    const h = historyRef.current
    // Descarta branch de redo se o usuário continuou editando após desfazer.
    h.stack = h.stack.slice(0, h.index + 1)

    const now = performance.now()
    const top = h.stack[h.index]
    const sinceLast = now - h.lastPushAt

    // Heurística de coalescência: digitação contínua (mesmo length±1 e tempo curto) vira uma só entrada.
    const isContinuousTyping =
      coalesce &&
      sinceLast < COALESCE_WINDOW_MS &&
      Math.abs(snap.value.length - top.value.length) <= 1

    if (isContinuousTyping) {
      h.stack[h.index] = snap
    } else {
      h.stack.push(snap)
      h.index = h.stack.length - 1
      if (h.stack.length > MAX_HISTORY) {
        h.stack.splice(0, h.stack.length - MAX_HISTORY)
        h.index = h.stack.length - 1
      }
    }
    h.lastPushAt = now
    lastKnownRef.current = snap.value
  }, [])

  const undo = useCallback(() => {
    const h = historyRef.current
    if (h.index <= 0) return false
    h.index -= 1
    const snap = h.stack[h.index]
    lastKnownRef.current = snap.value
    apply(snap)
    return true
  }, [apply])

  const redo = useCallback(() => {
    const h = historyRef.current
    if (h.index >= h.stack.length - 1) return false
    h.index += 1
    const snap = h.stack[h.index]
    lastKnownRef.current = snap.value
    apply(snap)
    return true
  }, [apply])

  const canUndo = useCallback(() => historyRef.current.index > 0, [])
  const canRedo = useCallback(
    () => historyRef.current.index < historyRef.current.stack.length - 1,
    [],
  )

  return { record, undo, redo, canUndo, canRedo }
}
