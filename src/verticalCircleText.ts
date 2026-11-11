import { GRAVITY, TIME_LIMIT, TRACK_RADIUS, type MotionRun } from './verticalCirclePhysics'

// Every combination of what holds the ball and where it starts.
export type SceneKind = 'rope' | 'rod' | 'inside-height' | 'tube-height' | 'inside-bottom' | 'tube-bottom' | 'outside'
export type ThresholdRow = { id: string; label: string; condition: string }

export function chipLabel(run: MotionRun, scene: SceneKind) {
  switch (run.outcome) {
    case 'swing': return scene.endsWith('height') ? '來回滑動' : '來回擺動'
    case 'loop': return '完成圓周'
    case 'exit': return '通過迴圈'
    case 'leave': return scene === 'rope' ? '繩子鬆弛' : '離開軌道'
    case 'rest': return '停止'
    default: return `已模擬 ${TIME_LIMIT} 秒`
  }
}

function speedTex(speed: number) {
  return `${speed.toFixed(2)}\\ \\text{m/s}`
}

export function thresholdRows(scene: SceneKind, radius: number): ThresholdRow[] {
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
        { id: 'swing', label: '來回滑動', condition: `H \\le R = ${TRACK_RADIUS}\\ \\text{m}` },
        { id: 'leave', label: '離開軌道', condition: 'R < H < \\tfrac{5}{2}R' },
        { id: 'exit', label: '通過迴圈', condition: `H \\ge \\tfrac{5}{2}R = ${2.5 * TRACK_RADIUS}\\ \\text{m}` },
      ]
    case 'tube-height':
      return [
        { id: 'swing', label: '來回滑動', condition: `H < 2R = ${2 * TRACK_RADIUS}\\ \\text{m}` },
        { id: 'exit', label: '通過迴圈', condition: 'H > 2R' },
      ]
    case 'outside':
      return [
        { id: 'slide', label: '滑下後離開', condition: `v_0 < \\sqrt{gR} = ${speedTex(Math.sqrt(gr))}` },
        { id: 'top', label: '立刻離開', condition: 'v_0 \\ge \\sqrt{gR}' },
      ]
    default:
      return [
        { id: 'swing', label: '來回擺動', condition: `v_0 \\le \\sqrt{2gR} = ${speedTex(Math.sqrt(2 * gr))}` },
        { id: 'leave', label: scene === 'rope' ? '繩子鬆弛' : '離開軌道', condition: '\\sqrt{2gR} < v_0 < \\sqrt{5gR}' },
        { id: 'loop', label: '完成圓周', condition: `v_0 \\ge \\sqrt{5gR} = ${speedTex(Math.sqrt(5 * gr))}` },
      ]
  }
}

// The row that describes this run; the table only covers motion without resistance.
export function activeThreshold(run: MotionRun, scene: SceneKind) {
  if (run.resistance > 0) return null
  if (scene === 'outside') return run.leaveAngle !== null && run.leaveAngle > 1e-6 ? 'slide' : 'top'
  if (run.outcome === 'swing' || run.outcome === 'loop' || run.outcome === 'exit' || run.outcome === 'leave') return run.outcome
  return null
}
