import { useId, useMemo, useState, type ReactNode } from 'react'
import MathText from './MathText'
import { clamp, formatTick, formatValue, linearScale, niceTicks, tracePath } from './chartUtils'
import { horizontalDrag, useElementWidth } from './labHooks'

// Controls, charts and dialogs used by more than one lab. Styles are in LabPage.css.

export type ChartMargin = { left: number; right: number; top: number; bottom: number }
type Scale = (value: number) => number

export function Sym({ children }: { children: string }) {
  return <tspan fontFamily="KaTeX_Math" fontStyle="italic" fontSize="13">{children}</tspan>
}

type LabTabsProps<T extends string> = {
  tabs: { id: T; label: string }[]
  value: T
  onChange: (id: T) => void
}

export function LabTabs<T extends string>({ tabs, value, onChange }: LabTabsProps<T>) {
  return (
    <nav className="lab-tabs" aria-label="實驗主題">
      {tabs.map((tab) => <button key={tab.id} className="lab-tab" aria-current={value === tab.id ? 'true' : undefined} onClick={() => onChange(tab.id)}>{tab.label}</button>)}
    </nav>
  )
}

export function HelpDialog({ paragraphs, onClose }: { paragraphs: ReactNode[]; onClose: () => void }) {
  const titleId = useId()
  return (
    <div className="lab-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="lab-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId}>說明</h2>
        {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        <button className="lab-secondary" onClick={onClose}>關閉</button>
      </section>
    </div>
  )
}

type NumberFieldProps = {
  value: number
  min: number
  max: number
  step: number
  digits: number
  label: string
  // Drops any fraction that is typed.
  integer?: boolean
  // Sets the width; the default fits decimals such as 12.34.
  className?: string
  onChange: (value: number) => void
}

