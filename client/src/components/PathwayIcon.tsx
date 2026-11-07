import type { PathwayId } from '../types/api';

/**
 * One icon per pathway so meaning never relies on colour alone.
 * Adapt = layered stack (building on what you have), Transform = arrow bending into a new
 * direction, Discover = sprout. Decorative: always paired with a text label.
 */
export function PathwayIcon({
  pathway,
  className = 'h-6 w-6',
}: {
  pathway: PathwayId;
  className?: string;
}) {
  const common = {
    viewBox: '0 0 24 24',
    className,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
  };
  if (pathway === 'adapt') {
    return (
      <svg {...common}>
        <path d="M12 3l9 4.5-9 4.5-9-4.5z" />
        <path d="M3 12l9 4.5 9-4.5" />
        <path d="M3 16.5L12 21l9-4.5" />
      </svg>
    );
  }
  if (pathway === 'transform') {
    return (
      <svg {...common}>
        <path d="M4 20c0-8 4-12 12-12h4" />
        <path d="M16 4l4 4-4 4" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M12 21v-9" />
      <path d="M12 13C12 8 9 5 4 5c0 5 3 8 8 8z" />
      <path d="M12 11c0-4 3-7 8-7 0 4-3 7-8 7z" />
    </svg>
  );
}
