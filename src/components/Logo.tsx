/** The app mark: a radar dish with a sweep and a target blip. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden>
      <rect width="64" height="64" rx="16" fill="#161A24" />
      <circle cx="32" cy="32" r="21" fill="none" stroke="#2E8BFF" strokeOpacity=".35" strokeWidth="2" />
      <circle cx="32" cy="32" r="12" fill="none" stroke="#2E8BFF" strokeOpacity=".5" strokeWidth="2" />
      <path d="M32 32 L32 11 A21 21 0 0 1 50.2 21.5 Z" fill="#2E8BFF" fillOpacity=".55" />
      <circle cx="32" cy="32" r="3" fill="#E9EDF6" />
      <rect x="40" y="16" width="8" height="8" rx="2.5" fill="#FF8A1F" />
    </svg>
  );
}
