/** Local stroke icons (24px grid, 2px stroke). Decorative: text always carries the meaning. */
const PATHS = {
  current: <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
  stale: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  missing: <circle cx="12" cy="12" r="9" strokeDasharray="3 3" />,
  invalid: <><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6M15 9l-6 6" /></>,
  conflicting: <path d="M4 8h13l-3-3M20 16H7l3 3" />,
  watch: <><path d="M12 4 3 20h18L12 4Z" /><path d="M12 10v4M12 17h.01" /></>,
  insufficient: <><circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" /></>,
  observed: <><rect x="5" y="5" width="14" height="14" rx="2" /><path d="M9 12h6" /></>,
  open: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  resolved: <path d="m5 12 5 5 9-10" />,
  historical: <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" /></>,
  synthetic: <path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3" />,
  device: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 10h.01M11 10h.01M15 10h.01M8 14h8" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>,
  why: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
}

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="ui-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  )
}
