'use client';
// Monochrome "victory / peace hand" icon (uses currentColor). Accessible label included.
export default function VictorySign({ size = 16, className = '' }) {
  return (
    <svg role="img" aria-label="Victory sign" width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className={className}>
      <path d="M9.2 11.2 7.2 4.6a1.4 1.4 0 0 1 2.7-.8l1.6 5.3" />
      <path d="M12.6 9.1l1.9-4.4a1.4 1.4 0 0 1 2.6 1l-1.7 4.6" />
      <path d="M8.9 11.1c-1.8-.5-3.4.6-3.4 2.6 0 3.6 2.4 6.8 6.1 6.8h1.1c3 0 5-2.2 5.4-5l.5-3.4a1.4 1.4 0 0 0-2.8-.5l-.4 2.1" />
    </svg>
  );
}
