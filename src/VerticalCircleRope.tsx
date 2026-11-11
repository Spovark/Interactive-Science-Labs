import { useMemo, useState } from 'react'
import MathText from './MathText'
import { clamp, formatValue, snap } from './momentumChartUtils'
import { horizontalDrag, useElementWidth } from './momentumHooks'
import { usePlayback } from './verticalCircleHooks'
import { BallArrows, ChartHeading, COLOR_BALL, COLOR_FORCE, COLOR_POTENTIAL, COLOR_TOTAL, DEFAULT_PLAYBACK_RATE, EnergyChart, EnergyReadout, FlightTrail, ForceChart, Legend, LegendItem, MotionThresholds, PlaybackRate, ResistanceSlider, RunNote, Segmented, Slider, SpeedControl, Sym, TimelineBar, type OpenHelp, type SpeedUnit } from './VerticalCircleShared'
import { GRAVITY, solveRope, type Link, type MotionFrame, type MotionRun, type RopeInput } from './verticalCirclePhysics'
import { activeThreshold, chipLabel, thresholdRows } from './verticalCircleText'

const RADIUS_RANGE = { min: 0.5, max: 1.5, step: 0.1 }
const MASS_RANGE = { min: 0.5, max: 2, step: 0.1 }
const SPEED_RANGE = { min: 1, max: 12, step: 0.1 }
const DEFAULT_SETTINGS: RopeInput = { link: 'rope', radius: 1, mass: 1, speed: 7.5, resistance: 0 }
const LINK_OPTIONS: { value: Link; label: string }[] = [{ value: 'rope', label: '繩子' }, { value: 'rod', label: '輕桿' }]
const VIEW_HALF_WIDTH = 1.75
const VIEW_TOP = 3.6
const VIEW_BOTTOM = -0.35
const STAGE_MAX_HEIGHT = 380
const BALL_RADIUS = 9
// Metres of arrow per m/s, so the drag handle always moves the same distance per unit of speed.
const VELOCITY_LENGTH = 0.12
// Longest force arrow as a fraction of the radius.
const FORCE_LENGTH = 0.85
const ENERGY_LINE_MARGIN = 0.5
const SLACK_SAG = 0.6

function largestForce(run: MotionRun, mass: number) {
  const traced = run.forceTrace.flat().map(([, force]) => Math.abs(force))
  return Math.max(mass * GRAVITY, run.resistance, ...traced)
}

type StageProps = {
  run: MotionRun
  frame: MotionFrame
  time: number
  settings: RopeInput
  editable: boolean
  onSpeedChange: (speed: number) => void
}

