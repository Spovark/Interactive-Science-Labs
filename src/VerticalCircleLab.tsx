import { useState, type ReactNode } from 'react'
import { HelpDialog, LabTabs } from './LabShared'
import MathText from './MathText'
import VerticalCircleRope from './VerticalCircleRope'
import type { CircleHelpTopic } from './VerticalCircleShared'
import VerticalCircleTrack from './VerticalCircleTrack'
import './LabPage.css'
import './VerticalCircleLab.css'

type SceneId = 'rope' | 'track'

const SCENES: { id: SceneId; label: string }[] = [
  { id: 'rope', label: '繩子與輕桿' },
  { id: 'track', label: '實體軌道' },
]

const ENERGY_LINE = '紫色虛線是動能全部轉成重力位能時的高度。小球的動能不會小於 0，所以永遠不會高過這條線；有阻力時力學能減少，這條線也跟著下降。'

const HELP_CONTENT: Record<CircleHelpTopic, ReactNode[]> = {
  ropeStage: [
    <>小球繫在繩子或輕桿的一端，以另一端為圓心，在鉛直面上作半徑 <MathText tex="R" /> 的圓周運動。</>,
    '繩子或輕桿對小球的力沿著半徑方向，始終和速度垂直，所以不作功。沒有阻力時，只有重力對小球作功，因此小球的力學能守恆：',
    <MathText tex="\frac{1}{2}mv^{2} + mgh = \frac{1}{2}mv_0^{2}" display />,
    <><MathText tex="m" /> 是小球的質量，<MathText tex="v" /> 是速率，<MathText tex="h" /> 是小球離最低點的高度，<MathText tex="v_0" /> 是最低點的速率，重力加速度 <MathText tex="g = 9.8\ \text{m/s}^{2}" />。</>,
    ENERGY_LINE,
    '繩子只能拉、不能推；輕桿可以拉，也可以推。這個差別決定了小球能不能繞完一圈。',
    <>在起點暫停時，可以沿著圓周拖曳小球，改變出發位置。小球出發時的力學能和從最低點以 <MathText tex="v_0" /> 出發時相同，所以出發位置越高，出發的速率越小。小球最高只能放到動能全部轉成位能的高度；用繩子時，也不能放到繩子會鬆弛的位置。</>,
  ],
  strength: [
    <>斷裂強度 <MathText tex="T_{\max}" /> 是繩子能承受的最大張力，張力超過它，繩子就會斷。只有繩子有這個設定。</>,
    <>小球在最低點的速率最大，張力也最大：</>,
    <MathText tex="T = mg + \frac{mv_0^{2}}{R}" display />,
    <>所以只要最低點需要的張力超過 <MathText tex="T_{\max}" />，繩子在小球到達最低點以前就會斷；從最低點出發時，小球一出發繩子就斷了，改作平拋運動。繩子不斷的條件是：</>,
    <MathText tex="v_0 \le \sqrt{\left(\frac{T_{\max}}{m} - g\right)R}" display />,
    <>要完成圓周，<MathText tex="v_0" /> 至少要 <MathText tex="\sqrt{5gR}" />，這時最低點的張力是 <MathText tex="6mg" />。所以 <MathText tex="T_{\max}" /> 小於 <MathText tex="6mg" /> 時，小球不可能繞完一圈：速率太小繩子會鬆弛，速率太大繩子會斷。</>,
    <>完成圓周需要的速率只和 <MathText tex="R" /> 有關；繩子會不會斷，則和 <MathText tex="R" />、<MathText tex="m" /> 都有關。</>,
    <>動畫在中途暫停時調整斷裂強度，新的值從這個時刻開始生效，小球從目前的位置繼續運動。張力一超過斷裂強度，繩子就斷，小球沿著當時的切線方向飛出。例如在最高點附近把斷裂強度調低，繩子會在小球往下擺、張力變大的途中斷掉。</>,
  ],
  trackHeight: [
    <>小球從高度 <MathText tex="H" /> 的地方由靜止滑下，進入半徑 <MathText tex="R" /> 的圓形軌道。軌道的正向力始終和速度垂直，不作功。沒有阻力時，小球的力學能守恆：</>,
    <MathText tex="mgH = \frac{1}{2}mv^{2} + mgh" display />,
    <><MathText tex="h" /> 是小球離圓形軌道最低點的高度，<MathText tex="v" /> 是速率。</>,
    <>軌道內側：正向力和繩子的張力一樣指向圓心，而且不能小於 0。要通過最高點，最高點的速率至少要 <MathText tex="\sqrt{gR}" />，所以釋放高度至少要 <MathText tex="\frac{5}{2}R" />。<MathText tex="H \le R" /> 時，小球最高只滑到和圓心一樣高，再滑回斜坡；<MathText tex="R < H < \frac{5}{2}R" /> 時，小球在到達最高點之前就離開軌道，改作拋體運動。</>,
    <>圓管：小球在管子裡運動，外側管壁把小球往圓心推，內側管壁把小球往外推，作用和輕桿一樣，小球不會離開圓周。只要到達最高點時速率大於 0，也就是 <MathText tex="H > 2R" />，就能通過最高點。</>,
    ENERGY_LINE,
  ],
  trackBottom: [
    <>小球從圓形軌道的最低點出發，速率為 <MathText tex="v_0" />，在半徑 <MathText tex="R" /> 的軌道上運動。沒有阻力時，小球的力學能守恆：</>,
    <MathText tex="\frac{1}{2}mv^{2} + mgh = \frac{1}{2}mv_0^{2}" display />,
    <>軌道內側：正向力指向圓心而且不能小於 0，和繩子的張力一樣。最低點的速率至少要 <MathText tex="\sqrt{5gR}" /> 才能繞完一圈；介於 <MathText tex="\sqrt{2gR}" /> 和 <MathText tex="\sqrt{5gR}" /> 之間時，小球會在途中離開軌道。</>,
    <>圓管：內外兩側的管壁都能推小球，作用和輕桿一樣。最低點的速率大於 <MathText tex="2\sqrt{gR}" /> 就能繞完一圈。</>,
    ENERGY_LINE,
  ],
  trackOutside: [
    <>小球從半徑 <MathText tex="R" /> 的圓形軌道外側的最高點出發，速率為 <MathText tex="v_0" />，沿著軌道往下滑。圓心在地面上，<MathText tex="h" /> 是小球離地面的高度。沒有阻力時，小球的力學能守恆：</>,
    <MathText tex="\frac{1}{2}mv^{2} + mgh = \frac{1}{2}mv_0^{2} + mgR" display />,
    <>在軌道外側，正向力 <MathText tex="N" /> 背離圓心，只能把小球往外推。重力沿半徑方向的分力減去正向力，提供向心力：</>,
    <MathText tex="mg\cos\theta - N = \frac{mv^{2}}{R}" display />,
    <><MathText tex="\theta" /> 從最高點量起。小球越往下滑，速率越大、需要的向心力越大，重力沿半徑方向的分力卻越小。正向力降到 0 時，小球就離開軌道，這時：</>,
    <MathText tex="\cos\theta = \frac{2}{3} + \frac{v_0^{2}}{3gR}" display />,
    <><MathText tex="v_0 \ge \sqrt{gR}" /> 時，最高點的重力已經不足以提供需要的向心力，小球一出發就離開軌道。</>,
  ],
  observer: [
    '「地面」是站在地面上觀察。地面是慣性坐標系，小球只受到實際存在的力：重力、繩子的張力或軌道的正向力，以及阻力。',
    '「小球」是跟著小球一起移動的觀察者。畫面的上下方向不變，小球固定在中央，看起來是圓心、軌道和地面在移動。',
    <>小球有加速度 <MathText tex="\vec{a}" />，所以這是非慣性坐標系。在這個坐標系裡要讓牛頓運動定律成立，必須再加上一個假想力，大小是 <MathText tex="ma" />，方向和加速度相反。<MathText tex="m" /> 是小球的質量。</>,
    '在自己的坐標系裡小球靜止不動，所以實際的力加上假想力，合力為 0。',
    <>假想力沿半徑方向的分量指向圓外，就是離心力，大小是 <MathText tex="\frac{mv^{2}}{R}" />，<MathText tex="v" /> 是小球相對於地面的速率，<MathText tex="R" /> 是圓周的半徑。沿切線方向的分量，和重力的切向分量、阻力抵消。</>,
    '假想力不是任何物體施加的力，沒有反作用力，圖上用虛線箭頭表示。小球離開圓周後只畫出整個假想力，它正好和重力、阻力抵消。',
  ],
  vectors: [
    '同一個畫面裡，所有力的箭頭都從小球中心畫起，使用同一個比例尺，箭頭的長度和力的大小成正比。速度的箭頭另有自己的比例尺。兩個比例尺標在動畫下方，改變設定或拉近鏡頭時會跟著調整。',
    '「徑向與切向分量」把重力分解成沿半徑方向和沿切線方向的兩個分量。虛線和兩個分量圍成矩形，重力是矩形的對角線。',
    <>向心力不是另一個實際存在的力，而是作圓周運動需要的、指向圓心的合力，大小是 <MathText tex="F_c = \frac{mv^{2}}{R}" />，必須由張力或正向力，加上重力的徑向分量來提供。<MathText tex="m" /> 是質量，<MathText tex="v" /> 是速率，<MathText tex="R" /> 是半徑。圖上用虛線箭頭畫在半徑的旁邊。</>,
    '「實際力的徑向合力」把重力的徑向分量平移到張力或正向力箭頭的尖端，兩個箭頭頭尾相接。從小球到終點就是實際的力在徑向的合力，終點正好和向心力箭頭的尖端對齊。',
    '以小球為坐標系時，再接上離心力的箭頭，三個箭頭會回到小球，表示徑向的合力為 0。',
    '切線方向的力只有重力的切向分量和阻力，它們改變小球的速率。',
  ],
  trackHalf: [
    <>小球從水平地面出發，初速率為 <MathText tex="v_0" />，經過最低點後沿著半圓形軌道內側往上。軌道只有右半圈，到最高點為止。在地面上，正向力和重力抵消，<MathText tex="N = mg" />；一進入軌道，正向力還要提供向心力，在最低點突然增加為 <MathText tex="N = mg + rac{mv_0^{2}}{R}" />。沒有阻力時，小球的力學能守恆：</>,
    <MathText tex="\frac{1}{2}mv^{2} + mgh = \frac{1}{2}mv_0^{2}" display />,
    <>小球到達最高點後水平往左拋出，作平拋運動。最高點的正向力不能小於 0，所以最高點的速率至少要 <MathText tex="\sqrt{gR}" />，所以 <MathText tex="v_0" /> 至少要 <MathText tex="\sqrt{5gR}" />。</>,
    <>從高度 <MathText tex="2R" /> 落到地面的時間是 <MathText tex="\sqrt{\frac{4R}{g}}" />，所以落地點和最低點的水平距離是：</>,
    <MathText tex="d = v_1\sqrt{\frac{4R}{g}} \ge 2R" display />,
    <><MathText tex="v_1" /> 是最高點的速率，<MathText tex="v_1 = \sqrt{gR}" /> 時 <MathText tex="d" /> 最小，等於 <MathText tex="2R" />。</>,
    <><MathText tex="v_0" /> 介於 <MathText tex="\sqrt{2gR}" /> 和 <MathText tex="\sqrt{5gR}" /> 之間時，小球在到達最高點之前離開軌道；不超過 <MathText tex="\sqrt{2gR}" /> 時，小球滑回最低點，沿地面往左離開。</>,
    ENERGY_LINE,
  ],
  energy: [
    <>動能 <MathText tex="K = \frac{1}{2}mv^{2}" />，重力位能 <MathText tex="U = mgh" />，以畫面上 <MathText tex="h = 0" /> 的位置作為重力位能的零點。兩者的和就是力學能 <MathText tex="E" />：</>,
    <MathText tex="E = K + U" display />,
    '沒有阻力時，小球上升時動能減少的量正好變成重力位能，所以力學能的曲線保持水平。繩子鬆弛或小球離開軌道後，小球只受重力作拋體運動，力學能仍然守恆。',
    '有阻力時，阻力對小球作負功，力學能逐漸減少。減少的量畫在長條的灰色部分，長條的總長度是一開始的力學能。',
  ],
  resistance: [
    <>阻力 <MathText tex="f" /> 代表空氣阻力、摩擦力等所有阻礙小球運動的力的合力。這裡假設它的大小固定，方向永遠和速度相反。</>,
    <>阻力對小球作負功，力學能減少的量等於阻力的大小乘上小球走過的路徑長 <MathText tex="s" />：</>,
    <MathText tex="\Delta E = -fs" display />,
    <><MathText tex="s" /> 是路徑長，不是位移；小球來回擺動時，往回走的路程也要算進去。</>,
    <>小球停下來的瞬間，如果重力沿軌道方向的分力不大於 <MathText tex="f" />，小球就停住不動，就像受到摩擦力一樣。</>,
  ],
  ropeForce: [
    <><MathText tex="\theta" /> 是小球的角位置，也就是小球和圓心的連線與鉛直向下方向的夾角。最低點 <MathText tex="\theta = 0^\circ" />，最高點 <MathText tex="\theta = \pm 180^\circ" />。</>,
    <>沿著半徑方向，繩子的張力 <MathText tex="T" /> 和重力的分力合起來提供向心力：</>,
    <MathText tex="T - mg\cos\theta = \frac{mv^{2}}{R}" display />,
    <>沒有阻力時，再用力學能守恆代入 <MathText tex="v" />，張力只和角位置有關：</>,
    <MathText tex="T = \frac{mv_0^{2}}{R} - 2mg + 3mg\cos\theta" display />,
    <>改變 <MathText tex="v_0" /> 時，整條曲線只會上下平移，所以最低點和最高點的張力永遠相差 <MathText tex="6mg" />。</>,
    <>繩子的張力不能小於 0，而最高點的張力最小。要繞完一圈，最高點的速率至少要 <MathText tex="\sqrt{gR}" />，最低點的速率至少要 <MathText tex="\sqrt{5gR}" />。張力在途中降到 0 時，繩子就會鬆弛，小球改作拋體運動。</>,
    <>輕桿的作用力 <MathText tex="F" /> 也符合同一個式子，但可以是負值，表示桿把小球往外推。所以輕桿只要求小球到達最高點時速率大於 0，最低點的速率大於 <MathText tex="2\sqrt{gR}" /> 就能繞完一圈。</>,
    '有阻力時，小球每繞一圈力學能都會減少，曲線一圈比一圈低，圖上畫的是實際算出的值。',
  ],
  trackForce: [
    <><MathText tex="\theta" /> 是小球在圓形軌道上的角位置，最低點 <MathText tex="\theta = 0^\circ" />，最高點 <MathText tex="\theta = \pm 180^\circ" />。小球從圓形軌道右側往上繞，先經過正的角度。</>,
    <MathText tex="N = \frac{mv^{2}}{R} + mg\cos\theta" display />,
    <>沒有阻力時，從高處釋放的 <MathText tex="v^{2} = 2g(H - h)" />，從最低點出發的 <MathText tex="v^{2} = v_0^{2} - 2gh" />。改變 <MathText tex="H" /> 或 <MathText tex="v_0" />，整條曲線只會上下平移，最低點和最高點的正向力相差 <MathText tex="6mg" />。</>,
    '軌道內側的正向力不能小於 0，降到 0 的位置就是小球離開軌道的地方。圓管的正向力可以是負值，表示內側管壁把小球往外推。',
    '斜坡和水平軌道上的正向力顯示在動畫上方，這張圖只畫圓形軌道的部分。',
  ],
  outsideForce: [
    <><MathText tex="\theta" /> 是小球和圓心的連線與鉛直向上方向的夾角，最高點 <MathText tex="\theta = 0^\circ" />。</>,
    <>沒有阻力時，代入力學能守恆，正向力只和角位置有關：</>,
    <MathText tex="N = mg\cos\theta - \frac{mv^{2}}{R} = 3mg\cos\theta - 2mg - \frac{mv_0^{2}}{R}" display />,
    '正向力在最高點最大，往下滑時越來越小，降到 0 的地方就是小球離開軌道的位置。虛線是小球如果留在軌道上，軌道必須把小球往內拉的部分，實際上做不到。',
  ],
}

