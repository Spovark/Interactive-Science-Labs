import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import FourierSpectrum from './FourierSpectrum'
import MathText from './MathText'
import './LabPage.css'
import './FourierWaveLab.css'

type WaveType = 'custom' | 'square' | 'triangle' | 'saw' | 'pulse'

const SERIES_COLORS = Array.from({ length: 8 }, (_, i) => `var(--fourier-series-${i + 1})`)
const DEFAULT_TERMS = 6
const STACKED_CHART_QUERY = '(max-width: 1050px)'
const MAX_TERMS = 100
const MAX_PERIODS = 4
const MIN_PANEL_HEIGHT = 320
const PANEL_BOTTOM_GAP = 16
const PANEL_STICKY_TOP = 8
const SAMPLE_COUNT = 700
const COEFFICIENT_STEP = 0.005
const WAVE_LABELS: Record<Exclude<WaveType, 'custom'>, string> = { square: '方波', triangle: '三角波', saw: '鋸齒波', pulse: '脈衝波' }

type HelpTopic = 'wave' | 'spectrum' | 'rms'

const HELP_CONTENT: Record<HelpTopic, { title: string; paragraphs: ReactNode[] }> = {
  wave: {
    title: '說明',
    paragraphs: [
      '常見的週期波形，都可以拆成許多頻率不同的正弦波；反過來，把這些正弦波疊加起來，就能組回原本的波形。這就是傅立葉級數的想法。',
      '粗紫線是合成波，也就是所有勾選的諧波加起來的結果；細線是各個諧波，灰色虛線是你選的目標波形。',
      '試試看：目標波形選「方波」，再慢慢增加諧波項數，看紫線是不是愈來愈貼近目標。',
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
      'RMS 是 Root Mean Square 的縮寫，中文叫「方均根」。RMS 誤差用一個數字表示合成波和目標波形平均差多少，數值愈小，兩條線愈接近。',
      <>在圖上取 <MathText tex={`N = ${SAMPLE_COUNT}`} /> 個等間距的位置 <MathText tex="x_1, x_2, \ldots, x_N" />，其中 <MathText tex="x_1 = -k\pi" /> 是圖的最左端，<MathText tex="x_N = k\pi" /> 是最右端，<MathText tex="k" /> 為顯示週期。<MathText tex="s(x_i)" /> 與 <MathText tex="g(x_i)" /> 分別是第 <MathText tex="i" /> 個位置上合成波與目標波形的值，則 RMS 誤差 <MathText tex="E_{\mathrm{RMS}}" /> 定義為：</>,
      <MathText tex="E_{\mathrm{RMS}} = \sqrt{\frac{1}{N}\sum_{i=1}^{N} \left[ s(x_i) - g(x_i) \right]^{2}}" display />,
      <>自訂波形沒有目標波形，上式中的 <MathText tex="g(x_i)" /> 不存在，因此 RMS 誤差無法定義。</>,
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

function clampToRange(value: string, max: number) {
  return Math.max(1, Math.min(max, Math.floor(Number(value)) || 1))
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

function subscribeToChartWidth(onChange: () => void) {
  const query = window.matchMedia(STACKED_CHART_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function FourierWaveLab() {
  const homePath = import.meta.env.BASE_URL
  // In a narrow chart column a fixed aspect ratio would flatten the wave into a thin strip.
  const fillChartHeight = useSyncExternalStore(subscribeToChartWidth, () => window.matchMedia(STACKED_CHART_QUERY).matches)
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

  const data = useMemo(() => {
    const count = SAMPLE_COUNT
    const xs = Array.from({ length: count }, (_, i) => -periods * Math.PI + (2 * periods * Math.PI * i) / (count - 1))
    const sum = xs.map(() => 0)
    // The pulse target is even, so its series needs cosines.
    const basisWave = wave === 'pulse' ? Math.cos : Math.sin
    const components = Array.from({ length: terms }, (_, index) => {
      const n = index + 1
      const values = xs.map((x) => coefficients[index] * basisWave(n * x))
      if (enabled[index]) values.forEach((value, point) => { sum[point] += value })
      return values
    })
    const goal = xs.map((x) => targetWave(wave, x))
    const error = wave === 'custom' ? null : Math.sqrt(sum.reduce((total, value, i) => total + (value - goal[i]) ** 2, 0) / count)
    return { xs, sum, components, goal, error }
  }, [coefficients, enabled, periods, terms, wave])

  // Let the panel reach the bottom of the window as it moves up with the page.
  useEffect(() => {
    const panel = panelRef.current
    const layout = panel?.parentElement
    if (!panel || !layout) return
    const fitPanelToWindow = () => {
      const top = Math.max(panel.getBoundingClientRect().top, PANEL_STICKY_TOP)
      const bottom = Math.min(window.innerHeight - PANEL_BOTTOM_GAP, layout.getBoundingClientRect().bottom)
      panel.style.maxHeight = `${Math.max(MIN_PANEL_HEIGHT, bottom - top)}px`
    }
    fitPanelToWindow()
    window.addEventListener('scroll', fitPanelToWindow, { passive: true })
    window.addEventListener('resize', fitPanelToWindow)
    return () => {
      window.removeEventListener('scroll', fitPanelToWindow)
      window.removeEventListener('resize', fitPanelToWindow)
    }
  }, [])

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

  return (
    <div className="lab-page fourier-page">
      <header className="lab-header">
        <a href={homePath} className="lab-home">← 返回實驗室首頁</a>
        <span>互動科學實驗室</span>
      </header>
      <main className="lab-main">
        <h1>傅立葉波形實驗室</h1>
        <p className="lab-intro">調整不同頻率的正弦波，觀察它們如何疊加成不同形狀的波形。</p>
        <div className="lab-layout">
          <aside className="lab-panel" ref={panelRef}>
            <h2>波形設定</h2>
            <div className="lab-control"><label htmlFor="wave-type">目標波形</label><select id="wave-type" value={wave} onChange={(event) => changeWave(event.target.value as WaveType)}><option value="custom">自訂波形</option><option value="square">方波</option><option value="triangle">三角波</option><option value="saw">鋸齒波</option><option value="pulse">脈衝波</option></select></div>
            <div className="lab-control"><div className="lab-control-head"><label htmlFor="term-count">諧波項數</label><input className="lab-number-input" aria-label="輸入諧波項數" type="number" min="1" max={MAX_TERMS} step="1" value={termDraft ?? terms} onChange={(event) => changeTermDraft(event.target.value)} onBlur={() => setTermDraft(null)} /></div><input id="term-count" type="range" min="1" max={MAX_TERMS} value={terms} onChange={(event) => setTerms(Number(event.target.value))} /></div>
            <div className="lab-control"><div className="lab-control-head"><label htmlFor="period-count">顯示週期</label><input className="lab-number-input" aria-label="輸入顯示週期" type="number" min="1" max={MAX_PERIODS} step="1" value={periodDraft ?? periods} onChange={(event) => changePeriodDraft(event.target.value)} onBlur={() => setPeriodDraft(null)} /></div><input id="period-count" type="range" min="1" max={MAX_PERIODS} value={periods} onChange={(event) => setPeriods(Number(event.target.value))} /></div>
            <button className="lab-secondary" onClick={reset}>重設</button>
            <p className="lab-note">試著增加諧波項數，觀察合成波形如何逐漸接近目標波形。你也可以調整每一項諧波的振幅。</p>
            <div className="fourier-harmonics"><h2>諧波成分設定</h2><p>勾選要加入合成波的成分，並拖曳滑桿調整振幅。</p>{waveLabel && <div className={`fourier-component-status${isCustomized ? ' is-customized' : ''}`}><span role="status">{isCustomized ? `成分已自訂，非${waveLabel}理論值；RMS 誤差仍與${waveLabel}比較。` : `目前是${waveLabel}的理論成分。`}</span>{isCustomized && <button className="lab-secondary" onClick={restoreTheory}>恢復理論值</button>}</div>}<div className="fourier-harmonic-list">{Array.from({ length: terms }, (_, index) => <div className="fourier-harmonic" key={index}>
              <div className="fourier-harmonic-head"><label><input type="checkbox" checked={enabled[index]} onChange={(event) => setEnabled((current) => current.map((value, i) => i === index ? event.target.checked : value))} /><span>第 {index + 1} 諧波（{index === 0 ? <>基頻 <MathText tex="f_1" /></> : <MathText tex={`f_{${index + 1}} = ${index + 1}f_1`} />}）</span></label><span>{coefficients[index].toFixed(3)}</span></div>
              <label className="fourier-slider-label" htmlFor={`coefficient-${index}`}>振幅係數</label><input id={`coefficient-${index}`} type="range" min="-1.5" max="1.5" step={COEFFICIENT_STEP} value={coefficients[index]} onChange={(event) => changeCoefficient(index, Number(event.target.value))} />
            </div>)}</div></div>
          </aside>
          <section className="lab-plots">
            <div className="lab-chart"><div className="lab-chart-heading"><h2>合成波形</h2><button className="lab-help-button" onClick={() => setHelpTopic('wave')} aria-label="開啟合成波形說明">?</button></div>
              <div className="fourier-chart-toolbar"><div className="lab-metrics"><div><span>RMS 誤差<button className="lab-help-button lab-help-small" onClick={() => setHelpTopic('rms')} aria-label="開啟 RMS 誤差說明">?</button></span><b className={data.error === null ? 'fourier-metric-undefined' : undefined}>{data.error === null ? '自訂波形不定義' : data.error.toFixed(3)}</b></div></div>
              <div className="fourier-display-controls">{terms <= 6 && terms <= Math.max(1, Math.floor((window.innerWidth - 580) / 42)) ? Array.from({ length: terms }, (_, i) => <label key={i}><input type="checkbox" checked={visible[i]} onChange={(event) => setVisible((current) => current.map((value, index) => index === i ? event.target.checked : value))} />{i + 1}</label>) : <button className="lab-secondary" onClick={() => setVisible((current) => current.map((value, i) => i < terms ? !allVisible : value))}>{allVisible ? '隱藏所有成分' : '顯示所有成分'}</button>}
                <label><input type="checkbox" checked={showTarget} disabled={wave === 'custom'} onChange={(event) => setShowTarget(event.target.checked)} />目標</label><label className="fourier-limit-toggle"><input type="checkbox" checked={showLimit} disabled={wave === 'custom'} onChange={(event) => setShowLimit(event.target.checked)} />極限</label></div></div>
              <svg className="fourier-plot" viewBox="0 0 1000 300" preserveAspectRatio={fillChartHeight ? 'none' : undefined} role="img" aria-label="傅立葉波形圖"><path d="M0 30H1000M0 270H1000" stroke="var(--lab-grid)" />{data.components.map((values, index) => enabled[index] && visible[index] && makeSeries(values, SERIES_COLORS[index % SERIES_COLORS.length], 1.4))}<path d="M0 150H1000" stroke="var(--lab-axis)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />{showTarget && wave !== 'custom' && makeSeries(data.goal, 'var(--fourier-target)', 2, '8 6')}{showLimit && wave !== 'custom' && makeSeries(data.goal, 'var(--fourier-limit)', 6, undefined, 0.5)}{makeSeries(data.sum, 'var(--fourier-sum)', 3.2)}</svg>
              <div className="fourier-axis"><MathText tex={piMultipleTex(-periods)} /><MathText tex="0" /><MathText tex={piMultipleTex(periods)} /></div>
            </div>
            <div className="lab-chart"><div className="lab-chart-heading"><h2>頻譜</h2><button className="lab-help-button" onClick={() => setHelpTopic('spectrum')} aria-label="開啟頻譜說明">?</button></div><FourierSpectrum amplitudes={Array.from({ length: terms }, (_, i) => enabled[i] ? Math.abs(coefficients[i]) : 0)} maxHarmonic={terms} /></div>
          </section>
        </div>
      </main>
      {helpTopic && <div className="lab-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setHelpTopic(null) }}><section className="lab-dialog" role="dialog" aria-modal="true" aria-labelledby="fourier-help-title"><h2 id="fourier-help-title">{HELP_CONTENT[helpTopic].title}</h2>{HELP_CONTENT[helpTopic].paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}<button className="lab-secondary" onClick={() => setHelpTopic(null)}>關閉</button></section></div>}
    </div>
  )
}

export default FourierWaveLab
