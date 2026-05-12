import { useEffect, useRef, useState } from 'react'
import { Mic, Square, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface Props {
  onComplete: (blob: Blob, mimeType: string, durationMs: number) => void | Promise<void>
  disabled?: boolean
}

/**
 * Gravador via MediaRecorder + waveform em canvas em tempo real.
 *
 * Quando o usuário clica em "parar", chama `onComplete` com o blob.
 * O formato será o que o browser oferecer (Chrome: webm/opus, Safari: mp4/aac);
 * a conversão pra WAV acontece no backend.
 */
export function AudioRecorder({ onComplete, disabled }: Props) {
  const [recording, setRecording] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const startTimeRef = useRef<number>(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const tickRef = useRef<number | null>(null)

  useEffect(() => () => stop(true), [])

  async function start() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Pick best supported mime — let the browser decide if nothing matches.
      const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ]
      const mimeType = candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? ''
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = handleStop
      recorder.start(250)
      mediaRecorderRef.current = recorder

      // Analyzer pra waveform.
      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      source.connect(analyser)
      analyserRef.current = analyser

      startTimeRef.current = performance.now()
      setRecording(true)
      setElapsedMs(0)
      drawWaveform()
      tickRef.current = window.setInterval(() => {
        setElapsedMs(performance.now() - startTimeRef.current)
      }, 100)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao acessar microfone'
      setError(msg)
    }
  }

  function stop(silent = false) {
    const r = mediaRecorderRef.current
    if (r && r.state !== 'inactive') {
      r.stop()
    } else if (silent) {
      // Cleanup direto se não tava gravando.
      cleanup()
    }
  }

  function cleanup() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (animationRef.current) cancelAnimationFrame(animationRef.current)
    animationRef.current = null
    if (tickRef.current) clearInterval(tickRef.current)
    tickRef.current = null
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    analyserRef.current = null
    mediaRecorderRef.current = null
    setRecording(false)
  }

  async function handleStop() {
    const recorder = mediaRecorderRef.current
    const duration = performance.now() - startTimeRef.current
    const mimeType = recorder?.mimeType || 'audio/webm'
    const blob = new Blob(chunksRef.current, { type: mimeType })
    chunksRef.current = []
    cleanup()
    if (blob.size === 0) return
    setSubmitting(true)
    try {
      await onComplete(blob, mimeType, duration)
    } finally {
      setSubmitting(false)
      setElapsedMs(0)
    }
  }

  function drawWaveform() {
    const canvas = canvasRef.current
    const analyser = analyserRef.current
    if (!canvas || !analyser) return
    const ctx = canvas.getContext('2d')!
    const bufferLength = analyser.fftSize
    const data = new Uint8Array(bufferLength)
    const dpr = window.devicePixelRatio || 1

    const render = () => {
      animationRef.current = requestAnimationFrame(render)
      const w = canvas.clientWidth * dpr
      const h = canvas.clientHeight * dpr
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }

      analyser.getByteTimeDomainData(data)
      ctx.fillStyle = '#09090b'
      ctx.fillRect(0, 0, w, h)
      ctx.lineWidth = 2 * dpr
      ctx.strokeStyle = '#10b981'
      ctx.beginPath()
      const slice = w / bufferLength
      let x = 0
      for (let i = 0; i < bufferLength; i++) {
        const v = data[i] / 128
        const y = (v * h) / 2
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
        x += slice
      }
      ctx.stroke()
    }
    render()
  }

  const seconds = Math.floor(elapsedMs / 1000)
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {recording ? (
            <Button variant="danger" size="sm" onClick={() => stop()} disabled={submitting}>
              <Square size={14} fill="currentColor" /> Parar
            </Button>
          ) : (
            <Button size="sm" onClick={start} disabled={disabled || submitting}>
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Mic size={14} />}
              {submitting ? 'Enviando…' : 'Gravar'}
            </Button>
          )}
          {recording && (
            <span className="flex items-center gap-2 text-sm">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span className="font-mono text-zinc-200">
                {mm}:{ss}
              </span>
            </span>
          )}
        </div>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
      <canvas
        ref={canvasRef}
        className={cn(
          'w-full h-20 rounded-md bg-zinc-950 border border-zinc-800',
          !recording && 'opacity-30',
        )}
      />
    </div>
  )
}
