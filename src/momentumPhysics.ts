export const TRACK_LENGTH = 12
export const CART_WIDTH = 1.5
export const BUMPER_LENGTH = 0.5
export const START_POSITION_A = 2.5
export const START_POSITION_B = 9.5
export const CONTACT_PLAYBACK_SECONDS = 1.6

const BUMPER_STIFFNESS = 600
const TOUCH_DISTANCE = CART_WIDTH + 2 * BUMPER_LENGTH
const MIN_POSITION_A = CART_WIDTH / 2
const MAX_POSITION_B = TRACK_LENGTH - CART_WIDTH / 2
const RUN_AFTER_COLLISION_LIMIT = 4
const RUN_WITHOUT_COLLISION_LIMIT = 3
// A critically damped contact never reaches zero compression, so it ends once the remainder is invisible.
const STUCK_SETTLE_RADIANS = 7

export type CollisionInput = {
  massA: number
  massB: number
  velocityA: number
  velocityB: number
  restitution: number
}

export type CollisionFrame = {
  positionA: number
  positionB: number
  velocityA: number
  velocityB: number
  momentumA: number
  momentumB: number
  kineticA: number
  kineticB: number
  elastic: number
  heat: number
  centerOfMass: number
  compression: number
}

export type CollisionRun = {
  collides: boolean
  closingSpeed: number
  touchTime: number
  separateTime: number
  endTime: number
  totalMomentum: number
  totalEnergy: number
  frameAt: (time: number) => CollisionFrame
}

function kineticEnergy(mass: number, velocity: number) {
  return 0.5 * mass * velocity ** 2
}

function timeToTrackEnd(positionA: number, velocityA: number, positionB: number, velocityB: number) {
  const timeA = velocityA < 0 ? (MIN_POSITION_A - positionA) / velocityA : Infinity
  const timeB = velocityB > 0 ? (MAX_POSITION_B - positionB) / velocityB : Infinity
  return Math.max(0, Math.min(timeA, timeB))
}

// The bumpers act as one spring and damper between the carts. Damping is chosen so the
// closed-form contact ends with exactly the requested coefficient of restitution.
export function solveCollision(input: CollisionInput): CollisionRun {
  const { massA, massB, velocityA, velocityB, restitution } = input
  const totalMass = massA + massB
  const shareA = massA / totalMass
  const shareB = massB / totalMass
  const centerVelocity = shareA * velocityA + shareB * velocityB
  const centerStart = shareA * START_POSITION_A + shareB * START_POSITION_B
  const closingSpeed = velocityA - velocityB
  const startDistance = START_POSITION_B - START_POSITION_A
  const totalEnergy = kineticEnergy(massA, velocityA) + kineticEnergy(massB, velocityB)

  const frequency = Math.sqrt((BUMPER_STIFFNESS * totalMass) / (massA * massB))
  const logRestitution = Math.log(restitution)
  const damping = restitution > 0 ? -logRestitution / Math.hypot(Math.PI, logRestitution) : 1
  const dampedFrequency = frequency * Math.sqrt(1 - damping ** 2)
  const contactDuration = restitution > 0 ? Math.PI / dampedFrequency : STUCK_SETTLE_RADIANS / frequency

  const touchTime = closingSpeed > 0 ? (startDistance - TOUCH_DISTANCE) / closingSpeed : Infinity
  const separateTime = touchTime + contactDuration
  const centerAtSeparation = centerStart + centerVelocity * separateTime
  // A contact cut short by the end of the track would have no "after" state to show.
  const collides = touchTime < timeToTrackEnd(START_POSITION_A, velocityA, START_POSITION_B, velocityB)
    && centerAtSeparation - shareB * TOUCH_DISTANCE >= MIN_POSITION_A
    && centerAtSeparation + shareA * TOUCH_DISTANCE <= MAX_POSITION_B

  const contactAt = (elapsed: number) => {
    const decay = Math.exp(-damping * frequency * elapsed)
    if (restitution === 0) {
      return { compression: closingSpeed * elapsed * decay, closingRate: closingSpeed * (1 - frequency * elapsed) * decay }
    }
    const angle = dampedFrequency * elapsed
    return {
      compression: (closingSpeed / dampedFrequency) * decay * Math.sin(angle),
      closingRate: closingSpeed * decay * (Math.cos(angle) - ((damping * frequency) / dampedFrequency) * Math.sin(angle)),
    }
  }

  const frameAt = (time: number): CollisionFrame => {
    let distance = startDistance - closingSpeed * time
    let closingRate = closingSpeed
    let compression = 0
    if (collides && time >= touchTime) {
      if (time < separateTime) {
        const contact = contactAt(time - touchTime)
        compression = contact.compression
        closingRate = contact.closingRate
        distance = TOUCH_DISTANCE - compression
      } else {
        closingRate = -restitution * closingSpeed
        distance = TOUCH_DISTANCE - closingRate * (time - separateTime)
      }
    }
    const centerOfMass = centerStart + centerVelocity * time
    const currentVelocityA = centerVelocity + shareB * closingRate
    const currentVelocityB = centerVelocity - shareA * closingRate
    const kineticA = kineticEnergy(massA, currentVelocityA)
    const kineticB = kineticEnergy(massB, currentVelocityB)
    const elastic = 0.5 * BUMPER_STIFFNESS * compression ** 2
    return {
      positionA: centerOfMass - shareB * distance,
      positionB: centerOfMass + shareA * distance,
      velocityA: currentVelocityA,
      velocityB: currentVelocityB,
      momentumA: massA * currentVelocityA,
      momentumB: massB * currentVelocityB,
      kineticA,
      kineticB,
      elastic,
      heat: Math.max(0, totalEnergy - kineticA - kineticB - elastic),
      centerOfMass,
      compression,
    }
  }

  let endTime = Math.min(RUN_WITHOUT_COLLISION_LIMIT, touchTime, timeToTrackEnd(START_POSITION_A, velocityA, START_POSITION_B, velocityB))
  if (collides) {
    const separated = frameAt(separateTime)
    endTime = separateTime + Math.min(RUN_AFTER_COLLISION_LIMIT, timeToTrackEnd(separated.positionA, separated.velocityA, separated.positionB, separated.velocityB))
  }

  return {
    collides,
    closingSpeed,
    touchTime,
    separateTime,
    endTime,
    totalMomentum: massA * velocityA + massB * velocityB,
    totalEnergy,
    frameAt,
  }
}

