import { useId } from 'react';

/** The Odyssey logo: a planet with an orbit. Also used as the tutor's avatar. */
export default function OdysseyMark({ size = 32, animated = false }: { size?: number; animated?: boolean }) {
  // A per-instance gradient id: a shared id breaks when its first copy sits in a hidden element.
  const gradient = `om-bg-${useId().replace(/:/g, '')}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className={animated ? 'mark spinning' : 'mark'}>
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4f46e5" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill={`url(#${gradient})`} />
      <circle cx="32" cy="32" r="13" fill="none" stroke="#fff" strokeWidth="3.5" />
      <g className="mark-orbit">
        <ellipse cx="32" cy="32" rx="22" ry="8" fill="none" stroke="#c7d2fe" strokeWidth="2.5" transform="rotate(-28 32 32)" />
        <circle cx="51" cy="22" r="3.5" fill="#fbbf24" />
      </g>
      <circle cx="32" cy="32" r="5" fill="#fbbf24" />
    </svg>
  );
}
