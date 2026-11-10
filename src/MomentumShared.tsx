import { useId, useMemo, type ReactNode } from 'react'
import MathText from './MathText'
import { clamp, formatTick, formatValue, linearScale, niceTicks, tracePath } from './momentumChartUtils'
import { horizontalDrag, useElementWidth } from './momentumHooks'

export type MomentumHelpTopic = 'momentumSpeed' | 'energySpeed' | 'impulse' | 'work' | 'track' | 'collisionMomentum' | 'collisionEnergy'
export type OpenHelp = (topic: MomentumHelpTopic) => void
export type ChartMargin = { left: number; right: number; top: number; bottom: number }

export const COLOR_A = 'var(--momentum-a)'
export const COLOR_B = 'var(--momentum-b)'
export const COLOR_TOTAL = 'var(--momentum-total)'
export const COLOR_SPRING = 'var(--momentum-spring)'
export const COLOR_HEAT = 'var(--momentum-heat)'

const WHEEL_RADIUS = 8
const BODY_HEIGHT = 22
const BLOCK_HEIGHT = 11
const BLOCK_GAP = 2
const BLOCKS_PER_ROW = 3
const WIDE_CART_LABEL_WIDTH = 72

export const CART_HEIGHT = WHEEL_RADIUS * 2 + BODY_HEIGHT + 2 * (BLOCK_HEIGHT + BLOCK_GAP)
export const CART_BODY_CENTER = WHEEL_RADIUS * 2 + BODY_HEIGHT / 2

export function Sym({ children }: { children: string }) {
  return <tspan fontFamily="KaTeX_Math" fontStyle="italic" fontSize="13">{children}</tspan>
}

type LabSliderProps = {
  label: ReactNode
  value: number
  min: number
  max: number
  step: number
  unit?: string
  digits?: number
  onChange: (value: number) => void
}

export function LabSlider({ label, value, min, max, step, unit, digits = 1, onChange }: LabSliderProps) {
  const id = useId()
  return (
    <div className="lab-control">
      <div className="lab-control-head">
        <label htmlFor={id}>{label}</label>
        <span className="momentum-slider-value">{formatValue(value, digits)}{unit ? ` ${unit}` : ''}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  )
}

type ChartHeadingProps = {
  title: string
  help?: MomentumHelpTopic
  onHelp?: OpenHelp
  children?: ReactNode
}

export function ChartHeading({ title, help, onHelp, children }: ChartHeadingProps) {
  return (
    <div className="lab-chart-heading">
      <h2>{title}</h2>
      <div className="momentum-heading-side">
        {children}
        {help && onHelp && <button className="lab-help-button" onClick={() => onHelp(help)} aria-label={`開啟${title}說明`}>?</button>}
      </div>
    </div>
  )
}

export function Legend({ children }: { children: ReactNode }) {
  return <div className="momentum-legend">{children}</div>
}

type LegendItemProps = {
  color: string
  kind?: 'line' | 'block' | 'dashed'
  children: ReactNode
}

export function LegendItem({ color, kind = 'block', children }: LegendItemProps) {
  return <span className="momentum-legend-item"><i className={`momentum-key is-${kind}`} style={{ color }} />{children}</span>
}

type CartProps = {
  x: number
  railY: number
  width: number
  mass: number
  color: string
  name?: string
}

export function Cart({ x, railY, width, mass, color, name }: CartProps) {
  const left = x - width / 2
  const bodyTop = railY - WHEEL_RADIUS * 2 - BODY_HEIGHT
  const inset = width * 0.06
  const blockWidth = (width - 2 * inset - (BLOCKS_PER_ROW - 1) * BLOCK_GAP) / BLOCKS_PER_ROW
  const fullBlocks = Math.floor(mass)
  const blockCount = fullBlocks + (mass > fullBlocks ? 1 : 0)
  const wheelAngle = (x / WHEEL_RADIUS) * (180 / Math.PI)
  const massText = `${mass} kg`
  const label = name ? (width >= WIDE_CART_LABEL_WIDTH ? `${name} ${massText}` : name) : massText

  return (
    <g>
      {Array.from({ length: blockCount }, (_, index) => (
        <rect
          key={index}
          x={left + inset + (index % BLOCKS_PER_ROW) * (blockWidth + BLOCK_GAP)}
          y={bodyTop - (Math.floor(index / BLOCKS_PER_ROW) + 1) * (BLOCK_HEIGHT + BLOCK_GAP)}
          width={index === fullBlocks ? blockWidth / 2 : blockWidth}
          height={BLOCK_HEIGHT}
          rx={2}
          fill={color}
          fillOpacity={0.55}
        />
      ))}
      <rect x={left} y={bodyTop} width={width} height={BODY_HEIGHT} rx={5} fill={color} />
      <text x={x} y={bodyTop + 15} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--momentum-on-cart)">{label}</text>
      {[left + width * 0.24, left + width * 0.76].map((wheelX) => (
        <g key={wheelX} transform={`translate(${wheelX} ${railY - WHEEL_RADIUS}) rotate(${wheelAngle})`}>
          <circle r={WHEEL_RADIUS - 1} fill="var(--lab-surface)" stroke="var(--lab-axis)" strokeWidth={2} />
          <line x1={-WHEEL_RADIUS + 2} x2={WHEEL_RADIUS - 2} stroke="var(--lab-axis)" strokeWidth={1.5} />
        </g>
      ))}
    </g>
  )
}

