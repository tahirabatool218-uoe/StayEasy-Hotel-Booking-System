import Icon from '../ui/Icon';

// A crafted, brand-native visual for the hero — an abstract skyline-at-dusk
// motif rendered in CSS/SVG rather than a stock photo, so it never depends
// on image rights and always matches the theme.
export default function HeroVisual() {
  return (
    <div className="hero-visual" aria-hidden="true">
      <svg viewBox="0 0 520 560" className="hero-visual-svg" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="skyGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--color-secondary)" stopOpacity="0.95" />
          </linearGradient>
          <linearGradient id="buildingGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f8fafc" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#f8fafc" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        <rect width="520" height="560" rx="28" fill="url(#skyGradient)" />
        <circle cx="380" cy="120" r="58" fill="#f8fafc" opacity="0.18" />
        <circle cx="380" cy="120" r="34" fill="#f8fafc" opacity="0.35" />

        {/* skyline */}
        <g fill="url(#buildingGradient)">
          <rect x="40" y="330" width="70" height="190" rx="6" />
          <rect x="120" y="270" width="56" height="250" rx="6" />
          <rect x="186" y="360" width="64" height="160" rx="6" />
          <rect x="260" y="230" width="72" height="290" rx="6" />
          <rect x="342" y="300" width="58" height="220" rx="6" />
          <rect x="410" y="350" width="66" height="170" rx="6" />
        </g>

        {/* windows */}
        <g fill="#f8fafc" opacity="0.35">
          {Array.from({ length: 6 }).map((_, col) =>
            Array.from({ length: 4 }).map((_, row) => (
              <rect key={`${col}-${row}`} x={54 + col * 76} y={300 + row * 34} width="7" height="10" rx="1.5" />
            ))
          )}
        </g>
      </svg>

      <div className="hero-visual-card hero-visual-card-top">
        <span className="hero-visual-card-icon">
          <Icon name="shield" size={18} />
        </span>
        <div>
          <strong>Verified hotels</strong>
          <span>Every listing checked before it goes live</span>
        </div>
      </div>

      <div className="hero-visual-card hero-visual-card-bottom">
        <span className="hero-visual-card-icon">
          <Icon name="star" size={18} />
        </span>
        <div>
          <strong>Real guest reviews</strong>
          <span>Only from confirmed, completed stays</span>
        </div>
      </div>
    </div>
  );
}
