export const GRAVITY = 9.8

// The default radius of the circle in both scenes.
export const TRACK_RADIUS = 1
export const RAMP_RADIUS = 4.3
export const RAMP_TOP = 4.1
export const EXIT_LENGTH = 3
export const TIME_LIMIT = 60
// The floor to the left of the half-circle track, where a ball thrown from the top lands.
export const FLOOR_LENGTH = 4.4
// The ball on the half-circle track starts on the floor, so the floor and the circle can be compared.
export const HALF_START = -3.5

const STEPS_PER_RADIUS = 160
const MAX_LEGS = 400
const FLIGHT_STEP = 0.0005
const FLIGHT_LIMIT = 10
const BISECTIONS = 50
const TRACE_POINTS = 4000
const CONTINUATION_POINTS = 60
const REST_DURATION = 1
// A ball whose rope snaps falls this far below h = 0, out of the animation, before the run ends.
const SNAP_FLOOR = -1
// Lets settings typed as exact critical values (for example v₀ = √(5gR)) keep the ball on the circle despite rounding.
const FORCE_TOLERANCE = 5e-4
const POSITION_TOLERANCE = 1e-6

export type Link = 'rope' | 'rod'
export type TrackKind = 'inside' | 'tube' | 'outside' | 'half'
export type TrackStart = 'height' | 'bottom'
// swing and loop repeat forever; the others end the run. launch is a ball thrown off the end of the track,
// snap a rope pulled harder than its breaking strength.
export type Outcome = 'swing' | 'loop' | 'leave' | 'launch' | 'exit' | 'rest' | 'limit' | 'snap'
// Which way the rope, rod or track can act on the ball, relative to the centre of the circle.
type Allows = 'toward' | 'away' | 'both'

// The rope breaks once its tension would exceed `strength`.
export type RopeInput = { link: Link; radius: number; mass: number; speed: number; resistance: number; strength: number }
export type TrackInput = { kind: TrackKind; start: TrackStart; height: number; speed: number; radius: number; mass: number; resistance: number }

// Heights are measured from the h = 0 line of each scene, x to the right of the circle's centre.
export type MotionFrame = {
  x: number
  y: number
  vx: number
  vy: number
  speed: number
  kinetic: number
  potential: number
  // Mechanical energy taken away by the resistance so far.
  lost: number
  // Tension, rod force or normal force along (normalX, normalY).
  force: number
  normalX: number
  normalY: number
  // Unit vector toward the centre of curvature of the path, and that curvature in 1/m; all zero in flight.
  inwardX: number
  inwardY: number
  curvature: number
  // The resistance acting on the ball, including the static value that holds it in place once it has stopped.
  resistanceX: number
  resistanceY: number
  // Angular position on the circle in the chart's convention; null off the circle.
  angle: number | null
  attached: boolean
}

export type MotionRun = {
  outcome: Outcome
  periodic: boolean
  duration: number
  mass: number
  resistance: number
  initialEnergy: number
  leaveTime: number | null
  leaveAngle: number | null
  // Number of times the ball went over the top of the circle.
  topPasses: number
  // The resistance holds the ball where it was released.
  stuckAtStart: boolean
  frameAt: (time: number) => MotionFrame
  // Force against angular position (degrees) while on the circle, one array per continuous stretch.
  forceTrace: [number, number][][]
  // The force the rope or track would have to supply if the ball had stayed on the circle after leaving.
  forceContinuation: [number, number][]
}

type PathPoint = {
  x: number
  y: number
  tx: number
  ty: number
  nx: number
  ny: number
  curvature: number
}

type Scenario = {
  mass: number
  resistance: number
  allows: Allows
  // +1 reports the force toward the centre of curvature, −1 away from it.
  forceSign: 1 | -1
  geometry: (position: number) => PathPoint
  angleOf: (position: number) => number | null
  start: number
  speed: number
  step: number
  // Circumference of a closed path, or null for an open one.
  wrap: number | null
  // The ends of an open path. Reaching `end` throws the ball off the track when `launchAtEnd` is set.
  end: number | null
  begin: number | null
  launchAtEnd: boolean
  // Path positions of the top of the circle, for counting passes over it.
  tops: { first: number; spacing: number } | null
  landing: Landing
  // The rope snaps when the force toward the centre would exceed this; null for anything that cannot break.
  breakForce: number | null
  // How far the would-be force curve continues after leaving, measured along the path.
  continuationLimit: (position: number) => number
}