export function CartGhost({ x, railY, width, color, opacity }: { x: number; railY: number; width: number; color: string; opacity: number }) {
  return <rect x={x - width / 2} y={railY - WHEEL_RADIUS * 2 - BODY_HEIGHT} width={width} height={BODY_HEIGHT} rx={5} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={opacity} />
}

type ArrowProps = {
  from: number
  to: number
  y: number
  color: string
  thickness?: number
}

export function Arrow({ from, to, y, color, thickness = 3 }: ArrowProps) {
  const span = to - from
  if (Math.abs(span) < 0.5) return null
  const direction = Math.sign(span)
  const head = Math.min(Math.abs(span), Math.max(10, thickness * 1.8))
  const neck = to - direction * head
  const halfHead = Math.max(5.5, thickness)
  return (
    <g>
      {neck !== from && <line x1={from} x2={neck} y1={y} y2={y} stroke={color} strokeWidth={thickness} />}
      <path d={`M${to} ${y}L${neck} ${y - halfHead}L${neck} ${y + halfHead}Z`} fill={color} />
    </g>
  )
}

type RulerProps = {
  xFor: (meters: number) => number
  ticks: number[]
  minorTicks?: number[]
  y: number
  labelled?: boolean
  width: number
}

export function Ruler({ xFor, ticks, minorTicks = [], y, labelled = true, width }: RulerProps) {
  return (
    <g>
      <line x1={0} x2={width} y1={y} y2={y} stroke="var(--lab-axis)" strokeWidth={2} />
      {minorTicks.map((tick) => <line key={tick} x1={xFor(tick)} x2={xFor(tick)} y1={y} y2={y + 4} stroke="var(--lab-axis)" strokeOpacity={0.6} />)}
      {ticks.map((tick, index) => (
        <g key={tick}>
          <line x1={xFor(tick)} x2={xFor(tick)} y1={y} y2={y + 7} stroke="var(--lab-axis)" />
          {labelled && <text x={xFor(tick)} y={y + 20} textAnchor="middle" fontSize="11" fill="var(--lab-muted)">{index === ticks.length - 1 ? `${tick} m` : tick}</text>}
        </g>
      ))}
    </g>
  )
}

type TimelineBarProps = {
  position: number
  length: number
  playing: boolean
  time: number
  onToggle: () => void
  onRewind: () => void
  onSeek: (position: number) => void
}

export function TimelineBar({ position, length, playing, time, onToggle, onRewind, onSeek }: TimelineBarProps) {
  const finished = position >= length
  return (
    <div className="momentum-timeline">
      <button onClick={onToggle}>{playing ? '暫停' : finished ? '重播' : '播放'}</button>
      <button className="lab-secondary" onClick={onRewind}>回到起點</button>
      <input type="range" aria-label="時間軸" min={0} max={1} step={0.001} value={length > 0 ? position / length : 0} onChange={(event) => onSeek(Number(event.target.value) * length)} />
      <span className="momentum-time"><MathText tex="t" /> = {time.toFixed(2)} s</span>
    </div>
  )
}

type ChartFrameProps = {
  width: number
  height: number
  margin: ChartMargin
  xFor: (value: number) => number
  yFor: (value: number) => number
  xTicks: number[]
  yTicks: number[]
  xLabel: ReactNode
  yLabel: ReactNode
}

