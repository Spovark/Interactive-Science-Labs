import { useMemo, useState, type ReactNode } from 'react'
import MathText from './MathText'
import { clamp, formatValue, snap } from './momentumChartUtils'
import { horizontalDrag, useElementWidth } from './momentumHooks'
import { pointerDrag, usePlayback } from './verticalCircleHooks'
import { BallArrows, ChartHeading, COLOR_BALL, COLOR_FORCE, COLOR_POTENTIAL, COLOR_TOTAL, DEFAULT_PLAYBACK_RATE, EnergyChart, EnergyReadout, FlightTrail, ForceChart, Legend, LegendItem, MotionThresholds, PlaybackRate, ResistanceSlider, RunNote, Segmented, Slider, SpeedControl, Sym, TimelineBar, type CircleHelpTopic, type OpenHelp, type SpeedUnit } from './VerticalCircleShared'
import { EXIT_LENGTH, GRAVITY, RAMP_RADIUS, RAMP_TOP, solveTrack, TRACK_RADIUS, type MotionFrame, type MotionRun, type TrackKind, type TrackStart } from './verticalCirclePhysics'
import { activeThreshold, chipLabel, thresholdRows, type SceneKind } from './verticalCircleText'

type TrackSettings = {
  kind: TrackKind
  start: TrackStart
  height: number
  bottomSpeed: number
  topSpeed: number
  mass: number
  resistance: number
}

type View = { left: number; right: number; top: number; bottom: number }

const HEIGHT_RANGE = { min: 0.5, max: 4, step: 0.1 }
const MASS_RANGE = { min: 0.5, max: 2, step: 0.1 }
const BOTTOM_SPEED_RANGE = { min: 1, max: 12, step: 0.1 }
const TOP_SPEED_RANGE = { min: 0.1, max: 4, step: 0.1 }
const DEFAULT_SETTINGS: TrackSettings = { kind: 'inside', start: 'height', height: 3, bottomSpeed: 7.5, topSpeed: 0.5, mass: 1, resistance: 0 }
const KIND_OPTIONS: { value: TrackKind; label: string }[] = [{ value: 'inside', label: '軌道內側' }, { value: 'tube', label: '圓管' }, { value: 'outside', label: '軌道外側' }]
const START_OPTIONS: { value: TrackStart; label: string }[] = [{ value: 'height', label: '從高處釋放' }, { value: 'bottom', label: '從最低點出發' }]
const VIEWS: Record<'height' | 'bottom' | 'outside', View> = {
  height: { left: -4.6, right: EXIT_LENGTH + 0.2, top: 5.1, bottom: -0.45 },
  bottom: { left: -1.75, right: 1.75, top: 3.2, bottom: -0.45 },
  outside: { left: -1.6, right: 2.6, top: 2.4, bottom: -0.45 },
}
const STAGE_MAX_HEIGHT = 360
const BALL_RADIUS = 9
// The track surface is drawn this far from the path of the ball's centre.
const SURFACE_GAP = BALL_RADIUS + 1
const VELOCITY_LENGTH = 0.12
// Longest force arrow as a fraction of the track radius.
const FORCE_LENGTH = 1.1
// On the outside of the circle the weight is the largest force, so a shorter scale keeps it above the ground.
const OUTSIDE_FORCE_LENGTH = 0.5
const ENERGY_LINE_MARGIN = 0.5
const RAMP_SAMPLES = 60
const DEGREES = 180 / Math.PI

const STAGE_HELP: Record<'height' | 'bottom' | 'outside', CircleHelpTopic> = { height: 'trackHeight', bottom: 'trackBottom', outside: 'trackOutside' }
const NOTES: Record<'height' | 'bottom' | 'outside', string> = {
  height: '在起點暫停時，可以沿著斜坡拖曳小球改變釋放高度。試著找出小球剛好能通過迴圈最高點的高度，再換成圓管比較。',
  bottom: '在起點暫停時，可以拖曳速度箭頭的圓點改變最低點的速率。比較軌道內側和圓管，小球要多快才能繞完一圈。',
  outside: '把最高點的速率調到很小，小球大約在 48° 離開軌道；速率越大，離開得越早。',
}
const NEGATIVE_NOTES: Record<TrackKind, string> = {
  inside: '軌道只能把小球往圓心推，正向力不能小於 0',
  tube: '負值：內側管壁把小球往外推',
  outside: '軌道只能把小球往外推，正向力不能小於 0',
}

