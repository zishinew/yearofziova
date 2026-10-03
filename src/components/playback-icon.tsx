export function PlaybackIcon({ playing, size = 16 }: { playing: boolean; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
    {playing ? <><rect x="6" y="4" width="4" height="16" rx="0.5" /><rect x="14" y="4" width="4" height="16" rx="0.5" /></> : <path d="M7 4v16l13-8Z" />}
  </svg>;
}