// Where free flight ends: back on the circle of this radius around (0, radius), on the ground y = 0,
// whichever comes first of the ground and the right half of that circle, or at the height y.
type Landing = { kind: 'circle'; radius: number } | { kind: 'ground' } | { kind: 'groundOrArc'; radius: number } | { kind: 'level'; y: number }

type Leg = {
  kind: 'leg'
  t0: number
  duration: number
  start: number
  direction: 1 | -1
  energy: number
  lost: number
  grid: number[]
  times: number[]
  speeds: number[]
}

type FlightState = { x: number; y: number; vx: number; vy: number; lost: number }
type Flight = { kind: 'flight'; t0: number; duration: number; states: FlightState[]; finalStep: number }
type Segment = Leg | Flight
type LegEnd = 'turn' | 'leave' | 'snap' | 'end' | 'cycle' | 'limit'

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function wrapAngle(angle: number) {
  return angle - 2 * Math.PI * Math.round(angle / (2 * Math.PI))
}

function circlePoint(radius: number, angle: number): PathPoint {
  const sin = Math.sin(angle)
  const cos = Math.cos(angle)
  return { x: radius * sin, y: radius * (1 - cos), tx: cos, ty: sin, nx: -sin, ny: cos, curvature: 1 / radius }
}

// Ramp (arc of radius RAMP_RADIUS) for s < 0, the loop for 0 ≤ s ≤ 2πR, then a flat exit.
function trackPoint(radius: number, position: number): PathPoint {
  const loopLength = 2 * Math.PI * radius
  if (position < 0) {
    const angle = -position / RAMP_RADIUS
    const sin = Math.sin(angle)
    const cos = Math.cos(angle)
    return { x: -RAMP_RADIUS * sin, y: RAMP_RADIUS * (1 - cos), tx: cos, ty: -sin, nx: sin, ny: cos, curvature: 1 / RAMP_RADIUS }
  }
  if (position <= loopLength) return circlePoint(radius, position / radius)
  return { x: position - loopLength, y: 0, tx: 1, ty: 0, nx: 0, ny: 1, curvature: 0 }
}

// The outside of a circle of radius R centred on the ground, angle measured from the top.
function domePoint(radius: number, angle: number): PathPoint {
  const sin = Math.sin(angle)
  const cos = Math.cos(angle)
  return { x: radius * sin, y: radius * cos, tx: cos, ty: -sin, nx: -sin, ny: -cos, curvature: 1 / radius }
}

function rampPosition(height: number) {
  return -RAMP_RADIUS * Math.acos(1 - height / RAMP_RADIUS)
}

// Narrows [good, bad] down to the boundary of `ok` and returns the last point where it still holds.
function bisect(good: number, bad: number, ok: (position: number) => boolean) {
  let low = good
  let high = bad
  for (let step = 0; step < BISECTIONS; step += 1) {
    const middle = (low + high) / 2
    if (ok(middle)) low = middle
    else high = middle
  }
  return low
}

// The resistance has done work f·s over the path length s since the start of the leg.
function speedSquaredOnLeg(scenario: Scenario, start: number, energy: number, position: number) {
  const { mass, resistance } = scenario
  return (2 * (energy - resistance * Math.abs(position - start) - mass * GRAVITY * scenario.geometry(position).y)) / mass
}

// The force the rope, rod or track has to supply toward the centre of curvature.
function inwardForce(scenario: Scenario, point: PathPoint, speedSquared: number) {
  return scenario.mass * (Math.max(0, speedSquared) * point.curvature + GRAVITY * point.ny)
}

function violates(scenario: Scenario, inward: number) {
  const tolerance = FORCE_TOLERANCE * scenario.mass * GRAVITY
  if (scenario.allows === 'toward') return inward < -tolerance
  if (scenario.allows === 'away') return inward > tolerance
  return false
}

