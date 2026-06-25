/**
 * SYPHONIX brand mark — gold. Recreated as SVG (the 4-petal diamond emblem)
 * with a metallic-gold gradient, plus the wordmark in matching gold.
 */

const GOLD_STOPS = (
  <>
    <stop offset="0%" stopColor="#FCEFC2" />
    <stop offset="38%" stopColor="#E4C063" />
    <stop offset="68%" stopColor="#C49A2B" />
    <stop offset="100%" stopColor="#8C6A16" />
  </>
)

// one petal forms one edge of the diamond; rotated 4× around the centre
const PETAL = 'M50 8 Q84 16 92 50 Q56 44 50 8 Z'

export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-label="Syphonix">
      <defs>
        <linearGradient id="syphonix-gold" x1="0" y1="0" x2="1" y2="1">{GOLD_STOPS}</linearGradient>
      </defs>
      <g fill="url(#syphonix-gold)">
        <path d={PETAL} />
        <path d={PETAL} transform="rotate(90 50 50)" />
        <path d={PETAL} transform="rotate(180 50 50)" />
        <path d={PETAL} transform="rotate(270 50 50)" />
      </g>
    </svg>
  )
}

export const GOLD_GRADIENT_CSS =
  'linear-gradient(135deg,#FCEFC2 0%,#E4C063 40%,#C49A2B 70%,#8C6A16 100%)'

export function LogoLockup({ size = 26 }: { size?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <LogoMark size={size} />
      <span
        className="font-heading"
        style={{
          fontSize: size * 0.6,
          fontWeight: 800,
          letterSpacing: 2,
          backgroundImage: GOLD_GRADIENT_CSS,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
          WebkitTextFillColor: 'transparent',
        }}
      >
        SYPHONIX
      </span>
    </div>
  )
}
