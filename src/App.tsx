import './App.css'

function App() {
  return (
    <>
      <header className="site-header">
        <a className="brand" href="/" aria-label="互動科學實驗室首頁">
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
            <a className="primary-link" href="/fourier_wave_lab_v3.html">
              開始傅立葉波形實驗 <span aria-hidden="true">↗</span>
            </a>
          </div>
          <div className="wave-art" aria-hidden="true">
            <span className="wave-label">WAVE 01</span>
            <svg viewBox="0 0 380 190" role="presentation">
              <path className="wave-grid" d="M0 38H380M0 95H380M0 152H380M38 0V190M114 0V190M190 0V190M266 0V190M342 0V190" />
              <path className="wave-line wave-line-a" d="M0 95 C22 95 23 43 47 43 S70 147 95 147 S118 43 142 43 S166 147 190 147 S213 43 237 43 S261 147 285 147 S309 43 333 43 S356 95 380 95" />
              <path className="wave-line wave-line-b" d="M0 95 C22 95 23 64 47 64 S70 126 95 126 S118 64 142 64 S166 126 190 126 S213 64 237 64 S261 126 285 126 S309 64 333 64 S356 95 380 95" />
              <path className="wave-line wave-line-c" d="M0 95 C22 95 23 80 47 80 S70 110 95 110 S118 80 142 80 S166 110 190 110 S213 80 237 80 S261 110 285 110 S309 80 333 80 S356 95 380 95" />
            </svg>
            <div className="wave-legend"><span>基頻</span><span>諧波</span><span>合成波</span></div>
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

          <a className="lab-card" href="/fourier_wave_lab_v3.html">
            <div className="lab-card-icon" aria-hidden="true">∿</div>
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
