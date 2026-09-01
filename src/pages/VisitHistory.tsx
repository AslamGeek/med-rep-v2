import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { Visit } from '../types'

export function VisitHistory({ history, camps }: { history: Visit[]; camps: string[] }) {
  const [campFilter, setCampFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return history.filter((v) => {
      if (campFilter && v.camp !== campFilter) return false
      if (dateFilter && v.date !== dateFilter) return false
      if (q) {
        const hay = [v.camp, v.doctors, v.pharmacy, v.day].join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [history, campFilter, dateFilter, query])

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="visit-history">
      <p className="history-count">{filtered.length} bundle{filtered.length === 1 ? '' : 's'} logged</p>

      <div className="history-filters">
        <input
          className="history-search"
          placeholder="Search history"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={campFilter} onChange={(e) => setCampFilter(e.target.value)}>
          <option value="">All camps</option>
          {camps.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
        />
      </div>

      <ul className="history">
        {filtered.map((v) => {
          const isOpen = expanded.has(v.id)
          const isHoliday = v.day === 'Holiday/Leave' || v.day === 'Sunday'
          return (
            <li key={v.id} className="history-item">
              <button type="button" className="history-row" onClick={() => toggle(v.id)}>
                <span className="history-row-main">
                  <strong>
                    {v.date} · {v.camp || v.day}
                  </strong>
                  <span className="muted">
                    {v.doctorsCount} doctors · {v.pharmacyCount} pharmacies
                    {isHoliday && <span className="badge badge--holiday"> Holiday</span>}
                  </span>
                </span>
                {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </button>
              {isOpen && (
                <div className="history-details">
                  {v.doctors && <p className="muted">Doctors: {v.doctors}</p>}
                  {v.pharmacy && <p className="muted">Pharmacies: {v.pharmacy}</p>}
                  {!v.doctors && !v.pharmacy && <p className="muted">No visit logged this day</p>}
                </div>
              )}
            </li>
          )
        })}
        {filtered.length === 0 && <p className="muted pad">No visits match</p>}
      </ul>
    </div>
  )
}