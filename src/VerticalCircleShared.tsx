import { useId, useMemo, useState, type ReactNode } from 'react'
import MathText from './MathText'
import { clamp, formatTick, formatValue, linearScale, niceTicks, tracePath } from './momentumChartUtils'
import { horizontalDrag, useElementWidth } from './momentumHooks'
import { GRAVITY, TIME_LIMIT, type MotionFrame, type MotionRun } from './verticalCirclePhysics'
import type { SceneKind, ThresholdRow } from './verticalCircleText'

export type CircleHelpTopic = 'ropeStage' | 'trackHeight' | 'trackBottom' | 'trackOutside' | 'energy' | 'resistance' | 'ropeForce' | 'trackForce' | 'outsideForce'
export type OpenHelp = (topic: CircleHelpTopic) => void
export type SpeedUnit = 'si' | 'ratio'
type ChartMargin = { left: number; right: number; top: number; bottom: number }
type Series = { key: string; color: string; width: number; dash?: string; points: [number, number][] }

export const COLOR_KINETIC = 'var(--circle-kinetic)'
export const COLOR_POTENTIAL = 'var(--circle-potential)'
export const COLOR_TOTAL = 'var(--circle-total)'
export const COLOR_FORCE = 'var(--circle-force)'
export const COLOR_WEIGHT = 'var(--circle-weight)'
export const COLOR_RESISTANCE = 'var(--circle-resistance)'
export const COLOR_BALL = 'var(--circle-ball)'

export const DEFAULT_PLAYBACK_RATE = 0.5

const RESISTANCE_RANGE = { min: 0, max: 3, step: 0.1 }
const PLAYBACK_RATES = [0.25, 0.5, 1]
const DEGREES = 180 / Math.PI
const ENERGY_CHART_HEIGHT = 200
const ENERGY_CHART_MARGIN: ChartMargin = { left: 48, right: 12, top: 10, bottom: 40 }
const ENERGY_SAMPLES_PER_SECOND = 80
const ENERGY_SAMPLES_MIN = 360
const ENERGY_SAMPLES_MAX = 3000
const FORCE_CHART_HEIGHT = 230
const FORCE_CHART_MARGIN: ChartMargin = { left: 52, right: 22, top: 12, bottom: 58 }
const VALUE_PADDING = 1.12
const TRAIL_SAMPLES = 40
const ANGLE_AXES = {
  bottom: { domain: [-180, 180], ticks: [-180, -90, 0, 90, 180], names: new Map([[0, '最低點'], [180, '最高點'], [-180, '最高點']]) },
  top: { domain: [0, 90], ticks: [0, 30, 60, 90], names: new Map([[0, '最高點'], [90, '與圓心同高']]) },
}

export function Sym({ children }: { children: string }) {
  return <tspan fontFamily="KaTeX_Math" fontStyle="italic" fontSize="13">{children}</tspan>
}

type NumberFieldProps = {
  value: number
  min: number
  max: number
  step: number
  digits: number
  label: string
  onChange: (value: number) => void
}

