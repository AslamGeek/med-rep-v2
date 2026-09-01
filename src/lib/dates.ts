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
  return values.filter(Boolean).join('\n')
}

export function splitList(value: string) {
  // Newline is the current format; ';' and '|' are kept for backward
  // compatibility with older rows saved before this change.
  return value
    .split(/\r?\n|[;|]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function daysBetweenIso(fromIso: string, toIso: string) {
  const [fy, fm, fd] = fromIso.split('-').map(Number)
  const [ty, tm, td] = toIso.split('-').map(Number)
  const from = Date.UTC(fy, fm - 1, fd)
  const to = Date.UTC(ty, tm - 1, td)
  return Math.round((to - from) / 86400000)
}

export function lastVisitByDoctorName(visits: { date: string; doctors: string }[]) {
  const map = new Map<string, string>()
  for (const visit of visits) {
    if (!visit.date || !visit.doctors) continue
    for (const name of splitList(visit.doctors)) {
      const key = name.toLowerCase()
      const prev = map.get(key)
      if (!prev || visit.date > prev) map.set(key, visit.date)
    }
  }
  return map
}

export function visitRecencyLabel(lastDate: string | undefined, today = todayIso()) {
  if (!lastDate) return { text: 'Never visited', tone: 'never' as const }
  const days = daysBetweenIso(lastDate, today)
  // Bug fix: this used to treat any non-positive diff as "today", which
  // silently swallowed the common case where the last logged visit has a
  // future date (since dates auto-advance past "today" after each save).
  if (days === 0) return { text: `Visited today (${lastDate})`, tone: 'ok' as const }
  if (days > 0) {
    const text = `Last visited ${lastDate} · ${days} day${days === 1 ? '' : 's'} ago`
    return { text, tone: days >= 14 ? ('stale' as const) : ('ok' as const) }
  }
  const inDays = Math.abs(days)
  return { text: `Scheduled ${lastDate} · in ${inDays} day${inDays === 1 ? '' : 's'}`, tone: 'ok' as const }
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