// Moves along the path in one direction until the ball turns back, leaves, reaches the end or completes a cycle.
function buildLeg(scenario: Scenario, start: number, direction: 1 | -1, energy: number, lost: number, t0: number, cycleTarget: number | null): { leg: Leg; end: LegEnd } {
  const speedSquaredAt = (position: number) => speedSquaredOnLeg(scenario, start, energy, position)
  const inwardAt = (position: number) => inwardForce(scenario, scenario.geometry(position), speedSquaredAt(position))
  const breaks = (position: number) => violates(scenario, inwardAt(position))
  const snaps = (position: number) => scenario.breakForce !== null && inwardAt(position) > scenario.breakForce
  const grid = [start]
  const speeds = [Math.sqrt(Math.max(0, speedSquaredAt(start)))]
  const times = [0]
  const leg: Leg = { kind: 'leg', t0, duration: 0, start, direction, energy, lost, grid, times, speeds }
  // Assumes constant tangential acceleration inside each step.
  const push = (position: number) => {
    const speed = Math.sqrt(Math.max(0, speedSquaredAt(position)))
    const last = grid.length - 1
    const average = (speeds[last] + speed) / 2
    times.push(times[last] + (average > 0 ? Math.abs(position - grid[last]) / average : 0))
    grid.push(position)
    speeds.push(speed)
    leg.duration = times[times.length - 1]
  }
  if (snaps(start)) return { leg, end: 'snap' }
  if (breaks(start)) return { leg, end: 'leave' }

  let position = start
  for (;;) {
    let next = position + direction * scenario.step
    let stop: LegEnd | null = null
    if (scenario.end !== null && direction > 0 && next >= scenario.end) {
      next = scenario.end
      stop = 'end'
    }
    if (scenario.begin !== null && direction < 0 && next <= scenario.begin) {
      next = scenario.begin
      stop = 'end'
    }
    if (cycleTarget !== null && position < cycleTarget && next >= cycleTarget) {
      next = cycleTarget
      stop = 'cycle'
    }
    if (speedSquaredAt(next) <= 0) {
      push(bisect(position, next, (point) => speedSquaredAt(point) > 0))
      return { leg, end: 'turn' }
    }
    if (snaps(next)) {
      push(bisect(position, next, (point) => !snaps(point)))
      return { leg, end: 'snap' }
    }
    if (breaks(next)) {
      push(bisect(position, next, (point) => !breaks(point)))
      return { leg, end: 'leave' }
    }
    push(next)
    if (stop) return { leg, end: stop }
    if (t0 + leg.duration > TIME_LIMIT) return { leg, end: 'limit' }
    position = next
  }
}

function legPosition(leg: Leg, local: number) {
  const { grid, times, speeds } = leg
  const last = grid.length - 1
  if (local <= 0 || last === 0) return grid[0]
  if (local >= leg.duration) return grid[last]
  let low = 0
  let high = last
  while (high - low > 1) {
    const middle = (low + high) >> 1
    if (times[middle] <= local) low = middle
    else high = middle
  }
  const span = times[high] - times[low]
  if (span <= 0) return grid[high]
  const elapsed = local - times[low]
  const acceleration = (speeds[high] - speeds[low]) / span
  return grid[low] + Math.sign(grid[high] - grid[low]) * (speeds[low] * elapsed + 0.5 * acceleration * elapsed ** 2)
}

function flightStep(scenario: Scenario, state: FlightState, dt: number): FlightState {
  const derive = (current: FlightState): FlightState => {
    const speed = Math.hypot(current.vx, current.vy)
    const drag = speed > 0 ? scenario.resistance / scenario.mass / speed : 0
    return { x: current.vx, y: current.vy, vx: -drag * current.vx, vy: -GRAVITY - drag * current.vy, lost: scenario.resistance * speed }
  }
  const add = (base: FlightState, change: FlightState, scale: number): FlightState => ({
    x: base.x + change.x * scale,
    y: base.y + change.y * scale,
    vx: base.vx + change.vx * scale,
    vy: base.vy + change.vy * scale,
    lost: base.lost + change.lost * scale,
  })
  const k1 = derive(state)
  const k2 = derive(add(state, k1, dt / 2))
  const k3 = derive(add(state, k2, dt / 2))
  const k4 = derive(add(state, k3, dt))
  const combine = (key: keyof FlightState) => state[key] + (dt / 6) * (k1[key] + 2 * k2[key] + 2 * k3[key] + k4[key])
  return { x: combine('x'), y: combine('y'), vx: combine('vx'), vy: combine('vy'), lost: combine('lost') }
}

