import { formatValue } from './chartUtils'
import { GRAVITY, TIME_LIMIT, type MotionRun } from './verticalCirclePhysics'

// Every combination of what holds the ball and where it starts.
export type SceneKind = 'rope' | 'rod' | 'inside-height' | 'tube-height' | 'inside-bottom' | 'tube-bottom' | 'outside' | 'half'
export type ThresholdRow = { id: string; label: string; condition: string }

export function chipLabel(run: MotionRun, scene: SceneKind) {
  switch (run.outcome) {
    case 'swing': return scene.endsWith('height') ? '來回滑動' : '來回擺動'
    case 'loop': return '完成圓周'
    case 'exit': return scene === 'half' ? '滑回地面' : '通過迴圈'
    case 'launch': return '平拋'
    case 'leave': return scene === 'rope' ? '繩子鬆弛' : '離開軌道'
    case 'rest': return '停止'
    case 'snap': return '繩子斷裂'
    default: return `已模擬 ${TIME_LIMIT} 秒`
  }
}

function speedTex(speed: number) {
  return `${speed.toFixed(2)}\\ \\text{m/s}`
}

// `mass` and `strength` add the row for a rope that snaps.
export function thresholdRows(scene: SceneKind, radius: number, mass = 0, strength = 0): ThresholdRow[] {
  const gr = GRAVITY * radius
  switch (scene) {
    case 'rod':
    case 'tube-bottom':
      return [
        { id: 'swing', label: '來回擺動', condition: `v_0 < 2\\sqrt{gR} = ${speedTex(2 * Math.sqrt(gr))}` },
        { id: 'loop', label: '完成圓周', condition: 'v_0 > 2\\sqrt{gR}' },
      ]
    case 'inside-height':
      return [
        { id: 'swing', label: '來回滑動', condition: `H \\le R = ${formatValue(radius)}\\ \\text{m}` },
        { id: 'leave', label: '離開軌道', condition: 'R < H < \\tfrac{5}{2}R' },
        { id: 'exit', label: '通過迴圈', condition: `H \\ge \\tfrac{5}{2}R = ${formatValue(2.5 * radius, 2)}\\ \\text{m}` },
      ]
    case 'tube-height':
      return [
        { id: 'swing', label: '來回滑動', condition: `H < 2R = ${formatValue(2 * radius)}\\ \\text{m}` },
        { id: 'exit', label: '通過迴圈', condition: 'H > 2R' },
      ]
    case 'half':
      return [
        { id: 'back', label: '滑回地面', condition: `v_0 \\le \\sqrt{2gR} = ${speedTex(Math.sqrt(2 * gr))}` },
        { id: 'leave', label: '離開軌道', condition: '\\sqrt{2gR} < v_0 < \\sqrt{5gR}' },
        { id: 'top', label: '從頂端平拋', condition: `v_0 \\ge \\sqrt{5gR} = ${speedTex(Math.sqrt(5 * gr))}` },
      ]
    case 'outside':
      return [
        { id: 'slide', label: '滑下後離開', condition: `v_0 < \\sqrt{gR} = ${speedTex(Math.sqrt(gr))}` },
        { id: 'top', label: '立刻離開', condition: 'v_0 \\ge \\sqrt{gR}' },
      ]
    default: {
      const rows = [
        { id: 'swing', label: '來回擺動', condition: `v_0 \\le \\sqrt{2gR} = ${speedTex(Math.sqrt(2 * gr))}` },
        { id: 'leave', label: scene === 'rope' ? '繩子鬆弛' : '離開軌道', condition: '\\sqrt{2gR} < v_0 < \\sqrt{5gR}' },
        { id: 'loop', label: '完成圓周', condition: `v_0 \\ge \\sqrt{5gR} = ${speedTex(Math.sqrt(5 * gr))}` },
      ]
      if (scene !== 'rope' || mass <= 0) return rows
      // The tension is largest at the lowest point, where it is mg + mv₀²/R.
      const reach = strength / mass - GRAVITY
      const condition = reach > 0 ? `v_0 > \\sqrt{\\left(\\tfrac{T_{\\max}}{m} - g\\right)R} = ${speedTex(Math.sqrt(reach * radius))}` : 'v_0 > 0'
      return [...rows, { id: 'snap', label: '繩子斷裂', condition }]
    }
  }
}

// The row that describes this run; the table only covers motion without resistance.
export function activeThreshold(run: MotionRun, scene: SceneKind) {
  // The tension is largest at the lowest point, so a rope that snaps anywhere satisfies the row's condition.
  if (run.outcome === 'snap') return 'snap'
  if (run.resistance > 0) return null
  if (scene === 'outside') return run.leaveAngle !== null && run.leaveAngle > 1e-6 ? 'slide' : 'top'
  if (scene === 'half') return run.outcome === 'launch' ? 'top' : run.outcome === 'exit' ? 'back' : run.outcome === 'leave' ? 'leave' : null
  if (run.outcome === 'swing' || run.outcome === 'loop' || run.outcome === 'exit' || run.outcome === 'leave') return run.outcome
  return null
}
