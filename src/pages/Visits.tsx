import { useEffect, useMemo, useState } from 'react'
import { db, newVisitId } from '../db/database'
import { useLiveQuery } from '../hooks/useLiveQuery'
import { addDaysIso, isSunday, joinList, todayIso, weekdayName } from '../lib/dates'
import { persistVisit, undoVisit } from '../sync/engine'
import type { Doctor, Visit } from '../types'

const EMPTY_DOCTORS: Doctor[] = []
const EMPTY_VISITS: Visit[] = []
const SUGGEST_KEY = 'visitSuggestedDate'
const OFF_DAY = 'Holiday/Leave'

export function Visits() {
  const doctors = useLiveQuery(() => db.doctors.filter((d) => d.active).toArray(), []) ?? EMPTY_DOCTORS
  const lists = useLiveQuery(() => db.settingLists.get('Camps'), [])
  const history = useLiveQuery(() => db.visits.orderBy('date').reverse().toArray(), []) ?? EMPTY_VISITS

  const [date, setDate] = useState(todayIso)
  const [offDay, setOffDay] = useState(false)
  const [camp, setCamp] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [undo, setUndo] = useState<Visit | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    void db.meta.get(SUGGEST_KEY).then((row) => {
      const suggested = row?.value || todayIso()
      const min = todayIso()
      setDate(suggested < min ? min : suggested)
    })
  }, [])

  const weekday = weekdayName(date)
  const sunday = isSunday(date)
  const noVisit = sunday || offDay
  const camps = lists?.values ?? []

  const selectedDoctors = useMemo(
    () => doctors.filter((d) => selected.includes(d.id)),
    [doctors, selected],
  )
  const pharmacies = useMemo(() => {
    const names = selectedDoctors.map((d) => d.attachedPharmacy.trim()).filter(Boolean)
    return [...new Set(names)]
  }, [selectedDoctors])

  const canSaveWorking = selectedDoctors.length > 0

  async function save() {
    if (!noVisit && !canSaveWorking) {
      setError('Select at least one doctor')
      return
    }
    setError('')
    const day = sunday ? 'Sunday' : offDay ? OFF_DAY : weekday
    const visit: Visit = {
      id: newVisitId(),
      date,
      day,
      camp: noVisit ? '' : camp,
      doctorsCount: noVisit ? 0 : selectedDoctors.length,
      pharmacyCount: noVisit ? 0 : pharmacies.length,
      doctors: noVisit ? '' : joinList(selectedDoctors.map((d) => d.name)),
      pharmacy: noVisit ? '' : joinList(pharmacies),
    }
    await persistVisit(visit)
    setUndo(visit)
    setSelected([])
    setOffDay(false)
    if (date === todayIso()) {
      const next = addDaysIso(date, 1)
      setDate(next)
      await db.meta.put({ key: SUGGEST_KEY, value: next })
    }
    window.setTimeout(() => setUndo((u) => (u?.id === visit.id ? null : u)), 8000)
  }

  async function revert() {
    if (!undo) return
    await undoVisit(undo)
    setUndo(null)
  }

  function toggle(d: Doctor) {
    setSelected((ids) => (ids.includes(d.id) ? ids.filter((id) => id !== d.id) : [...ids, d.id]))
    setError('')
  }

  const minDate = todayIso()

  return (
    <section className="page visits">
      <label>
        Date
        <input
          type="date"
          min={minDate}
          value={date}
          onChange={(e) => {
            const v = e.target.value
            if (v && v >= minDate) {
              setDate(v)
              setOffDay(false)
              setError('')
            }
          }}
        />
      </label>

      <p className="day-meta">
        {weekday}
        {sunday ? ' · no visit' : ''}
      </p>

      {!sunday && (
        <button
          type="button"
          className={`chip holiday-toggle ${offDay ? 'chip--on' : ''}`}
          onClick={() => {
            setOffDay((v) => !v)
            setError('')
          }}
        >
          Mark as Holiday/Leave (no visit today)
        </button>
      )}

      {!noVisit && (
        <>
          <label>
            Camp
            <select value={camp} onChange={(e) => setCamp(e.target.value)}>
              <option value="">Select</option>
              {camps.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <div className="picker">
            <p className="picker-label">Doctors</p>
            <div className="picker-pane">
              {doctors
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    className={`picker-item ${selected.includes(d.id) ? 'on' : ''}`}
                    onClick={() => toggle(d)}
                  >
                    {d.name}
                    <span className="muted">{d.area}</span>
                  </button>
                ))}
              {doctors.length === 0 && <p className="muted">No active doctors</p>}
            </div>
          </div>

          <div className="preview">
            <p>
              <strong>{selectedDoctors.length}</strong> doctors
              {' · '}
              <strong>{pharmacies.length}</strong> pharmacies
            </p>
            {selectedDoctors.length > 0 && (
              <p className="muted">{selectedDoctors.map((d) => d.name).join('; ')}</p>
            )}
            {pharmacies.length > 0 && <p className="muted">{pharmacies.join('; ')}</p>}
          </div>
        </>
      )}

      {error && <p className="error">{error}</p>}

      <button
        type="button"
        className="primary"
        disabled={!noVisit && !canSaveWorking}
        onClick={() => void save()}
      >
        Save visit
      </button>

      {undo && (
        <div className="snack">
          Saved
          <button type="button" onClick={() => void revert()}>
            Undo
          </button>
        </div>
      )}

      <h3>History</h3>
      <ul className="history">
        {history.map((v) => (
          <li key={v.id}>
            <strong>
              {v.date} · {v.day}
            </strong>
            <span>
              {v.doctorsCount} doctors · {v.pharmacyCount} pharmacies
            </span>
            {v.doctors && <p className="muted">{v.doctors}</p>}
          </li>
        ))}
        {history.length === 0 && <p className="muted">No visits yet</p>}
      </ul>
    </section>
  )
}
