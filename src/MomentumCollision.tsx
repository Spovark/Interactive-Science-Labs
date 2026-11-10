import { useMemo, useState } from 'react'
import MathText from './MathText'
import { Arrow, Cart, CART_BODY_CENTER, ChartHeading, COLOR_A, COLOR_B, COLOR_HEAT, COLOR_SPRING, COLOR_TOTAL, LabSlider, Legend, LegendItem, Ruler, Sym, TimeChart, TimelineBar, type OpenHelp, type TimeSeries } from './MomentumShared'
import { clamp, formatChange, formatValue, linearScale, snap } from './momentumChartUtils'
import { horizontalDrag, useElementWidth, useTimeline } from './momentumHooks'
import { BUMPER_LENGTH, CART_WIDTH, CONTACT_PLAYBACK_SECONDS, playbackLength, playbackToTime, solveCollision, timeToPlayback, TRACK_LENGTH, type CollisionFrame, type CollisionInput, type CollisionRun } from './momentumPhysics'

const MASS_RANGE = { min: 1, max: 6, step: 0.5 }
const VELOCITY_LIMIT = 6
const VELOCITY_STEP = 0.5
const DEFAULT_SETTINGS: CollisionInput = { massA: 3, massB: 2, velocityA: 4, velocityB: -2, restitution: 0.5 }

const PRESETS: Record<string, { label: string; settings: CollisionInput }> = {
  equal: { label: '等質量彈性碰撞', settings: { massA: 2, massB: 2, velocityA: 4, velocityB: 0, restitution: 1 } },
  heavy: { label: '重車撞靜止輕車', settings: { massA: 6, massB: 1, velocityA: 3, velocityB: 0, restitution: 1 } },
  light: { label: '輕車撞靜止重車', settings: { massA: 1, massB: 6, velocityA: 5, velocityB: 0, restitution: 1 } },
  stop: { label: '對撞後一起停下', settings: { massA: 3, massB: 3, velocityA: 4, velocityB: -4, restitution: 0 } },
}

const CUSTOM_PRESET = 'custom'
const STAGE_HEIGHT = 206
const RAIL_Y = 150
const SIDE_PADDING = 14
const ARROW_RATIO = 0.33
const ARROW_Y_A = 60
const ARROW_Y_B = 72
const SPRING_TEETH = 7
const SPRING_AMPLITUDE = 6
const GLOW_FADE_SECONDS = 0.5
const VECTOR_ROW_HEIGHT = 27
const VECTOR_LABEL_WIDTH = 56
const VECTOR_VALUE_WIDTH = 58
const CHART_SAMPLES = 260
const CONTACT_WINDOW_PADDING = 0.3
const VALUE_PADDING = 1.12

function collisionKind(restitution: number) {
  if (restitution === 1) return '彈性碰撞'
  if (restitution === 0) return '完全非彈性碰撞'
  return '非彈性碰撞'
}

function springPath(fromX: number, toX: number, y: number) {
  const span = toX - fromX
  const points = Array.from({ length: SPRING_TEETH - 1 }, (_, index) => `L${fromX + (span * (index + 1)) / SPRING_TEETH} ${y + (index % 2 ? SPRING_AMPLITUDE : -SPRING_AMPLITUDE)}`)
  return `M${fromX} ${y}${points.join('')}L${toX} ${y}`
}

type StageProps = {
  run: CollisionRun
  frame: CollisionFrame
  time: number
  settings: CollisionInput
  editable: boolean
  slowMotion: boolean
  onVelocityChange: (change: Partial<CollisionInput>) => void
}

function VelocityReadout({ color, name, value }: { color: string; name: string; value: number }) {
  return <span className="momentum-readout"><i style={{ background: color }} />{name} <b>{formatValue(value)}</b> m/s</span>
}