function layoutOf(settings: TrackSettings) {
  return settings.kind === 'outside' ? 'outside' : settings.start
}

function sceneOf(settings: TrackSettings): SceneKind {
  return settings.kind === 'outside' ? 'outside' : `${settings.kind}-${settings.start}`
}

function largestForce(run: MotionRun, mass: number) {
  const traced = run.forceTrace.flat().map(([, force]) => Math.abs(force))
  return Math.max(mass * GRAVITY, run.resistance, ...traced)
}

type StageProps = {
  run: MotionRun
  frame: MotionFrame
  time: number
  settings: TrackSettings
  editable: boolean
  onChange: (change: Partial<TrackSettings>) => void
}

function TrackStage({ run, frame, time, settings, editable, onChange }: StageProps) {
  const [stageRef, width] = useElementWidth<HTMLDivElement>(560)
  const layout = layoutOf(settings)
  const view = VIEWS[layout]
  const { kind, mass, resistance } = settings
  const viewWidth = view.right - view.left
  const viewHeight = view.top - view.bottom
  const scale = Math.min(width / viewWidth, STAGE_MAX_HEIGHT / viewHeight)
  const height = viewHeight * scale
  const offsetX = (width - viewWidth * scale) / 2
  const toX = (x: number) => offsetX + (x - view.left) * scale
  const toY = (y: number) => (view.top - y) * scale
  const groundY = toY(0)
  const radiusPixels = TRACK_RADIUS * scale
  const place = (state: MotionFrame) => ({ x: toX(state.x), y: toY(state.y) })
  const { x: ballX, y: ballY } = place(frame)
  const forceScale = ((layout === 'outside' ? OUTSIDE_FORCE_LENGTH : FORCE_LENGTH) * radiusPixels) / largestForce(run, mass)
  const velocityScale = VELOCITY_LENGTH * scale
  const energyHeight = (frame.kinetic + frame.potential) / (mass * GRAVITY)
  const startSpeed = kind === 'outside' ? settings.topSpeed : settings.bottomSpeed
  const speedRange = kind === 'outside' ? TOP_SPEED_RANGE : BOTTOM_SPEED_RANGE
  const handle = layout === 'outside' ? { x: toX(0), y: toY(TRACK_RADIUS) } : { x: toX(0), y: groundY }
  const speedFrom = (x: number) => clamp(snap((x - handle.x - BALL_RADIUS) / velocityScale, speedRange.step), speedRange.min, speedRange.max)
  const changeSpeed = (speed: number) => onChange(kind === 'outside' ? { topSpeed: speed } : { bottomSpeed: speed })
  const heightFrom = (x: number, y: number) => {
    const worldX = view.left + (x - offsetX) / scale
    const worldY = view.top - y / scale
    const angle = Math.atan2(-worldX, RAMP_RADIUS - worldY)
    return clamp(snap(RAMP_RADIUS * (1 - Math.cos(Math.max(0, angle))), HEIGHT_RANGE.step), HEIGHT_RANGE.min, HEIGHT_RANGE.max)
  }
  const loopCentreY = toY(TRACK_RADIUS)

  const loopTrack = kind === 'tube'
    ? (
      <g>
        <circle cx={toX(0)} cy={loopCentreY} r={radiusPixels} fill="none" stroke="var(--lab-grid)" strokeWidth={2 * SURFACE_GAP} />
        <circle cx={toX(0)} cy={loopCentreY} r={radiusPixels + SURFACE_GAP} fill="none" stroke="var(--lab-axis)" strokeWidth={3} />
        <circle cx={toX(0)} cy={loopCentreY} r={radiusPixels - SURFACE_GAP} fill="none" stroke="var(--lab-axis)" strokeWidth={3} />
      </g>
    )
    : <circle cx={toX(0)} cy={loopCentreY} r={radiusPixels + SURFACE_GAP} fill="none" stroke="var(--lab-axis)" strokeWidth={4} />

  let scenery: ReactNode
  if (layout === 'height') {
    const rampTopAngle = Math.acos(1 - RAMP_TOP / RAMP_RADIUS)
    const rampPoints = Array.from({ length: RAMP_SAMPLES + 1 }, (_, index) => {
      const angle = rampTopAngle * (1 - index / RAMP_SAMPLES)
      const x = toX(-RAMP_RADIUS * Math.sin(angle)) - Math.sin(angle) * SURFACE_GAP
      const y = toY(RAMP_RADIUS * (1 - Math.cos(angle))) + Math.cos(angle) * SURFACE_GAP
      return `${x.toFixed(2)} ${y.toFixed(2)}`
    })
    const rampPath = `M${rampPoints.join('L')}`
    const floorY = groundY + SURFACE_GAP
    const referenceHeight = kind === 'tube' ? 2 * TRACK_RADIUS : 2.5 * TRACK_RADIUS
    scenery = (
      <g>
        <path d={`${rampPath}L${rampPoints[0].split(' ')[0]} ${floorY}Z`} fill="var(--lab-grid)" />
        <line x1={0} x2={width} y1={toY(referenceHeight)} y2={toY(referenceHeight)} stroke="var(--lab-axis)" strokeDasharray="2 4" />
        <text x={8} y={toY(referenceHeight) - 6} fontSize="11" fill="var(--lab-muted)"><Sym>h</Sym> = {kind === 'tube' ? '2' : '2.5'}<Sym>R</Sym></text>
        <path d={rampPath} fill="none" stroke="var(--lab-axis)" strokeWidth={4} strokeLinejoin="round" />
        {loopTrack}
        <line x1={toX(0)} x2={toX(EXIT_LENGTH)} y1={floorY} y2={floorY} stroke="var(--lab-axis)" strokeWidth={4} strokeLinecap="round" />
      </g>
    )
  } else if (layout === 'bottom') {
    scenery = loopTrack
  } else {
    const domeRadius = radiusPixels - SURFACE_GAP
    const floorY = groundY + SURFACE_GAP
    scenery = (
      <g>
        <path d={`M${toX(0) - domeRadius} ${floorY}V${groundY}A${domeRadius} ${domeRadius} 0 0 1 ${toX(0) + domeRadius} ${groundY}V${floorY}Z`} fill="var(--lab-grid)" stroke="var(--lab-axis)" strokeWidth={4} strokeLinejoin="round" />
        <line x1={0} x2={width} y1={floorY} y2={floorY} stroke="var(--lab-axis)" strokeWidth={2} />
      </g>
    )
  }

  return (
    <div className="circle-stage" ref={stageRef}>
      <div className="circle-stage-top">
        <span className="circle-readout-group">
          <span>速率 <MathText tex="v" /> = <b>{formatValue(frame.speed)}</b> m/s</span>
          <span>高度 <MathText tex="h" /> = <b>{formatValue(frame.y, 2)}</b> m</span>
        </span>
        <span>正向力 <MathText tex="N" /> = <b>{formatValue(frame.force)}</b> N</span>
      </div>
      <svg width="100%" height={height} role="img" aria-label={kind === 'outside' ? '小球從圓形軌道外側的最高點往下滑' : layout === 'height' ? '小球從斜坡滑下，進入圓形軌道' : '小球從圓形軌道的最低點出發'}>
        {scenery}
        <line x1={0} x2={width} y1={groundY} y2={groundY} stroke="var(--lab-axis)" strokeDasharray="4 4" />
        <text x={width - 8} y={groundY - 6} textAnchor="end" fontSize="11" fill="var(--lab-muted)"><Sym>h</Sym> = 0</text>
        {energyHeight <= view.top - ENERGY_LINE_MARGIN && (
          <g>
            <line x1={0} x2={width} y1={toY(energyHeight)} y2={toY(energyHeight)} stroke={COLOR_TOTAL} strokeDasharray="6 5" strokeWidth={1.5} />
            <text x={width - 8} y={toY(energyHeight) - 6} textAnchor="end" fontSize="11" fill={COLOR_TOTAL}>動能全部轉成位能時的高度</text>
          </g>
        )}
        <FlightTrail run={run} time={time} place={place} />
        {frame.y > 0.02 && <line x1={ballX} x2={ballX} y1={ballY} y2={groundY} stroke={COLOR_POTENTIAL} strokeDasharray="3 3" strokeWidth={1.5} />}
        <circle cx={ballX} cy={ballY} r={BALL_RADIUS} fill={COLOR_BALL} />
        <BallArrows frame={frame} x={ballX} y={ballY} ballRadius={BALL_RADIUS} mass={mass} resistance={resistance} forceScale={forceScale} velocityScale={velocityScale} forceSymbol="N" />
        {editable && layout === 'height' && (
          <g className="circle-grab" {...pointerDrag((x, y) => onChange({ height: heightFrom(x, y) }))}>
            <circle cx={ballX} cy={ballY} r={BALL_RADIUS + 6} fill="none" stroke="var(--lab-text)" strokeDasharray="3 3" />
            <circle cx={ballX} cy={ballY} r={22} fill="transparent" />
          </g>
        )}
        {editable && layout !== 'height' && (
          <g className="circle-drag" {...horizontalDrag((x) => changeSpeed(speedFrom(x)))}>
            <circle cx={handle.x + BALL_RADIUS + startSpeed * velocityScale} cy={handle.y} r={20} fill="transparent" />
            <circle cx={handle.x + BALL_RADIUS + startSpeed * velocityScale} cy={handle.y} r={7} fill="var(--lab-text)" stroke="var(--lab-surface)" strokeWidth={2} />
          </g>
        )}
      </svg>
    </div>
  )
}

