import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'

const MAX_FRAME_SECONDS = 0.05

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// `onFrame` keeps the loop going by returning true.
function runFrames(onFrame: (seconds: number) => boolean) {
  let previous: number | null = null
  let frame = requestAnimationFrame(function tick(now) {
    const seconds = previous === null ? 0 : Math.min(MAX_FRAME_SECONDS, (now - previous) / 1000)
    previous = now
    if (onFrame(seconds)) frame = requestAnimationFrame(tick)
  })
  return () => cancelAnimationFrame(frame)
}

export function useElementWidth<T extends Element>(initialWidth: number) {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(initialWidth)

  useEffect(() => {
    if (!ref.current) return
    const observer = new ResizeObserver(([entry]) => {
      // Hidden tabs report zero; keep the last real width for them.
      if (entry.contentRect.width > 0) setWidth(entry.contentRect.width)
    })
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return [ref, width] as const
}

export function useTimeline(length: number, active: boolean) {
  const [position, setPosition] = useState(0)
  const [playing, setPlaying] = useState(() => !prefersReducedMotion())
  const positionRef = useRef(0)

  const seek = useCallback((next: number) => {
    positionRef.current = next
    setPosition(next)
  }, [])

  useEffect(() => {
    if (!playing || !active) return
    return runFrames((seconds) => {
      const next = Math.min(length, positionRef.current + seconds)
      positionRef.current = next
      setPosition(next)
      if (next < length) return true
      setPlaying(false)
      return false
    })
  }, [active, length, playing])

  const pause = useCallback(() => setPlaying(false), [])

  const rewind = useCallback(() => {
    seek(0)
    setPlaying(false)
  }, [seek])

  const replay = useCallback(() => {
    seek(0)
    setPlaying(true)
  }, [seek])

  const toggle = useCallback(() => {
    if (playing) {
      setPlaying(false)
      return
    }
    if (positionRef.current >= length) seek(0)
    setPlaying(true)
  }, [length, playing, seek])

  return { position, playing, seek, pause, rewind, replay, toggle }
}

export function useWrappingPosition(start: number, speed: number, span: number, running: boolean) {
  const [position, setPosition] = useState(start)
  const positionRef = useRef(start)

  useEffect(() => {
    if (!running || speed === 0) return
    return runFrames((seconds) => {
      positionRef.current = (((positionRef.current + speed * seconds) % span) + span) % span
      setPosition(positionRef.current)
      return true
    })
  }, [running, span, speed])

  return position
}

// Reports the pointer's x position in SVG pixels for as long as it is held down.
export function horizontalDrag(onDrag: (x: number) => void) {
  const report = (event: PointerEvent<SVGElement>) => {
    const svg = event.currentTarget.ownerSVGElement
    if (svg) onDrag(event.clientX - svg.getBoundingClientRect().left)
  }
  return {
    onPointerDown: (event: PointerEvent<SVGElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId)
      report(event)
    },
    onPointerMove: (event: PointerEvent<SVGElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) report(event)
    },
  }
}