// Typing updates the value as soon as it is a number in range; leaving the field clamps whatever is left.
export function NumberField({ value, min, max, step, digits, label, onChange }: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const isNumber = (text: string) => text.trim() !== '' && Number.isFinite(Number(text))
  const change = (text: string) => {
    setDraft(text)
    const next = Number(text)
    if (isNumber(text) && next >= min && next <= max) onChange(next)
  }
  const commit = () => {
    if (draft !== null && isNumber(draft)) onChange(clamp(Number(draft), min, max))
    setDraft(null)
  }
  return (
    <input
      className="lab-number-input circle-number-input"
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
  onChange: (value: number) => void
}

export function Slider({ label, value, min, max, step, unit, digits = 1, extra, inputLabel, onChange }: SliderProps) {
  const id = useId()
  return (
    <div className="lab-control">
      <div className="lab-control-head">
        <span className="circle-label-group"><label htmlFor={id}>{label}</label>{extra}</span>
        {inputLabel
          ? <span className="circle-unit-input"><NumberField value={value} min={min} max={max} step={step} digits={digits} label={inputLabel} onChange={onChange} />{unit}</span>
          : <span className="circle-slider-value">{formatValue(value, digits)}{unit ? ` ${unit}` : ''}</span>}
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  )
}

type SpeedControlProps = {
  label: ReactNode
  speed: number
  // √(gR) in m/s.
  unitSpeed: number
  min: number
  max: number
  step: number
  unit: SpeedUnit
  onUnitChange: (unit: SpeedUnit) => void
  onChange: (speed: number) => void
}

// Speed in m/s or in multiples of √(gR); the other unit is always shown underneath.
export function SpeedControl({ label, speed, unitSpeed, min, max, step, unit, onUnitChange, onChange }: SpeedControlProps) {
  const id = useId()
  const inRatio = unit === 'ratio'
  const scale = inRatio ? unitSpeed : 1
  const ratio = speed / unitSpeed
  return (
    <div className="lab-control">
      <div className="lab-control-head">
        <label htmlFor={id}>{label}</label>
        <span className="circle-unit-input">
          <NumberField key={unit} value={speed / scale} min={min / scale} max={max / scale} step={inRatio ? 0.01 : step} digits={inRatio ? 3 : 2} label="輸入速率" onChange={(value) => onChange(value * scale)} />
          {inRatio ? <MathText tex="\sqrt{gR}" /> : 'm/s'}
        </span>
      </div>
      <input id={id} type="range" min={min / scale} max={max / scale} step={inRatio ? 0.01 : step} value={speed / scale} onChange={(event) => onChange(Number(event.target.value) * scale)} />
      <div className="circle-speed-foot">
        <span>{inRatio ? `= ${formatValue(speed, 2)} m/s` : <MathText tex={`= ${ratio.toFixed(2)}\\sqrt{gR}`} />}</span>
        <span className="circle-unit-switch" role="group" aria-label="速率的單位">
          <button aria-pressed={!inRatio} onClick={() => onUnitChange('si')}>m/s</button>
          <button aria-pressed={inRatio} onClick={() => onUnitChange('ratio')} aria-label="根號 g R 的倍數"><MathText tex="\sqrt{gR}" /></button>
        </span>
      </div>
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
      <span className="circle-field-label">{label}</span>
      <div className="circle-segmented" role="group" aria-label={label} style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
        {options.map((option) => <button key={option.value} aria-pressed={option.value === value} onClick={() => onChange(option.value)}>{option.label}</button>)}
      </div>
    </div>
  )
}

export function PlaybackRate({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <Segmented label="播放速度" options={PLAYBACK_RATES.map((rate) => ({ value: rate, label: `${rate} 倍` }))} value={value} onChange={onChange} />
}

export function ResistanceSlider({ value, onChange, onHelp }: { value: number; onChange: (value: number) => void; onHelp: OpenHelp }) {
  return (
    <Slider
      label={<>阻力 <MathText tex="f" /></>}
      extra={<button className="lab-help-button lab-help-small" onClick={() => onHelp('resistance')} aria-label="開啟阻力說明">?</button>}
      {...RESISTANCE_RANGE}
      unit="N"
      value={value}
      onChange={onChange}
    />
  )
}

export function MotionThresholds({ title, rows, active }: { title: ReactNode; rows: ThresholdRow[]; active: string | null }) {
  return (
    <div className="lab-control">
      <span className="circle-field-label">{title}</span>
      <table className="circle-thresholds">
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={row.id === active ? 'is-current' : undefined} aria-current={row.id === active ? 'true' : undefined}>
              <th scope="row">{row.label}</th>
              <td><MathText tex={row.condition} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

type ChartHeadingProps = {
  title: string
  help?: CircleHelpTopic
  onHelp?: OpenHelp
  children?: ReactNode
}

export function ChartHeading({ title, help, onHelp, children }: ChartHeadingProps) {
  return (
    <div className="lab-chart-heading">
      <h2>{title}</h2>
      <div className="circle-heading-side">
        {children}
        {help && onHelp && <button className="lab-help-button" onClick={() => onHelp(help)} aria-label={`開啟${title}說明`}>?</button>}
      </div>
    </div>
  )
}

export function Legend({ children }: { children: ReactNode }) {
  return <div className="circle-legend">{children}</div>
}

type LegendItemProps = {
  color: string
  kind?: 'line' | 'block' | 'dashed' | 'dot'
  children: ReactNode
}

export function LegendItem({ color, kind = 'block', children }: LegendItemProps) {
  return <span className="circle-legend-item"><i className={`circle-key is-${kind}`} style={{ color }} />{children}</span>
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
  // Starts the arrow this many pixels from (x, y), for example at the edge of the ball.
  gap?: number
}

export function VectorArrow({ x, y, dx, dy, color, width = 2.5, label, labelShift = 0, gap = 0 }: VectorArrowProps) {
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
      {length > head && <line x1={tailX} y1={tailY} x2={neckX} y2={neckY} stroke={color} strokeWidth={width} />}
      <path d={`M${tipX} ${tipY}L${neckX - uy * halfHead} ${neckY + ux * halfHead}L${neckX + uy * halfHead} ${neckY - ux * halfHead}Z`} fill={color} />
      {label && <text x={tipX + ux * 11 + uy * labelShift} y={tipY + uy * 11 - ux * labelShift + 4} textAnchor="middle" fontSize="12" fill={color}>{label}</text>}
    </g>
  )
}

type BallArrowsProps = {
  frame: MotionFrame
  x: number
  y: number
  ballRadius: number
  mass: number
  resistance: number
  forceScale: number
  velocityScale: number
  forceSymbol: string
}

// Velocity, the rope or track force, the weight and the resistance, all starting at the edge of the ball.
export function BallArrows({ frame, x, y, ballRadius, mass, resistance, forceScale, velocityScale, forceSymbol }: BallArrowsProps) {
  const weight = mass * GRAVITY
  const moving = frame.speed > 1e-6
  return (
    <g>
      {frame.attached && <VectorArrow x={x} y={y} dx={frame.normalX * frame.force * forceScale} dy={-frame.normalY * frame.force * forceScale} color={COLOR_FORCE} label={<Sym>{forceSymbol}</Sym>} labelShift={-10} gap={ballRadius} />}
      <VectorArrow x={x + 6} y={y} dx={0} dy={weight * forceScale} color={COLOR_WEIGHT} label={<Sym>mg</Sym>} labelShift={10} gap={ballRadius} />
      {resistance > 0 && moving && <VectorArrow x={x} y={y} dx={(-frame.vx / frame.speed) * resistance * forceScale} dy={(frame.vy / frame.speed) * resistance * forceScale} color={COLOR_RESISTANCE} label={<Sym>f</Sym>} labelShift={-10} gap={ballRadius} />}
      <VectorArrow x={x} y={y} dx={frame.vx * velocityScale} dy={-frame.vy * velocityScale} color="var(--lab-text)" width={2} label={<Sym>v</Sym>} gap={ballRadius} />
    </g>
  )
}

type FlightTrailProps = {
  run: MotionRun
  time: number
  // Where the ball is drawn for a frame, in SVG pixels.
  place: (frame: MotionFrame) => { x: number; y: number }
}

// The path the ball has flown since the rope went slack or the ball left the track.
export function FlightTrail({ run, time, place }: FlightTrailProps) {
  if (run.leaveTime === null || time <= run.leaveTime) return null
  const start = run.leaveTime
  const points = Array.from({ length: TRAIL_SAMPLES + 1 }, (_, index) => {
    const point = place(run.frameAt(start + ((time - start) * index) / TRAIL_SAMPLES))
    return `${point.x.toFixed(1)} ${point.y.toFixed(1)}`
  })
  return <path d={`M${points.join('L')}`} fill="none" stroke="var(--lab-muted)" strokeWidth={1.5} strokeDasharray="2 4" />
}

export function EnergyReadout({ frame, run }: { frame: MotionFrame; run: MotionRun }) {
  const total = run.initialEnergy
  const parts = [
    { key: 'kinetic', color: COLOR_KINETIC, value: frame.kinetic },
    { key: 'potential', color: COLOR_POTENTIAL, value: frame.potential },
    { key: 'lost', color: COLOR_RESISTANCE, value: frame.lost },
  ].filter((part) => total > 0 && part.value / total > 0.001)
  return (
    <div className="circle-readout-block">
      <div className="circle-energy-bar" role="presentation">{parts.map((part) => <i key={part.key} style={{ background: part.color, flexGrow: part.value / total }} />)}</div>
      <Legend>
        <LegendItem color={COLOR_TOTAL} kind="line">力學能 <MathText tex="E" /> <b>{formatValue(frame.kinetic + frame.potential)}</b></LegendItem>
        <LegendItem color={COLOR_KINETIC}>動能 <MathText tex="K" /> <b>{formatValue(frame.kinetic)}</b></LegendItem>
        <LegendItem color={COLOR_POTENTIAL}>重力位能 <MathText tex="U" /> <b>{formatValue(frame.potential)}</b></LegendItem>
        {run.resistance > 0 && <LegendItem color={COLOR_RESISTANCE}>減少的力學能 <b>{formatValue(frame.lost)}</b></LegendItem>}
      </Legend>
    </div>
  )
}

type AxesProps = {
  width: number
  height: number
  margin: ChartMargin
  xFor: (value: number) => number
  yFor: (value: number) => number
  xTicks: number[]
  yTicks: number[]
  xLabel: ReactNode
  yLabel: ReactNode
  xTickLabel?: (tick: number, x: number) => ReactNode
}

function Axes({ width, height, margin, xFor, yFor, xTicks, yTicks, xLabel, yLabel, xTickLabel = (tick) => formatTick(tick) }: AxesProps) {
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

function paddedDomain(values: number[]): [number, number] {
  const low = Math.min(0, ...values) * VALUE_PADDING
  const high = Math.max(0, ...values) * VALUE_PADDING
  return high > low ? [low, high] : [-1, 1]
}

type EnergyChartProps = {
  run: MotionRun
  time: number
  onSeek: (time: number) => void
}

export function EnergyChart({ run, time, onSeek }: EnergyChartProps) {
  const [containerRef, width] = useElementWidth<HTMLDivElement>(340)
  const margin = ENERGY_CHART_MARGIN
  const height = ENERGY_CHART_HEIGHT
  const right = width - margin.right
  const bottom = height - margin.bottom
  const series = useMemo<Series[]>(() => {
    const count = Math.round(clamp(run.duration * ENERGY_SAMPLES_PER_SECOND, ENERGY_SAMPLES_MIN, ENERGY_SAMPLES_MAX))
    const frames = Array.from({ length: count + 1 }, (_, index) => {
      const sampleTime = (run.duration * index) / count
      return { time: sampleTime, frame: run.frameAt(sampleTime) }
    })
    const line = (key: string, color: string, lineWidth: number, value: (frame: MotionFrame) => number): Series => ({
      key, color, width: lineWidth, points: frames.map((sample) => [sample.time, value(sample.frame)]),
    })
    return [
      line('kinetic', COLOR_KINETIC, 2, (frame) => frame.kinetic),
      line('potential', COLOR_POTENTIAL, 2, (frame) => frame.potential),
      line('total', COLOR_TOTAL, 3, (frame) => frame.kinetic + frame.potential),
    ]
  }, [run])
  const yMax = run.initialEnergy > 0 ? run.initialEnergy * VALUE_PADDING : 1
  const xFor = linearScale(0, run.duration, margin.left, right)
  const yFor = linearScale(0, yMax, bottom, margin.top)
  const timeAt = linearScale(margin.left, right, 0, run.duration)

  return (
    <div ref={containerRef} className="circle-chart-box">
      <svg width="100%" height={height} role="img" aria-label="動能、重力位能與力學能隨時間的變化">
        <Axes width={width} height={height} margin={margin} xFor={xFor} yFor={yFor} xTicks={niceTicks(0, run.duration, width < 300 ? 3 : 6)} yTicks={niceTicks(0, yMax, 4)} xLabel={<>時間 <Sym>t</Sym>（s）</>} yLabel="能量（J）" />
        {run.resistance > 0 && (
          <g>
            <line x1={margin.left} x2={right} y1={yFor(run.initialEnergy)} y2={yFor(run.initialEnergy)} stroke={COLOR_RESISTANCE} strokeWidth={1.5} strokeDasharray="5 4" />
            <text x={right - 4} y={yFor(run.initialEnergy) - 5} textAnchor="end" fontSize="11" fill="var(--lab-muted)">初始力學能</text>
          </g>
        )}
        {series.map((line) => <path key={line.key} d={tracePath(line.points, xFor, yFor)} fill="none" stroke={line.color} strokeWidth={line.width} strokeLinejoin="round" strokeLinecap="round" />)}
        <line x1={xFor(time)} x2={xFor(time)} y1={margin.top} y2={bottom} stroke="var(--lab-text)" strokeWidth={1.5} />
        <rect className="circle-drag" x={margin.left} y={margin.top} width={Math.max(0, right - margin.left)} height={bottom - margin.top} fill="transparent" {...horizontalDrag((x) => onSeek(clamp(timeAt(x), 0, run.duration)))} />
      </svg>
    </div>
  )
}

type ForceChartProps = {
  run: MotionRun
  frame: MotionFrame
  // Angles from the lowest point (−180° to 180°) or from the highest point (0° to 90°).
  axis: 'bottom' | 'top'
  canPush: boolean
  ariaLabel: string
  yLabel: ReactNode
  negativeNote: string
  leaveLabel: string
}

export function ForceChart({ run, frame, axis, canPush, ariaLabel, yLabel, negativeNote, leaveLabel }: ForceChartProps) {
  const [containerRef, width] = useElementWidth<HTMLDivElement>(340)
  // The longer name under the last tick of the top axis needs more room on the right.
  const margin = axis === 'top' ? { ...FORCE_CHART_MARGIN, right: 34 } : FORCE_CHART_MARGIN
  const height = FORCE_CHART_HEIGHT
  const right = width - margin.right
  const bottom = height - margin.bottom
  const { domain, ticks, names } = ANGLE_AXES[axis]
  const yDomain = useMemo(() => paddedDomain([...run.forceTrace.flat(), ...run.forceContinuation].map(([, value]) => value)), [run])
  const xFor = linearScale(domain[0], domain[1], margin.left, right)
  const yFor = linearScale(yDomain[0], yDomain[1], bottom, margin.top)
  const marker = frame.attached && frame.angle !== null ? { x: xFor(frame.angle * DEGREES), y: yFor(frame.force) } : null
  const showNegative = yDomain[0] < 0
  const tickLabel = (tick: number, x: number) => {
    const name = names.get(tick)
    return (
      <>
        {formatTick(tick)}°
        {name && <tspan x={x} dy={14}>{name}</tspan>}
      </>
    )
  }

  return (
    <div ref={containerRef} className="circle-chart-box">
      <svg width="100%" height={height} role="img" aria-label={ariaLabel}>
        {showNegative && !canPush && <rect x={margin.left} y={yFor(0)} width={Math.max(0, right - margin.left)} height={bottom - yFor(0)} fill="var(--lab-grid)" fillOpacity={0.7} />}
        <Axes width={width} height={height} margin={margin} xFor={xFor} yFor={yFor} xTicks={ticks} yTicks={niceTicks(yDomain[0], yDomain[1], 5)} xLabel={<>角位置 <Sym>θ</Sym></>} yLabel={yLabel} xTickLabel={tickLabel} />
        {showNegative && <text x={(margin.left + right) / 2} y={bottom - 6} textAnchor="middle" fontSize="11" fill="var(--lab-muted)">{negativeNote}</text>}
        {run.forceContinuation.length > 1 && <path d={tracePath(run.forceContinuation, xFor, yFor)} fill="none" stroke={COLOR_FORCE} strokeWidth={2} strokeDasharray="5 5" strokeOpacity={0.7} />}
        {run.forceTrace.map((stroke, index) => <path key={index} d={tracePath(stroke, xFor, yFor)} fill="none" stroke={COLOR_FORCE} strokeWidth={2.5} strokeLinejoin="round" />)}
        {run.leaveAngle !== null && (
          <g>
            <circle cx={xFor(run.leaveAngle * DEGREES)} cy={yFor(0)} r={5} fill="var(--lab-surface)" stroke={COLOR_FORCE} strokeWidth={2} />
            <text x={xFor(run.leaveAngle * DEGREES) + (axis === 'top' ? 8 : -8)} y={yFor(0) - 9} textAnchor={axis === 'top' ? 'start' : 'end'} fontSize="11" fill="var(--lab-text)">{leaveLabel}</text>
          </g>
        )}
        {marker && <circle cx={marker.x} cy={marker.y} r={6.5} fill={COLOR_FORCE} stroke="var(--lab-surface)" strokeWidth={2} />}
      </svg>
    </div>
  )
}

function AngleTex({ angle, fromTop }: { angle: number; fromTop?: boolean }) {
  return <><MathText tex={`\\theta = ${Math.round(angle * DEGREES)}^\\circ`} />{fromTop ? '（從最高點量起）' : ''}</>
}

// Explains how a run that does not repeat ends.
export function RunNote({ run, scene }: { run: MotionRun; scene: SceneKind }) {
  const fromTop = scene === 'outside'
  const conserved = run.resistance === 0 ? '，力學能仍然守恆' : ''
  const passes = run.resistance > 0 && run.topPasses > 0 ? `小球通過最高點 ${run.topPasses} 次後，` : ''
  let note: ReactNode = null
  if (run.outcome === 'leave' && run.leaveAngle !== null) {
    if (scene === 'rope') {
      note = <>{passes}繩子在 <AngleTex angle={run.leaveAngle} /> 時鬆弛，小球改作拋體運動{conserved}。繩子再次拉緊時會猛然拉扯小球、損失力學能，模擬到這裡為止。</>
    } else if (fromTop) {
      note = run.leaveAngle > 1e-6
        ? <>小球在 <AngleTex angle={run.leaveAngle} fromTop />時離開軌道，改作拋體運動，模擬到落地為止。</>
        : <>小球一出發就離開軌道，改作拋體運動，模擬到落地為止。</>
    } else {
      note = <>{passes || '小球'}在 <AngleTex angle={run.leaveAngle} /> 時離開軌道，改作拋體運動{conserved}。小球撞回軌道時會損失力學能，模擬到這裡為止。</>
    }
  } else if (run.outcome === 'rest') {
    const end = run.frameAt(run.duration)
    const place = end.angle !== null ? <>停在 <AngleTex angle={end.angle} fromTop={fromTop} /> 的位置</> : end.x < 0 ? '停在斜坡上' : '停在水平軌道上'
    note = run.stuckAtStart
      ? '阻力不小於重力沿軌道方向的分力，小球不會移動。'
      : <>{passes || '小球'}{place}：重力沿軌道方向的分力不大於阻力，小球不再移動。</>
  } else if (run.outcome === 'limit') {
    note = `${passes ? `小球已通過最高點 ${run.topPasses} 次，` : '小球'}仍在運動，這裡只模擬前 ${TIME_LIMIT} 秒。`
  }
  return note ? <p className="circle-run-note">{note}</p> : null
}

type TimelineBarProps = {
  position: number
  length: number
  looping: boolean
  playing: boolean
  onToggle: () => void
  onRewind: () => void
  onSeek: (position: number) => void
}

export function TimelineBar({ position, length, looping, playing, onToggle, onRewind, onSeek }: TimelineBarProps) {
  const finished = !looping && position >= length
  return (
    <div className="circle-timeline">
      <button onClick={onToggle}>{playing ? '暫停' : finished ? '重播' : '播放'}</button>
      <button className="lab-secondary" onClick={onRewind}>回到起點</button>
      <input type="range" aria-label="時間軸" min={0} max={1} step={0.001} value={length > 0 ? position / length : 0} onChange={(event) => onSeek(Number(event.target.value) * length)} />
      <span className="circle-time"><MathText tex="t" /> = {position.toFixed(2)} s</span>
    </div>
  )
}
