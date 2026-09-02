import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { applyTheme, storedTheme } from '../lib/dates'

function resolve(theme: 'light' | 'dark' | 'system'): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}

export function ThemeToggle() {
  const [mode, setMode] = useState<'light' | 'dark'>(() => resolve(storedTheme()))

  useEffect(() => {
    applyTheme(mode)
  }, [mode])

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={() => setMode((m) => (m === 'dark' ? 'light' : 'dark'))}
    >
      {mode === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  )
}