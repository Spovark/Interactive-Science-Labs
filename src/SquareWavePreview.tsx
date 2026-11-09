const HARMONIC_TERMS = 15
const PERIODS = 2
const SAMPLE_COUNT = 800

function fundamental(x: number) {
  return (4 / Math.PI) * Math.sin(x)
}

function partialSum(x: number) {
  let sum = 0
  for (let n = 1; n <= HARMONIC_TERMS; n += 2) sum += (4 / (Math.PI * n)) * Math.sin(n * x)
  return sum
}

function target(x: number) {
  return Math.sin(x) >= 0 ? 1 : -1
}

function tracePath(wave: (x: number) => number, width: number, height: number, scale: number) {
  return Array.from({ length: SAMPLE_COUNT }, (_, i) => {
    const progress = i / (SAMPLE_COUNT - 1)
    // A tiny offset keeps the first sample off the jump at x = 0.
    const x = progress * PERIODS * 2 * Math.PI + 1e-6
    return `${i === 0 ? 'M' : 'L'}${(progress * width).toFixed(2)} ${(height / 2 - wave(x) * scale).toFixed(2)}`
  }).join('')
}

const ART_WIDTH = 380
const ART_HEIGHT = 190
const ART_SCALE = 58
const ART_PATHS = {
  fundamental: tracePath(fundamental, ART_WIDTH, ART_HEIGHT, ART_SCALE),
  target: tracePath(target, ART_WIDTH, ART_HEIGHT, ART_SCALE),
  sum: tracePath(partialSum, ART_WIDTH, ART_HEIGHT, ART_SCALE),
}
const ICON_PATH = tracePath(partialSum, 40, 40, 12)

export function SquareWaveArt() {
  return (
    <svg viewBox={`0 0 ${ART_WIDTH} ${ART_HEIGHT}`} role="presentation">
      <path className="wave-grid" d="M0 38H380M0 95H380M0 152H380M38 0V190M114 0V190M190 0V190M266 0V190M342 0V190" />
      <path className="wave-line wave-line-fundamental" d={ART_PATHS.fundamental} />
      <path className="wave-line wave-line-sum" d={ART_PATHS.sum} />
      <path className="wave-line wave-line-target" d={ART_PATHS.target} />
    </svg>
  )
}

export function SquareWaveIcon() {
  return (
    <svg className="lab-card-wave" viewBox="0 0 40 40" role="presentation">
      <path d={ICON_PATH} />
    </svg>
  )
}
