import { useEffect, type ReactNode } from 'react'
import { formatValue } from './chartUtils'
import { ChartHeading, Legend, LegendItem, Sym, VectorArrow } from './LabShared'
import { COLOR_FORCE, COLOR_RESISTANCE, COLOR_WEIGHT, type CircleHelpTopic, type OpenHelp } from './VerticalCircleShared'
import type { MotionFrame } from './verticalCirclePhysics'
import { forceVectors, scaleBar, type Observer, type StageOptions, type Vector } from './verticalCircleView'

// Drawn like forces without being forces acting on the ball: the required centripetal force and the fictitious force.
const COLOR_APPARENT = 'var(--circle-apparent)'
const RATE_OPTIONS = [0.1, 0.25, 0.5, 1].map((rate) => ({ value: rate, label: `${rate} 倍` }))
const OBSERVER_OPTIONS: { value: Observer; label: string }[] = [{ value: 'ground', label: '地面（慣性坐標）' }, { value: 'ball', label: '小球（非慣性坐標）' }]
const FORCE_WIDTH = 2.8
const COMPONENT_WIDTH = 1.8
const APPARENT_DASH = '5 3'
// Sideways offsets, in pixels, that keep arrows along the same radial line apart.
const SUM_LANE = 7
const CENTRIPETAL_LANE = 9
const CONNECTOR_OVERHANG = 4

type Point = { x: number; y: number }

type StageCardProps = {
  title: string
  help: CircleHelpTopic
  onHelp: OpenHelp
  chip: string
  options: StageOptions
  onOptionsChange: (change: Partial<StageOptions>) => void
  children: ReactNode
}

