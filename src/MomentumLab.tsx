import { useState, type ReactNode } from 'react'
import MathText from './MathText'
import MomentumBasics from './MomentumBasics'
import MomentumCollision from './MomentumCollision'
import MomentumPush from './MomentumPush'
import type { MomentumHelpTopic } from './MomentumShared'
import './LabPage.css'
import './MomentumLab.css'

type SceneId = 'basics' | 'push' | 'collision'

const SCENES: { id: SceneId; label: string }[] = [
  { id: 'basics', label: '動量與動能' },
  { id: 'push', label: '衝量與功' },
  { id: 'collision', label: '碰撞' },
]

const HELP_CONTENT: Record<MomentumHelpTopic, ReactNode[]> = {
  momentumSpeed: [
    <>質量 <MathText tex="m" /> 的物體以速度 <MathText tex="v" /> 運動時，動量 <MathText tex="p" /> 與動能 <MathText tex="K" /> 分別是：</>,
    <MathText tex="p = mv, \qquad K = \frac{1}{2}mv^{2}" display />,
    '圖上直線的斜率是質量，點的高度是動量。速度反向時，動量也跟著變號，所以動量有方向。',
    <>底為 <MathText tex="v" />、高為 <MathText tex="mv" /> 的三角形，面積正好等於動能。速度變成 2 倍時，底和高都變成 2 倍，三角形裡可以放進 4 個原來的三角形。</>,
  ],
  energySpeed: [
    '動能只和速率有關，所以圖形左右對稱：同樣的速率，不論往左或往右，動能都相同。',
    '質量變成 2 倍時，動能變成 2 倍；速度變成 2 倍時，動能變成 4 倍。',
  ],
  impulse: [
    <>定力 <MathText tex="F" /> 作用一段時間 <MathText tex="\Delta t" /> 的衝量 <MathText tex="J" />，等於物體的動量變化 <MathText tex="\Delta p" />：</>,
    <MathText tex="J = F\Delta t = \Delta p" display />,
    '力－時間圖下的面積就是衝量。受力相同且作用時間相同時，不論質量多大，動量變化都相同。',
  ],
  work: [
    <>定力 <MathText tex="F" /> 沿運動方向作用一段位移 <MathText tex="\Delta x" /> 所作的功 <MathText tex="W" />，等於物體的動能變化 <MathText tex="\Delta K" />：</>,
    <MathText tex="W = F\Delta x = \Delta K" display />,
    '力－位移圖下的面積就是功。受力相同且位移相同時，不論質量多大，動能變化都相同。',
  ],
  track: [
    '軌道沒有摩擦力，滑車前端的彈簧在接觸時被壓縮。接觸的時間很短，所以用慢動作播放。',
    <>恢復係數 <MathText tex="e" /> 表示碰撞後分離的快慢與碰撞前接近的快慢的比值：</>,
    <MathText tex="e = \frac{v_B' - v_A'}{v_A - v_B}" display />,
    <><MathText tex="v_A" />、<MathText tex="v_B" /> 是碰撞前 A、B 車的速度，<MathText tex="v_A'" />、<MathText tex="v_B'" /> 是碰撞後的速度，向右為正。</>,
    <><MathText tex="e = 1" /> 是彈性碰撞，<MathText tex="0 < e < 1" /> 是非彈性碰撞，<MathText tex="e = 0" /> 是完全非彈性碰撞，碰撞後兩車以相同速度一起運動。</>,
    '軌道下方的三角形標示質心的位置。兩車不受外力，所以質心的速度在碰撞前後都不變。',
  ],
  collisionMomentum: [
    '碰撞時兩車互相施力，力的大小相等、方向相反，作用時間也相同，所以一車增加多少動量，另一車就減少多少，總動量不變。',
    '上方的箭頭把 A 車和 B 車的動量頭尾相接，紫色箭頭是兩者的向量和，整個過程都不會改變。',
    '下方的圖放大接觸前後的一小段時間，可以拖曳圖面查看不同時刻。',
  ],
  collisionEnergy: [
    '接觸時彈簧被壓縮，一部分動能暫時變成彈性位能，所以即使是彈性碰撞，接觸期間的總動能也會下降。',
    '彈簧恢復時，彈性位能變回動能。恢復係數小於 1 時，有一部分能量變成熱能等其他形式，總動能回不到原來的值。',
  ],
}

function MomentumLab() {
  const homePath = import.meta.env.BASE_URL
  const [scene, setScene] = useState<SceneId>('basics')
  const [helpTopic, setHelpTopic] = useState<MomentumHelpTopic | null>(null)

  return (
    <div className="lab-page momentum-page">
      <header className="lab-header">
        <a href={homePath} className="lab-home">← 返回實驗室首頁</a>
        <span>Spovark</span>
      </header>
      <main className="lab-main">
        <h1>動能與動量實驗室</h1>
        <p className="lab-intro">拖曳滑車和圖上的點，觀察動量和動能在運動與碰撞中如何變化。</p>
        <nav className="momentum-tabs" aria-label="實驗主題">
          {SCENES.map((item) => <button key={item.id} className="momentum-tab" aria-current={scene === item.id ? 'true' : undefined} onClick={() => setScene(item.id)}>{item.label}</button>)}
        </nav>
        <div className="lab-layout momentum-scene" hidden={scene !== 'basics'}><MomentumBasics active={scene === 'basics'} onHelp={setHelpTopic} /></div>
        <div className="lab-layout momentum-scene" hidden={scene !== 'push'}><MomentumPush active={scene === 'push'} onHelp={setHelpTopic} /></div>
        <div className="lab-layout momentum-scene" hidden={scene !== 'collision'}><MomentumCollision active={scene === 'collision'} onHelp={setHelpTopic} /></div>
      </main>
      {helpTopic && <div className="lab-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setHelpTopic(null) }}><section className="lab-dialog" role="dialog" aria-modal="true" aria-labelledby="momentum-help-title"><h2 id="momentum-help-title">說明</h2>{HELP_CONTENT[helpTopic].map((paragraph, index) => <p key={index}>{paragraph}</p>)}<button className="lab-secondary" onClick={() => setHelpTopic(null)}>關閉</button></section></div>}
    </div>
  )
}

export default MomentumLab
