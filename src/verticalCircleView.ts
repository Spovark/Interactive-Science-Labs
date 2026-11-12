import { useCallback, useState } from 'react'
import { useElementSize } from './labHooks'
import { GRAVITY, type MotionFrame, type MotionRun } from './verticalCirclePhysics'

export type Observer = 'ground' | 'ball'

export type StageOptions = {
  // Whose coordinate system the animation is drawn in.
  observer: Observer
  // The animation card fills the window.
  enlarged: boolean
  // While enlarged, the camera moves in on the ball and follows it.
  closeUp: boolean
  // Radial and tangential components of the weight (and of the fictitious force).
  components: boolean
  // The centripetal force the motion requires; only drawn for the observer on the ground.
  centripetal: boolean
  // The radial forces placed head to tail.
  radialSum: boolean
}

export type ViewBox = { left: number; right: number; top: number; bottom: number }
export type Vector = { x: number; y: number }

// The centripetal force starts hidden to keep the default view uncluttered.
const DEFAULT_OPTIONS: StageOptions = { observer: 'ground', enlarged: false, closeUp: false, components: true, centripetal: false, radialSum: true }
const CLOSE_UP_ZOOM = 2.5
// Matches the min-height of the enlarged animation in VerticalCircleLab.css.
const ENLARGED_MIN_HEIGHT = 220
// Room kept under the weight arrow for its label.
const WEIGHT_LABEL_ROOM = 18
const SCALE_BAR_PIXELS = 48
const SCALE_STEPS = [1, 2, 5]

export function useStageOptions() {
  const [options, setOptions] = useState(DEFAULT_OPTIONS)
  const change = useCallback((next: Partial<StageOptions>) => setOptions((current) => ({ ...current, ...next })), [])
  return [options, change] as const
}

// Maps metres to SVG pixels. The camera shows the whole `box`, or follows the ball when the ball is the observer
// or the view is a close-up.
export function useStageCamera(box: ViewBox, ball: Vector, options: StageOptions, maxHeight: number) {
  // Enlarged, the stylesheet stretches the animation over the space left in the window, and it is drawn to that size.
  const [stageRef, width, stretchedHeight] = useElementSize<HTMLDivElement>(560)
  const heightLimit = options.enlarged ? Math.max(ENLARGED_MIN_HEIGHT, stretchedHeight) : maxHeight
  const boxHeight = box.top - box.bottom
  const fit = Math.min(width / (box.right - box.left), heightLimit / boxHeight)
  const height = options.enlarged ? heightLimit : boxHeight * fit
  const zoom = options.enlarged && options.closeUp ? CLOSE_UP_ZOOM : 1
  const following = options.observer === 'ball' || zoom > 1
  const scale = fit * zoom
  const centerX = following ? ball.x : (box.left + box.right) / 2
  const centerY = following ? ball.y : (box.top + box.bottom) / 2
  return {
    stageRef,
    width,
    height,
    scale,
    following,
    // Pixels available for the weight arrow under a ball at h = 0.
    roomBelow: (-box.bottom * fit - WEIGHT_LABEL_ROOM) * zoom,
    toX: (x: number) => width / 2 + (x - centerX) * scale,
    toY: (y: number) => height / 2 - (y - centerY) * scale,
    toWorld: (x: number, y: number): Vector => ({ x: centerX + (x - width / 2) / scale, y: centerY - (y - height / 2) / scale }),
  }
}

export function largestForce(run: MotionRun, mass: number) {
  let largest = Math.max(mass * GRAVITY, run.resistance)
  for (const stroke of run.forceTrace) {
    for (const [, force] of stroke) largest = Math.max(largest, Math.abs(force))
  }
  // A rope that snaps at once has no trace, but its tension is drawn at the start.
  if (run.outcome === 'snap') {
    for (const [, force] of run.forceContinuation) largest = Math.max(largest, Math.abs(force))
  }
  return largest
}

// Pixels per newton, shared by every force arrow: the largest force of the run is `longest` pixels long,
// unless the weight arrow would then reach below the animation.
export function forceScaleFor(longest: number, roomBelow: number, largest: number, mass: number) {
  return Math.min(longest / largest, roomBelow / (mass * GRAVITY))
}

// A round value whose bar is about SCALE_BAR_PIXELS long.
export function scaleBar(pixelsPerUnit: number) {
  const raw = SCALE_BAR_PIXELS / pixelsPerUnit
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const value = Number(((SCALE_STEPS.findLast((step) => step * magnitude <= raw) ?? 1) * magnitude).toPrecision(1))
  return { value, pixels: value * pixelsPerUnit }
}

export type ForceSet = {
  // The ball is on the circle or the track, so radial and tangential directions exist.
  onPath: boolean
  // Unit vector toward the centre of curvature.
  inward: Vector
  // Tension, rod force or normal force.
  constraint: Vector
  weight: Vector
  weightRadial: Vector
  weightTangential: Vector
  resistance: Vector
  // The radial part of the net force, mv²/R toward the centre.
  centripetal: Vector
  // −ma, the force an observer moving with the ball has to add.
  fictitious: Vector
  fictitiousRadial: Vector
  fictitiousTangential: Vector
}

// Every force on the ball in metres-up coordinates.
export function forceVectors(frame: MotionFrame, mass: number): ForceSet {
  const inward = { x: frame.inwardX, y: frame.inwardY }
  const along = (vector: Vector): Vector => {
    const size = vector.x * inward.x + vector.y * inward.y
    return { x: size * inward.x, y: size * inward.y }
  }
  const minus = (a: Vector, b: Vector): Vector => ({ x: a.x - b.x, y: a.y - b.y })
  const constraint = { x: frame.force * frame.normalX, y: frame.force * frame.normalY }
  const weight = { x: 0, y: -mass * GRAVITY }
  const resistance = { x: frame.resistanceX, y: frame.resistanceY }
  const net = { x: constraint.x + weight.x + resistance.x, y: constraint.y + weight.y + resistance.y }
  const fictitious = { x: -net.x, y: -net.y }
  const weightRadial = along(weight)
  const fictitiousRadial = along(fictitious)
  return {
    onPath: frame.attached,
    inward,
    constraint,
    weight,
    weightRadial,
    weightTangential: minus(weight, weightRadial),
    resistance,
    centripetal: along(net),
    fictitious,
    fictitiousRadial,
    fictitiousTangential: minus(fictitious, fictitiousRadial),
  }
}
