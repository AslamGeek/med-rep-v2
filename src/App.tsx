import { lazy, Suspense, useEffect, useState } from 'react'
import { BookUser, CalendarDays, Settings } from 'lucide-react'
import { StatusDot } from './components/StatusDot'
import { Directory } from './pages/Directory'
import { Visits } from './pages/Visits'
import { ensureDefaults } from './db/database'
import { startSyncListeners } from './sync/engine'
import { applyTheme, storedTheme } from './lib/dates'

const SettingsPage = lazy(() =>
  import('./pages/Settings').then((m) => ({ default: m.SettingsPage })),
)

type Tab = 'directory' | 'visits' | 'settings'

export default function App() {
  const [tab, setTab] = useState<Tab>('directory')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    applyTheme(storedTheme())
    void ensureDefaults().then(() => {
      setReady(true)
      startSyncListeners()
    })
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
      <header className="top">
        <h1>MedRep</h1>
        <StatusDot />
      </header>

      <main>
        {tab === 'directory' && <Directory />}
        {tab === 'visits' && <Visits />}
        {tab === 'settings' && (
          <Suspense fallback={<p className="muted pad">Loading</p>}>
            <SettingsPage />
          </Suspense>
        )}
      </main>

      <nav className="tabbar">
        <button type="button" className={tab === 'directory' ? 'on' : ''} onClick={() => setTab('directory')}>
          <BookUser size={22} />
          Directory
        </button>
        <button type="button" className={tab === 'visits' ? 'on' : ''} onClick={() => setTab('visits')}>
          <CalendarDays size={22} />
          Visits
        </button>
        <button type="button" className={tab === 'settings' ? 'on' : ''} onClick={() => setTab('settings')}>
          <Settings size={22} />
          Settings
        </button>
      </nav>
    </div>
  )
}