function lerpState(a: FlightState, b: FlightState, fraction: number): FlightState {
  const mix = (key: keyof FlightState) => a[key] + (b[key] - a[key]) * fraction
  return { x: mix('x'), y: mix('y'), vx: mix('vx'), vy: mix('vy'), lost: mix('lost') }
}

// Free flight under gravity and the resistance until the ball is back on the circle or on the ground.
function fly(scenario: Scenario, initial: FlightState, t0: number, landing: Landing = scenario.landing): Flight {
  // Positive while the ball is still in the air.
  const gap = (state: FlightState) => {
    if (landing.kind === 'ground') return state.y
    if (landing.kind === 'level') return state.y - landing.y
    const inside = landing.radius ** 2 - state.x ** 2 - (state.y - landing.radius) ** 2
    if (landing.kind === 'circle') return inside
    return state.x > 0 ? Math.min(state.y, inside) : state.y
  }
  const tolerance = landing.kind === 'ground' || landing.kind === 'level' ? 0 : 1e-9 * landing.radius ** 2
  const states = [initial]
  let armed = landing.kind === 'ground' || landing.kind === 'level'
  let previous = initial
  const limit = Math.min(FLIGHT_LIMIT, Math.max(FLIGHT_STEP, TIME_LIMIT - t0))
  for (let step = 1; step * FLIGHT_STEP <= limit; step += 1) {
    const next = flightStep(scenario, previous, FLIGHT_STEP)
    const value = gap(next)
    if (value > tolerance) armed = true
    if (armed && value <= 0) {
      const before = gap(previous)
      const fraction = before > value ? before / (before - value) : 1
      states.push(lerpState(previous, next, fraction))
      return { kind: 'flight', t0, duration: (step - 1 + fraction) * FLIGHT_STEP, states, finalStep: fraction }
    }
    states.push(next)
    previous = next
  }
  return { kind: 'flight', t0, duration: (states.length - 1) * FLIGHT_STEP, states, finalStep: 1 }
}

function flightStateAt(flight: Flight, local: number) {
  const { states } = flight
  const last = states.length - 1
  if (local <= 0 || last === 0) return states[0]
  if (local >= flight.duration) return states[last]
  const index = Math.min(last - 1, Math.floor(local / FLIGHT_STEP))
  const stepLength = index === last - 1 ? flight.finalStep * FLIGHT_STEP : FLIGHT_STEP
  return lerpState(states[index], states[index + 1], clamp((local - index * FLIGHT_STEP) / stepLength, 0, 1))
}

// `resting` marks a ball the resistance holds still: it then exactly balances gravity along the path.
function legFrame(scenario: Scenario, leg: Leg, local: number, resting: boolean): MotionFrame {
  const position = legPosition(leg, local)
  const point = scenario.geometry(position)
  const speedSquared = resting ? 0 : Math.max(0, speedSquaredOnLeg(scenario, leg.start, leg.energy, position))
  const speed = Math.sqrt(speedSquared)
  const { mass, forceSign } = scenario
  const resistance = resting ? mass * GRAVITY * point.ty : -leg.direction * scenario.resistance
  return {
    x: point.x,
    y: point.y,
    vx: leg.direction * speed * point.tx,
    vy: leg.direction * speed * point.ty,
    speed,
    kinetic: 0.5 * mass * speedSquared,
    potential: mass * GRAVITY * point.y,
    lost: leg.lost + scenario.resistance * Math.abs(position - leg.start),
    force: forceSign * inwardForce(scenario, point, speedSquared),
    normalX: forceSign * point.nx,
    normalY: forceSign * point.ny,
    inwardX: point.nx,
    inwardY: point.ny,
    curvature: point.curvature,
    resistanceX: resistance * point.tx,
    resistanceY: resistance * point.ty,
    angle: scenario.angleOf(position),
    attached: true,
  }
}

