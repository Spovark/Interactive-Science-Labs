import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import FourierSpectrum from './FourierSpectrum'
import { DEFAULT_FUNDAMENTAL, DEFAULT_VOLUME, FourierSoundPlayer, MAX_AUDIBLE_FREQUENCY, MAX_FUNDAMENTAL, MIN_FUNDAMENTAL, makeSoundWave, maxVolumeFor, volumeGain, type SeriesBasis } from './fourierSound'
import MathText from './MathText'
import './LabPage.css'
import './FourierWaveLab.css'

type WaveType = 'custom' | 'square' | 'triangle' | 'saw' | 'pulse'

const SERIES_COLORS = Array.from({ length: 8 }, (_, i) => `var(--fourier-series-${i + 1})`)
const DEFAULT_TERMS = 10
const STACKED_CHART_QUERY = '(max-width: 1050px)'
const MAX_TERMS = 100
const MAX_PERIODS = 4
const MAX_HARMONIC_TOGGLES = 11
// Measured widths of the chart toolbar's parts, used to predict how its controls wrap.
const TOOLBAR_METRICS_WIDTH = 135
const CONTROLS_MIN_WIDTH = 260 // Matches the flex-basis of .fourier-display-controls.
const CONTROLS_MAX_ROWS = 2
const CONTROLS_GAP = 8
const HARMONIC_TOGGLE_WIDTH = 30
const TWO_DIGIT_TOGGLE_WIDTH = 38
const REFERENCE_TOGGLES_WIDTH = 158
const MIN_PANEL_HEIGHT = 320
const PANEL_BOTTOM_GAP = 16
const PANEL_STICKY_TOP = 8
const SAMPLE_COUNT = 700
const COEFFICIENT_STEP = 0.005
const WAVE_LABELS: Record<Exclude<WaveType, 'custom'>, string> = { square: '方波', triangle: '三角波', saw: '鋸齒波', pulse: '脈衝波' }
const volumeCapNotice = (percent: number) => `振幅太大，音量最高只能到 ${percent}%，避免破音。`

type HelpTopic = 'sound' | 'harmonics' | 'wave' | 'spectrum' | 'rms'
type SoundSource = 'sum' | 'target'

