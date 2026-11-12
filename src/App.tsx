import { useEffect } from 'react'
import './App.css'
import FourierWaveLab from './FourierWaveLab'
import HeroArt from './HeroArt'
import MomentumLab from './MomentumLab'
import { CollisionArt, MomentumCartIcon } from './MomentumPreview'
import { SquareWaveArt, SquareWaveIcon } from './SquareWavePreview'
import VerticalCircleLab from './VerticalCircleLab'
import { VerticalCircleArt, VerticalCircleIcon } from './VerticalCirclePreview'

const basePath = import.meta.env.BASE_URL
const labPath = `${basePath}fourier-wave-lab`
const momentumLabPath = `${basePath}momentum-energy-lab`
const verticalCircleLabPath = `${basePath}vertical-circle-lab`

const LABS = [
  {
    path: labPath,
    tag: '波動學',
    title: '波的疊加',
    text: '調整不同頻率的諧波，觀察它們如何組合成週期波形。',
    Icon: SquareWaveIcon,
    Art: SquareWaveArt,
  },
  {
    path: momentumLabPath,
    tag: '力學',
    title: '動能與動量',
    text: '拖曳滑車、調整質量，觀察動量和動能在運動與碰撞中如何變化。',
    Icon: MomentumCartIcon,
    Art: CollisionArt,
  },
  {
    path: verticalCircleLabPath,
    tag: '力學',
    title: '鉛直圓周運動',
    text: '改變小球的速率或釋放高度，觀察動能和重力位能如何轉換，以及小球能不能繞完一圈。',
    Icon: VerticalCircleIcon,
    Art: VerticalCircleArt,
  },
]

function App() {
  const currentPath = window.location.pathname.replace(/\/$/, '')
  const labTitle = LABS.find(({ path }) => path === currentPath)?.title

  useEffect(() => {
    if (labTitle) document.title = `Spovark | ${labTitle}`
  }, [labTitle])

  if (currentPath === labPath.replace(/\/$/, '')) {
    return <FourierWaveLab />
  }

  if (currentPath === momentumLabPath) {
    return <MomentumLab />
  }

  if (currentPath === verticalCircleLabPath) {
    return <VerticalCircleLab />
  }

  return (
    <>
      <header className="site-header">
        <a className="brand" href={basePath} aria-label="Spovark 首頁">
          <span className="brand-mark" aria-hidden="true">S</span>
          <span>Spovark</span>
        </a>
        <div className="header-note">
          <strong>互動科學實驗室</strong>
          <span>探索・觀察・理解</span>
        </div>
      </header>

      <main>
        <section className="welcome" aria-labelledby="welcome-title">
          <div className="welcome-copy">
            <p className="eyebrow">INTERACTIVE SCIENCE LABS</p>
            <h1 id="welcome-title">讓抽象的科學，<br />變得看得見。</h1>
            <p className="welcome-description">
              動手調整參數、觀察變化，在互動中探索科學原理。這裡是各種線上實驗的入口。
            </p>
            <a className="primary-link" href="#labs">
              瀏覽所有實驗 <span aria-hidden="true">↓</span>
            </a>
          </div>
          <HeroArt scenes={LABS} />
        </section>

        <div className="ticks" aria-hidden="true"></div>

        <section id="labs" className="labs-section" aria-labelledby="labs-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">THE LABS</p>
              <h2 id="labs-title">實驗室</h2>
            </div>
            <p>選一個主題，開始動手探索。</p>
          </div>

          {LABS.map(({ path, tag, title, text, Icon }) => (
            <a className="lab-card" href={path} key={path}>
              <div className="lab-card-icon" aria-hidden="true"><Icon /></div>
              <div className="lab-card-content">
                <span className="lab-tag">{tag}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
              <span className="lab-card-arrow" aria-hidden="true">↗</span>
            </a>
          ))}
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
