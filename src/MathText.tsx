import katex from 'katex'
import 'katex/dist/katex.min.css'

const renderedMath = new Map<string, string>()

function renderMath(tex: string, display: boolean) {
  const key = `${display ? 'display' : 'inline'}:${tex}`
  let html = renderedMath.get(key)
  if (html === undefined) {
    html = katex.renderToString(tex, { displayMode: display })
    renderedMath.set(key, html)
  }
  return html
}

type MathTextProps = {
  tex: string
  display?: boolean
}

function MathText({ tex, display = false }: MathTextProps) {
  return <span dangerouslySetInnerHTML={{ __html: renderMath(tex, display) }} />
}

export default MathText