const HELP_CONTENT: Record<HelpTopic, { title: string; paragraphs: ReactNode[] }> = {
  sound: {
    title: '說明',
    paragraphs: [
      <>開啟聲音後，會播放畫面上的合成波。合成波每秒重複 <MathText tex="f_1" /> 次，第 <MathText tex="n" /> 諧波的頻率是 <MathText tex="n f_1" />，振幅和正負號都和滑桿相同。頻率超過 {MAX_AUDIBLE_FREQUENCY} Hz 的諧波人耳聽不到，所以不播放。</>,
      `選擇播放「理想波形」時，會加入頻率在 ${MAX_AUDIBLE_FREQUENCY} Hz 以內的所有諧波，聽起來就是理想波形，可以和合成波比較。自訂波形沒有理想波形，只能播放合成波。`,
      '同一個波形，振幅愈大，聲音愈大；不同形狀的波，就算最高點一樣高，聽起來也不一定一樣大聲。音量滑桿的刻度依照耳朵的感覺設計：滑桿每移動相同的距離，聲音大約放大或縮小相同的倍率。振幅大到會破音時，音量滑桿會自動調低，最高只能調到不會破音的位置。',
    ],
  },
  harmonics: {
    title: '說明',
    paragraphs: [
      '振幅係數決定每個諧波的大小，數值的絕對值愈大，這個諧波在合成波中占的份量愈大。',
      '振幅係數可以是負的，代表這個諧波的波形上下顛倒，也就是相位差半個週期。有些波形一定要用負值才合成得出來，例如三角波的第 3、7 諧波。',
    ],
  },
  wave: {
    title: '說明',
    paragraphs: [
      '常見的週期波形，都可以拆成許多頻率不同的正弦波；反過來，把這些正弦波疊加起來，就能組回原本的波形。這就是傅立葉級數的想法。',
      '粗紫線是合成波，也就是所有勾選的諧波加起來的結果；細線是各個諧波，灰色虛線是理想波形。',
      '試試看：波形選「方波」，再慢慢增加諧波項數，看紫線是不是愈來愈貼近理想波形。',
    ],
  },
  spectrum: {
    title: '說明',
    paragraphs: [
      '頻譜是用來呈現一個波由哪些頻率的成分組成、各成分有多強的圖。就像把一段聲音拆開，看裡面有哪些音高、各有多大聲。',
      <>這張圖的橫軸是「第 <MathText tex="n" /> 諧波」，也就是頻率為基頻 <MathText tex="n" /> 倍的正弦波；縱軸是這個諧波的振幅大小。長條愈高，代表這個諧波在合成波中占的份量愈大。</>,
      '沒有勾選的諧波不會加入合成波，所以不會出現在圖上。',
      <>振幅為負的諧波，代表它的波形上下顛倒。頻譜只看振幅的大小，所以長條仍然朝上畫，例如振幅 <MathText tex="-0.25" /> 和 <MathText tex="+0.25" /> 的長條一樣高。</>,
    ],
  },
  rms: {
    title: '說明',
    paragraphs: [
      'RMS 是 Root Mean Square 的縮寫，中文叫「方均根」。RMS 誤差用一個數字表示合成波和理想波形平均差多少，數值愈小，兩條線愈接近。',
      <>在圖上取 <MathText tex={`M = ${SAMPLE_COUNT}`} /> 個等間距的位置 <MathText tex="x_1, x_2, \ldots, x_M" />，其中 <MathText tex="x_1 = -k\pi" /> 是圖的最左端，<MathText tex="x_M = k\pi" /> 是最右端，<MathText tex="k" /> 為顯示週期。<MathText tex="s(x_i)" /> 與 <MathText tex="g(x_i)" /> 分別是第 <MathText tex="i" /> 個位置上合成波與理想波形的值，則 RMS 誤差 <MathText tex="E_{\mathrm{RMS}}" /> 定義為：</>,
      <MathText tex="E_{\mathrm{RMS}} = \sqrt{\frac{1}{M}\sum_{i=1}^{M} \left[ s(x_i) - g(x_i) \right]^{2}}" display />,
      <>自訂波形沒有理想波形，上式中的 <MathText tex="g(x_i)" /> 不存在，因此 RMS 誤差無法定義。</>,
    ],
  },
}

function initialCoefficient(type: WaveType, n: number) {
  if (type === 'custom') return n === 1 ? 1 : n === 2 ? 0.5 : n === 3 ? -0.25 : 0
  if (type === 'square') return n % 2 ? 4 / (Math.PI * n) : 0
  if (type === 'triangle') return n % 2 ? (8 / (Math.PI ** 2 * n ** 2)) * (n % 4 === 1 ? 1 : -1) : 0
  if (type === 'saw') return (2 * (-1) ** (n + 1)) / (Math.PI * n)
  return (8 / (3 * Math.PI)) * Math.sin((n * Math.PI) / 4) / n
}

