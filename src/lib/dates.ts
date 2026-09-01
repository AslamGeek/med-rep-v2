const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function todayIso() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDaysIso(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d + days)
  const yy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

export function weekdayName(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return WEEKDAYS[new Date(y, m - 1, d).getDay()]
}

export function isSunday(iso: string) {
  return weekdayName(iso) === 'Sunday'
}

export function joinList(values: string[]) {
  return values.filter(Boolean).join('; ')
}

export function splitList(value: string) {
  return value
    .split(/[;|]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function applyTheme(theme: 'light' | 'dark' | 'system') {
  const root = document.documentElement
  const resolved =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme
  root.dataset.theme = resolved
  localStorage.setItem('medrep-theme', theme)
}

export function storedTheme(): 'light' | 'dark' | 'system' {
  const v = localStorage.getItem('medrep-theme')
  if (v === 'light' || v === 'dark' || v === 'system') return v
  return 'system'
}
