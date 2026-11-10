import { useMemo, useState, type ReactNode } from 'react'
import MathText from './MathText'
import { Arrow, Cart, ChartHeading, COLOR_A, COLOR_B, COLOR_TOTAL, CART_BODY_CENTER, LabSlider, Ruler, Sym, TimelineBar, type OpenHelp } from './MomentumShared'
import { formatTick, formatValue, linearScale, niceCeil, zeroBasedTicks } from './momentumChartUtils'
import { useElementWidth, useTimeline } from './momentumHooks'
import { solvePush, type PushFrame, type PushMode, type PushRun } from './momentumPhysics'

const MASS_RANGE = { min: 1, max: 6, step: 0.5 }
const FORCE_RANGE = { min: 2, max: 10, step: 1 }
const TIME_RANGE = { min: 1, max: 4, step: 0.5 }
const DISPLACEMENT_RANGE = { min: 2, max: 12, step: 1 }
const DEFAULT_SETTINGS = { massA: 1, massB: 3, force: 6, mode: 'time' as PushMode, time: 2, displacement: 6 }
const STAGE_HEIGHT = 226
const LANE_Y = [94, 194]
const STAGE_LEFT = 74
const STAGE_RIGHT = 18
const MAX_CART_WIDTH = 72
const ARROW_PER_NEWTON = 3.4
const FARTHEST_POSITION_RATIO = 0.86
const AREA_ROW_HEIGHT = 74
const AREA_ROW_GAP = 12
const AREA_TOP = 6
const AREA_BOTTOM = 40
const AREA_LEFT = 44
const AREA_RIGHT = 12
const AREA_FORCE_AXIS = 12
const AREA_LABEL_WIDTH = 142
const SAME_VALUE_TOLERANCE = 1e-6

type PushSettings = typeof DEFAULT_SETTINGS

