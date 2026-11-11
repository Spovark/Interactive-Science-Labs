export type SeriesBasis = 'sin' | 'cos'

export type SoundWave = {
  // amplitudes[i] belongs to harmonic i + 1, the same coefficients the wave plot uses.
  amplitudes: readonly number[]
  basis: SeriesBasis
  peak: number
}

export const MIN_FUNDAMENTAL = 100
export const MAX_FUNDAMENTAL = 1000
export const DEFAULT_FUNDAMENTAL = 220
// −6 dB on the volume taper.
export const DEFAULT_VOLUME = 85
// Upper limit of human hearing. Harmonics above it are left out of the sound.
export const MAX_AUDIBLE_FREQUENCY = 20000

// The output is always wave × volume gain × this, so the sound stays proportional to the plotted wave.
const OUTPUT_PER_UNIT = 0.45
// Highest output allowed, kept a little under the clipping level of 1 for headroom.
const MAX_OUTPUT = 0.9
const PEAK_SAMPLES = 4096
// Chrome weakens harmonics near half the sample rate. At the usual 48 kHz that starts below 20 kHz,
// so the audio runs at 96 kHz, which keeps every harmonic up to 20 kHz at full strength.
const SAMPLE_RATE = 96000
const LEVEL_TIME_CONSTANT = 0.015
// Turning the level down must be finished before a larger wave starts to be heard (SCHEDULE_AHEAD later).
const LEVEL_DOWN_TIME_CONSTANT = 0.002
const FREQUENCY_TIME_CONSTANT = 0.01
const CROSSFADE_TIME_CONSTANT = 0.004
// Wave changes start this far ahead, so the new table has reached the audio thread before it is heard.
const SCHEDULE_AHEAD = 0.01
// After six time constants a crossfade is within 0.25 % of its end.
const CROSSFADE_LENGTH = 6 * CROSSFADE_TIME_CONSTANT
// By then the fade-out has decayed by about e^-8, well below hearing.
const STOP_DELAY = 0.12
const SUSPEND_DELAY_MS = 250

let sineTable: Float32Array | null = null

function getSineTable() {
  if (!sineTable) {
    sineTable = new Float32Array(PEAK_SAMPLES)
    for (let i = 0; i < PEAK_SAMPLES; i += 1) sineTable[i] = Math.sin((2 * Math.PI * i) / PEAK_SAMPLES)
  }
  return sineTable
}

export function makeSoundWave(amplitudes: readonly number[], basis: SeriesBasis): SoundWave {
  const table = getSineTable()
  // cos(nθ) = sin(nθ + π/2), a quarter of the table ahead.
  const offset = basis === 'cos' ? PEAK_SAMPLES / 4 : 0
  let peak = 0
  for (let m = 0; m < PEAK_SAMPLES; m += 1) {
    let value = 0
    for (let i = 0; i < amplitudes.length; i += 1) {
      if (amplitudes[i] !== 0) value += amplitudes[i] * table[((i + 1) * m + offset) % PEAK_SAMPLES]
    }
    peak = Math.max(peak, Math.abs(value))
  }
  return { amplitudes, basis, peak }
}

// The level falls by a fixed 0.4 dB per slider percent, so equal slider moves are equal ratios of
// loudness. The slope comes from a fit to measurements of iPhone volume steps. 0 % is true silence.
// Returns 0 to 1.
const VOLUME_RANGE_DB = 40

export function volumeGain(percent: number) {
  if (percent <= 0) return 0
  return 10 ** (-VOLUME_RANGE_DB * (1 - Math.min(percent, 100) / 100) / 20)
}

// The highest whole slider percentage at which this wave does not clip. Clipping is avoided only by
// turning the volume control down, as a person at an amplifier would; the wave itself is never rescaled.
export function maxVolumeFor(peak: number) {
  let percent = 100
  while (percent > 0 && peak * volumeGain(percent) * OUTPUT_PER_UNIT > MAX_OUTPUT) percent -= 1
  return percent
}

// Web Audio plays real[k] cos(2πkft) + imag[k] sin(2πkft) summed over k, so the plot's
// coefficients go in unchanged. Normalization is off so the shape and size stay exact.
export function createSeriesWave(context: BaseAudioContext, wave: SoundWave) {
  const size = wave.amplitudes.length + 1
  const real = new Float32Array(size)
  const imag = new Float32Array(size)
  const terms = wave.basis === 'cos' ? real : imag
  wave.amplitudes.forEach((amplitude, i) => { terms[i + 1] = amplitude })
  return context.createPeriodicWave(real, imag, { disableNormalization: true })
}

// Two oscillators run in step. A new wave goes onto the silent one, then the two crossfade,
// because swapping the table of the audible oscillator would make the output jump and click.
type Path = { oscillator: OscillatorNode; weight: GainNode }
type Voice = {
  paths: [Path, Path]
  active: 0 | 1
  master: GainNode
  wave: SoundWave | null
  pending: SoundWave | null
  busyUntil: number
  timer: number | undefined
  frequency: number
  level: number
}
type AudioSessionNavigator = Navigator & { audioSession?: { type: string } }

