import { useState, type ReactNode } from 'react'
import MathText from './MathText'
import { Cart, CartGhost, ChartFrame, ChartHeading, COLOR_A, COLOR_TOTAL, LabSlider, Legend, LegendItem, Ruler, Sym, type ChartMargin, type OpenHelp } from './MomentumShared'
import { clamp, formatValue, linearScale, niceTicks, snap, tracePath } from './momentumChartUtils'
import { horizontalDrag, prefersReducedMotion, useElementWidth, useWrappingPosition } from './momentumHooks'
import { CART_WIDTH, TRACK_LENGTH } from './momentumPhysics'

const MASS_RANGE = { min: 1, max: 4, step: 0.5 }
const SPEED_LIMIT = 4
const SPEED_STEP = 0.1
const DEFAULT_STATE = { mass: 2, speed: 2 }
const STAGE_HEIGHT = 142
const RAIL_Y = 110
const SIDE_PADDING = 14
const STROBE_INTERVAL = 0.3
const STROBE_COUNT = 4
const MOMENTUM_LIMIT = 17
const MOMENTUM_TICKS = [-16, -8, 0, 8, 16]
const ENERGY_LIMIT = 34
const ENERGY_TICKS = [0, 8, 16, 24, 32]
const CHART_HEIGHT = 300
const CHART_MARGIN: ChartMargin = { left: 50, right: 14, top: 12, bottom: 42 }
const CURVE_SAMPLES = 120

type CartState = { mass: number; speed: number }
type Scale = (value: number) => number

function wrap(position: number) {
  return ((position % TRACK_LENGTH) + TRACK_LENGTH) % TRACK_LENGTH
}

function BasicsStage({ mass, speed, running, active }: CartState & { running: boolean; active: boolean }) {
  const [stageRef, width] = useElementWidth<HTMLDivElement>(720)
  const position = useWrappingPosition(TRACK_LENGTH / 4, speed, TRACK_LENGTH, running && active)
  const scale = (width - 2 * SIDE_PADDING) / TRACK_LENGTH
  const xFor = (meters: number) => SIDE_PADDING + meters * scale
  const cartWidth = CART_WIDTH * scale
  const ticks = Array.from({ length: TRACK_LENGTH / 2 + 1 }, (_, index) => index * 2)
  const minorTicks = Array.from({ length: TRACK_LENGTH + 1 }, (_, index) => index)
  const strobes = speed === 0 ? [] : Array.from({ length: STROBE_COUNT }, (_, index) => ({
    x: wrap(position - speed * (index + 1) * STROBE_INTERVAL),
    opacity: 0.55 - index * 0.12,
  }))

  return (
    <div className="momentum-stage" ref={stageRef}>
      <svg width="100%" height={STAGE_HEIGHT} role="img" aria-label={`質量 ${mass} 公斤的滑車以 ${formatValue(speed)} 公尺每秒運動`}>
        <Ruler xFor={xFor} ticks={ticks} minorTicks={minorTicks} y={RAIL_Y} width={width} />
        {strobes.map((strobe, index) => <CartGhost key={index} x={xFor(strobe.x)} railY={RAIL_Y} width={cartWidth} color={COLOR_A} opacity={strobe.opacity} />)}
        {[position, position - TRACK_LENGTH, position + TRACK_LENGTH].map((copy) => <Cart key={copy === position ? 'main' : copy < position ? 'before' : 'after'} x={xFor(copy)} railY={RAIL_Y} width={cartWidth} mass={mass} color={COLOR_A} />)}
      </svg>
    </div>
  )
}

type SpeedPlotProps = {
  ariaLabel: string
  yDomain: [number, number]
  yTicks: number[]
  yLabel: ReactNode
  onSpeedChange: (speed: number) => void
  children: (xFor: Scale, yFor: Scale) => ReactNode
}

