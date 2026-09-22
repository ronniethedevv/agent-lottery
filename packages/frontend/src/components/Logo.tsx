export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="logo-grad" x1="0" y1="0" x2="40" y2="40">
          <stop offset="0%" stopColor="var(--accent-bright)" />
          <stop offset="100%" stopColor="var(--accent-dim)" />
        </linearGradient>
        <linearGradient id="logo-grad-gold" x1="0" y1="0" x2="40" y2="40">
          <stop offset="0%" stopColor="var(--gold-bright)" />
          <stop offset="100%" stopColor="var(--gold-dim)" />
        </linearGradient>
      </defs>
      {/* outer hex */}
      <path
        d="M20 2.5 L34.6 11 V29 L20 37.5 L5.4 29 V11 Z"
        stroke="url(#logo-grad)"
        strokeWidth="2"
        fill="rgba(124,108,240,0.08)"
      />
      {/* inner ticket / node */}
      <circle cx="20" cy="20" r="5.5" fill="url(#logo-grad-gold)" />
      <circle cx="20" cy="20" r="9.5" stroke="url(#logo-grad)" strokeWidth="1.5" opacity="0.6" />
    </svg>
  );
}