function flightFrame(scenario: Scenario, flight: Flight, local: number): MotionFrame {
  const state = flightStateAt(flight, local)
  const speed = Math.hypot(state.vx, state.vy)
  const drag = speed > 0 ? scenario.resistance / speed : 0
  return {
    x: state.x,
    y: state.y,
    vx: state.vx,
    vy: state.vy,
    speed,
    kinetic: 0.5 * scenario.mass * speed ** 2,
    potential: scenario.mass * GRAVITY * state.y,
    lost: state.lost,
    force: 0,
    normalX: 0,
    normalY: 0,
    inwardX: 0,
    inwardY: 0,
    curvature: 0,
    resistanceX: -drag * state.vx,
    resistanceY: -drag * state.vy,
    angle: null,
    attached: false,
  }
}

function countTops(scenario: Scenario, leg: Leg) {
  if (!scenario.tops) return 0
  const { first, spacing } = scenario.tops
  const finish = leg.grid[leg.grid.length - 1]
  const low = Math.min(leg.start, finish)
  const high = Math.max(leg.start, finish)
  if (!Number.isFinite(spacing)) return low < first && first <= high ? 1 : 0
  return Math.max(0, Math.floor((high - first) / spacing) - Math.ceil((low - first) / spacing) + 1)
}

function traceForces(scenario: Scenario, legs: Leg[]) {
  const total = legs.reduce((sum, leg) => sum + leg.grid.length, 0)
  const stride = Math.max(1, Math.ceil(total / TRACE_POINTS))
  const strokes: [number, number][][] = []
  let stroke: [number, number][] = []
  let previous: number | null = null
  const close = () => {
    if (stroke.length > 1) strokes.push(stroke)
    stroke = []
  }
  for (const leg of legs) {
    const last = leg.grid.length - 1
    for (let index = 0; index <= last; index += 1) {
      if (index % stride !== 0 && index !== last) continue
      const position = leg.grid[index]
      const angle = scenario.angleOf(position)
      if (angle === null) {
        close()
        previous = null
        continue
      }
      if (previous !== null && Math.abs(angle - previous) > Math.PI) close()
      const speedSquared = speedSquaredOnLeg(scenario, leg.start, leg.energy, position)
      stroke.push([(angle * 180) / Math.PI, scenario.forceSign * inwardForce(scenario, scenario.geometry(position), speedSquared)])
      previous = angle
    }
  }
  close()
  return strokes
}

function continueForce(scenario: Scenario, leg: Leg) {
  const from = leg.grid[leg.grid.length - 1]
  const distance = scenario.continuationLimit(from)
  const points: [number, number][] = []
  for (let index = 0; index <= CONTINUATION_POINTS; index += 1) {
    const position = from + (leg.direction * distance * index) / CONTINUATION_POINTS
    const speedSquared = speedSquaredOnLeg(scenario, leg.start, leg.energy, position)
    const angle = scenario.angleOf(position)
    if (speedSquared < 0 || angle === null) break
    points.push([(angle * 180) / Math.PI, scenario.forceSign * inwardForce(scenario, scenario.geometry(position), speedSquared)])
  }
  return points
}

