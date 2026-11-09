import { useEffect, useRef, useState } from 'react'

const MAX_AMPLITUDE = 1.6
const AMPLITUDE_TICKS = [0, 0.5, 1, 1.5]
const HARMONIC_TICK_STEPS = [1, 2, 5, 10, 20]
const MIN_TICK_SPACING = 32
const MAX_BAR_WIDTH = 56
const MARGIN = { left: 48, right: 18, top: 8, bottom: 42 }
const TEXT_COLOR = 'var(--lab-text)'
const GRID_COLOR = 'var(--lab-grid)'
const AXIS_COLOR = 'var(--fourier-spectrum-axis)'
const BAR_COLOR = 'var(--fourier-bar)'

type FourierSpectrumProps = {
  amplitudes: number[]
  maxHarmonic: number
}

// Drawn in real pixels instead of a scaled viewBox so axis text stays readable at any width.
function FourierSpectrum({ amplitudes, maxHarmonic }: FourierSpectrumProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState({ width: 700, height: 280 })

  useEffect(() => {
    if (!svgRef.current) return
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(svgRef.current)
    return () => observer.disconnect()
  }, [])

  const plotWidth = Math.max(size.width - MARGIN.left - MARGIN.right, 1)
  const plotHeight = Math.max(size.height - MARGIN.top - MARGIN.bottom, 1)
  const bottom = MARGIN.top + plotHeight
  const xFor = (harmonic: number) => MARGIN.left + (harmonic / (maxHarmonic + 1)) * plotWidth
  const yFor = (amplitude: number) => bottom - (Math.min(amplitude, MAX_AMPLITUDE) / MAX_AMPLITUDE) * plotHeight
  const harmonicWidth = plotWidth / (maxHarmonic + 1)
  const barWidth = Math.min(MAX_BAR_WIDTH, Math.max(2, harmonicWidth * 0.8))
  const tickStep = HARMONIC_TICK_STEPS.find((step) => step * harmonicWidth >= MIN_TICK_SPACING) ?? 20
  const harmonicTicks = Array.from({ length: Math.floor(maxHarmonic / tickStep) + 1 }, (_, i) => i * tickStep)

  return (
    <svg ref={svgRef} className="fourier-spectrum" role="img" aria-label="各諧波振幅頻譜">
      {harmonicTicks.map((tick) => (
        <g key={tick}>
          <line x1={xFor(tick)} x2={xFor(tick)} y1={MARGIN.top} y2={bottom} stroke={tick === 0 ? AXIS_COLOR : GRID_COLOR} />
          <text x={xFor(tick)} y={bottom + 16} textAnchor="middle" fontSize="12" fill={TEXT_COLOR}>{tick}</text>
        </g>
      ))}
      {AMPLITUDE_TICKS.map((tick) => (
        <g key={tick}>
          <line x1={MARGIN.left} x2={MARGIN.left + plotWidth} y1={yFor(tick)} y2={yFor(tick)} stroke={tick === 0 ? AXIS_COLOR : GRID_COLOR} />
          <text x={MARGIN.left - 6} y={yFor(tick) + 4} textAnchor="end" fontSize="12" fill={TEXT_COLOR}>{tick}</text>
        </g>
      ))}
      {amplitudes.map((amplitude, index) => amplitude > 0 && (
        <rect key={index} x={xFor(index + 1) - barWidth / 2} y={yFor(amplitude)} width={barWidth} height={bottom - yFor(amplitude)} fill={BAR_COLOR}>
          <title>{`第 ${index + 1} 諧波：${amplitude.toFixed(3)}`}</title>
        </rect>
      ))}
      <text x={MARGIN.left + plotWidth / 2} y={size.height - 6} textAnchor="middle" fontSize="12" fill={TEXT_COLOR}>第 <tspan fontFamily="KaTeX_Math" fontStyle="italic" fontSize="14">n</tspan> 諧波</text>
      <text transform={`translate(14 ${MARGIN.top + plotHeight / 2}) rotate(-90)`} textAnchor="middle" fontSize="12" fill={TEXT_COLOR}>振幅</text>
    </svg>
  )
}

export default FourierSpectrum
