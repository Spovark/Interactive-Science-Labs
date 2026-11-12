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

export function useElementSize<T extends Element>(initialWidth: number) {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ width: initialWidth, height: 0 })

  useEffect(() => {
    if (!ref.current) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      // Hidden tabs report zero; keep the last real size for them.
      if (width > 0) setSize({ width, height })
    })
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return [ref, size.width, size.height] as const
}

export function useElementWidth<T extends Element>(initialWidth: number) {
  const [ref, width] = useElementSize<T>(initialWidth)
  return [ref, width] as const
}

type PlaybackOptions = {
  // Starts again from the beginning instead of stopping at the end.
  looping?: boolean
  // Seconds of timeline per second of real time.
  rate?: number
}

// A timeline of `length` seconds that plays while `active`, starting on its own unless motion is reduced.
export function usePlayback(length: number, active: boolean, { looping = false, rate = 1 }: PlaybackOptions = {}) {
  const [position, setPosition] = useState(0)
  const [playing, setPlaying] = useState(() => !prefersReducedMotion())
  const positionRef = useRef(0)

  const seek = useCallback((next: number) => {
    positionRef.current = next
    setPosition(next)
  }, [])

  useEffect(() => {
    if (!playing || !active || length <= 0) return
    return runFrames((seconds) => {
      let next = positionRef.current + seconds * rate
      if (next >= length) {
        if (!looping) {
          positionRef.current = length
          setPosition(length)
          setPlaying(false)
          return false
        }
        next %= length
      }
      positionRef.current = next
      setPosition(next)
      return true
    })
  }, [active, length, looping, playing, rate])

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

function svgPoint(event: PointerEvent<SVGElement>) {
  const svg = event.currentTarget.ownerSVGElement
  if (!svg) return null
  const box = svg.getBoundingClientRect()
  return { x: event.clientX - box.left, y: event.clientY - box.top }
}

// Reports the pointer position in SVG pixels for as long as it is held down.
export function pointerDrag(onDrag: (x: number, y: number) => void) {
  const report = (event: PointerEvent<SVGElement>) => {
    const point = svgPoint(event)
    if (point) onDrag(point.x, point.y)
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

// Reports only the pointer's x position in SVG pixels.
export function horizontalDrag(onDrag: (x: number) => void) {
  return pointerDrag((x) => onDrag(x))
}