function PushStage({ settings, run, time }: { settings: PushSettings; run: PushRun; time: number }) {
  const [stageRef, width] = useElementWidth<HTMLDivElement>(720)
  const { force, mode, displacement } = settings
  // The lighter cart keeps coasting after the force stops, so the view has to reach its last position.
  const trackLength = niceCeil(Math.max(run.cartA.frameAt(run.endTime).position, run.cartB.frameAt(run.endTime).position) / FARTHEST_POSITION_RATIO)
  const xFor = linearScale(0, trackLength, STAGE_LEFT, width - STAGE_RIGHT)
  const cartWidth = Math.min(MAX_CART_WIDTH, width * 0.16)
  const ticks = zeroBasedTicks(trackLength, width < 460 ? 4 : 8)
  const lanes = [
    { key: 'A', name: 'A', mass: settings.massA, color: COLOR_A, frame: run.cartA.frameAt(time), y: LANE_Y[0], labelled: false },
    { key: 'B', name: 'B', mass: settings.massB, color: COLOR_B, frame: run.cartB.frameAt(time), y: LANE_Y[1], labelled: true },
  ]

  return (
    <div className="momentum-stage" ref={stageRef}>
      <svg width="100%" height={STAGE_HEIGHT} role="img" aria-label="兩台滑車受相同的力由靜止加速">
        <line x1={xFor(0)} x2={xFor(0)} y1={12} y2={LANE_Y[1]} stroke="var(--lab-grid)" strokeWidth={1.5} />
        {mode === 'displacement' && (
          <g>
            <line x1={xFor(displacement)} x2={xFor(displacement)} y1={22} y2={LANE_Y[1]} stroke={COLOR_TOTAL} strokeWidth={1.5} strokeDasharray="6 5" />
            <text x={xFor(displacement)} y={15} textAnchor="middle" fontSize="11.5" fill="var(--lab-muted)">力在此停止</text>
          </g>
        )}
        {lanes.map((lane) => {
          const x = xFor(lane.frame.position)
          const tail = x - cartWidth / 2
          const arrowLength = force * ARROW_PER_NEWTON
          const arrowY = lane.y - CART_BODY_CENTER
          return (
            <g key={lane.key}>
              <Ruler xFor={xFor} ticks={ticks} y={lane.y} labelled={lane.labelled} width={width} />
              <Cart x={x} railY={lane.y} width={cartWidth} mass={lane.mass} color={lane.color} name={lane.name} />
              {lane.frame.pushing && (
                <g>
                  <Arrow from={tail - arrowLength - 1} to={tail - 1} y={arrowY} color={COLOR_TOTAL} thickness={4} />
                  <text x={tail - arrowLength / 2} y={arrowY - 11} textAnchor="middle" fontSize="11" fill="var(--lab-muted)">{force} N</text>
                </g>
              )}
              <text x={width - STAGE_RIGHT} y={lane.y - 72} textAnchor="end" fontSize="12.5" fill="var(--lab-text)">{lane.name} 車速度 {formatValue(lane.frame.velocity)} m/s</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

type AreaRow = {
  key: string
  name: string
  color: string
  extent: number
  areaText: ReactNode
}

type ForceAreaChartProps = {
  ariaLabel: string
  xMax: number
  xLabel: ReactNode
  force: number
  rows: AreaRow[]
  playhead?: number
}

function ForceAreaChart({ ariaLabel, xMax, xLabel, force, rows, playhead }: ForceAreaChartProps) {
  const [containerRef, width] = useElementWidth<HTMLDivElement>(340)
  const right = width - AREA_RIGHT
  const xFor = linearScale(0, xMax, AREA_LEFT, right)
  const rowsBottom = AREA_TOP + rows.length * AREA_ROW_HEIGHT + (rows.length - 1) * AREA_ROW_GAP
  const height = rowsBottom + AREA_BOTTOM
  const ticks = zeroBasedTicks(xMax, width < 300 ? 3 : 5)
  const barHeight = (force / AREA_FORCE_AXIS) * AREA_ROW_HEIGHT

  return (
    <div ref={containerRef} className="momentum-chart-box">
      <svg width="100%" height={height} role="img" aria-label={ariaLabel}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={xFor(tick)} x2={xFor(tick)} y1={AREA_TOP} y2={rowsBottom} stroke="var(--lab-grid)" />
            <text x={xFor(tick)} y={rowsBottom + 15} textAnchor="middle" fontSize="11" fill="var(--lab-muted)">{formatTick(tick)}</text>
          </g>
        ))}
        {rows.map((row, index) => {
          const baseline = AREA_TOP + (index + 1) * AREA_ROW_HEIGHT + index * AREA_ROW_GAP
          const barWidth = Math.max(0, xFor(row.extent) - AREA_LEFT)
          const fits = barWidth >= AREA_LABEL_WIDTH
          return (
            <g key={row.key}>
              <line x1={AREA_LEFT} x2={right} y1={baseline} y2={baseline} stroke="var(--lab-axis)" />
              <text x={AREA_LEFT - 8} y={baseline - AREA_ROW_HEIGHT / 2 + 4} textAnchor="end" fontSize="12" fill="var(--lab-text)">{row.name}</text>
              <rect x={AREA_LEFT} y={baseline - barHeight} width={barWidth} height={barHeight} fill={row.color} fillOpacity={0.24} />
              {barWidth > 0 && <line x1={AREA_LEFT} x2={AREA_LEFT + barWidth} y1={baseline - barHeight} y2={baseline - barHeight} stroke={row.color} strokeWidth={2} />}
              {barWidth > 0 && <line x1={AREA_LEFT + barWidth} x2={AREA_LEFT + barWidth} y1={baseline - barHeight} y2={baseline} stroke={row.color} strokeWidth={2} />}
              <text x={fits ? AREA_LEFT + 8 : AREA_LEFT + barWidth + 8} y={baseline - barHeight / 2 + 4} fontSize="12" fill="var(--lab-text)">{row.areaText}</text>
            </g>
          )
        })}
        {playhead !== undefined && <line x1={xFor(playhead)} x2={xFor(playhead)} y1={AREA_TOP} y2={rowsBottom} stroke="var(--lab-text)" strokeWidth={1.5} />}
        <text x={(AREA_LEFT + right) / 2} y={height - 6} textAnchor="middle" fontSize="11.5" fill="var(--lab-muted)">{xLabel}</text>
      </svg>
    </div>
  )
}

function compareText(valueA: number, valueB: number, quantity: string) {
  if (Math.abs(valueA - valueB) < SAME_VALUE_TOLERANCE) return `兩車${quantity}相同`
  return `${valueA > valueB ? 'A' : 'B'} 車${quantity}較大`
}

function MomentumPush({ active, onHelp }: { active: boolean; onHelp: OpenHelp }) {
  const [settings, setSettings] = useState<PushSettings>(DEFAULT_SETTINGS)
  const { massA, massB, force, mode, time: timeLimit, displacement } = settings
  const run = useMemo(() => solvePush({ massA, massB, force, mode, limit: mode === 'time' ? timeLimit : displacement }), [displacement, force, massA, massB, mode, timeLimit])
  const timeline = useTimeline(run.endTime, active)
  const time = timeline.position
  const frameA: PushFrame = run.cartA.frameAt(time)
  const frameB: PushFrame = run.cartB.frameAt(time)
  const finished = time >= run.endTime
  const timeAxis = niceCeil(run.endTime)
  const displacementAxis = niceCeil(Math.max(run.cartA.displacement, run.cartB.displacement))

  const update = (change: Partial<PushSettings>) => {
    setSettings((current) => ({ ...current, ...change }))
    timeline.rewind()
  }
  const changeMode = (next: PushMode) => {
    setSettings((current) => ({ ...current, mode: next }))
    timeline.replay()
  }
  const seek = (position: number) => {
    timeline.pause()
    timeline.seek(position)
  }

  const impulseRows: AreaRow[] = [
    { key: 'A', name: 'A 車', color: COLOR_A, extent: frameA.pushTime, areaText: <>Δ<Sym>p</Sym> = {formatValue(frameA.momentum)} kg·m/s</> },
    { key: 'B', name: 'B 車', color: COLOR_B, extent: frameB.pushTime, areaText: <>Δ<Sym>p</Sym> = {formatValue(frameB.momentum)} kg·m/s</> },
  ]
  const workRows: AreaRow[] = [
    { key: 'A', name: 'A 車', color: COLOR_A, extent: frameA.pushDisplacement, areaText: <>Δ<Sym>K</Sym> = {formatValue(frameA.kinetic)} J</> },
    { key: 'B', name: 'B 車', color: COLOR_B, extent: frameB.pushDisplacement, areaText: <>Δ<Sym>K</Sym> = {formatValue(frameB.kinetic)} J</> },
  ]

  return (
    <>
      <aside className="lab-panel">
        <h2>實驗設定</h2>
        <div className="lab-control">
          <span className="momentum-field-label">比較條件</span>
          <div className="momentum-segmented">
            <button aria-pressed={mode === 'time'} onClick={() => changeMode('time')}>相同時間</button>
            <button aria-pressed={mode === 'displacement'} onClick={() => changeMode('displacement')}>相同位移</button>
          </div>
        </div>
        {mode === 'time'
          ? <LabSlider label="作用時間" {...TIME_RANGE} unit="s" value={timeLimit} onChange={(next) => update({ time: next })} />
          : <LabSlider label="作用位移" {...DISPLACEMENT_RANGE} digits={0} unit="m" value={displacement} onChange={(next) => update({ displacement: next })} />}
        <LabSlider label={<>推力 <MathText tex="F" /></>} {...FORCE_RANGE} digits={0} unit="N" value={force} onChange={(next) => update({ force: next })} />
        <LabSlider label="A 車質量" {...MASS_RANGE} unit="kg" value={massA} onChange={(next) => update({ massA: next })} />
        <LabSlider label="B 車質量" {...MASS_RANGE} unit="kg" value={massB} onChange={(next) => update({ massB: next })} />
        <p className="lab-note">兩車都從靜止開始，受到相同的力。按下播放前先猜猜看：誰的動量比較大？誰的動能比較大？</p>
      </aside>
      <section className="lab-plots">
        <div className="lab-chart momentum-stage-card">
          <ChartHeading title="兩車比較" />
          <PushStage settings={settings} run={run} time={time} />
          <TimelineBar position={time} length={run.endTime} playing={timeline.playing} time={time} onToggle={timeline.toggle} onRewind={timeline.rewind} onSeek={seek} />
        </div>
        <div className="momentum-chart-pair">
          <div className="lab-chart">
            <ChartHeading title="力－時間圖" help="impulse" onHelp={onHelp}>{finished && <span className="momentum-chip">{compareText(frameA.momentum, frameB.momentum, '動量')}</span>}</ChartHeading>
            <ForceAreaChart ariaLabel="兩車的力與時間關係，面積為衝量" xMax={timeAxis} xLabel={<>時間 <Sym>t</Sym>（s）</>} force={force} rows={impulseRows} playhead={time} />
          </div>
          <div className="lab-chart">
            <ChartHeading title="力－位移圖" help="work" onHelp={onHelp}>{finished && <span className="momentum-chip">{compareText(frameA.kinetic, frameB.kinetic, '動能')}</span>}</ChartHeading>
            <ForceAreaChart ariaLabel="兩車的力與位移關係，面積為功" xMax={displacementAxis} xLabel={<>位移 <Sym>x</Sym>（m）</>} force={force} rows={workRows} />
          </div>
        </div>
      </section>
    </>
  )
}

export default MomentumPush
