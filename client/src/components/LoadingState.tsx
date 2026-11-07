export function LoadingState({
  label = 'Loading',
  className = '',
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center gap-4 py-16 text-center ${className}`}
    >
      <span className="relative flex h-10 w-10" aria-hidden="true">
        <span className="absolute inset-0 animate-ping rounded-full bg-adapt/60" />
        <span className="relative m-auto h-4 w-4 rounded-full bg-midnight" />
      </span>
      <span className="text-base font-medium">{label}…</span>
    </div>
  );
}

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