function simulate(scenario: Scenario): MotionRun {
  const { mass, resistance } = scenario
  const startPoint = scenario.geometry(scenario.start)
  const initialEnergy = 0.5 * mass * scenario.speed ** 2 + mass * GRAVITY * startPoint.y
  const segments: Segment[] = []
  const legs: Leg[] = []
  // With v = 0 the ball stays put unless gravity along the path beats the resistance.
  const restsAt = (point: PathPoint) => mass * GRAVITY * Math.abs(point.ty) <= resistance + 1e-9 * mass * GRAVITY
  let outcome: Outcome = 'limit'
  let periodic = false
  let leaveTime: number | null = null
  let leaveAngle: number | null = null
  let topPasses = 0
  let time = 0
  let position = scenario.start
  let energy = initialEnergy
  let lost = 0
  let direction: 1 | -1 = 1
  if (scenario.speed === 0) {
    if (restsAt(startPoint)) outcome = 'rest'
    else direction = -startPoint.ty > 0 ? 1 : -1
  }

  for (let index = 0; outcome !== 'rest' && index < MAX_LEGS; index += 1) {
    // Without resistance the motion repeats once the ball is back where it started, moving the same way.
    const cycleTarget = resistance > 0 || scenario.wrap === null || direction !== 1
      ? null
      : index === 0 ? scenario.start + scenario.wrap : scenario.start
    const { leg, end } = buildLeg(scenario, position, direction, energy, lost, time, cycleTarget)
    segments.push(leg)
    legs.push(leg)
    topPasses += countTops(scenario, leg)
    time += leg.duration
    const finish = leg.grid[leg.grid.length - 1]
    energy -= resistance * Math.abs(finish - leg.start)
    lost += resistance * Math.abs(finish - leg.start)
    position = finish

    if (end === 'cycle') {
      outcome = index === 0 ? 'loop' : 'swing'
      periodic = true
      break
    }
    if (end === 'end' && scenario.launchAtEnd && direction > 0) {
      const point = scenario.geometry(finish)
      const speed = Math.sqrt(Math.max(0, speedSquaredOnLeg(scenario, leg.start, leg.energy, finish)))
      leaveTime = time
      const flight = fly(scenario, { x: point.x, y: point.y, vx: speed * point.tx, vy: speed * point.ty, lost }, time)
      segments.push(flight)
      time += flight.duration
      outcome = 'launch'
      break
    }
    if (end === 'end') {
      outcome = 'exit'
      break
    }
    if (end === 'limit') break
    if (end === 'leave' || end === 'snap') {
      const point = scenario.geometry(finish)
      const speed = Math.sqrt(Math.max(0, speedSquaredOnLeg(scenario, leg.start, leg.energy, finish)))
      leaveTime = time
      leaveAngle = scenario.angleOf(finish)
      const landing: Landing | undefined = end === 'snap' ? { kind: 'level', y: SNAP_FLOOR } : undefined
      const flight = fly(scenario, { x: point.x, y: point.y, vx: direction * speed * point.tx, vy: direction * speed * point.ty, lost }, time, landing)
      segments.push(flight)
      time += flight.duration
      outcome = end
      break
    }
    // An open track released from rest repeats once the ball is back at the release point.
    if (resistance === 0 && scenario.wrap === null && index >= 1 && Math.abs(finish - scenario.start) < POSITION_TOLERANCE) {
      outcome = 'swing'
      periodic = true
      break
    }
    const point = scenario.geometry(finish)
    if (restsAt(point)) {
      outcome = 'rest'
      break
    }
    direction = -point.ty > 0 ? 1 : -1
  }

  const restLeg: Leg = { kind: 'leg', t0: 0, duration: 0, start: scenario.start, direction: 1, energy: initialEnergy, lost: 0, grid: [scenario.start], times: [0], speeds: [0] }
  if (segments.length === 0) segments.push(restLeg)
  const duration = time > 0 ? time : REST_DURATION
  const lastLeg = legs[legs.length - 1]

  const frameAt = (requested: number): MotionFrame => {
    const local = periodic ? ((requested % duration) + duration) % duration : clamp(requested, 0, duration)
    let segment = segments[segments.length - 1]
    for (const candidate of segments) {
      if (local <= candidate.t0 + candidate.duration) {
        segment = candidate
        break
      }
    }
    const resting = outcome === 'rest' && (legs.length === 0 || local >= duration)
    return segment.kind === 'leg' ? legFrame(scenario, segment, local - segment.t0, resting) : flightFrame(scenario, segment, local - segment.t0)
  }

  return {
    outcome,
    periodic,
    duration,
    mass,
    resistance,
    initialEnergy,
    leaveTime,
    leaveAngle,
    topPasses,
    stuckAtStart: legs.length === 0,
    frameAt,
    forceTrace: traceForces(scenario, legs.length > 0 ? legs : [restLeg]),
    forceContinuation: (outcome === 'leave' || outcome === 'snap') && lastLeg ? continueForce(scenario, lastLeg) : [],
  }
}

