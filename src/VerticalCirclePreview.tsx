const CENTER_X = 190
const CENTER_Y = 90
const RADIUS = 66
const BALL_ANGLE = 125
const GHOST_ANGLES = [35, 65, 95]
const ARROW_LENGTH = 42

// Angles are measured from the lowest point, turning counterclockwise on screen.
function pointAt(degrees: number, radius = RADIUS) {
  const angle = (degrees * Math.PI) / 180
  return { x: CENTER_X + radius * Math.sin(angle), y: CENTER_Y + radius * Math.cos(angle) }
}

const ball = pointAt(BALL_ANGLE)
// Unit vector of the velocity, tangent to the circle in the direction of motion.
const direction = { x: Math.cos((BALL_ANGLE * Math.PI) / 180), y: -Math.sin((BALL_ANGLE * Math.PI) / 180) }
const arrowTip = { x: ball.x + ARROW_LENGTH * direction.x, y: ball.y + ARROW_LENGTH * direction.y }
const headLeft = { x: arrowTip.x - 10 * direction.x - 7 * direction.y, y: arrowTip.y - 10 * direction.y + 7 * direction.x }
const headRight = { x: arrowTip.x - 10 * direction.x + 7 * direction.y, y: arrowTip.y - 10 * direction.y - 7 * direction.x }

export function VerticalCircleArt() {
  return (
    <svg viewBox="0 0 380 190" role="presentation">
      <path className="wave-grid" d="M0 38H380M0 95H380M0 152H380M38 0V190M114 0V190M190 0V190M266 0V190M342 0V190" />
      <path className="circle-art-ground" d={`M60 ${CENTER_Y + RADIUS}H320`} />
      <circle className="circle-art-path" cx={CENTER_X} cy={CENTER_Y} r={RADIUS} />
      {GHOST_ANGLES.map((degrees, index) => {
        const ghost = pointAt(degrees)
        return <circle key={degrees} className="circle-art-ghost" cx={ghost.x} cy={ghost.y} r={9} opacity={0.3 + index * 0.2} />
      })}
      <line className="circle-art-rope" x1={CENTER_X} y1={CENTER_Y} x2={ball.x} y2={ball.y} />
      <circle className="circle-art-pivot" cx={CENTER_X} cy={CENTER_Y} r={4.5} />
      <circle className="circle-art-ball" cx={ball.x} cy={ball.y} r={10} />
      <path className="circle-art-arrow" d={`M${ball.x} ${ball.y}L${arrowTip.x} ${arrowTip.y}M${headLeft.x} ${headLeft.y}L${arrowTip.x} ${arrowTip.y}L${headRight.x} ${headRight.y}`} />
    </svg>
  )
}

export function VerticalCircleIcon() {
  return (
    <svg className="lab-card-wave" viewBox="0 0 40 40" role="presentation">
      <circle cx="20" cy="18" r="12" strokeDasharray="2.5 3" />
      <path d="M20 18L28.5 26.5" />
      <circle cx="20" cy="18" r="1.6" fill="currentColor" />
      <circle cx="28.5" cy="26.5" r="3.4" fill="currentColor" />
    </svg>
  )
}