function SpeedPlot({ ariaLabel, yDomain, yTicks, yLabel, onSpeedChange, children }: SpeedPlotProps) {
  const [containerRef, width] = useElementWidth<HTMLDivElement>(340)
  const margin = CHART_MARGIN
  const right = width - margin.right
  const bottom = CHART_HEIGHT - margin.bottom
  const xFor = linearScale(-SPEED_LIMIT, SPEED_LIMIT, margin.left, right)
  const yFor = linearScale(yDomain[0], yDomain[1], bottom, margin.top)
  const speedAt = linearScale(margin.left, right, -SPEED_LIMIT, SPEED_LIMIT)

  return (
    <div ref={containerRef} className="momentum-chart-box">
      <svg width="100%" height={CHART_HEIGHT} role="img" aria-label={ariaLabel}>
        <ChartFrame width={width} height={CHART_HEIGHT} margin={margin} xFor={xFor} yFor={yFor} xTicks={niceTicks(-SPEED_LIMIT, SPEED_LIMIT, width < 300 ? 4 : 8)} yTicks={yTicks} xLabel={<>速度 <Sym>v</Sym>（m/s）</>} yLabel={yLabel} />
        {children(xFor, yFor)}
        <rect className="momentum-drag" x={margin.left} y={margin.top} width={Math.max(0, right - margin.left)} height={bottom - margin.top} fill="transparent" {...horizontalDrag((x) => onSpeedChange(clamp(snap(speedAt(x), SPEED_STEP), -SPEED_LIMIT, SPEED_LIMIT)))} />
      </svg>
    </div>
  )
}

function Dot({ x, y }: { x: number; y: number }) {
  return <circle cx={x} cy={y} r={7} fill={COLOR_TOTAL} stroke="var(--lab-surface)" strokeWidth={2} />
}

// Grid lines that cut the triangle into copies of the triangle at 1 m/s, so the count grows as v².
function triangleSubdivision(mass: number, speed: number) {
  const direction = Math.sign(speed)
  return Array.from({ length: Math.max(0, Math.ceil(Math.abs(speed)) - 1) }, (_, index) => {
    const step = direction * (index + 1)
    return [
      [[step, 0], [step, mass * step]],
      [[step, mass * step], [speed, mass * step]],
      [[step, 0], [speed, mass * (speed - step)]],
    ] as [number, number][][]
  }).flat()
}

function MomentumMarks({ mass, speed, base, xFor, yFor }: CartState & { base: CartState; xFor: Scale; yFor: Scale }) {
  const trianglePath = (state: CartState) => tracePath([[0, 0], [state.speed, 0], [state.speed, state.mass * state.speed]], xFor, yFor) + 'Z'
  const lineAcross = (slope: number) => tracePath([[-SPEED_LIMIT, -slope * SPEED_LIMIT], [SPEED_LIMIT, slope * SPEED_LIMIT]], xFor, yFor)
  return (
    <g>
      <path d={lineAcross(base.mass)} fill="none" stroke="var(--lab-axis)" strokeWidth={1.5} strokeDasharray="5 5" />
      <path d={trianglePath(base)} fill="none" stroke="var(--lab-axis)" strokeWidth={1.5} strokeDasharray="5 5" />
      <path d={trianglePath({ mass, speed })} fill={COLOR_TOTAL} fillOpacity={0.2} />
      {triangleSubdivision(mass, speed).map((segment, index) => <path key={index} d={tracePath(segment, xFor, yFor)} fill="none" stroke={COLOR_TOTAL} strokeOpacity={0.45} />)}
      <path d={lineAcross(mass)} fill="none" stroke={COLOR_TOTAL} strokeWidth={2} />
      <line x1={xFor(speed)} x2={xFor(speed)} y1={yFor(0)} y2={yFor(mass * speed)} stroke={COLOR_TOTAL} strokeWidth={4} />
      <Dot x={xFor(speed)} y={yFor(mass * speed)} />
    </g>
  )
}

function energyCurve(mass: number): [number, number][] {
  return Array.from({ length: CURVE_SAMPLES + 1 }, (_, index) => {
    const speed = -SPEED_LIMIT + (2 * SPEED_LIMIT * index) / CURVE_SAMPLES
    return [speed, 0.5 * mass * speed ** 2]
  })
}

function EnergyMarks({ mass, speed, base, xFor, yFor }: CartState & { base: CartState; xFor: Scale; yFor: Scale }) {
  const energy = 0.5 * mass * speed ** 2
  return (
    <g>
      <path d={tracePath(energyCurve(base.mass), xFor, yFor)} fill="none" stroke="var(--lab-axis)" strokeWidth={1.5} strokeDasharray="5 5" />
      <circle cx={xFor(base.speed)} cy={yFor(0.5 * base.mass * base.speed ** 2)} r={4} fill="var(--lab-surface)" stroke="var(--lab-axis)" strokeWidth={1.5} />
      <path d={tracePath(energyCurve(mass), xFor, yFor)} fill="none" stroke={COLOR_TOTAL} strokeWidth={2} />
      <line x1={xFor(speed)} x2={xFor(speed)} y1={yFor(0)} y2={yFor(energy)} stroke={COLOR_TOTAL} strokeWidth={4} />
      <Dot x={xFor(speed)} y={yFor(energy)} />
    </g>
  )
}

