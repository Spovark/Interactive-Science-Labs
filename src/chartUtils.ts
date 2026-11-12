const NICE_CEILINGS = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]
const NICE_TICK_FACTORS = [1, 2, 2.5, 5, 10]
const ZERO_BASED_FACTORS = [1, 2, 2.5, 5]

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function snap(value: number, step: number) {
  return Number((Math.round(value / step) * step).toFixed(6))
}

export function niceCeil(value: number) {
  if (value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  return (NICE_CEILINGS.find((ceiling) => ceiling * magnitude >= value - 1e-9) ?? 10) * magnitude
}

export function niceTicks(min: number, max: number, targetCount: number) {
  const rough = (max - min) / Math.max(1, targetCount)
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step = (NICE_TICK_FACTORS.find((factor) => factor * magnitude >= rough) ?? 10) * magnitude
  const first = Math.ceil(min / step - 1e-9)
  const last = Math.floor(max / step + 1e-9)
  return Array.from({ length: last - first + 1 }, (_, index) => Number(((first + index) * step).toFixed(6)))
}

// Ticks for an axis from 0 to `axisMax` that land exactly on the end of the axis.
export function zeroBasedTicks(axisMax: number, targetCount: number) {
  const magnitude = 10 ** Math.floor(Math.log10(axisMax / targetCount))
  const fits = (candidate: number) => {
    const count = axisMax / candidate
    return count <= targetCount && Math.abs(count - Math.round(count)) < 1e-9
  }
  const candidates = [magnitude, magnitude * 10].flatMap((scale) => ZERO_BASED_FACTORS.map((factor) => factor * scale))
  const step = candidates.find(fits) ?? [magnitude * 4, magnitude * 40].find(fits) ?? axisMax
  return Array.from({ length: Math.round(axisMax / step) + 1 }, (_, index) => Number((index * step).toFixed(6)))
}

export function linearScale(domainStart: number, domainEnd: number, rangeStart: number, rangeEnd: number) {
  return (value: number) => rangeStart + ((value - domainStart) / (domainEnd - domainStart)) * (rangeEnd - rangeStart)
}

export function formatValue(value: number, digits = 1) {
  const magnitude = Math.abs(value).toFixed(digits)
  return `${value < 0 && Number(magnitude) !== 0 ? '−' : ''}${magnitude}`
}

export function formatChange(value: number, digits = 1) {
  const text = formatValue(value, digits)
  return value > 0 && Number(text) !== 0 ? `+${text}` : text
}

export function formatTick(value: number) {
  return String(value).replace('-', '−')
}

export function tracePath(points: [number, number][], xFor: (x: number) => number, yFor: (y: number) => number) {
  return points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${xFor(x).toFixed(2)} ${yFor(y).toFixed(2)}`).join('')
}