export function ChartFrame({ width, height, margin, xFor, yFor, xTicks, yTicks, xLabel, yLabel }: ChartFrameProps) {
  const bottom = height - margin.bottom
  const right = width - margin.right
  return (
    <g>
      {xTicks.map((tick) => (
        <g key={tick}>
          <line x1={xFor(tick)} x2={xFor(tick)} y1={margin.top} y2={bottom} stroke={tick === 0 ? 'var(--lab-axis)' : 'var(--lab-grid)'} />
          <text x={xFor(tick)} y={bottom + 15} textAnchor="middle" fontSize="11" fill="var(--lab-muted)">{formatTick(tick)}</text>
        </g>
      ))}
      {yTicks.map((tick) => (
        <g key={tick}>
          <line x1={margin.left} x2={right} y1={yFor(tick)} y2={yFor(tick)} stroke={tick === 0 ? 'var(--lab-axis)' : 'var(--lab-grid)'} />
          <text x={margin.left - 6} y={yFor(tick) + 4} textAnchor="end" fontSize="11" fill="var(--lab-muted)">{formatTick(tick)}</text>
        </g>
      ))}
      <text x={(margin.left + right) / 2} y={height - 6} textAnchor="middle" fontSize="11.5" fill="var(--lab-muted)">{xLabel}</text>
      <text transform={`translate(13 ${(margin.top + bottom) / 2}) rotate(-90)`} textAnchor="middle" fontSize="11.5" fill="var(--lab-muted)">{yLabel}</text>
    </g>
  )
}

export type TimeSeries = {
  key: string
  color: string
  width?: number
  dash?: string
  points: [number, number][]
}

type TimeChartProps = {
  ariaLabel: string
  xLabel: ReactNode
  yLabel: ReactNode
  xDomain: [number, number]
  yDomain: [number, number]
  series: TimeSeries[]
  playhead: number | null
  onSeek: (time: number) => void
}

const TIME_CHART_HEIGHT = 190
const TIME_CHART_MARGIN: ChartMargin = { left: 48, right: 12, top: 10, bottom: 40 }

export function TimeChart({ ariaLabel, xLabel, yLabel, xDomain, yDomain, series, playhead, onSeek }: TimeChartProps) {
  const [containerRef, width] = useElementWidth<HTMLDivElement>(340)
  const margin = TIME_CHART_MARGIN
  const [xStart, xEnd] = xDomain
  const [yStart, yEnd] = yDomain
  const right = width - margin.right
  const bottom = TIME_CHART_HEIGHT - margin.bottom
  const paths = useMemo(() => {
    const xFor = linearScale(xStart, xEnd, margin.left, right)
    const yFor = linearScale(yStart, yEnd, bottom, margin.top)
    return series.map((line) => ({ ...line, path: tracePath(line.points, xFor, yFor) }))
  }, [bottom, margin.left, margin.top, right, series, xEnd, xStart, yEnd, yStart])
  const xFor = linearScale(xStart, xEnd, margin.left, right)
  const yFor = linearScale(yStart, yEnd, bottom, margin.top)
  const timeAt = linearScale(margin.left, right, xStart, xEnd)

  return (
    <div ref={containerRef} className="momentum-chart-box">
      <svg width="100%" height={TIME_CHART_HEIGHT} role="img" aria-label={ariaLabel}>
        <ChartFrame width={width} height={TIME_CHART_HEIGHT} margin={margin} xFor={xFor} yFor={yFor} xTicks={niceTicks(xStart, xEnd, width < 300 ? 3 : 5)} yTicks={niceTicks(yStart, yEnd, 4)} xLabel={xLabel} yLabel={yLabel} />
        {paths.map((line) => <path key={line.key} d={line.path} fill="none" stroke={line.color} strokeWidth={line.width ?? 2} strokeDasharray={line.dash} strokeLinejoin="round" strokeLinecap="round" />)}
        {playhead !== null && <line x1={xFor(playhead)} x2={xFor(playhead)} y1={margin.top} y2={bottom} stroke="var(--lab-text)" strokeWidth={1.5} />}
        <rect className="momentum-drag" x={margin.left} y={margin.top} width={Math.max(0, right - margin.left)} height={bottom - margin.top} fill="transparent" {...horizontalDrag((x) => onSeek(clamp(timeAt(x), xStart, xEnd)))} />
      </svg>
    </div>
  )
}