function ForceSummary({ run, settings }: { run: MotionRun; settings: TrackSettings }) {
  const { kind, start, height, bottomSpeed, topSpeed, mass } = settings
  const weight = mass * GRAVITY
  if (run.resistance > 0) return <p className="circle-force-values">有阻力時力學能逐漸減少，正向力也比沒有阻力時小。</p>
  if (kind === 'outside') {
    const top = weight - (mass * topSpeed ** 2) / TRACK_RADIUS
    if (top <= 0 || run.leaveAngle === null) return <p className="circle-force-values">在最高點，重力已經不足以提供需要的向心力 <MathText tex="\tfrac{mv_0^{2}}{R}" />，正向力為 0。</p>
    const theory = Math.acos(2 / 3 + topSpeed ** 2 / (3 * GRAVITY * TRACK_RADIUS)) * DEGREES
    return <p className="circle-force-values">最高點 <b>{formatValue(top)}</b> N。由 <MathText tex="\cos\theta = \tfrac{2}{3} + \tfrac{v_0^{2}}{3gR}" /> 算出離開位置 <MathText tex={`\\theta = ${theory.toFixed(1)}^\\circ`} /></p>
  }
  const centripetal = start === 'height' ? (2 * weight * height) / TRACK_RADIUS : (mass * bottomSpeed ** 2) / TRACK_RADIUS
  const bottom = centripetal + weight
  if (run.outcome !== 'loop' && run.outcome !== 'exit') return <p className="circle-force-values">最低點 <b>{formatValue(bottom)}</b> N</p>
  const top = bottom - 6 * weight
  return <p className="circle-force-values">最低點 <b>{formatValue(bottom)}</b> N，最高點 <b>{formatValue(top)}</b> N，相差 <b>{formatValue(bottom - top)}</b> N，正好是 <MathText tex={`6mg = ${formatValue(6 * weight)}\\ \\text{N}`} /></p>
}

