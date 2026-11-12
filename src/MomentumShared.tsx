export type MomentumHelpTopic = 'momentumSpeed' | 'energySpeed' | 'impulse' | 'work' | 'track' | 'collisionMomentum' | 'collisionEnergy'
export type OpenHelp = (topic: MomentumHelpTopic) => void

export const COLOR_A = 'var(--momentum-a)'
export const COLOR_B = 'var(--momentum-b)'
export const COLOR_TOTAL = 'var(--momentum-total)'
export const COLOR_SPRING = 'var(--momentum-spring)'
export const COLOR_HEAT = 'var(--momentum-heat)'

const WHEEL_RADIUS = 8
const BODY_HEIGHT = 22
const BLOCK_HEIGHT = 11
const BLOCK_GAP = 2
const BLOCKS_PER_ROW = 3
const WIDE_CART_LABEL_WIDTH = 72

export const CART_HEIGHT = WHEEL_RADIUS * 2 + BODY_HEIGHT + 2 * (BLOCK_HEIGHT + BLOCK_GAP)
export const CART_BODY_CENTER = WHEEL_RADIUS * 2 + BODY_HEIGHT / 2

type CartProps = {
  x: number
  railY: number
  width: number
  mass: number
  color: string
  name?: string
}

export function Cart({ x, railY, width, mass, color, name }: CartProps) {
  const left = x - width / 2
  const bodyTop = railY - WHEEL_RADIUS * 2 - BODY_HEIGHT
  const inset = width * 0.06
  const blockWidth = (width - 2 * inset - (BLOCKS_PER_ROW - 1) * BLOCK_GAP) / BLOCKS_PER_ROW
  const fullBlocks = Math.floor(mass)
  const blockCount = fullBlocks + (mass > fullBlocks ? 1 : 0)
  const wheelAngle = (x / WHEEL_RADIUS) * (180 / Math.PI)
  const massText = `${mass} kg`
  const label = name ? (width >= WIDE_CART_LABEL_WIDTH ? `${name} ${massText}` : name) : massText

  return (
    <g>
      {Array.from({ length: blockCount }, (_, index) => (
        <rect
          key={index}
          x={left + inset + (index % BLOCKS_PER_ROW) * (blockWidth + BLOCK_GAP)}
          y={bodyTop - (Math.floor(index / BLOCKS_PER_ROW) + 1) * (BLOCK_HEIGHT + BLOCK_GAP)}
          width={index === fullBlocks ? blockWidth / 2 : blockWidth}
          height={BLOCK_HEIGHT}
          rx={2}
          fill={color}
          fillOpacity={0.55}
        />
      ))}
      <rect x={left} y={bodyTop} width={width} height={BODY_HEIGHT} rx={5} fill={color} />
      <text x={x} y={bodyTop + 15} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--momentum-on-cart)">{label}</text>
      {[left + width * 0.24, left + width * 0.76].map((wheelX) => (
        <g key={wheelX} transform={`translate(${wheelX} ${railY - WHEEL_RADIUS}) rotate(${wheelAngle})`}>
          <circle r={WHEEL_RADIUS - 1} fill="var(--lab-surface)" stroke="var(--lab-axis)" strokeWidth={2} />
          <line x1={-WHEEL_RADIUS + 2} x2={WHEEL_RADIUS - 2} stroke="var(--lab-axis)" strokeWidth={1.5} />
        </g>
      ))}
    </g>
  )
}

export function CartGhost({ x, railY, width, color, opacity }: { x: number; railY: number; width: number; color: string; opacity: number }) {
  return <rect x={x - width / 2} y={railY - WHEEL_RADIUS * 2 - BODY_HEIGHT} width={width} height={BODY_HEIGHT} rx={5} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={opacity} />
}

type ArrowProps = {
  from: number
  to: number
  y: number
  color: string
  thickness?: number
}

// A horizontal arrow whose head grows with its thickness, for velocities and momenta along the track.
export function Arrow({ from, to, y, color, thickness = 3 }: ArrowProps) {
  const span = to - from
  if (Math.abs(span) < 0.5) return null
  const direction = Math.sign(span)
  const head = Math.min(Math.abs(span), Math.max(10, thickness * 1.8))
  const neck = to - direction * head
  const halfHead = Math.max(5.5, thickness)
  return (
    <g>
      {neck !== from && <line x1={from} x2={neck} y1={y} y2={y} stroke={color} strokeWidth={thickness} />}
      <path d={`M${to} ${y}L${neck} ${y - halfHead}L${neck} ${y + halfHead}Z`} fill={color} />
    </g>
  )
}

type RulerProps = {
  xFor: (meters: number) => number
  ticks: number[]
  minorTicks?: number[]
  y: number
  labelled?: boolean
  width: number
}

export function Ruler({ xFor, ticks, minorTicks = [], y, labelled = true, width }: RulerProps) {
  return (
    <g>
      <line x1={0} x2={width} y1={y} y2={y} stroke="var(--lab-axis)" strokeWidth={2} />
      {minorTicks.map((tick) => <line key={tick} x1={xFor(tick)} x2={xFor(tick)} y1={y} y2={y + 4} stroke="var(--lab-axis)" strokeOpacity={0.6} />)}
      {ticks.map((tick, index) => (
        <g key={tick}>
          <line x1={xFor(tick)} x2={xFor(tick)} y1={y} y2={y + 7} stroke="var(--lab-axis)" />
          {labelled && <text x={xFor(tick)} y={y + 20} textAnchor="middle" fontSize="11" fill="var(--lab-muted)">{index === ticks.length - 1 ? `${tick} m` : tick}</text>}
        </g>
      ))}
    </g>
  )
}