// The animation card. Enlarged, it covers the window until the button or the Escape key puts it back.
export function StageCard({ title, help, onHelp, chip, options, onOptionsChange, children }: StageCardProps) {
  const { enlarged, closeUp } = options

  useEffect(() => {
    if (!enlarged) return
    const pageOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOptionsChange({ enlarged: false })
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = pageOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [enlarged, onOptionsChange])

  return (
    <div className={`lab-chart lab-stage-card${enlarged ? ' circle-enlarged' : ''}`}>
      <ChartHeading title={title} help={help} onHelp={onHelp}>
        <span className="lab-chip">{chip}</span>
        {enlarged && <button className="lab-secondary lab-small-button" aria-pressed={closeUp} onClick={() => onOptionsChange({ closeUp: !closeUp })}>{closeUp ? '拉遠' : '拉近'}</button>}
        <button className="lab-secondary lab-small-button" onClick={() => onOptionsChange({ enlarged: !enlarged })}>{enlarged ? '縮小' : '放大'}</button>
      </ChartHeading>
      {children}
    </div>
  )
}

type ToolbarChoiceProps<T extends string | number> = {
  label: string
  help?: ReactNode
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}

function ToolbarChoice<T extends string | number>({ label, help, options, value, onChange }: ToolbarChoiceProps<T>) {
  return (
    <div className="circle-toolbar-group">
      <span className="circle-toolbar-label">{label}{help}</span>
      <div className="lab-segmented circle-toolbar-choice" role="group" aria-label={label}>
        {options.map((option) => <button key={option.value} aria-pressed={option.value === value} onClick={() => onChange(option.value)}>{option.label}</button>)}
      </div>
    </div>
  )
}

function ToolbarCheck({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="circle-check"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{label}</label>
}

type StageToolbarProps = {
  options: StageOptions
  onOptionsChange: (change: Partial<StageOptions>) => void
  rate: number
  onRateChange: (rate: number) => void
  onHelp: OpenHelp
}

// Lives inside the animation card so that it stays within reach when the card is enlarged.
export function StageToolbar({ options, onOptionsChange, rate, onRateChange, onHelp }: StageToolbarProps) {
  const helpButton = (topic: CircleHelpTopic, name: string) => <button className="lab-help-button lab-help-small" onClick={() => onHelp(topic)} aria-label={`開啟${name}說明`}>?</button>
  return (
    <div className="circle-toolbar">
      <ToolbarChoice label="坐標系" help={helpButton('observer', '坐標系')} options={OBSERVER_OPTIONS} value={options.observer} onChange={(observer) => onOptionsChange({ observer })} />
      <ToolbarChoice label="播放速度" options={RATE_OPTIONS} value={rate} onChange={onRateChange} />
      <div className="circle-toolbar-group">
        <span className="circle-toolbar-label">向量{helpButton('vectors', '向量')}</span>
        <ToolbarCheck label="徑向與切向分量" checked={options.components} onChange={(components) => onOptionsChange({ components })} />
        {options.observer === 'ground' && <ToolbarCheck label="向心力" checked={options.centripetal} onChange={(centripetal) => onOptionsChange({ centripetal })} />}
        <ToolbarCheck label="實際力的徑向合力" checked={options.radialSum} onChange={(radialSum) => onOptionsChange({ radialSum })} />
      </div>
    </div>
  )
}

type DecompositionProps = {
  origin: Point
  // Pixel offsets from the origin.
  total: Point
  radial: Point
  tangential: Point
  color: string
  dash?: string
  radialLabel?: ReactNode
}

// The two components of a vector, with dashed lines completing the rectangle that has the vector as its diagonal.
function Decomposition({ origin, total, radial, tangential, color, dash, radialLabel }: DecompositionProps) {
  const corner = (offset: Point) => `${origin.x + offset.x} ${origin.y + offset.y}`
  return (
    <g>
      <path d={`M${corner(radial)}L${corner(total)}L${corner(tangential)}`} fill="none" stroke={color} strokeDasharray="3 3" strokeOpacity={0.8} />
      <VectorArrow x={origin.x} y={origin.y} dx={radial.x} dy={radial.y} color={color} width={COMPONENT_WIDTH} dash={dash} label={radialLabel} />
      <VectorArrow x={origin.x} y={origin.y} dx={tangential.x} dy={tangential.y} color={color} width={COMPONENT_WIDTH} dash={dash} />
    </g>
  )
}

type ForceDiagramProps = {
  frame: MotionFrame
  // Centre of the ball in SVG pixels.
  x: number
  y: number
  ballRadius: number
  mass: number
  // Pixels per newton and per m/s.
  forceScale: number
  velocityScale: number
  forceSymbol: string
  options: StageOptions
  // Moves the velocity arrow sideways, in pixels toward the centre of curvature, clear of the forces along the tangent.
  velocityShift: number
}

// Every force arrow starts at the centre of the ball and uses the same scale, so lengths compare directly.
export function ForceDiagram({ frame, x, y, ballRadius, mass, forceScale, velocityScale, forceSymbol, options, velocityShift }: ForceDiagramProps) {
  const forces = forceVectors(frame, mass)
  const pixels = (vector: Vector): Point => ({ x: vector.x * forceScale, y: -vector.y * forceScale })
  const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y })
  const origin = { x, y }
  // Screen directions: `inward` points at the centre of curvature and `lane` steps sideways from it.
  const inward = { x: forces.inward.x, y: -forces.inward.y }
  const lane = (point: Point, offset: number): Point => ({ x: point.x - inward.y * offset, y: point.y + inward.x * offset })
  const fromBall = options.observer === 'ball'
  const showComponents = options.components && forces.onPath
  const showSum = options.radialSum && forces.onPath
  const showCentripetal = options.centripetal && forces.onPath && !fromBall

  const constraint = pixels(forces.constraint)
  const weight = pixels(forces.weight)
  const resistance = pixels(forces.resistance)
  const weightRadial = pixels(forces.weightRadial)
  const centripetal = pixels(forces.centripetal)
  const fictitious = pixels(forces.fictitious)
  const fictitiousRadial = pixels(forces.fictitiousRadial)
  // Head to tail: the constraint force, then the radial part of the weight. Their sum ends level with the tip of the
  // centripetal arrow; for the observer on the ball the centrifugal force then leads back to the ball.
  const constraintTip = add(origin, constraint)
  const sumEnd = add(constraintTip, weightRadial)
  const sumStart = lane(constraintTip, SUM_LANE)
  const closingStart = lane(sumEnd, 2 * SUM_LANE)
  const centripetalStart = lane(origin, -CENTRIPETAL_LANE)
  const connector = fromBall
    ? [lane(sumEnd, SUM_LANE - CONNECTOR_OVERHANG), lane(sumEnd, 2 * SUM_LANE + CONNECTOR_OVERHANG)]
    : [lane(sumEnd, -CENTRIPETAL_LANE - CONNECTOR_OVERHANG), lane(sumEnd, SUM_LANE + CONNECTOR_OVERHANG)]

  return (
    <g>
      {showComponents && <Decomposition origin={origin} total={weight} radial={weightRadial} tangential={pixels(forces.weightTangential)} color={COLOR_WEIGHT} />}
      {showComponents && fromBall && <Decomposition origin={origin} total={fictitious} radial={fictitiousRadial} tangential={pixels(forces.fictitiousTangential)} color={COLOR_APPARENT} dash={APPARENT_DASH} radialLabel={<tspan fontSize="11">離心力</tspan>} />}
      <VectorArrow x={x} y={y} dx={constraint.x} dy={constraint.y} color={COLOR_FORCE} width={FORCE_WIDTH} label={<Sym>{forceSymbol}</Sym>} labelShift={-10} />
      <VectorArrow x={x} y={y} dx={weight.x} dy={weight.y} color={COLOR_WEIGHT} width={FORCE_WIDTH} label={<Sym>mg</Sym>} labelShift={12} />
      <VectorArrow x={x} y={y} dx={resistance.x} dy={resistance.y} color={COLOR_RESISTANCE} width={FORCE_WIDTH} label={<Sym>f</Sym>} labelShift={-10} />
      {fromBall && <VectorArrow x={x} y={y} dx={fictitious.x} dy={fictitious.y} color={COLOR_APPARENT} width={FORCE_WIDTH} dash={APPARENT_DASH} label={showComponents ? undefined : <tspan fontSize="11">假想力</tspan>} />}
      {showSum && <VectorArrow x={sumStart.x} y={sumStart.y} dx={weightRadial.x} dy={weightRadial.y} color={COLOR_WEIGHT} width={COMPONENT_WIDTH} />}
      {showSum && fromBall && <VectorArrow x={closingStart.x} y={closingStart.y} dx={fictitiousRadial.x} dy={fictitiousRadial.y} color={COLOR_APPARENT} width={COMPONENT_WIDTH} dash={APPARENT_DASH} />}
      {showCentripetal && <VectorArrow x={centripetalStart.x} y={centripetalStart.y} dx={centripetal.x} dy={centripetal.y} color={COLOR_APPARENT} width={FORCE_WIDTH} dash={APPARENT_DASH} label={<><Sym>F</Sym><tspan fontSize="9" dy="3">c</tspan></>} labelShift={12} />}
      {showSum && (fromBall || showCentripetal) && <line x1={connector[0].x} y1={connector[0].y} x2={connector[1].x} y2={connector[1].y} stroke="var(--lab-muted)" strokeDasharray="2 2" />}
      {!fromBall && <VectorArrow x={x + inward.x * velocityShift} y={y + inward.y * velocityShift} dx={frame.vx * velocityScale} dy={-frame.vy * velocityScale} color="var(--lab-text)" width={2} label={<Sym>v</Sym>} gap={ballRadius} />}
    </g>
  )
}

