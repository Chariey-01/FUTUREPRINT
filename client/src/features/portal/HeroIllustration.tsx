/**
 * Horizon scene from the approved landing design: a sunrise with three winding roads
 * (Adapt = lavender, Transform = coral, Discover = green) running through layered,
 * paper-cut hills. Inline SVG — no network request, so it never delays first paint.
 * Decorative: hidden from assistive tech (the pathway content is real HTML elsewhere).
 */
export function HorizonScene({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1600 460"
      className={className}
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="xMidYMax slice"
    >
      <defs>
        <radialGradient id="hz-sun" cx="0.68" cy="0.62" r="0.32">
          <stop offset="0%" stopColor="#FFF6E3" />
          <stop offset="18%" stopColor="#FBE3B8" stopOpacity="0.95" />
          <stop offset="45%" stopColor="#E7A18F" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#E7A18F" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hz-far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8E86B8" />
          <stop offset="100%" stopColor="#5E5A8C" />
        </linearGradient>
        <linearGradient id="hz-mid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#B9ADD6" />
          <stop offset="100%" stopColor="#9488BE" />
        </linearGradient>
        <linearGradient id="hz-near" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E9DFEF" />
          <stop offset="100%" stopColor="#CFC2E2" />
        </linearGradient>
        <filter id="hz-paper" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" />
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.06 0" />
          <feComposite in2="SourceGraphic" operator="in" />
          <feBlend in="SourceGraphic" mode="multiply" />
        </filter>
      </defs>

      {/* sunrise glow */}
      <rect width="1600" height="460" fill="url(#hz-sun)" />
      <ellipse cx="1090" cy="300" rx="120" ry="70" fill="#FFF3DC" opacity="0.95" />
      {[-60, -35, -12, 12, 35, 60].map((a) => (
        <line
          key={a}
          x1="1090"
          y1="290"
          x2={1090 + Math.sin((a * Math.PI) / 180) * 230}
          y2={290 - Math.cos((a * Math.PI) / 180) * 230}
          stroke="#FBE3B8"
          strokeOpacity="0.35"
          strokeWidth="3"
        />
      ))}

      {/* clouds */}
      <g fill="#EDE7DD" opacity="0.85" filter="url(#hz-paper)">
        <path d="M640 250c10-30 60-34 76-12 18-26 70-20 74 14 30-2 44 30 20 40H640c-26-4-26-38 0-42z" />
        <path d="M1380 225c12-28 58-30 72-8 20-22 66-14 68 16 28 0 38 32 14 40h-150c-26-6-24-44-4-48z" />
      </g>

      {/* skyline (industry & work) and a wind turbine (emerging fields), cut-paper style */}
      <g fill="#6E6496" opacity="0.85">
        <rect x="905" y="262" width="16" height="40" />
        <rect x="924" y="248" width="20" height="54" />
        <rect x="947" y="270" width="14" height="32" />
        <rect x="964" y="256" width="18" height="46" />
        <rect x="985" y="276" width="12" height="26" />
      </g>
      <g stroke="#EDE7DD" strokeWidth="2.5" strokeLinecap="round" opacity="0.8">
        <path d="M1500 346 V282" />
        <path d="M1500 282 L1500 254 M1500 282 L1524 296 M1500 282 L1476 296" />
      </g>

      {/* far hills */}
      <path
        d="M0 300 C160 250 300 290 420 280 C560 268 640 300 760 300 C880 300 960 280 1090 300 C1240 322 1380 270 1600 286 V460 H0 Z"
        fill="url(#hz-far)"
        filter="url(#hz-paper)"
      />
      {/* roads converging on the sun */}
      <path
        d="M1076 300 C1040 330 900 340 820 380 C740 420 700 440 640 460 L760 460 C800 430 880 400 960 372 C1030 348 1070 326 1086 302 Z"
        fill="#C7B9E6"
      />
      <path
        d="M1088 302 C1080 340 1040 370 1060 410 C1072 436 1080 450 1076 460 L1196 460 C1180 430 1140 410 1130 384 C1112 350 1100 330 1094 302 Z"
        fill="#EDA894"
      />
      <path
        d="M1100 300 C1160 330 1300 340 1380 380 C1440 410 1470 440 1500 460 L1600 460 L1600 440 C1540 410 1440 380 1360 356 C1240 330 1150 320 1104 300 Z"
        fill="#9CC4A6"
      />
      {/* mid hills */}
      <path
        d="M0 350 C120 320 220 345 340 340 C470 334 520 370 620 372 C700 374 740 360 790 352 L640 460 H0 Z"
        fill="url(#hz-mid)"
        filter="url(#hz-paper)"
      />
      <path
        d="M1240 360 C1320 340 1420 330 1600 350 V460 H1500 C1460 430 1380 395 1240 360 Z"
        fill="#86B08F"
        filter="url(#hz-paper)"
      />
      {/* near paper hills */}
      <path
        d="M0 400 C90 380 180 392 260 404 C360 420 420 410 520 430 C560 438 590 450 610 460 H0 Z"
        fill="url(#hz-near)"
        filter="url(#hz-paper)"
      />
      <path
        d="M1300 430 C1380 400 1480 396 1600 404 V460 H1260 Z"
        fill="#E9DFEF"
        filter="url(#hz-paper)"
      />

      {/* travellers: one walking each pathway toward the horizon */}
      <Traveller x={905} y={366} scale={0.5} shirt="#EDE7DD" pack="#54457F" />
      <Traveller x={1098} y={424} scale={0.66} shirt="#F4F0E9" pack="#8C3F2B" />
      <Traveller x={1318} y={364} scale={0.48} shirt="#EDE7DD" pack="#2E5B3E" />
      {/* foreground visitors looking on (cropped away on narrow screens) */}
      <Traveller x={170} y={490} scale={2.1} shirt="#DDD3C3" pack="#3A4F7A" hair="#2A1E1A" />
      <Traveller x={1470} y={496} scale={2.3} shirt="#BFB3A0" pack="#24365A" hair="#3A2A22" />
    </svg>
  );
}

