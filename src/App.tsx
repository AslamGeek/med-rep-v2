import { useEffect, useState } from 'react'
import { BookUser, CalendarDays, Search } from 'lucide-react'
import { ThemeToggle } from './components/ThemeToggle'
import { Directory } from './pages/Directory'
import { Visits } from './pages/Visits'
import { ensureDefaults } from './db/database'
import { startSyncListeners } from './sync/engine'
import { applyTheme, storedTheme } from './lib/dates'

type Tab = 'directory' | 'visits'

export default function App() {
  const [tab, setTab] = useState<Tab>('directory')
  const [ready, setReady] = useState(false)
  const [barsHidden, setBarsHidden] = useState(false)
  const [directorySearchOpen, setDirectorySearchOpen] = useState(false)

  useEffect(() => {
    applyTheme(storedTheme())
    void ensureDefaults().then(() => {
      setReady(true)
      startSyncListeners()
    })
  }, [])

  useEffect(() => {
    let lastY = window.scrollY
    let ticking = false

    function onScroll() {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const y = window.scrollY
        const delta = y - lastY
        // Ignore tiny jitters, and always show the bars near the top of the page.
        if (y < 40) {
          setBarsHidden(false)
        } else if (delta > 4) {
          setBarsHidden(true)
        } else if (delta < -4) {
          setBarsHidden(false)
        }
        lastY = y
        ticking = false
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!ready) {
    return (
      <div className="boot">
        <p>MedRep</p>
      </div>
    )
  }

  return (
    <div className="app">
      <header className={`top ${barsHidden ? 'hide' : ''}`}>
        <h1>MedRep</h1>
        <div className="top-actions">
          {tab === 'directory' && (
            <button
              type="button"
              className="theme-toggle"
              aria-label={directorySearchOpen ? 'Hide search' : 'Search doctors'}
              aria-pressed={directorySearchOpen}
              onClick={() => setDirectorySearchOpen((o) => !o)}
            >
              <Search size={18} />
            </button>
          )}
          <ThemeToggle />
        </div>
      </header>

      <main>
        {tab === 'directory' && (
          <Directory searchOpen={directorySearchOpen} onSearchOpenChange={setDirectorySearchOpen} />
        )}
        {tab === 'visits' && <Visits />}
      </main>

      <nav className={`tabbar ${barsHidden ? 'hide' : ''}`}>
        <button type="button" className={tab === 'directory' ? 'on' : ''} onClick={() => setTab('directory')}>
          <BookUser size={22} />
          Directory
        </button>
        <button type="button" className={tab === 'visits' ? 'on' : ''} onClick={() => setTab('visits')}>
          <CalendarDays size={22} />
          Visits
        </button>
      </nav>
    </div>
  )
}
