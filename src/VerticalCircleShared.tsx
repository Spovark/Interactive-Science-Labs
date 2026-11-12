import { useId, useMemo, type ReactNode } from 'react'
import { clamp, formatTick, formatValue, linearScale, niceTicks, tracePath } from './chartUtils'
import { useElementWidth } from './labHooks'
import { ChartFrame, Legend, LegendItem, NumberField, Slider, Sym, TimeChart, type ChartMargin, type TimeSeries } from './LabShared'
import MathText from './MathText'
import { TIME_LIMIT, type MotionFrame, type MotionRun } from './verticalCirclePhysics'
import type { SceneKind, ThresholdRow } from './verticalCircleText'

export type CircleHelpTopic = 'ropeStage' | 'trackHeight' | 'trackBottom' | 'trackOutside' | 'trackHalf' | 'observer' | 'vectors' | 'energy' | 'resistance' | 'ropeForce' | 'trackForce' | 'outsideForce'
export type OpenHelp = (topic: CircleHelpTopic) => void
export type SpeedUnit = 'si' | 'ratio'

export const COLOR_KINETIC = 'var(--circle-kinetic)'
export const COLOR_POTENTIAL = 'var(--circle-potential)'
export const COLOR_TOTAL = 'var(--circle-total)'
export const COLOR_FORCE = 'var(--circle-force)'
export const COLOR_WEIGHT = 'var(--circle-weight)'
export const COLOR_RESISTANCE = 'var(--circle-resistance)'
export const COLOR_BALL = 'var(--circle-ball)'

export const DEFAULT_PLAYBACK_RATE = 0.5

const RESISTANCE_RANGE = { min: 0, max: 3, step: 0.1 }
const DEGREES = 180 / Math.PI
const ENERGY_CHART_HEIGHT = 200
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
        <span className="lab-unit-input">
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
      <span className="lab-field-label">{title}</span>
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
  const series = useMemo<TimeSeries[]>(() => {
    const count = Math.round(clamp(run.duration * ENERGY_SAMPLES_PER_SECOND, ENERGY_SAMPLES_MIN, ENERGY_SAMPLES_MAX))
    const frames = Array.from({ length: count + 1 }, (_, index) => {
      const sampleTime = (run.duration * index) / count
      return { time: sampleTime, frame: run.frameAt(sampleTime) }
    })
    const line = (key: string, color: string, lineWidth: number, value: (frame: MotionFrame) => number): TimeSeries => ({
      key, color, width: lineWidth, points: frames.map((sample) => [sample.time, value(sample.frame)]),
    })
    return [
      line('kinetic', COLOR_KINETIC, 2, (frame) => frame.kinetic),
      line('potential', COLOR_POTENTIAL, 2, (frame) => frame.potential),
      line('total', COLOR_TOTAL, 3, (frame) => frame.kinetic + frame.potential),
    ]
  }, [run])
  const yMax = run.initialEnergy > 0 ? run.initialEnergy * VALUE_PADDING : 1
  const initialLine = (xFor: (value: number) => number, yFor: (value: number) => number) => run.resistance > 0 && (
    <g>
      <line x1={xFor(0)} x2={xFor(run.duration)} y1={yFor(run.initialEnergy)} y2={yFor(run.initialEnergy)} stroke={COLOR_RESISTANCE} strokeWidth={1.5} strokeDasharray="5 4" />
      <text x={xFor(run.duration) - 4} y={yFor(run.initialEnergy) - 5} textAnchor="end" fontSize="11" fill="var(--lab-muted)">初始力學能</text>
    </g>
  )
  return (
    <TimeChart
      ariaLabel="動能、重力位能與力學能隨時間的變化"
      xLabel={<>時間 <Sym>t</Sym>（s）</>}
      yLabel="能量（J）"
      xDomain={[0, run.duration]}
      yDomain={[0, yMax]}
      series={series}
      playhead={time}
      onSeek={onSeek}
      height={ENERGY_CHART_HEIGHT}
      background={initialLine}
    />
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
    <div ref={containerRef} className="lab-chart-box">
      <svg width="100%" height={height} role="img" aria-label={ariaLabel}>
        {showNegative && !canPush && <rect x={margin.left} y={yFor(0)} width={Math.max(0, right - margin.left)} height={bottom - yFor(0)} fill="var(--lab-grid)" fillOpacity={0.7} />}
        <ChartFrame width={width} height={height} margin={margin} xFor={xFor} yFor={yFor} xTicks={ticks} yTicks={niceTicks(yDomain[0], yDomain[1], 5)} xLabel={<>角位置 <Sym>θ</Sym></>} yLabel={yLabel} xTickLabel={tickLabel} />
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
    } else if (scene === 'half') {
      note = <>{passes || '小球'}在 <AngleTex angle={run.leaveAngle} /> 時離開軌道，改作拋體運動{conserved}，模擬到小球落地或撞回軌道為止。</>
    } else {
      note = <>{passes || '小球'}在 <AngleTex angle={run.leaveAngle} /> 時離開軌道，改作拋體運動{conserved}。小球撞回軌道時會損失力學能，模擬到這裡為止。</>
    }
  } else if (run.outcome === 'launch' && run.leaveTime !== null) {
    const top = run.frameAt(run.leaveTime).speed
    const landing = -run.frameAt(run.duration).x
    note = <>小球從最高點以 <MathText tex={`v_1 = ${formatValue(top, 2)}\\ \\text{m/s}`} /> 水平拋出，落在最低點左側 <MathText tex={`d = ${formatValue(landing, 2)}\\ \\text{m}`} /> 的地面上，模擬到落地為止。{run.resistance === 0 && <>最高點的速率至少要 <MathText tex="\sqrt{gR}" />，所以 <MathText tex="d" /> 至少是 <MathText tex="2R" />。</>}</>
  } else if (run.outcome === 'exit' && scene === 'half') {
    note = '小球沒有到達最高點，滑回最低點後沿地面往左離開。'
  } else if (run.outcome === 'rest') {
    const end = run.frameAt(run.duration)
    const flat = scene === 'half' || end.x > 0 ? '停在水平地面上' : '停在斜坡上'
    const place = end.angle !== null ? <>停在 <AngleTex angle={end.angle} fromTop={fromTop} /> 的位置</> : flat
    note = run.stuckAtStart
      ? '阻力不小於重力沿軌道方向的分力，小球不會移動。'
      : <>{passes || '小球'}{place}：重力沿軌道方向的分力不大於阻力，小球不再移動。</>
  } else if (run.outcome === 'limit') {
    note = `${passes ? `小球已通過最高點 ${run.topPasses} 次，` : '小球'}仍在運動，這裡只模擬前 ${TIME_LIMIT} 秒。`
  }
  return note ? <p className="circle-run-note">{note}</p> : null
}
