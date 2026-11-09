import './App.css'
import FourierWaveLab from './FourierWaveLab'
import { SquareWaveArt, SquareWaveIcon } from './SquareWavePreview'

function App() {
  const basePath = import.meta.env.BASE_URL
  const labPath = `${basePath}fourier-wave-lab`
  const currentPath = window.location.pathname.replace(/\/$/, '')

  if (currentPath === labPath.replace(/\/$/, '')) {
    return <FourierWaveLab />
  }

  return (
    <>
      <header className="site-header">
        <a className="brand" href={basePath} aria-label="互動科學實驗室首頁">
          <span className="brand-mark" aria-hidden="true">∿</span>
          <span>互動科學實驗室</span>
        </a>
        <span className="header-note">探索・觀察・理解</span>
      </header>

      <main>
        <section className="welcome" aria-labelledby="welcome-title">
          <div className="welcome-copy">
            <p className="eyebrow">INTERACTIVE SCIENCE LABS</p>
            <h1 id="welcome-title">讓抽象的科學，<br />變得看得見。</h1>
            <p className="welcome-description">
              動手調整參數、觀察變化，在互動中探索科學原理。這裡是各種線上實驗的入口。
            </p>
            <a className="primary-link" href={labPath}>
              開始傅立葉波形實驗 <span aria-hidden="true">↗</span>
            </a>
          </div>
          <div className="wave-art" aria-hidden="true">
            <span className="wave-label">WAVE 01</span>
            <SquareWaveArt />
            <div className="wave-legend"><span>基頻</span><span>目標方波</span><span>合成波</span></div>
          </div>
        </section>

        <div className="ticks" aria-hidden="true"></div>

        <section className="labs-section" aria-labelledby="labs-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">THE LABS</p>
              <h2 id="labs-title">實驗室</h2>
            </div>
            <p>選一個主題，開始動手探索。</p>
          </div>

          <a className="lab-card" href={labPath}>
            <div className="lab-card-icon" aria-hidden="true"><SquareWaveIcon /></div>
            <div className="lab-card-content">
              <span className="lab-tag">訊號與波動</span>
              <h3>傅立葉波形實驗室</h3>
              <p>調整不同頻率的諧波，觀察它們如何組合成週期波形。</p>
            </div>
            <span className="lab-card-arrow" aria-hidden="true">↗</span>
          </a>
        </section>
      </main>

      <footer className="site-footer">
        <span>互動科學實驗室</span>
        <span>用觀察，理解世界。</span>
      </footer>
    </>
  )
}

export default App