function targetWave(type: WaveType, x: number) {
  const angle = ((((x + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI
  if (type === 'square') return Math.sin(angle) >= 0 ? 1 : -1
  if (type === 'triangle') return (2 / Math.PI) * Math.asin(Math.sin(angle))
  if (type === 'saw') return angle / Math.PI
  if (type === 'pulse') return Math.abs(angle) < Math.PI / 4 ? 1 : -1 / 3
  return 0
}

function clampToRange(value: string, max: number, min = 1) {
  return Math.max(min, Math.min(max, Math.floor(Number(value)) || min))
}

function piMultipleTex(multiple: number) {
  if (multiple === 1) return '\\pi'
  if (multiple === -1) return '-\\pi'
  return `${multiple}\\pi`
}

function makeSeries(points: number[], color: string, width: number, dash?: string, opacity?: number) {
  const line = points.map((value, index) => `${index === 0 ? 'M' : 'L'} ${(index / (points.length - 1)) * 1000} ${((2.8 - value) / 5.6) * 300}`).join(' ')
  return <path d={line} fill="none" stroke={color} strokeWidth={width} strokeDasharray={dash} strokeOpacity={opacity} vectorEffect="non-scaling-stroke" />
}

function displayControlRows(terms: number, toolbarWidth: number) {
  const besideMetrics = toolbarWidth - TOOLBAR_METRICS_WIDTH
  const width = besideMetrics >= CONTROLS_MIN_WIDTH ? besideMetrics : toolbarWidth
  const items = [...Array.from({ length: terms }, (_, i) => (i < 9 ? HARMONIC_TOGGLE_WIDTH : TWO_DIGIT_TOGGLE_WIDTH)), REFERENCE_TOGGLES_WIDTH]
  let rows = 1
  let used = 0
  for (const item of items) {
    const next = used === 0 ? item : used + CONTROLS_GAP + item
    if (used > 0 && next > width) {
      rows += 1
      used = item
    } else {
      used = next
    }
  }
  return rows
}

// Let the panel reach the bottom of the window, but not past the bottom of the layout.
function fitPanelToWindow(panel: HTMLElement, layout: HTMLElement) {
  const top = Math.max(panel.getBoundingClientRect().top, PANEL_STICKY_TOP)
  const bottom = Math.min(window.innerHeight - PANEL_BOTTOM_GAP, layout.getBoundingClientRect().bottom)
  panel.style.maxHeight = `${Math.max(MIN_PANEL_HEIGHT, bottom - top)}px`
}

function subscribeToChartWidth(onChange: () => void) {
  const query = window.matchMedia(STACKED_CHART_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function FourierWaveLab() {
  const homePath = import.meta.env.BASE_URL
  // In a narrow chart column a fixed aspect ratio would flatten the wave into a thin strip.
  const fillChartHeight = useSyncExternalStore(subscribeToChartWidth, () => window.matchMedia(STACKED_CHART_QUERY).matches)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [toolbarWidth, setToolbarWidth] = useState(Number.POSITIVE_INFINITY)

  useEffect(() => {
    if (!toolbarRef.current) return
    const observer = new ResizeObserver(([entry]) => setToolbarWidth(entry.contentRect.width))
    observer.observe(toolbarRef.current)
    return () => observer.disconnect()
  }, [])

  const [wave, setWave] = useState<WaveType>('custom')
  const [terms, setTerms] = useState(DEFAULT_TERMS)
  const [termDraft, setTermDraft] = useState<string | null>(null)
  const [periods, setPeriods] = useState(3)
  const [periodDraft, setPeriodDraft] = useState<string | null>(null)
  const panelRef = useRef<HTMLElement>(null)
  const [coefficients, setCoefficients] = useState(() => Array.from({ length: MAX_TERMS }, (_, i) => initialCoefficient('custom', i + 1)))
  const [enabled, setEnabled] = useState(() => Array(MAX_TERMS).fill(true) as boolean[])
  const [visible, setVisible] = useState(() => Array(MAX_TERMS).fill(true) as boolean[])
  const [showTarget, setShowTarget] = useState(true)
  const [showLimit, setShowLimit] = useState(false)
  const [helpTopic, setHelpTopic] = useState<HelpTopic | null>(null)
  const [soundOn, setSoundOn] = useState(false)
  const [soundSource, setSoundSource] = useState<SoundSource>('sum')
  const [fundamental, setFundamental] = useState(DEFAULT_FUNDAMENTAL)
  const [fundamentalDraft, setFundamentalDraft] = useState<string | null>(null)
  const [volume, setVolume] = useState(DEFAULT_VOLUME)
  const [player] = useState(() => new FourierSoundPlayer())

  // The pulse target is even, so its series needs cosines.
  const basis: SeriesBasis = wave === 'pulse' ? 'cos' : 'sin'
  const playTarget = soundSource === 'target' && wave !== 'custom'
  const audibleTerms = Math.floor(MAX_AUDIBLE_FREQUENCY / fundamental)
  const sumSound = useMemo(() => soundOn && !playTarget ? makeSoundWave(Array.from({ length: Math.min(terms, audibleTerms) }, (_, i) => enabled[i] ? coefficients[i] : 0), basis) : null, [audibleTerms, basis, coefficients, enabled, playTarget, soundOn, terms])
  const targetSound = useMemo(() => soundOn && playTarget ? makeSoundWave(Array.from({ length: audibleTerms }, (_, i) => initialCoefficient(wave, i + 1)), basis) : null, [audibleTerms, basis, playTarget, soundOn, wave])
  const soundWave = sumSound ?? targetSound
  // A wave too large for the current volume would clip. The volume control is then turned down and
  // stays there, as a person at an amplifier would do; the wave itself is never rescaled.
  const volumeCap = soundWave ? maxVolumeFor(soundWave.peak) : 100
  if (volume > volumeCap) setVolume(volumeCap)
  const atVolumeCap = soundWave !== null && volumeCap < 100 && volume >= volumeCap

  useEffect(() => {
    if (soundWave) player.update(soundWave, fundamental, volumeGain(Math.min(volume, volumeCap)))
  }, [fundamental, player, soundWave, volume, volumeCap])

  useEffect(() => {
    if (!soundOn) player.stop()
  }, [player, soundOn])

  useEffect(() => () => player.dispose(), [player])

  // A tone that keeps playing in a tab nobody is looking at is easy to forget, so switch it off.
  useEffect(() => {
    const stopWhenHidden = () => { if (document.hidden) setSoundOn(false) }
    document.addEventListener('visibilitychange', stopWhenHidden)
    return () => document.removeEventListener('visibilitychange', stopWhenHidden)
  }, [])

  const toggleSound = (on: boolean) => {
    // Audio has to start inside the click itself.
    if (on) player.start()
    setSoundOn(on)
  }

  // Most partly typed numbers are below 100 Hz, so only values already in range play at once;
  // anything else is clamped when typing ends, instead of the tone dropping to 100 Hz per keystroke.
  const changeFundamentalDraft = (value: string) => {
    setFundamentalDraft(value)
    const next = Number(value)
    if (value !== '' && Number.isInteger(next) && next >= MIN_FUNDAMENTAL && next <= MAX_FUNDAMENTAL) setFundamental(next)
  }

  const commitFundamentalDraft = () => {
    if (fundamentalDraft) setFundamental(clampToRange(fundamentalDraft, MAX_FUNDAMENTAL, MIN_FUNDAMENTAL))
    setFundamentalDraft(null)
  }

  const data = useMemo(() => {
    const count = SAMPLE_COUNT
    const xs = Array.from({ length: count }, (_, i) => -periods * Math.PI + (2 * periods * Math.PI * i) / (count - 1))
    const sum = xs.map(() => 0)
    const basisWave = basis === 'cos' ? Math.cos : Math.sin
    const components = Array.from({ length: terms }, (_, index) => {
      const n = index + 1
      const values = xs.map((x) => coefficients[index] * basisWave(n * x))
      if (enabled[index]) values.forEach((value, point) => { sum[point] += value })
      return values
    })
    const goal = xs.map((x) => targetWave(wave, x))
    const error = wave === 'custom' ? null : Math.sqrt(sum.reduce((total, value, i) => total + (value - goal[i]) ** 2, 0) / count)
    return { xs, sum, components, goal, error }
  }, [basis, coefficients, enabled, periods, terms, wave])

  // Let the panel reach the bottom of the window as it moves up with the page.
  useEffect(() => {
    const panel = panelRef.current
    const layout = panel?.parentElement
    if (!panel || !layout) return
    const fit = () => fitPanelToWindow(panel, layout)
    fit()
    window.addEventListener('scroll', fit, { passive: true })
    window.addEventListener('resize', fit)
    return () => {
      window.removeEventListener('scroll', fit)
      window.removeEventListener('resize', fit)
    }
  }, [])

  // Measuring against the layout can only keep the panel at its current height, so when its content
  // grows (the sound settings open, the status line appears) first give it all the room the window allows.
  useLayoutEffect(() => {
    const panel = panelRef.current
    const layout = panel?.parentElement
    if (!panel || !layout) return
    const top = Math.max(panel.getBoundingClientRect().top, PANEL_STICKY_TOP)
    panel.style.maxHeight = `${Math.max(MIN_PANEL_HEIGHT, window.innerHeight - PANEL_BOTTOM_GAP - top)}px`
    fitPanelToWindow(panel, layout)
  }, [soundOn, wave])

  const changeTermDraft = (value: string) => {
    setTermDraft(value)
    if (value !== '') setTerms(clampToRange(value, MAX_TERMS))
  }

  const changePeriodDraft = (value: string) => {
    setPeriodDraft(value)
    if (value !== '') setPeriods(clampToRange(value, MAX_PERIODS))
  }

  const changeWave = (next: WaveType) => {
    setWave(next)
    setCoefficients(Array.from({ length: MAX_TERMS }, (_, i) => initialCoefficient(next, i + 1)))
  }

  const reset = () => {
    changeWave('custom')
    setTerms(DEFAULT_TERMS)
    setPeriods(3)
    setEnabled(Array(MAX_TERMS).fill(true))
    setVisible(Array(MAX_TERMS).fill(true))
    setShowTarget(true)
    setShowLimit(false)
  }

  const changeCoefficient = (index: number, value: number) => {
    setCoefficients((current) => current.map((coefficient, i) => i === index ? value : coefficient))
  }

  const restoreTheory = () => {
    changeWave(wave)
    setEnabled(Array(MAX_TERMS).fill(true))
  }

  const waveLabel = wave === 'custom' ? null : WAVE_LABELS[wave]
  const isCustomized = wave !== 'custom' && Array.from({ length: terms }, (_, i) => i).some((i) => Math.abs((enabled[i] ? coefficients[i] : 0) - initialCoefficient(wave, i + 1)) > COEFFICIENT_STEP / 2 + 1e-9)

  const allVisible = visible.slice(0, terms).every(Boolean)
  const showHarmonicToggles = terms <= MAX_HARMONIC_TOGGLES && displayControlRows(terms, toolbarWidth) <= CONTROLS_MAX_ROWS

  return (
    <div className="lab-page fourier-page">
      <header className="lab-header">
        <a href={homePath} className="lab-home">← 返回實驗室首頁</a>
        <span>Spovark</span>
      </header>
      <main className="lab-main">
        <h1>諧波疊加</h1>
        <p className="lab-intro">任何週期波形，都可以由不同頻率的諧波疊加而成。調整各諧波的振幅，親手疊出想要的波形。</p>
        <div className="lab-layout">
          <aside className="lab-panel" ref={panelRef}>
            <h2>基本設定</h2>
            <div className="lab-control"><label htmlFor="wave-type">波形</label><select id="wave-type" value={wave} onChange={(event) => changeWave(event.target.value as WaveType)}><option value="custom">自訂波形</option><option value="square">方波</option><option value="triangle">三角波</option><option value="saw">鋸齒波</option><option value="pulse">脈衝波</option></select></div>
            <div className="lab-control"><div className="lab-control-head"><label htmlFor="term-count">諧波項數 <MathText tex="N" /></label><input className="lab-number-input" aria-label="輸入諧波項數" type="number" min="1" max={MAX_TERMS} step="1" value={termDraft ?? terms} onChange={(event) => changeTermDraft(event.target.value)} onBlur={() => setTermDraft(null)} /></div><input id="term-count" type="range" min="1" max={MAX_TERMS} value={terms} onChange={(event) => setTerms(Number(event.target.value))} /></div>
            <div className="lab-control"><div className="lab-control-head"><label htmlFor="period-count">顯示週期</label><input className="lab-number-input" aria-label="輸入顯示週期" type="number" min="1" max={MAX_PERIODS} step="1" value={periodDraft ?? periods} onChange={(event) => changePeriodDraft(event.target.value)} onBlur={() => setPeriodDraft(null)} /></div><input id="period-count" type="range" min="1" max={MAX_PERIODS} value={periods} onChange={(event) => setPeriods(Number(event.target.value))} /></div>
            <button className="lab-secondary" onClick={reset}>重設</button>
            <p className="lab-note">試著增加諧波項數，觀察合成波形如何逐漸接近理想波形。你也可以調整每一項諧波的振幅。</p>
            <section className="fourier-sound">
              <div className="fourier-sound-head"><h2>聲音<button className="lab-help-button lab-help-small" onClick={() => setHelpTopic('sound')} aria-label="開啟聲音說明">?</button></h2><input className="fourier-switch" type="checkbox" role="switch" aria-label="聲音" checked={soundOn} onChange={(event) => toggleSound(event.target.checked)} /></div>
              {soundOn && <div className="fourier-sound-body">
                <div className="lab-control"><div className="lab-control-head" id="sound-source-label">播放</div><div className="fourier-source" role="group" aria-labelledby="sound-source-label"><button type="button" aria-pressed={!playTarget} onClick={() => setSoundSource('sum')}>合成波</button><button type="button" aria-pressed={playTarget} disabled={wave === 'custom'} title={wave === 'custom' ? '自訂波形沒有理想波形' : undefined} onClick={() => setSoundSource('target')}>理想波形</button></div></div>
                <div className="lab-control"><div className="lab-control-head"><label htmlFor="fundamental">基頻 <MathText tex="f_1" /></label><span className="fourier-unit-input"><input className="lab-number-input fourier-frequency-input" aria-label="輸入基頻" type="number" min={MIN_FUNDAMENTAL} max={MAX_FUNDAMENTAL} step="1" value={fundamentalDraft ?? fundamental} onChange={(event) => changeFundamentalDraft(event.target.value)} onBlur={commitFundamentalDraft} onKeyDown={(event) => { if (event.key === 'Enter') commitFundamentalDraft() }} />Hz</span></div><input id="fundamental" type="range" min={MIN_FUNDAMENTAL} max={MAX_FUNDAMENTAL} step="1" value={fundamental} onChange={(event) => setFundamental(Number(event.target.value))} /></div>
                <div className="lab-control"><div className="lab-control-head"><label htmlFor="sound-volume">音量</label><span>{volume}%</span></div><input id="sound-volume" type="range" min="0" max="100" step="1" value={volume} onChange={(event) => setVolume(Math.min(Number(event.target.value), volumeCap))} />{/* A hidden copy keeps the notice's room, so the panel below does not jump while a slider is dragged. */}<p className="fourier-sound-limit"><span aria-hidden="true">{volumeCapNotice(99)}</span><span role="status">{atVolumeCap ? volumeCapNotice(volumeCap) : ''}</span></p></div>
              </div>}
            </section>
            <div className="fourier-harmonics"><h2>諧波振幅設定<button className="lab-help-button lab-help-small" onClick={() => setHelpTopic('harmonics')} aria-label="開啟諧波振幅設定說明">?</button></h2><p>勾選要加入合成波的成分，並拖曳滑桿調整振幅。</p>{waveLabel && <div className={`fourier-component-status${isCustomized ? ' is-customized' : ''}`}><span role="status">{isCustomized ? `成分已自訂，非${waveLabel}理論值；RMS 誤差仍與${waveLabel}比較。` : `目前是${waveLabel}的理論成分。`}</span>{isCustomized && <button className="lab-secondary" onClick={restoreTheory}>恢復理論值</button>}</div>}<div className="fourier-harmonic-list">{Array.from({ length: terms }, (_, index) => <div className="fourier-harmonic" key={index}>
              <div className="fourier-harmonic-head"><label><input type="checkbox" checked={enabled[index]} onChange={(event) => setEnabled((current) => current.map((value, i) => i === index ? event.target.checked : value))} /><span>第 {index + 1} 諧波（{index === 0 ? <>基頻 <MathText tex="f_1" /></> : <MathText tex={`f_{${index + 1}} = ${index + 1}f_1`} />}）</span></label><span>{coefficients[index].toFixed(3)}</span></div>
              <div className="fourier-slider-row"><label htmlFor={`coefficient-${index}`}>振幅係數</label>{soundOn && <span>頻率 {(index + 1) * fundamental} Hz{(index + 1) * fundamental > MAX_AUDIBLE_FREQUENCY && '（聽不到）'}</span>}</div><input id={`coefficient-${index}`} type="range" min="-1.5" max="1.5" step={COEFFICIENT_STEP} value={coefficients[index]} onChange={(event) => changeCoefficient(index, Number(event.target.value))} />
            </div>)}</div></div>
          </aside>
          <section className="lab-plots">
            <div className="lab-chart"><div className="lab-chart-heading"><h2>合成波形</h2><button className="lab-help-button" onClick={() => setHelpTopic('wave')} aria-label="開啟合成波形說明">?</button></div>
              <div className="fourier-chart-toolbar" ref={toolbarRef}><div className="lab-metrics"><div><span>RMS 誤差<button className="lab-help-button lab-help-small" onClick={() => setHelpTopic('rms')} aria-label="開啟 RMS 誤差說明">?</button></span><b className={data.error === null ? 'fourier-metric-undefined' : undefined}>{data.error === null ? '自訂波形不定義' : data.error.toFixed(3)}</b></div></div>
              <div className="fourier-display-controls">{showHarmonicToggles ? Array.from({ length: terms }, (_, i) => <label key={i}><input type="checkbox" checked={visible[i]} onChange={(event) => setVisible((current) => current.map((value, index) => index === i ? event.target.checked : value))} />{i + 1}</label>) : <button className="lab-secondary" onClick={() => setVisible((current) => current.map((value, i) => i < terms ? !allVisible : value))}>{allVisible ? '隱藏所有成分' : '顯示所有成分'}</button>}
                <div className="fourier-reference-toggles"><label><input type="checkbox" checked={showTarget} disabled={wave === 'custom'} onChange={(event) => setShowTarget(event.target.checked)} />理想波形</label><label className="fourier-limit-toggle"><input type="checkbox" checked={showLimit} disabled={wave === 'custom'} onChange={(event) => setShowLimit(event.target.checked)} /><MathText tex="N \to \infty" /></label></div></div></div>
              <svg className="fourier-plot" viewBox="0 0 1000 300" preserveAspectRatio={fillChartHeight ? 'none' : undefined} role="img" aria-label="合成波形圖"><path d="M0 30H1000M0 270H1000" stroke="var(--lab-grid)" />{data.components.map((values, index) => enabled[index] && visible[index] && <Fragment key={index}>{makeSeries(values, SERIES_COLORS[index % SERIES_COLORS.length], 1.4)}</Fragment>)}<path d="M0 150H1000" stroke="var(--lab-axis)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />{showTarget && wave !== 'custom' && makeSeries(data.goal, 'var(--fourier-target)', 2, '8 6')}{showLimit && wave !== 'custom' && makeSeries(data.goal, 'var(--fourier-limit)', 6, undefined, 0.5)}{makeSeries(data.sum, 'var(--fourier-sum)', 3.2)}</svg>
              <div className="fourier-axis"><MathText tex={piMultipleTex(-periods)} /><MathText tex="0" /><MathText tex={piMultipleTex(periods)} /></div>
            </div>
            <div className="lab-chart"><div className="lab-chart-heading"><h2>頻譜</h2><button className="lab-help-button" onClick={() => setHelpTopic('spectrum')} aria-label="開啟頻譜說明">?</button></div><FourierSpectrum amplitudes={Array.from({ length: terms }, (_, i) => enabled[i] ? Math.abs(coefficients[i]) : 0)} maxHarmonic={terms} fundamental={soundOn ? fundamental : null} /></div>
          </section>
        </div>
      </main>
      {helpTopic && <div className="lab-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setHelpTopic(null) }}><section className="lab-dialog" role="dialog" aria-modal="true" aria-labelledby="fourier-help-title"><h2 id="fourier-help-title">{HELP_CONTENT[helpTopic].title}</h2>{HELP_CONTENT[helpTopic].paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}<button className="lab-secondary" onClick={() => setHelpTopic(null)}>關閉</button></section></div>}
    </div>
  )
}

export default FourierWaveLab
