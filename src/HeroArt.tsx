import { useEffect, useState, type ComponentType } from 'react'
import { prefersReducedMotion } from './momentumHooks'

const SCENE_MILLISECONDS = 5000

type HeroScene = {
  tag: string
  Art: ComponentType
}

function randomIndex(length: number) {
  return Math.floor(Math.random() * length)
}

function HeroArt({ scenes }: { scenes: HeroScene[] }) {
  const [active, setActive] = useState(() => randomIndex(scenes.length))

  useEffect(() => {
    if (prefersReducedMotion()) return
    // Every scene can come up on every draw; excluding the current one would just alternate two labs.
    const timer = window.setInterval(() => setActive(randomIndex(scenes.length)), SCENE_MILLISECONDS)
    return () => window.clearInterval(timer)
  }, [scenes.length])

  return (
    <div className="hero-art" aria-hidden="true">
      {scenes.map(({ tag, Art }, index) => (
        <div className="hero-art-scene" data-active={index === active} key={tag}>
          <span className="hero-art-label">{tag}</span>
          <Art />
        </div>
      ))}
    </div>
  )
}

export default HeroArt
