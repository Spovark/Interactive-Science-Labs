import { useEffect, useRef, useState } from 'react'

const MAX_AMPLITUDE = 1.6
const AMPLITUDE_TICKS = [0, 0.5, 1, 1.5]
const HARMONIC_TICK_STEPS = [1, 2, 5, 10, 20]
// Frequency labels such as 100000 are wider than harmonic numbers, so they may need sparser ticks.
const FREQUENCY_TICK_STEPS = [1, 2, 5, 10, 20, 25, 50, 100]
const MIN_TICK_SPACING = 32
const MIN_FREQUENCY_TICK_SPACING = 48
const FREQUENCY_DIGIT_WIDTH = 7
const FREQUENCY_LABEL_GAP = 10
const MAX_BAR_WIDTH = 56
const MARGIN = { left: 48, right: 18, top: 8, bottom: 42 }
const FREQUENCY_ROW_HEIGHT = 16
const TEXT_COLOR = 'var(--lab-text)'
const MUTED_COLOR = 'var(--lab-muted)'
const GRID_COLOR = 'var(--lab-grid)'
const AXIS_COLOR = 'var(--fourier-spectrum-axis)'
const BAR_COLOR = 'var(--fourier-bar)'

type FourierSpectrumProps = {
  amplitudes: number[]
  maxHarmonic: number
  // In Hz. When given, each tick also shows its frequency.
  fundamental?: number | null
}

// Drawn in real pixels instead of a scaled viewBox so axis text stays readable at any width.
function FourierSpectrum({ amplitudes, maxHarmonic, fundamental = null }: FourierSpectrumProps) {
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

  const showFrequency = fundamental !== null
  const marginBottom = MARGIN.bottom + (showFrequency ? FREQUENCY_ROW_HEIGHT : 0)
  const plotWidth = Math.max(size.width - MARGIN.left - MARGIN.right, 1)
  const plotHeight = Math.max(size.height - MARGIN.top - marginBottom, 1)
  const bottom = MARGIN.top + plotHeight
  const xFor = (harmonic: number) => MARGIN.left + (harmonic / (maxHarmonic + 1)) * plotWidth
  const yFor = (amplitude: number) => bottom - (Math.min(amplitude, MAX_AMPLITUDE) / MAX_AMPLITUDE) * plotHeight
  const harmonicWidth = plotWidth / (maxHarmonic + 1)
  const barWidth = Math.min(MAX_BAR_WIDTH, Math.max(2, harmonicWidth * 0.8))
  const longestFrequencyLabel = showFrequency ? String(maxHarmonic * fundamental).length * FREQUENCY_DIGIT_WIDTH : 0
  const minTickSpacing = showFrequency ? Math.max(MIN_FREQUENCY_TICK_SPACING, longestFrequencyLabel + FREQUENCY_LABEL_GAP) : MIN_TICK_SPACING
  const tickSteps = showFrequency ? FREQUENCY_TICK_STEPS : HARMONIC_TICK_STEPS
  const tickStep = tickSteps.find((step) => step * harmonicWidth >= minTickSpacing) ?? tickSteps[tickSteps.length - 1]
  const harmonicTicks = Array.from({ length: Math.floor(maxHarmonic / tickStep) + 1 }, (_, i) => i * tickStep)

  return (
    <svg ref={svgRef} className="fourier-spectrum" role="img" aria-label="各諧波振幅頻譜">
      {harmonicTicks.map((tick) => (
        <g key={tick}>
          <line x1={xFor(tick)} x2={xFor(tick)} y1={MARGIN.top} y2={bottom} stroke={tick === 0 ? AXIS_COLOR : GRID_COLOR} />
          <text x={xFor(tick)} y={bottom + 16} textAnchor="middle" fontSize="12" fill={TEXT_COLOR}>{tick}</text>
          {/* A label that would stick out past the right edge is right-aligned to it instead. */}
          {showFrequency && (xFor(tick) + longestFrequencyLabel / 2 > size.width
            ? <text x={size.width - 2} y={bottom + 16 + FREQUENCY_ROW_HEIGHT} textAnchor="end" fontSize="11" fill={MUTED_COLOR}>{tick * fundamental}</text>
            : <text x={xFor(tick)} y={bottom + 16 + FREQUENCY_ROW_HEIGHT} textAnchor="middle" fontSize="11" fill={MUTED_COLOR}>{tick * fundamental}</text>)}
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
          <title>{`第 ${index + 1} 諧波${showFrequency ? `（${(index + 1) * fundamental} Hz）` : ''}：${amplitude.toFixed(3)}`}</title>
        </rect>
      ))}
      <text x={MARGIN.left + plotWidth / 2} y={size.height - 6} textAnchor="middle" fontSize="12" fill={TEXT_COLOR}>第 <tspan fontFamily="KaTeX_Math" fontStyle="italic" fontSize="14">n</tspan> 諧波</text>
      {showFrequency && <text x={MARGIN.left - 14} y={bottom + 16 + FREQUENCY_ROW_HEIGHT} textAnchor="end" fontSize="11" fill={MUTED_COLOR}>Hz</text>}
      <text transform={`translate(14 ${MARGIN.top + plotHeight / 2}) rotate(-90)`} textAnchor="middle" fontSize="12" fill={TEXT_COLOR}>振幅</text>
    </svg>
  )
}

export default FourierSpectrum
