function ArtCart({ x, className }: { x: number; className: string }) {
  return (
    <g className={className}>
      <rect x={x} y="98" width="104" height="46" rx="6" />
      <circle cx={x + 26} cy="151" r="8" />
      <circle cx={x + 78} cy="151" r="8" />
    </g>
  )
}

export function CollisionArt() {
  return (
    <svg viewBox="0 0 380 190" role="presentation">
      <path className="wave-grid" d="M0 38H380M0 95H380M0 152H380M38 0V190M114 0V190M190 0V190M266 0V190M342 0V190" />
      <path className="collision-track" d="M0 159H380" />
      <ArtCart x={48} className="collision-cart-a" />
      <ArtCart x={228} className="collision-cart-b" />
      <path className="collision-arrow collision-arrow-a" d="M100 66H184M174 56l10 10-10 10" />
      <path className="collision-arrow collision-arrow-b" d="M280 66H232M242 56l-10 10 10 10" />
    </svg>
  )
}

export function MomentumCartIcon() {
  return (
    <svg className="lab-card-wave" viewBox="0 0 40 40" role="presentation">
      <rect x="6" y="15" width="20" height="10" rx="2" />
      <circle cx="11" cy="29" r="3" />
      <circle cx="21" cy="29" r="3" />
      <path d="M26 20h9M31 16l4 4-4 4" />
    </svg>
  )
}