function MomentumBasics({ active, onHelp }: { active: boolean; onHelp: OpenHelp }) {
  const [state, setState] = useState<CartState>(DEFAULT_STATE)
  const [base, setBase] = useState<CartState>(DEFAULT_STATE)
  const [running, setRunning] = useState(() => !prefersReducedMotion())
  const { mass, speed } = state
  const momentum = mass * speed
  const energy = 0.5 * mass * speed ** 2
  const momentumRatio = momentum / (base.mass * base.speed)
  const energyRatio = energy / (0.5 * base.mass * base.speed ** 2)

  const changeSpeed = (next: number) => setState((current) => ({ ...current, speed: next }))
  const reset = () => {
    setState(DEFAULT_STATE)
    setBase(DEFAULT_STATE)
  }

  return (
    <>
      <aside className="lab-panel">
        <h2>滑車設定</h2>
        <LabSlider label={<>質量 <MathText tex="m" /></>} {...MASS_RANGE} unit="kg" value={mass} onChange={(next) => setState((current) => ({ ...current, mass: next }))} />
        <LabSlider label={<>速度 <MathText tex="v" /></>} min={-SPEED_LIMIT} max={SPEED_LIMIT} step={SPEED_STEP} unit="m/s" value={speed} onChange={changeSpeed} />
        <div className="momentum-button-row">
          <button className="lab-secondary" disabled={speed === 0} onClick={() => setBase(state)}>設為比較基準</button>
          <button className="lab-secondary" onClick={reset}>重設</button>
        </div>
        <p className="lab-note">拖曳圖上的點，把速度變成 2 倍，看動量和動能各變成幾倍；再試試把質量變成 2 倍。</p>
      </aside>
      <section className="lab-plots">
        <div className="lab-chart momentum-stage-card">
          <ChartHeading title="滑車運動"><button className="lab-secondary momentum-small-button" onClick={() => setRunning((current) => !current)}>{running ? '暫停' : '繼續'}</button></ChartHeading>
          <BasicsStage mass={mass} speed={speed} running={running} active={active} />
          <div className="lab-metrics momentum-metrics">
            <div><span>動量 <MathText tex="p" /></span><b>{formatValue(momentum)} kg·m/s</b><small>基準的 {formatValue(momentumRatio, 2)} 倍</small></div>
            <div><span>動能 <MathText tex="K" /></span><b>{formatValue(energy)} J</b><small>基準的 {formatValue(energyRatio, 2)} 倍</small></div>
          </div>
        </div>
        <div className="momentum-chart-pair">
          <div className="lab-chart">
            <ChartHeading title="動量－速度圖" help="momentumSpeed" onHelp={onHelp} />
            <SpeedPlot ariaLabel="動量與速度的關係圖，三角形面積為動能" yDomain={[-MOMENTUM_LIMIT, MOMENTUM_LIMIT]} yTicks={MOMENTUM_TICKS} yLabel={<>動量 <Sym>p</Sym>（kg·m/s）</>} onSpeedChange={changeSpeed}>
              {(xFor, yFor) => <MomentumMarks mass={mass} speed={speed} base={base} xFor={xFor} yFor={yFor} />}
            </SpeedPlot>
            <Legend>
              <LegendItem color={COLOR_TOTAL} kind="line">高度：動量 <MathText tex="p" /></LegendItem>
              <LegendItem color={COLOR_TOTAL}>面積：動能 <MathText tex="K" /></LegendItem>
              <LegendItem color="var(--lab-axis)" kind="dashed">比較基準</LegendItem>
            </Legend>
          </div>
          <div className="lab-chart">
            <ChartHeading title="動能－速度圖" help="energySpeed" onHelp={onHelp} />
            <SpeedPlot ariaLabel="動能與速度的關係圖" yDomain={[0, ENERGY_LIMIT]} yTicks={ENERGY_TICKS} yLabel={<>動能 <Sym>K</Sym>（J）</>} onSpeedChange={changeSpeed}>
              {(xFor, yFor) => <EnergyMarks mass={mass} speed={speed} base={base} xFor={xFor} yFor={yFor} />}
            </SpeedPlot>
            <Legend>
              <LegendItem color={COLOR_TOTAL} kind="line">目前質量</LegendItem>
              <LegendItem color="var(--lab-axis)" kind="dashed">比較基準</LegendItem>
            </Legend>
          </div>
        </div>
      </section>
    </>
  )
}

export default MomentumBasics