// Playback time stretches the brief contact to a fixed length so it can be watched and scrubbed.
export function playbackLength(run: CollisionRun) {
  return run.collides ? run.touchTime + CONTACT_PLAYBACK_SECONDS + (run.endTime - run.separateTime) : run.endTime
}

export function playbackToTime(run: CollisionRun, position: number) {
  if (!run.collides || position <= run.touchTime) return position
  const sinceTouch = position - run.touchTime
  if (sinceTouch < CONTACT_PLAYBACK_SECONDS) {
    return run.touchTime + (sinceTouch / CONTACT_PLAYBACK_SECONDS) * (run.separateTime - run.touchTime)
  }
  return run.separateTime + sinceTouch - CONTACT_PLAYBACK_SECONDS
}

export function timeToPlayback(run: CollisionRun, time: number) {
  if (!run.collides || time <= run.touchTime) return time
  if (time < run.separateTime) {
    return run.touchTime + ((time - run.touchTime) / (run.separateTime - run.touchTime)) * CONTACT_PLAYBACK_SECONDS
  }
  return run.touchTime + CONTACT_PLAYBACK_SECONDS + (time - run.separateTime)
}

export type PushMode = 'time' | 'displacement'

export type PushInput = {
  massA: number
  massB: number
  force: number
  mode: PushMode
  limit: number
}

export type PushFrame = {
  position: number
  velocity: number
  momentum: number
  kinetic: number
  pushTime: number
  pushDisplacement: number
  pushing: boolean
}

export type PushCart = {
  duration: number
  displacement: number
  frameAt: (time: number) => PushFrame
}

export type PushRun = {
  cartA: PushCart
  cartB: PushCart
  endTime: number
}

function solvePushCart(mass: number, force: number, mode: PushMode, limit: number): PushCart {
  const acceleration = force / mass
  const duration = mode === 'time' ? limit : Math.sqrt((2 * limit) / acceleration)
  return {
    duration,
    displacement: 0.5 * acceleration * duration ** 2,
    frameAt: (time) => {
      const pushTime = Math.min(time, duration)
      const velocity = acceleration * pushTime
      const pushDisplacement = 0.5 * acceleration * pushTime ** 2
      return {
        position: pushDisplacement + velocity * (time - pushTime),
        velocity,
        momentum: mass * velocity,
        kinetic: kineticEnergy(mass, velocity),
        pushTime,
        pushDisplacement,
        pushing: time < duration,
      }
    },
  }
}

export function solvePush({ massA, massB, force, mode, limit }: PushInput): PushRun {
  const cartA = solvePushCart(massA, force, mode, limit)
  const cartB = solvePushCart(massB, force, mode, limit)
  return { cartA, cartB, endTime: Math.max(cartA.duration, cartB.duration) }
}