function CollisionStage({ run, frame, time, settings, editable, slowMotion, onVelocityChange }: StageProps) {
  const [stageRef, width] = useElementWidth<HTMLDivElement>(720)
  const scale = (width - 2 * SIDE_PADDING) / TRACK_LENGTH
  const xFor = (meters: number) => SIDE_PADDING + meters * scale
  const cartWidth = CART_WIDTH * scale
  const arrowScale = scale * ARROW_RATIO
  const xA = xFor(frame.positionA)
  const xB = xFor(frame.positionB)
  const bumperY = RAIL_Y - CART_BODY_CENTER
  const bumper = (BUMPER_LENGTH - frame.compression / 2) * scale
  const tipA = xA + cartWidth / 2 + bumper
  const tipB = xB - cartWidth / 2 - bumper
  const ticks = Array.from({ length: TRACK_LENGTH / 2 + 1 }, (_, index) => index * 2)
  const minorTicks = Array.from({ length: TRACK_LENGTH + 1 }, (_, index) => index)
  const separated = run.collides ? run.frameAt(run.separateTime) : null
  const heatShare = run.totalEnergy > 0 ? frame.heat / run.totalEnergy : 0
  const hasTouched = run.collides && time >= run.touchTime
  const glowFade = time > run.separateTime ? Math.exp(-(time - run.separateTime) / GLOW_FADE_SECONDS) : 1
  const glowX = time > run.separateTime && separated ? xFor((separated.positionA + separated.positionB) / 2) : (tipA + tipB) / 2
  const velocityFrom = (x: number, cartX: number) => clamp(snap((x - cartX) / arrowScale, VELOCITY_STEP), -VELOCITY_LIMIT, VELOCITY_LIMIT)
  const handles = [
    { key: 'A', x: xA + frame.velocityA * arrowScale, y: ARROW_Y_A, color: COLOR_A, onDrag: (x: number) => onVelocityChange({ velocityA: velocityFrom(x, xA) }) },
    { key: 'B', x: xB + frame.velocityB * arrowScale, y: ARROW_Y_B, color: COLOR_B, onDrag: (x: number) => onVelocityChange({ velocityB: velocityFrom(x, xB) }) },
  ]

  return (
    <div className="momentum-stage" ref={stageRef}>
      <div className="momentum-stage-top">
        <VelocityReadout color={COLOR_A} name="A 車" value={frame.velocityA} />
        {slowMotion && <span className="momentum-chip">慢動作</span>}
        <VelocityReadout color={COLOR_B} name="B 車" value={frame.velocityB} />
      </div>
      <svg width="100%" height={STAGE_HEIGHT} role="img" aria-label="兩台滑車在軌道上碰撞">
        <defs>
          <radialGradient id="momentum-heat-glow">
            <stop offset="0%" stopColor={COLOR_HEAT} stopOpacity={0.85} />
            <stop offset="100%" stopColor={COLOR_HEAT} stopOpacity={0} />
          </radialGradient>
        </defs>
        <Ruler xFor={xFor} ticks={ticks} minorTicks={minorTicks} y={RAIL_Y} width={width} />
        <path d={`M${xFor(frame.centerOfMass)} ${RAIL_Y + 26}l6 10h-12Z`} fill={COLOR_TOTAL} />
        <text x={xFor(frame.centerOfMass) + 11} y={RAIL_Y + 37} fontSize="11" fill="var(--lab-muted)">質心</text>
        <path d={springPath(xA + cartWidth / 2, tipA, bumperY)} fill="none" stroke="var(--lab-axis)" strokeWidth={1.5} />
        <path d={springPath(xB - cartWidth / 2, tipB, bumperY)} fill="none" stroke="var(--lab-axis)" strokeWidth={1.5} />
        <line x1={tipA} x2={tipA} y1={bumperY - 9} y2={bumperY + 9} stroke="var(--lab-axis)" strokeWidth={3} strokeLinecap="round" />
        <line x1={tipB} x2={tipB} y1={bumperY - 9} y2={bumperY + 9} stroke="var(--lab-axis)" strokeWidth={3} strokeLinecap="round" />
        <Cart x={xA} railY={RAIL_Y} width={cartWidth} mass={settings.massA} color={COLOR_A} name="A" />
        <Cart x={xB} railY={RAIL_Y} width={cartWidth} mass={settings.massB} color={COLOR_B} name="B" />
        {hasTouched && heatShare > 0.002 && <circle cx={glowX} cy={bumperY} r={cartWidth * 0.62} fill="url(#momentum-heat-glow)" opacity={Math.min(1, 0.25 + heatShare) * glowFade} />}
        <Arrow from={xA} to={xA + frame.velocityA * arrowScale} y={ARROW_Y_A} color={COLOR_A} />
        <Arrow from={xB} to={xB + frame.velocityB * arrowScale} y={ARROW_Y_B} color={COLOR_B} />
        {editable && handles.map((handle) => (
          <g key={handle.key} className="momentum-drag" {...horizontalDrag(handle.onDrag)}>
            <circle cx={handle.x} cy={handle.y} r={20} fill="transparent" />
            <circle cx={handle.x} cy={handle.y} r={7} fill={handle.color} stroke="var(--lab-surface)" strokeWidth={2} />
          </g>
        ))}
      </svg>
    </div>
  )
}

