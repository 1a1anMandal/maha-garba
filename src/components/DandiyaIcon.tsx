export function DandiyaIcon({ className = "w-12 h-12" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Stick 1 */}
      <g transform="rotate(45 50 50)">
        <rect x="46" y="10" width="8" height="80" rx="4" fill="url(#stickGradient)" stroke="#f5b700" strokeWidth="1" />
        <rect x="46" y="20" width="8" height="4" fill="#8c0909" />
        <rect x="46" y="76" width="8" height="4" fill="#156d35" />
        {/* Tassels */}
        <path d="M50 10 L45 0 L55 0 Z" fill="#f5b700" />
      </g>
      {/* Stick 2 */}
      <g transform="rotate(-45 50 50)">
        <rect x="46" y="10" width="8" height="80" rx="4" fill="url(#stickGradient)" stroke="#f5b700" strokeWidth="1" />
        <rect x="46" y="20" width="8" height="4" fill="#156d35" />
        <rect x="46" y="76" width="8" height="4" fill="#8c0909" />
        {/* Tassels */}
        <path d="M50 10 L45 0 L55 0 Z" fill="#f5b700" />
      </g>
      <defs>
        <linearGradient id="stickGradient" x1="46" y1="10" x2="54" y2="10" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f5b700" />
          <stop offset="0.5" stopColor="#fff" />
          <stop offset="1" stopColor="#b38600" />
        </linearGradient>
      </defs>
    </svg>
  )
}