// A full circle of radius R with the ball starting at the lowest point; angle measured from there.
function circleScenario(radius: number, mass: number, speed: number, resistance: number, allows: Allows, breakForce: number | null = null): Scenario {
  const wrap = 2 * Math.PI * radius
  return {
    mass,
    resistance,
    allows,
    forceSign: 1,
    geometry: (position) => circlePoint(radius, position / radius),
    angleOf: (position) => wrapAngle(position / radius),
    start: 0,
    speed,
    step: radius / STEPS_PER_RADIUS,
    wrap,
    end: null,
    begin: null,
    launchAtEnd: false,
    tops: { first: Math.PI * radius, spacing: wrap },
    landing: { kind: 'circle', radius },
    breakForce,
    continuationLimit: (position) => Math.max(0, Math.PI * radius - Math.abs(wrapAngle(position / radius)) * radius),
  }
}

export function solveRope({ link, radius, mass, speed, resistance, strength }: RopeInput): MotionRun {
  return simulate(link === 'rope'
    ? circleScenario(radius, mass, speed, resistance, 'toward', strength)
    : circleScenario(radius, mass, speed, resistance, 'both'))
}

export function solveTrack({ kind, start, height, speed, radius, mass, resistance }: TrackInput): MotionRun {
  const loopLength = 2 * Math.PI * radius
  if (kind === 'outside') {
    return simulate({
      mass,
      resistance,
      allows: 'away',
      forceSign: -1,
      geometry: (position) => domePoint(radius, position / radius),
      angleOf: (position) => position / radius,
      start: 0,
      speed,
      step: radius / STEPS_PER_RADIUS,
      wrap: null,
      end: (Math.PI / 2) * radius,
      begin: null,
      launchAtEnd: false,
      tops: null,
      landing: { kind: 'ground' },
      breakForce: null,
      continuationLimit: (position) => Math.max(0, (Math.PI / 2) * radius - position),
    })
  }
  if (kind === 'half') {
    // The ball starts on a floor for s < 0, which leads into the right half of the circle, which ends at the top.
    const halfLength = Math.PI * radius
    return simulate({
      mass,
      resistance,
      allows: 'toward',
      forceSign: 1,
      geometry: (position) => (position < 0
        ? { x: position, y: 0, tx: 1, ty: 0, nx: 0, ny: 1, curvature: 0 }
        : circlePoint(radius, position / radius)),
      angleOf: (position) => (position >= 0 ? position / radius : null),
      start: HALF_START,
      speed,
      step: radius / STEPS_PER_RADIUS,
      wrap: null,
      end: halfLength,
      begin: -FLOOR_LENGTH,
      launchAtEnd: true,
      tops: { first: halfLength, spacing: Infinity },
      landing: { kind: 'groundOrArc', radius },
      breakForce: null,
      continuationLimit: (position) => Math.max(0, halfLength - position),
    })
  }
  const allows: Allows = kind === 'tube' ? 'both' : 'toward'
  if (start === 'bottom') return simulate(circleScenario(radius, mass, speed, resistance, allows))
  return simulate({
    mass,
    resistance,
    allows,
    forceSign: 1,
    geometry: (position) => trackPoint(radius, position),
    angleOf: (position) => (position >= 0 && position <= loopLength ? wrapAngle(position / radius) : null),
    start: rampPosition(height),
    speed: 0,
    step: radius / STEPS_PER_RADIUS,
    wrap: null,
    end: loopLength + EXIT_LENGTH,
    begin: null,
    launchAtEnd: false,
    tops: { first: Math.PI * radius, spacing: Infinity },
    landing: { kind: 'circle', radius },
    breakForce: null,
    continuationLimit: (position) => Math.max(0, Math.PI * radius - position),
  })
}