function createAudioContext() {
  try {
    return new AudioContext({ sampleRate: SAMPLE_RATE })
  } catch {
    return new AudioContext()
  }
}

export class FourierSoundPlayer {
  private context: AudioContext | null = null
  private voice: Voice | null = null
  private suspendTimer: number | undefined

  // Call this from the user's click: browsers only let audio start from a user action.
  start() {
    if (this.voice) return
    // On iPhone this lets the sound play even when the ring/silent switch is set to silent.
    const session = (navigator as AudioSessionNavigator).audioSession
    if (session) session.type = 'playback'
    if (!this.context || this.context.state === 'closed') this.context = createAudioContext()
    const context = this.context
    window.clearTimeout(this.suspendTimer)
    context.resume().catch(() => undefined)
    const master = context.createGain()
    master.gain.value = 0
    master.connect(context.destination)
    // The same start time and the same frequency changes keep both oscillators exactly in phase.
    const startTime = context.currentTime + SCHEDULE_AHEAD
    const makePath = (weight: number): Path => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      gain.gain.value = weight
      oscillator.connect(gain)
      gain.connect(master)
      oscillator.start(startTime)
      return { oscillator, weight: gain }
    }
    this.voice = { paths: [makePath(1), makePath(0)], active: 0, master, wave: null, pending: null, busyUntil: 0, timer: undefined, frequency: 0, level: 0 }
  }

  // volume is the gain from volumeGain, 0 to 1.
  update(wave: SoundWave, frequency: number, volume: number) {
    const { context, voice } = this
    if (!context || !voice) return
    const now = context.currentTime
    const isFirstUpdate = voice.wave === null
    if (isFirstUpdate) {
      // Nothing is audible yet, so the first wave goes straight onto the active oscillator.
      voice.paths[voice.active].oscillator.setPeriodicWave(createSeriesWave(context, wave))
      voice.wave = wave
    } else {
      voice.pending = wave
      this.crossfadeWhenReady(voice)
    }
    if (frequency !== voice.frequency) {
      for (const { oscillator } of voice.paths) {
        // Start on the right pitch, then glide between pitches so dragging the slider does not click.
        if (isFirstUpdate) oscillator.frequency.setValueAtTime(frequency, now)
        else oscillator.frequency.setTargetAtTime(frequency, now, FREQUENCY_TIME_CONSTANT)
      }
      voice.frequency = frequency
    }
    const level = volume * OUTPUT_PER_UNIT
    if (isFirstUpdate || level !== voice.level) {
      voice.master.gain.setTargetAtTime(level, now, level < voice.level ? LEVEL_DOWN_TIME_CONSTANT : LEVEL_TIME_CONSTANT)
      voice.level = level
    }
  }

  // One crossfade at a time. Changes that arrive meanwhile, such as a slider being dragged,
  // collapse into the latest wave, which starts as soon as the current crossfade ends.
  private crossfadeWhenReady(voice: Voice) {
    const context = this.context
    if (!context || voice !== this.voice || voice.timer !== undefined) return
    const wait = voice.busyUntil - context.currentTime
    if (wait > 0) {
      voice.timer = window.setTimeout(() => {
        voice.timer = undefined
        this.crossfadeWhenReady(voice)
      }, wait * 1000)
      return
    }
    const wave = voice.pending
    voice.pending = null
    if (!wave || wave === voice.wave) return
    const from = voice.paths[voice.active]
    const next = voice.active === 0 ? 1 : 0
    const to = voice.paths[next]
    const at = context.currentTime + SCHEDULE_AHEAD
    to.oscillator.setPeriodicWave(createSeriesWave(context, wave))
    // With the same time constant the two weights always add up to 1.
    to.weight.gain.setTargetAtTime(1, at, CROSSFADE_TIME_CONSTANT)
    from.weight.gain.setTargetAtTime(0, at, CROSSFADE_TIME_CONSTANT)
    voice.active = next
    voice.wave = wave
    voice.busyUntil = at + CROSSFADE_LENGTH
  }

  stop() {
    const { context, voice } = this
    if (!context || !voice) return
    window.clearTimeout(voice.timer)
    const now = context.currentTime
    voice.master.gain.cancelScheduledValues(now)
    voice.master.gain.setTargetAtTime(0, now, LEVEL_TIME_CONSTANT)
    voice.paths[1].oscillator.onended = () => {
      for (const { oscillator, weight } of voice.paths) {
        oscillator.disconnect()
        weight.disconnect()
      }
      voice.master.disconnect()
    }
    for (const { oscillator } of voice.paths) oscillator.stop(now + STOP_DELAY)
    this.voice = null
    // Release the audio device once the fade-out is over.
    this.suspendTimer = window.setTimeout(() => {
      if (!this.voice && context.state === 'running') context.suspend().catch(() => undefined)
    }, STOP_DELAY * 1000 + SUSPEND_DELAY_MS)
  }

  dispose() {
    window.clearTimeout(this.suspendTimer)
    if (this.voice) window.clearTimeout(this.voice.timer)
    this.voice = null
    const context = this.context
    this.context = null
    if (context && context.state !== 'closed') context.close().catch(() => undefined)
  }
}