function VerticalCircleTrack({ active, onHelp }: { active: boolean; onHelp: OpenHelp }) {
  const [settings, setSettings] = useState<TrackSettings>(DEFAULT_SETTINGS)
  const [speedUnit, setSpeedUnit] = useState<SpeedUnit>('si')
  const [rate, setRate] = useState(DEFAULT_PLAYBACK_RATE)
  const run = useMemo(() => solveTrack({
    kind: settings.kind,
    start: settings.start,
    height: settings.height,
    speed: settings.kind === 'outside' ? settings.topSpeed : settings.bottomSpeed,
    mass: settings.mass,
    resistance: settings.resistance,
  }), [settings])
  const playback = usePlayback(run.duration, run.periodic, rate, active)
  const time = Math.min(playback.position, run.duration)
  const frame = run.frameAt(time)
  const editable = playback.position === 0 && !playback.playing
  const layout = layoutOf(settings)
  const scene = sceneOf(settings)
  const rows = useMemo(() => thresholdRows(scene, TRACK_RADIUS), [scene])
  const isOutside = settings.kind === 'outside'
  const unitSpeed = Math.sqrt(GRAVITY * TRACK_RADIUS)

  const update = (change: Partial<TrackSettings>) => {
    setSettings((current) => ({ ...current, ...change }))
    playback.seek(0)
  }
  const reset = () => {
    setSettings(DEFAULT_SETTINGS)
    playback.rewind()
  }
  const seek = (next: number) => {
    playback.pause()
    playback.seek(next)
  }

  return (
    <>
      <aside className="lab-panel">
        <h2>軌道設定</h2>
        <Segmented label="軌道" options={KIND_OPTIONS} value={settings.kind} onChange={(kind) => update({ kind })} />
        {!isOutside && <Segmented label="出發方式" options={START_OPTIONS} value={settings.start} onChange={(start) => update({ start })} />}
        {layout === 'height' && <Slider label={<>釋放高度 <MathText tex="H" /></>} {...HEIGHT_RANGE} unit="m" digits={2} inputLabel="輸入釋放高度" value={settings.height} onChange={(height) => update({ height })} />}
        {layout === 'bottom' && <SpeedControl label={<>最低點的速率 <MathText tex="v_0" /></>} speed={settings.bottomSpeed} unitSpeed={unitSpeed} {...BOTTOM_SPEED_RANGE} unit={speedUnit} onUnitChange={setSpeedUnit} onChange={(bottomSpeed) => update({ bottomSpeed })} />}
        {layout === 'outside' && <SpeedControl label={<>最高點的速率 <MathText tex="v_0" /></>} speed={settings.topSpeed} unitSpeed={unitSpeed} {...TOP_SPEED_RANGE} unit={speedUnit} onUnitChange={setSpeedUnit} onChange={(topSpeed) => update({ topSpeed })} />}
        <Slider label={<>質量 <MathText tex="m" /></>} {...MASS_RANGE} unit="kg" value={settings.mass} onChange={(mass) => update({ mass })} />
        <ResistanceSlider value={settings.resistance} onChange={(resistance) => update({ resistance })} onHelp={onHelp} />
        <PlaybackRate value={rate} onChange={setRate} />
        <MotionThresholds title={<>運動情形（沒有阻力，<MathText tex={`R = ${TRACK_RADIUS}\\ \\text{m}`} />）</>} rows={rows} active={activeThreshold(run, scene)} />
        <button className="lab-secondary" onClick={reset}>重設</button>
        <p className="lab-note">{NOTES[layout]}</p>
      </aside>
      <section className="lab-plots">
        <div className="lab-chart circle-stage-card">
          <ChartHeading title="小球運動" help={STAGE_HELP[layout]} onHelp={onHelp}><span className="circle-chip">{chipLabel(run, scene)}</span></ChartHeading>
          <TrackStage run={run} frame={frame} time={time} settings={settings} editable={editable} onChange={update} />
          <TimelineBar position={time} length={run.duration} looping={run.periodic} playing={playback.playing} onToggle={playback.toggle} onRewind={playback.rewind} onSeek={seek} />
          <RunNote run={run} scene={scene} />
        </div>
        <div className="circle-chart-pair">
          <div className="lab-chart">
            <ChartHeading title="力學能" help="energy" onHelp={onHelp}><span className="circle-caption">單位：J</span></ChartHeading>
            <EnergyReadout frame={frame} run={run} />
            <EnergyChart run={run} time={time} onSeek={seek} />
          </div>
          <div className="lab-chart">
            <ChartHeading title="正向力" help={isOutside ? 'outsideForce' : 'trackForce'} onHelp={onHelp}><span className="circle-caption">{isOutside ? '單位：N，背離圓心為正' : '單位：N，指向圓心為正'}</span></ChartHeading>
            <Legend>
              <LegendItem color={COLOR_FORCE} kind="line">正向力</LegendItem>
              {run.forceContinuation.length > 1 && <LegendItem color={COLOR_FORCE} kind="dashed">需要軌道拉（做不到）</LegendItem>}
              <LegendItem color={COLOR_FORCE} kind="dot">目前 <b>{frame.attached && frame.angle !== null ? formatValue(frame.force) : '—'}</b></LegendItem>
            </Legend>
            <ForceChart run={run} frame={frame} axis={isOutside ? 'top' : 'bottom'} canPush={settings.kind === 'tube'} ariaLabel="正向力與角位置的關係圖" yLabel="正向力（N）" negativeNote={NEGATIVE_NOTES[settings.kind]} leaveLabel="離開" />
            <ForceSummary run={run} settings={settings} />
          </div>
        </div>
      </section>
    </>
  )
}

export default VerticalCircleTrack