function RopeStage({ run, frame, time, settings, editable, onSpeedChange }: StageProps) {
  const [stageRef, width] = useElementWidth<HTMLDivElement>(560)
  const { link, radius, mass, speed, resistance } = settings
  const scale = Math.min(width / (2 * VIEW_HALF_WIDTH), STAGE_MAX_HEIGHT / (VIEW_TOP - VIEW_BOTTOM))
  const height = (VIEW_TOP - VIEW_BOTTOM) * scale
  const toX = (x: number) => width / 2 + x * scale
  const toY = (y: number) => (VIEW_TOP - y) * scale
  const radiusPixels = radius * scale
  const pivotX = toX(0)
  const pivotY = toY(radius)
  const place = (state: MotionFrame) => ({ x: toX(state.x), y: toY(state.y) })
  const { x: ballX, y: ballY } = place(frame)
  const forceScale = (FORCE_LENGTH * radiusPixels) / largestForce(run, mass)
  const velocityScale = VELOCITY_LENGTH * scale
  const energyHeight = (frame.kinetic + frame.potential) / (mass * GRAVITY)
  const groundY = toY(0)
  const sag = Math.sqrt(Math.max(0, radiusPixels ** 2 - (ballX - pivotX) ** 2 - (ballY - pivotY) ** 2)) * SLACK_SAG
  const ropePath = `M${pivotX} ${pivotY}Q${(pivotX + ballX) / 2} ${(pivotY + ballY) / 2 + sag} ${ballX} ${ballY}`
  // The velocity arrow starts at the edge of the ball, so its tip sits one ball radius further out.
  const handleX = toX(0) + BALL_RADIUS + speed * velocityScale
  const speedFrom = (x: number) => clamp(snap((x - toX(0) - BALL_RADIUS) / velocityScale, SPEED_RANGE.step), SPEED_RANGE.min, SPEED_RANGE.max)

  return (
    <div className="circle-stage" ref={stageRef}>
      <div className="circle-stage-top">
        <span className="circle-readout-group">
          <span>速率 <MathText tex="v" /> = <b>{formatValue(frame.speed)}</b> m/s</span>
          <span>高度 <MathText tex="h" /> = <b>{formatValue(frame.y, 2)}</b> m</span>
        </span>
        <span>{link === 'rope' ? '張力' : '桿的作用力'} <MathText tex={link === 'rope' ? 'T' : 'F'} /> = <b>{formatValue(frame.force)}</b> N</span>
      </div>
      <svg width="100%" height={height} role="img" aria-label={`小球繫在${link === 'rope' ? '繩子' : '輕桿'}的一端，在鉛直面上運動`}>
        <line x1={0} x2={width} y1={groundY} y2={groundY} stroke="var(--lab-axis)" strokeDasharray="4 4" />
        <text x={8} y={groundY - 6} fontSize="11" fill="var(--lab-muted)"><Sym>h</Sym> = 0</text>
        {energyHeight <= VIEW_TOP - ENERGY_LINE_MARGIN && (
          <g>
            <line x1={0} x2={width} y1={toY(energyHeight)} y2={toY(energyHeight)} stroke={COLOR_TOTAL} strokeDasharray="6 5" strokeWidth={1.5} />
            <text x={width - 8} y={toY(energyHeight) - 6} textAnchor="end" fontSize="11" fill={COLOR_TOTAL}>動能全部轉成位能時的高度</text>
          </g>
        )}
        <circle cx={pivotX} cy={pivotY} r={radiusPixels} fill="none" stroke="var(--lab-axis)" strokeDasharray="3 5" strokeOpacity={0.8} />
        {frame.y > 0.02 && (
          <g>
            <line x1={ballX} x2={ballX} y1={ballY} y2={groundY} stroke={COLOR_POTENTIAL} strokeDasharray="3 3" strokeWidth={1.5} />
            <text x={ballX + (frame.x < 0 ? 7 : -7)} y={(ballY + groundY) / 2 + 4} textAnchor={frame.x < 0 ? 'start' : 'end'} fill={COLOR_POTENTIAL}><Sym>h</Sym></text>
          </g>
        )}
        {link === 'rope'
          ? <path d={ropePath} fill="none" stroke="var(--lab-text)" strokeWidth={1.8} />
          : <line x1={pivotX} y1={pivotY} x2={ballX} y2={ballY} stroke="var(--lab-muted)" strokeWidth={5} strokeLinecap="round" />}
        <circle cx={pivotX} cy={pivotY} r={4.5} fill="var(--lab-surface)" stroke="var(--lab-text)" strokeWidth={2} />
        <FlightTrail run={run} time={time} place={place} />
        <circle cx={ballX} cy={ballY} r={BALL_RADIUS} fill={COLOR_BALL} />
        <BallArrows frame={frame} x={ballX} y={ballY} ballRadius={BALL_RADIUS} mass={mass} resistance={resistance} forceScale={forceScale} velocityScale={velocityScale} forceSymbol={link === 'rope' ? 'T' : 'F'} />
        {editable && (
          <g className="circle-drag" {...horizontalDrag((x) => onSpeedChange(speedFrom(x)))}>
            <circle cx={handleX} cy={groundY} r={20} fill="transparent" />
            <circle cx={handleX} cy={groundY} r={7} fill="var(--lab-text)" stroke="var(--lab-surface)" strokeWidth={2} />
          </g>
        )}
      </svg>
    </div>
  )
}

function ForceSummary({ run, settings }: { run: MotionRun; settings: RopeInput }) {
  const { mass, radius, speed } = settings
  const name = settings.link === 'rope' ? '張力' : '作用力'
  if (run.resistance > 0) return <p className="circle-force-values">有阻力時力學能逐漸減少，小球每次經過同一個位置，{name}都比前一次小。</p>
  const bottom = (mass * speed ** 2) / radius + mass * GRAVITY
  if (run.outcome !== 'loop') return <p className="circle-force-values">最低點 <b>{formatValue(bottom)}</b> N</p>
  const top = bottom - 6 * mass * GRAVITY
  return <p className="circle-force-values">最低點 <b>{formatValue(bottom)}</b> N，最高點 <b>{formatValue(top)}</b> N，相差 <b>{formatValue(bottom - top)}</b> N，正好是 <MathText tex={`6mg = ${formatValue(6 * mass * GRAVITY)}\\ \\text{N}`} /></p>
}