// Typing updates the value as soon as it is a number in range, so a partly typed number does not jump the value
// around; leaving the field or pressing Enter clamps whatever is left.
export function NumberField({ value, min, max, step, digits, label, integer = false, className = 'lab-number-decimal', onChange }: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const isNumber = (text: string) => text.trim() !== '' && Number.isFinite(Number(text))
  const parse = (text: string) => (integer ? Math.floor(Number(text)) : Number(text))
  const change = (text: string) => {
    setDraft(text)
    const next = parse(text)
    if (isNumber(text) && next >= min && next <= max) onChange(next)
  }
  const commit = () => {
    if (draft !== null && isNumber(draft)) onChange(clamp(parse(draft), min, max))
    setDraft(null)
  }
  return (
    <input
      className={`lab-number-input ${className}`.trim()}
      type="number"
      aria-label={label}
      min={Number(min.toFixed(digits))}
      max={Number(max.toFixed(digits))}
      step={step}
      value={draft ?? Number(value.toFixed(digits))}
      onChange={(event) => change(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => { if (event.key === 'Enter') commit() }}
    />
  )
}

type SliderProps = {
  label: ReactNode
  value: number
  min: number
  max: number
  step: number
  unit?: string
  digits?: number
  // Shown right after the label, for example a help button.
  extra?: ReactNode
  // Replaces the read-only value with a number field labelled for screen readers.
  inputLabel?: string
  // Passed on to the number field.
  integer?: boolean
  inputClassName?: string
  onChange: (value: number) => void
}

export function Slider({ label, value, min, max, step, unit, digits = 1, extra, inputLabel, integer, inputClassName, onChange }: SliderProps) {
  const id = useId()
  return (
    <div className="lab-control">
      <div className="lab-control-head">
        <span className="lab-label-group"><label htmlFor={id}>{label}</label>{extra}</span>
        {inputLabel
          ? <span className="lab-unit-input"><NumberField value={value} min={min} max={max} step={step} digits={digits} label={inputLabel} integer={integer} className={inputClassName} onChange={onChange} />{unit}</span>
          : <span className="lab-slider-value">{formatValue(value, digits)}{unit ? ` ${unit}` : ''}</span>}
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  )
}

type SegmentedProps<T extends string | number> = {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}

export function Segmented<T extends string | number>({ label, options, value, onChange }: SegmentedProps<T>) {
  return (
    <div className="lab-control">
      <span className="lab-field-label">{label}</span>
      <div className="lab-segmented" role="group" aria-label={label} style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
        {options.map((option) => <button key={option.value} aria-pressed={option.value === value} onClick={() => onChange(option.value)}>{option.label}</button>)}
      </div>
    </div>
  )
}

type ChartHeadingProps<T extends string> = {
  title: string
  help?: T
  onHelp?: (topic: T) => void
  children?: ReactNode
}

export function ChartHeading<T extends string>({ title, help, onHelp, children }: ChartHeadingProps<T>) {
  return (
    <div className="lab-chart-heading">
      <h2>{title}</h2>
      <div className="lab-heading-side">
        {children}
        {help && onHelp && <button className="lab-help-button" onClick={() => onHelp(help)} aria-label={`開啟${title}說明`}>?</button>}
      </div>
    </div>
  )
}

export function Legend({ children }: { children: ReactNode }) {
  return <div className="lab-legend">{children}</div>
}

type LegendItemProps = {
  color: string
  kind?: 'line' | 'block' | 'dashed' | 'dot'
  children: ReactNode
}

export function LegendItem({ color, kind = 'block', children }: LegendItemProps) {
  return <span className="lab-legend-item"><i className={`lab-key is-${kind}`} style={{ color }} />{children}</span>
}

type VectorArrowProps = {
  x: number
  y: number
  dx: number
  dy: number
  color: string
  width?: number
  label?: ReactNode
  // Moves the label sideways (in pixels, to the left of the arrow's direction when positive).
  labelShift?: number
  // Starts the arrow this many pixels from (x, y), for example at the edge of a ball.
  gap?: number
  // A dashed shaft and an outlined head, for quantities that are not forces acting on the object.
  dash?: string
}

// An arrow in any direction, in SVG pixels.
export function VectorArrow({ x, y, dx, dy, color, width = 2.5, label, labelShift = 0, gap = 0, dash }: VectorArrowProps) {
  const length = Math.hypot(dx, dy)
  if (length < 3) return null
  const ux = dx / length
  const uy = dy / length
  const head = Math.min(length, 6 + width * 1.6)
  const halfHead = 2.5 + width * 0.8
  const tailX = x + ux * gap
  const tailY = y + uy * gap
  const tipX = tailX + dx
  const tipY = tailY + dy
  const neckX = tipX - ux * head
  const neckY = tipY - uy * head
  return (
    <g>
      {length > head && <line x1={tailX} y1={tailY} x2={neckX} y2={neckY} stroke={color} strokeWidth={width} strokeDasharray={dash} />}
      <path d={`M${tipX} ${tipY}L${neckX - uy * halfHead} ${neckY + ux * halfHead}L${neckX + uy * halfHead} ${neckY - ux * halfHead}Z`} fill={dash ? 'none' : color} stroke={dash ? color : undefined} strokeWidth={dash ? 1.4 : undefined} strokeLinejoin="round" />
      {label && <text x={tipX + ux * 11 + uy * labelShift} y={tipY + uy * 11 - ux * labelShift + 4} textAnchor="middle" fontSize="12" fill={color}>{label}</text>}
    </g>
  )
}

type ChartFrameProps = {
  width: number
  height: number
  margin: ChartMargin
  xFor: Scale
  yFor: Scale
  xTicks: number[]
  yTicks: number[]
  xLabel: ReactNode
  yLabel: ReactNode
  xTickLabel?: (tick: number, x: number) => ReactNode
}

export function ChartFrame({ width, height, margin, xFor, yFor, xTicks, yTicks, xLabel, yLabel, xTickLabel = (tick) => formatTick(tick) }: ChartFrameProps) {
  const bottom = height - margin.bottom
  const right = width - margin.right
  return (
    <g>
      {xTicks.map((tick) => (
        <g key={tick}>
          <line x1={xFor(tick)} x2={xFor(tick)} y1={margin.top} y2={bottom} stroke={tick === 0 ? 'var(--lab-axis)' : 'var(--lab-grid)'} />
          <text x={xFor(tick)} y={bottom + 15} textAnchor="middle" fontSize="11" fill="var(--lab-muted)">{xTickLabel(tick, xFor(tick))}</text>
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
  height?: number
  // Drawn between the grid and the series, for example a reference line.
  background?: (xFor: Scale, yFor: Scale, right: number) => ReactNode
}

const TIME_CHART_HEIGHT = 190
const TIME_CHART_MARGIN: ChartMargin = { left: 48, right: 12, top: 10, bottom: 40 }

// Values against time; dragging across the plot seeks to that time.
export function TimeChart({ ariaLabel, xLabel, yLabel, xDomain, yDomain, series, playhead, onSeek, height = TIME_CHART_HEIGHT, background }: TimeChartProps) {
  const [containerRef, width] = useElementWidth<HTMLDivElement>(340)
  const margin = TIME_CHART_MARGIN
  const [xStart, xEnd] = xDomain
  const [yStart, yEnd] = yDomain
  const right = width - margin.right
  const bottom = height - margin.bottom
  const paths = useMemo(() => {
    const xFor = linearScale(xStart, xEnd, margin.left, right)
    const yFor = linearScale(yStart, yEnd, bottom, margin.top)
    return series.map((line) => ({ ...line, path: tracePath(line.points, xFor, yFor) }))
  }, [bottom, margin.left, margin.top, right, series, xEnd, xStart, yEnd, yStart])
  const xFor = linearScale(xStart, xEnd, margin.left, right)
  const yFor = linearScale(yStart, yEnd, bottom, margin.top)
  const timeAt = linearScale(margin.left, right, xStart, xEnd)

  return (
    <div ref={containerRef} className="lab-chart-box">
      <svg width="100%" height={height} role="img" aria-label={ariaLabel}>
        <ChartFrame width={width} height={height} margin={margin} xFor={xFor} yFor={yFor} xTicks={niceTicks(xStart, xEnd, width < 300 ? 3 : 5)} yTicks={niceTicks(yStart, yEnd, 4)} xLabel={xLabel} yLabel={yLabel} />
        {background?.(xFor, yFor, right)}
        {paths.map((line) => <path key={line.key} d={line.path} fill="none" stroke={line.color} strokeWidth={line.width ?? 2} strokeDasharray={line.dash} strokeLinejoin="round" strokeLinecap="round" />)}
        {playhead !== null && <line x1={xFor(playhead)} x2={xFor(playhead)} y1={margin.top} y2={bottom} stroke="var(--lab-text)" strokeWidth={1.5} />}
        <rect className="lab-drag" x={margin.left} y={margin.top} width={Math.max(0, right - margin.left)} height={bottom - margin.top} fill="transparent" {...horizontalDrag((x) => onSeek(clamp(timeAt(x), xStart, xEnd)))} />
      </svg>
    </div>
  )
}

type TimelineBarProps = {
  position: number
  length: number
  playing: boolean
  // The time shown next to the slider, which can differ from the playback position (for example in slow motion).
  time: number
  // A looping timeline never shows「重播」.
  looping?: boolean
  onToggle: () => void
  onRewind: () => void
  onSeek: (position: number) => void
}

export function TimelineBar({ position, length, playing, time, looping = false, onToggle, onRewind, onSeek }: TimelineBarProps) {
  const finished = !looping && position >= length
  return (
    <div className="lab-timeline">
      <button onClick={onToggle}>{playing ? '暫停' : finished ? '重播' : '播放'}</button>
      <button className="lab-secondary" onClick={onRewind}>回到起點</button>
      <input type="range" aria-label="時間軸" min={0} max={1} step={0.001} value={length > 0 ? position / length : 0} onChange={(event) => onSeek(Number(event.target.value) * length)} />
      <span className="lab-time"><MathText tex="t" /> = {time.toFixed(2)} s</span>
    </div>
  )
}
