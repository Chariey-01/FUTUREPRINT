import { config } from '../lib/config';

/** Always visible in mock mode so sample data is never mistaken for real research. */
export function MockModeBadge() {
  if (!config.useMocks) return null;
  return (
    <p
      className="border-b-2 border-dashed border-transform-ink bg-ivory-50 px-4 py-1.5 text-center text-xs font-semibold text-transform-ink"
      data-testid="mock-mode-badge"
    >
      Mock mode · sample data, not real research
    </p>
  );
}
