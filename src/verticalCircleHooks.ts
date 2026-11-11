import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { prefersReducedMotion } from './momentumHooks'

const MAX_FRAME_SECONDS = 0.05

// Plays `length` seconds of motion at `rate` times real speed; periodic motion keeps looping.
export function usePlayback(length: number, looping: boolean, rate: number, active: boolean) {
  const [position, setPosition] = useState(0)
  const [playing, setPlaying] = useState(() => !prefersReducedMotion())
  const positionRef = useRef(0)

  const seek = useCallback((next: number) => {
    positionRef.current = next
    setPosition(next)
  }, [])

  useEffect(() => {
    if (!playing || !active || length <= 0) return
    let previous: number | null = null
    let frame = requestAnimationFrame(function tick(now) {
      const seconds = previous === null ? 0 : Math.min(MAX_FRAME_SECONDS, (now - previous) / 1000)
      previous = now
      let next = positionRef.current + seconds * rate
      if (next >= length) {
        if (!looping) {
          positionRef.current = length
          setPosition(length)
          setPlaying(false)
          return
        }
        next %= length
      }
      positionRef.current = next
      setPosition(next)
      frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [active, length, looping, playing, rate])

  const pause = useCallback(() => setPlaying(false), [])

  const rewind = useCallback(() => {
    seek(0)
    setPlaying(false)
  }, [seek])

  const toggle = useCallback(() => {
    if (playing) {
      setPlaying(false)
      return
    }
    if (positionRef.current >= length) seek(0)
    setPlaying(true)
  }, [length, playing, seek])

  return { position, playing, seek, pause, rewind, toggle }
}

// Reports the pointer position in SVG pixels for as long as it is held down.
export function pointerDrag(onDrag: (x: number, y: number) => void) {
  const report = (event: PointerEvent<SVGElement>) => {
    const svg = event.currentTarget.ownerSVGElement
    if (!svg) return
    const box = svg.getBoundingClientRect()
    onDrag(event.clientX - box.left, event.clientY - box.top)
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
