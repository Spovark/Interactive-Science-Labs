import { useMemo, useState } from 'react'
import './FourierWaveLab.css'

type WaveType = 'custom' | 'square' | 'triangle' | 'saw' | 'pulse'

const COLORS = ['#e07a35', '#168a83', '#8b5cf6', '#d94678', '#64748b', '#b08b21', '#3b82f6', '#65a30d']
const DEFAULT_TERMS = 11
const MAX_TERMS = 100

function initialCoefficient(type: WaveType, n: number) {
  if (type === 'custom') return n === 1 ? 1 : n === 2 ? 0.5 : n === 3 ? -0.25 : 0
  if (type === 'square') return n % 2 ? 4 / (Math.PI * n) : 0
  if (type === 'triangle') return n % 2 ? (8 / (Math.PI ** 2 * n ** 2)) * (n % 4 === 1 ? 1 : -1) : 0
  if (type === 'saw') return (2 * (-1) ** (n + 1)) / n
  return (2 / Math.PI) * Math.sin((n * Math.PI) / 4) / n
}

function targetWave(type: WaveType, x: number) {
  const angle = ((((x + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI
  if (type === 'square') return Math.sin(angle) >= 0 ? 1 : -1
  if (type === 'triangle') return (2 / Math.PI) * Math.asin(Math.sin(angle))
  if (type === 'saw') return angle / Math.PI
  if (type === 'pulse') return Math.abs(angle) < Math.PI / 4 ? 1 : -1 / 7
  return 0
}

function makeSeries(points: number[], color: string, width: number, dash?: string) {
  const line = points.map((value, index) => `${index === 0 ? 'M' : 'L'} ${(index / (points.length - 1)) * 1000} ${((2.8 - value) / 5.6) * 300}`).join(' ')
  return <path d={line} fill="none" stroke={color} strokeWidth={width} strokeDasharray={dash} vectorEffect="non-scaling-stroke" />
}

function FourierWaveLab() {
  const [wave, setWave] = useState<WaveType>('custom')
  const [terms, setTerms] = useState(DEFAULT_TERMS)
  const [periods, setPeriods] = useState(3)
  const [amplitude, setAmplitude] = useState(1)
  const [coefficients, setCoefficients] = useState(() => Array.from({ length: MAX_TERMS }, (_, i) => initialCoefficient('custom', i + 1)))
  const [enabled, setEnabled] = useState(() => Array(MAX_TERMS).fill(true) as boolean[])
  const [visible, setVisible] = useState(() => Array(MAX_TERMS).fill(true) as boolean[])
  const [showTarget, setShowTarget] = useState(true)
  const [showLimit, setShowLimit] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  const data = useMemo(() => {
    const count = 700
    const xs = Array.from({ length: count }, (_, i) => -periods * Math.PI + (2 * periods * Math.PI * i) / (count - 1))
    const sum = xs.map(() => 0)
    const components = Array.from({ length: terms }, (_, index) => {
      const n = index + 1
      const values = xs.map((x) => coefficients[index] * amplitude * Math.sin(n * x))
      if (enabled[index]) values.forEach((value, point) => { sum[point] += value })
      return values
    })
    const goal = xs.map((x) => amplitude * targetWave(wave, x))
    const error = wave === 'custom' ? null : Math.sqrt(sum.reduce((total, value, i) => total + (value - goal[i]) ** 2, 0) / count)
    return { xs, sum, components, goal, error }
  }, [amplitude, coefficients, enabled, periods, terms, wave])

  const changeWave = (next: WaveType) => {
    setWave(next)
    setCoefficients(Array.from({ length: MAX_TERMS }, (_, i) => initialCoefficient(next, i + 1)))
  }

  const reset = () => {
    changeWave('custom')
    setTerms(DEFAULT_TERMS)
    setPeriods(3)
    setAmplitude(1)
    setEnabled(Array(MAX_TERMS).fill(true))
    setVisible(Array(MAX_TERMS).fill(true))
    setShowTarget(true)
    setShowLimit(false)
  }

  const changeCoefficient = (index: number, value: number) => {
    setCoefficients((current) => current.map((coefficient, i) => i === index ? value : coefficient))
    if (wave !== 'custom') setWave('custom')
  }

  const allVisible = visible.slice(0, terms).every(Boolean)

  return (
    <div className="fourier-page">
      <header className="fourier-header">
        <a href="/" className="fourier-home">← 返回實驗室首頁</a>
        <span>互動科學實驗室</span>
      </header>
      <main className="fourier-main">
        <h1>傅立葉波形實驗室</h1>
        <p className="fourier-intro">調整不同頻率的正弦波，觀察它們如何疊加成不同形狀的波形。</p>
        <div className="fourier-layout">
          <aside className="fourier-panel">
            <h2>波形設定</h2>
            <div className="fourier-control"><label htmlFor="wave-type">目標波形</label><select id="wave-type" value={wave} onChange={(event) => changeWave(event.target.value as WaveType)}><option value="custom">自訂波形</option><option value="square">方波</option><option value="triangle">三角波</option><option value="saw">鋸齒波</option><option value="pulse">脈衝波</option></select></div>
            <div className="fourier-control"><label htmlFor="term-count">諧波數 <span>{terms}</span></label><input id="term-count" type="range" min="1" max={MAX_TERMS} value={terms} onChange={(event) => setTerms(Number(event.target.value))} /><input aria-label="輸入諧波數" type="number" min="1" max={MAX_TERMS} value={terms} onChange={(event) => setTerms(Math.max(1, Math.min(MAX_TERMS, Number(event.target.value) || 1)))} /></div>
            <div className="fourier-control"><label htmlFor="period-count">顯示週期 <span>{periods}</span></label><input id="period-count" type="range" min="1" max="4" value={periods} onChange={(event) => setPeriods(Number(event.target.value))} /></div>
            <div className="fourier-control"><label htmlFor="amplitude">振幅倍率 <span>{amplitude.toFixed(1)}</span></label><input id="amplitude" type="range" min="0.2" max="2" step="0.1" value={amplitude} onChange={(event) => setAmplitude(Number(event.target.value))} /></div>
            <button className="fourier-secondary" onClick={reset}>重設</button>
            <p className="fourier-note">試著增加諧波數，觀察合成波形如何逐漸接近目標波形。你也可以調整每一項諧波的振幅。</p>
            <div className="fourier-harmonics"><h2>諧波成分設定</h2><p>勾選要加入合成波的成分，並拖曳滑桿調整振幅。</p><div className="fourier-harmonic-list">{Array.from({ length: terms }, (_, index) => <div className="fourier-harmonic" key={index}>
              <div className="fourier-harmonic-head"><label><input type="checkbox" checked={enabled[index]} onChange={(event) => setEnabled((current) => current.map((value, i) => i === index ? event.target.checked : value))} /> 第 {index + 1} 項（{index + 1}f₀）</label><span>{coefficients[index].toFixed(3)}</span></div>
              <label className="fourier-slider-label" htmlFor={`coefficient-${index}`}>振幅係數</label><input id={`coefficient-${index}`} type="range" min="-1.5" max="1.5" step="0.005" value={coefficients[index]} onChange={(event) => changeCoefficient(index, Number(event.target.value))} />
            </div>)}</div></div>
          </aside>
          <section className="fourier-plots">
            <div className="fourier-chart"><div className="fourier-chart-heading"><h2>合成波形</h2><button className="fourier-help-button" onClick={() => setHelpOpen(true)} aria-label="開啟實驗說明">?</button></div>
              <div className="fourier-metrics"><div><span>使用諧波數</span><b>{terms}</b></div><div><span>最高頻率</span><b>{terms} f₀</b></div><div><span>RMS 誤差</span><b>{data.error === null ? '自訂' : data.error.toFixed(3)}</b></div></div>
              <div className="fourier-display-controls">{terms <= 6 && terms <= Math.max(1, Math.floor((window.innerWidth - 580) / 42)) ? Array.from({ length: terms }, (_, i) => <label key={i}><input type="checkbox" checked={visible[i]} onChange={(event) => setVisible((current) => current.map((value, index) => index === i ? event.target.checked : value))} />{i + 1}</label>) : <button className="fourier-secondary" onClick={() => setVisible((current) => current.map((value, i) => i < terms ? !allVisible : value))}>{allVisible ? '隱藏所有成分' : '顯示所有成分'}</button>}
                <label><input type="checkbox" checked={showTarget} disabled={wave === 'custom'} onChange={(event) => setShowTarget(event.target.checked)} />目標</label><label><input type="checkbox" checked={showLimit} disabled={wave === 'custom'} onChange={(event) => setShowLimit(event.target.checked)} />極限</label></div>
              <svg className="fourier-plot" viewBox="0 0 1000 300" role="img" aria-label="傅立葉波形圖"><path d="M0 150H1000M0 30H1000M0 270H1000" stroke="#e9edf5" />{data.components.map((values, index) => visible[index] && makeSeries(values, COLORS[index % COLORS.length], 1.4))}{showTarget && wave !== 'custom' && makeSeries(data.goal, '#9ca3af', 2, '8 6')}{showLimit && wave !== 'custom' && makeSeries(data.goal, '#7c3aed', 2, '2 5')}{makeSeries(data.sum, '#2457c5', 3.2)}</svg>
              <div className="fourier-axis"><span>{(-periods).toFixed(0)}π</span><span>0</span><span>{periods}π</span></div>
            </div>
            <div className="fourier-chart"><h2>頻譜</h2><svg className="fourier-spectrum" viewBox="0 0 1000 180" role="img" aria-label="各諧波振幅頻譜"><path d="M35 10V150H985" stroke="#aab4c5" fill="none" />{Array.from({ length: terms }, (_, i) => <rect key={i} x={45 + (i / Math.max(terms, 1)) * 925} y={150 - Math.min(Math.abs(coefficients[i] * amplitude), 1.6) / 1.6 * 130} width={Math.max(2, 900 / terms * 0.62)} height={Math.min(Math.abs(coefficients[i] * amplitude), 1.6) / 1.6 * 130} fill="#4775d1" />)}</svg></div>
          </section>
        </div>
      </main>
      {helpOpen && <div className="fourier-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setHelpOpen(false) }}><section className="fourier-dialog" role="dialog" aria-modal="true" aria-labelledby="fourier-help-title"><h2 id="fourier-help-title">實驗說明</h2><p>傅立葉級數可以將週期波形表示成多個不同頻率的正弦波相加。使用左側控制項調整諧波數、振幅與各項係數，並在圖表中觀察變化。</p><p>方波、三角波、鋸齒波與脈衝波會顯示目標波形及合成誤差；自訂波形可自由調整每一項係數。</p><button className="fourier-secondary" onClick={() => setHelpOpen(false)}>關閉</button></section></div>}
    </div>
  )
}

export default FourierWaveLab