interface TravellerProps {
  x: number;
  y: number;
  scale: number;
  shirt: string;
  pack: string;
  hair?: string;
}

/** A simple cut-paper figure seen from behind; (x, y) is the point between the feet. */
function Traveller({ x, y, scale, shirt, pack, hair = '#1B1A2E' }: TravellerProps) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="0" cy="0" rx="14" ry="3" fill="#17243B" opacity="0.18" />
      <rect x="-9" y="-26" width="7.5" height="26" rx="3.5" fill="#24365A" />
      <rect x="1.5" y="-26" width="7.5" height="26" rx="3.5" fill="#24365A" />
      <path d="M-12 -24 C-13 -40 -10 -50 0 -51 C10 -50 13 -40 12 -24 Z" fill={shirt} />
      <rect x="-8" y="-48" width="16" height="19" rx="5" fill={pack} />
      <rect x="-3" y="-56" width="6" height="6" fill="#C99C84" />
      <circle cx="0" cy="-62" r="8.5" fill={hair} />
    </g>
  );
}

/* --- Pathway bubble icons (decorative) --- */
export function LaptopIcon() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="h-7 w-7 sm:h-9 sm:w-9"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <rect x="6" y="7" width="20" height="13" rx="1.5" />
      <path d="M3 24h26l-2 2.5H5z" strokeLinejoin="round" />
    </svg>
  );
}

export function RocketIcon() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="h-7 w-7 sm:h-9 sm:w-9"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 5c4-1 7-1 8 0s1 4 0 8l-8 8-5-5 5-11z" />
      <circle cx="21.5" cy="10.5" r="2" />
      <path d="M14 16l-5 1-3 3 5 1M16 18l-1 5-3 3-1-5M9 23l-3 3" />
    </svg>
  );
}

export function SproutIcon() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="h-7 w-7 sm:h-9 sm:w-9"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 28V14" />
      <path d="M16 16C16 9 11 5 5 5c0 7 5 11 11 11z" />
      <path d="M16 14c0-6 4-9 10-9 0 6-4 9-10 9z" />
    </svg>
  );
}