function ScaleBar({ name, pixelsPerUnit, unit }: { name: string; pixelsPerUnit: number; unit: string }) {
  const bar = scaleBar(pixelsPerUnit)
  return <span className="circle-scale">{name}<i style={{ width: bar.pixels }} />{bar.value} {unit}</span>
}

type VectorLegendProps = {
  frame: MotionFrame
  mass: number
  forceScale: number
  velocityScale: number
  options: StageOptions
}

// The scales of the arrows on the animation, and the size of each quantity that has no readout of its own.
export function VectorLegend({ frame, mass, forceScale, velocityScale, options }: VectorLegendProps) {
  const forces = forceVectors(frame, mass)
  const size = (vector: Vector) => formatValue(Math.hypot(vector.x, vector.y))
  const fromBall = options.observer === 'ball'
  const showComponents = options.components && forces.onPath
  const hasResistance = Math.hypot(forces.resistance.x, forces.resistance.y) > 0
  return (
    <Legend>
      <span className="circle-scale-group">
        比例尺
        <ScaleBar name="力" pixelsPerUnit={forceScale} unit="N" />
        {!fromBall && <ScaleBar name="速度" pixelsPerUnit={velocityScale} unit="m/s" />}
      </span>
      <LegendItem color={COLOR_WEIGHT} kind="line">重力 <b>{size(forces.weight)}</b> N</LegendItem>
      {showComponents && <LegendItem color={COLOR_WEIGHT} kind="line">重力的徑向分量 <b>{size(forces.weightRadial)}</b> N</LegendItem>}
      {showComponents && <LegendItem color={COLOR_WEIGHT} kind="line">重力的切向分量 <b>{size(forces.weightTangential)}</b> N</LegendItem>}
      {hasResistance && <LegendItem color={COLOR_RESISTANCE} kind="line">阻力 <b>{size(forces.resistance)}</b> N</LegendItem>}
      {!fromBall && options.centripetal && forces.onPath && <LegendItem color={COLOR_APPARENT} kind="dashed">向心力 <b>{size(forces.centripetal)}</b> N</LegendItem>}
      {fromBall && <LegendItem color={COLOR_APPARENT} kind="dashed">假想力 <b>{size(forces.fictitious)}</b> N</LegendItem>}
      {fromBall && showComponents && <LegendItem color={COLOR_APPARENT} kind="dashed">離心力 <b>{size(forces.fictitiousRadial)}</b> N</LegendItem>}
    </Legend>
  )
}