function MomentumVectors({ frame, domain }: { frame: CollisionFrame; domain: [number, number] }) {
  const [containerRef, width] = useElementWidth<HTMLDivElement>(340)
  const xFor = linearScale(domain[0], domain[1], VECTOR_LABEL_WIDTH, width - VECTOR_VALUE_WIDTH)
  const total = frame.momentumA + frame.momentumB
  const rows = [
    { key: 'A', label: 'A 車', from: 0, to: frame.momentumA, value: frame.momentumA, color: COLOR_A, thickness: 7 },
    { key: 'B', label: 'B 車', from: frame.momentumA, to: total, value: frame.momentumB, color: COLOR_B, thickness: 7 },
    { key: 'total', label: '總動量', from: 0, to: total, value: total, color: COLOR_TOTAL, thickness: 9 },
  ]
  const height = rows.length * VECTOR_ROW_HEIGHT
  const rowY = (index: number) => (index + 0.5) * VECTOR_ROW_HEIGHT

  return (
    <div ref={containerRef} className="momentum-chart-box">
      <svg width="100%" height={height} role="img" aria-label={`A 車動量 ${formatValue(frame.momentumA)}，B 車動量 ${formatValue(frame.momentumB)}，總動量 ${formatValue(total)}`}>
        <line x1={xFor(0)} x2={xFor(0)} y1={0} y2={height} stroke="var(--lab-axis)" />
        <line x1={xFor(frame.momentumA)} x2={xFor(frame.momentumA)} y1={rowY(0)} y2={rowY(1)} stroke="var(--lab-axis)" strokeOpacity={0.6} />
        <line x1={xFor(total)} x2={xFor(total)} y1={rowY(1)} y2={rowY(2)} stroke="var(--lab-axis)" strokeOpacity={0.6} />
        {rows.map((row, index) => (
          <g key={row.key}>
            <text x={0} y={rowY(index) + 4} fontSize="12" fill="var(--lab-text)">{row.label}</text>
            <Arrow from={xFor(row.from)} to={xFor(row.to)} y={rowY(index)} color={row.color} thickness={row.thickness} />
            <text x={width} y={rowY(index) + 4} textAnchor="end" fontSize="12.5" fontWeight="650" fill="var(--lab-text)" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatValue(row.value)}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}

function EnergyBar({ frame, total }: { frame: CollisionFrame; total: number }) {
  const parts = [
    { key: 'A', color: COLOR_A, value: frame.kineticA },
    { key: 'B', color: COLOR_B, value: frame.kineticB },
    { key: 'spring', color: COLOR_SPRING, value: frame.elastic },
    { key: 'heat', color: COLOR_HEAT, value: frame.heat },
  ].filter((part) => total > 0 && part.value / total > 0.001)
  return <div className="momentum-energy-bar" role="presentation">{parts.map((part) => <i key={part.key} style={{ background: part.color, flexGrow: part.value / total }} />)}</div>
}

function sampleWindow(run: CollisionRun): [number, number] {
  if (!run.collides) return [0, run.endTime]
  const padding = (run.separateTime - run.touchTime) * CONTACT_WINDOW_PADDING
  return [Math.max(0, run.touchTime - padding), Math.min(run.endTime, run.separateTime + padding)]
}

function buildSeries(run: CollisionRun, window: [number, number]) {
  const origin = run.collides ? run.touchTime : 0
  const samples = Array.from({ length: CHART_SAMPLES + 1 }, (_, index) => {
    const time = window[0] + ((window[1] - window[0]) * index) / CHART_SAMPLES
    return { x: time - origin, frame: run.frameAt(time) }
  })
  const line = (key: string, color: string, value: (frame: CollisionFrame) => number, width?: number): TimeSeries => ({
    key, color, width, points: samples.map(({ x, frame }) => [x, value(frame)]),
  })
  return {
    momentum: [
      line('A', COLOR_A, (frame) => frame.momentumA),
      line('B', COLOR_B, (frame) => frame.momentumB),
      line('total', COLOR_TOTAL, (frame) => frame.momentumA + frame.momentumB, 3),
    ],
    energy: [
      line('A', COLOR_A, (frame) => frame.kineticA),
      line('B', COLOR_B, (frame) => frame.kineticB),
      line('total', COLOR_TOTAL, (frame) => frame.kineticA + frame.kineticB, 3),
    ],
  }
}

function paddedDomain(series: TimeSeries[], floorAtZero: boolean): [number, number] {
  const values = series.flatMap((line) => line.points.map(([, value]) => value))
  const low = floorAtZero ? 0 : Math.min(0, ...values) * VALUE_PADDING
  const high = Math.max(0, ...values) * VALUE_PADDING
  return high > low ? [low, high] : [-1, 1]
}

function MomentumCollision({ active, onHelp }: { active: boolean; onHelp: OpenHelp }) {
  const [settings, setSettings] = useState<CollisionInput>(DEFAULT_SETTINGS)
  const [preset, setPreset] = useState(CUSTOM_PRESET)
  const run = useMemo(() => solveCollision(settings), [settings])
  const length = playbackLength(run)
  const timeline = useTimeline(length, active)
  const time = playbackToTime(run, timeline.position)
  const frame = run.frameAt(time)
  const before = run.frameAt(0)
  const after = run.frameAt(run.endTime)
  const editable = timeline.position === 0 && !timeline.playing
  const slowMotion = run.collides && timeline.position > run.touchTime && timeline.position < run.touchTime + CONTACT_PLAYBACK_SECONDS

  const chartWindow = useMemo(() => sampleWindow(run), [run])
  const series = useMemo(() => buildSeries(run, chartWindow), [chartWindow, run])
  const momentumDomain = useMemo(() => paddedDomain(series.momentum, false), [series])
  const energyDomain = useMemo(() => paddedDomain(series.energy, true), [series])
  const origin = run.collides ? run.touchTime : 0
  const xDomain: [number, number] = [chartWindow[0] - origin, chartWindow[1] - origin]
  const playhead = time >= chartWindow[0] && time <= chartWindow[1] ? time - origin : null
  const vectorDomain: [number, number] = useMemo(() => {
    const anchors = [0, before.momentumA, after.momentumA, run.totalMomentum]
    const low = Math.min(...anchors)
    const high = Math.max(...anchors)
    const padding = Math.max(0.5, (high - low) * 0.05)
    return [low - padding, high + padding]
  }, [after.momentumA, before.momentumA, run.totalMomentum])

  const update = (change: Partial<CollisionInput>) => {
    setSettings((current) => ({ ...current, ...change }))
    setPreset(CUSTOM_PRESET)
    timeline.rewind()
  }
  const choosePreset = (name: string) => {
    setPreset(name)
    if (name !== CUSTOM_PRESET) {
      setSettings(PRESETS[name].settings)
      timeline.replay()
    }
  }
  const reset = () => {
    setSettings(DEFAULT_SETTINGS)
    setPreset(CUSTOM_PRESET)
    timeline.rewind()
  }
  const seek = (position: number) => {
    timeline.pause()
    timeline.seek(position)
  }

  const noCollisionNote = run.closingSpeed <= 0 ? '兩車沒有互相接近，不會相撞。' : '滑車先抵達軌道盡頭，沒有完成碰撞。'
  const xLabel = run.collides ? <>接觸開始後的時間 <Sym>t</Sym>（s）</> : <>時間 <Sym>t</Sym>（s）</>
  const summaryRows = [
    { key: 'vA', label: 'A 車速度（m/s）', before: before.velocityA, after: after.velocityA },
    { key: 'vB', label: 'B 車速度（m/s）', before: before.velocityB, after: after.velocityB },
    { key: 'p', label: '總動量（kg·m/s）', before: before.momentumA + before.momentumB, after: after.momentumA + after.momentumB },
    { key: 'K', label: '總動能（J）', before: before.kineticA + before.kineticB, after: after.kineticA + after.kineticB },
  ]

  return (
    <>
      <aside className="lab-panel">
        <h2>碰撞設定</h2>
        <div className="lab-control">
          <label htmlFor="collision-preset">範例</label>
          <select id="collision-preset" value={preset} onChange={(event) => choosePreset(event.target.value)}>
            <option value={CUSTOM_PRESET}>自訂</option>
            {Object.entries(PRESETS).map(([name, item]) => <option key={name} value={name}>{item.label}</option>)}
          </select>
        </div>
        <LabSlider label="A 車質量" {...MASS_RANGE} unit="kg" value={settings.massA} onChange={(next) => update({ massA: next })} />
        <LabSlider label="A 車速度" min={-VELOCITY_LIMIT} max={VELOCITY_LIMIT} step={VELOCITY_STEP} unit="m/s" value={settings.velocityA} onChange={(next) => update({ velocityA: next })} />
        <LabSlider label="B 車質量" {...MASS_RANGE} unit="kg" value={settings.massB} onChange={(next) => update({ massB: next })} />
        <LabSlider label="B 車速度" min={-VELOCITY_LIMIT} max={VELOCITY_LIMIT} step={VELOCITY_STEP} unit="m/s" value={settings.velocityB} onChange={(next) => update({ velocityB: next })} />
        <LabSlider label={<>恢復係數 <MathText tex="e" /></>} min={0} max={1} step={0.05} digits={2} value={settings.restitution} onChange={(next) => update({ restitution: next })} />
        <button className="lab-secondary" onClick={reset}>重設</button>
        <p className="lab-note">在起點時，可以直接拖曳滑車上方箭頭的圓點來改變速度。把恢復係數從 1 慢慢調到 0，比較總動量和總動能的變化。</p>
      </aside>
      <section className="lab-plots">
        <div className="lab-chart momentum-stage-card">
          <ChartHeading title="碰撞軌道" help="track" onHelp={onHelp}><span className="momentum-chip">{run.collides ? collisionKind(settings.restitution) : '沒有碰撞'}</span></ChartHeading>
          <CollisionStage run={run} frame={frame} time={time} settings={settings} editable={editable} slowMotion={slowMotion} onVelocityChange={update} />
          <TimelineBar position={timeline.position} length={length} playing={timeline.playing} time={time} onToggle={timeline.toggle} onRewind={timeline.rewind} onSeek={seek} />
        </div>
        <div className="momentum-chart-pair">
          <div className="lab-chart">
            <ChartHeading title="動量" help="collisionMomentum" onHelp={onHelp}><span className="momentum-caption">單位：kg·m/s，向右為正</span></ChartHeading>
            <div className="momentum-readout-block"><MomentumVectors frame={frame} domain={vectorDomain} /></div>
            <TimeChart ariaLabel="碰撞前後兩車動量與總動量隨時間的變化" xLabel={xLabel} yLabel="動量（kg·m/s）" xDomain={xDomain} yDomain={momentumDomain} series={series.momentum} playhead={playhead} onSeek={(value) => seek(timeToPlayback(run, value + origin))} />
          </div>
          <div className="lab-chart">
            <ChartHeading title="動能" help="collisionEnergy" onHelp={onHelp}><span className="momentum-caption">單位：J</span></ChartHeading>
            <div className="momentum-readout-block">
              <EnergyBar frame={frame} total={run.totalEnergy} />
              <Legend>
                <LegendItem color={COLOR_TOTAL} kind="line">總動能 <b>{formatValue(frame.kineticA + frame.kineticB)}</b></LegendItem>
                <LegendItem color={COLOR_A}>A 車 <b>{formatValue(frame.kineticA)}</b></LegendItem>
                <LegendItem color={COLOR_B}>B 車 <b>{formatValue(frame.kineticB)}</b></LegendItem>
                <LegendItem color={COLOR_SPRING}>彈性位能 <b>{formatValue(frame.elastic)}</b></LegendItem>
                <LegendItem color={COLOR_HEAT}>熱能等 <b>{formatValue(frame.heat)}</b></LegendItem>
              </Legend>
            </div>
            <TimeChart ariaLabel="碰撞前後兩車動能與總動能隨時間的變化" xLabel={xLabel} yLabel="動能（J）" xDomain={xDomain} yDomain={energyDomain} series={series.energy} playhead={playhead} onSeek={(value) => seek(timeToPlayback(run, value + origin))} />
          </div>
        </div>
        <div className="lab-chart momentum-summary">
          <ChartHeading title="碰撞前後比較" />
          {run.collides
            ? (
              <table className="momentum-table">
                <thead><tr><th scope="col">物理量</th><th scope="col">碰撞前</th><th scope="col">碰撞後</th><th scope="col">變化</th></tr></thead>
                <tbody>{summaryRows.map((row) => <tr key={row.key}><th scope="row">{row.label}</th><td>{formatValue(row.before)}</td><td>{formatValue(row.after)}</td><td>{formatChange(row.after - row.before)}</td></tr>)}</tbody>
              </table>
            )
            : <p className="momentum-empty">{noCollisionNote}</p>}
        </div>
      </section>
    </>
  )
}

export default MomentumCollision
