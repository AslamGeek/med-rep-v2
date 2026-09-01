import { useEffect, useState } from 'react'
import { getSyncStatus, subscribeSync } from '../sync/engine'
import type { SyncStatus } from '../types'

const LABELS: Record<SyncStatus, string> = {
  idle: 'Up to date',
  syncing: 'Saving',
  offline: 'Offline',
  error: 'Sync issue',
}

export function StatusDot() {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus)

  useEffect(() => subscribeSync(setStatus), [])

  return (
    <span className={`status-dot status-dot--${status}`} title={LABELS[status]} aria-label={LABELS[status]}>
      <i />
    </span>
  )
}