function VerticalCircleRope({ active, onHelp }: { active: boolean; onHelp: OpenHelp }) {
  const [settings, setSettings] = useState<RopeInput>(DEFAULT_SETTINGS)
  const [speedUnit, setSpeedUnit] = useState<SpeedUnit>('si')
  const [rate, setRate] = useState(DEFAULT_PLAYBACK_RATE)
  const run = useMemo(() => solveRope(settings), [settings])
  const playback = usePlayback(run.duration, run.periodic, rate, active)
  const time = Math.min(playback.position, run.duration)
  const frame = run.frameAt(time)
  const editable = playback.position === 0 && !playback.playing
  const scene = settings.link
  const rows = useMemo(() => thresholdRows(scene, settings.radius), [scene, settings.radius])
  const isRope = settings.link === 'rope'

  const update = (change: Partial<RopeInput>) => {
    setSettings((current) => ({ ...current, ...change }))
    playback.seek(0)
  }
  // In multiples of √(gR) the multiple stays the same when the radius changes.
  const changeRadius = (radius: number) => {
    setSettings((current) => ({
      ...current,
      radius,
      speed: speedUnit === 'ratio' ? clamp(current.speed * Math.sqrt(radius / current.radius), SPEED_RANGE.min, SPEED_RANGE.max) : current.speed,
    }))
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
        <h2>小球設定</h2>
        <Segmented label="連接方式" options={LINK_OPTIONS} value={settings.link} onChange={(link) => update({ link })} />
        <Slider label={<>半徑 <MathText tex="R" /></>} {...RADIUS_RANGE} unit="m" value={settings.radius} onChange={changeRadius} />
        <Slider label={<>質量 <MathText tex="m" /></>} {...MASS_RANGE} unit="kg" value={settings.mass} onChange={(mass) => update({ mass })} />
        <SpeedControl label={<>最低點的速率 <MathText tex="v_0" /></>} speed={settings.speed} unitSpeed={Math.sqrt(GRAVITY * settings.radius)} {...SPEED_RANGE} unit={speedUnit} onUnitChange={setSpeedUnit} onChange={(speed) => update({ speed })} />
        <ResistanceSlider value={settings.resistance} onChange={(resistance) => update({ resistance })} onHelp={onHelp} />
        <PlaybackRate value={rate} onChange={setRate} />
        <MotionThresholds title="運動情形（沒有阻力時）" rows={rows} active={activeThreshold(run, scene)} />
        <button className="lab-secondary" onClick={reset}>重設</button>
        <p className="lab-note">在起點暫停時，可以拖曳速度箭頭的圓點改變 <MathText tex="v_0" />。把 <MathText tex="v_0" /> 慢慢調小，看繩子從哪裡開始鬆弛；再換成輕桿比較。</p>
      </aside>
      <section className="lab-plots">
        <div className="lab-chart circle-stage-card">
          <ChartHeading title="小球運動" help="ropeStage" onHelp={onHelp}><span className="circle-chip">{chipLabel(run, scene)}</span></ChartHeading>
          <RopeStage run={run} frame={frame} time={time} settings={settings} editable={editable} onSpeedChange={(speed) => update({ speed })} />
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
            <ChartHeading title={isRope ? '張力' : '桿的作用力'} help="ropeForce" onHelp={onHelp}><span className="circle-caption">單位：N，指向圓心為正</span></ChartHeading>
            <Legend>
              <LegendItem color={COLOR_FORCE} kind="line">{isRope ? '張力' : '作用力'}</LegendItem>
              {run.forceContinuation.length > 1 && <LegendItem color={COLOR_FORCE} kind="dashed">需要繩子推（做不到）</LegendItem>}
              <LegendItem color={COLOR_FORCE} kind="dot">目前 <b>{frame.attached ? formatValue(frame.force) : '0.0'}</b></LegendItem>
            </Legend>
            <ForceChart run={run} frame={frame} axis="bottom" canPush={!isRope} ariaLabel={`${isRope ? '張力' : '桿的作用力'}與角位置的關係圖`} yLabel={isRope ? '張力（N）' : '作用力（N）'} negativeNote={isRope ? '繩子只能拉，張力不能小於 0' : '負值：桿把小球往外推'} leaveLabel="鬆弛" />
            <ForceSummary run={run} settings={settings} />
          </div>
        </div>
      </section>
    </>
  )
}

export default VerticalCircleRope