function VerticalCircleLab() {
  const homePath = import.meta.env.BASE_URL
  const [scene, setScene] = useState<SceneId>('rope')
  const [helpTopic, setHelpTopic] = useState<CircleHelpTopic | null>(null)

  return (
    <div className="lab-page circle-page">
      <header className="lab-header">
        <a href={homePath} className="lab-home">← 返回實驗室首頁</a>
        <span>Spovark</span>
      </header>
      <main className="lab-main">
        <h1>鉛直圓周運動</h1>
        <p className="lab-intro">改變小球的速率或釋放高度，觀察動能和重力位能如何互相轉換，以及小球要多快才能繞完一圈。</p>
        <LabTabs tabs={SCENES} value={scene} onChange={setScene} />
        <div className="lab-layout lab-scene" hidden={scene !== 'rope'}><VerticalCircleRope active={scene === 'rope'} onHelp={setHelpTopic} /></div>
        <div className="lab-layout lab-scene" hidden={scene !== 'track'}><VerticalCircleTrack active={scene === 'track'} onHelp={setHelpTopic} /></div>
      </main>
      {helpTopic && <HelpDialog paragraphs={HELP_CONTENT[helpTopic]} onClose={() => setHelpTopic(null)} />}
    </div>
  )
}

export default VerticalCircleLab
