import { useEffect, useMemo, useState } from 'react'
import { Ban } from 'lucide-react'
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

  const campDoctors = useMemo(() => {
    if (!camp) return EMPTY_DOCTORS
    return doctors
      .filter((d) => d.camp === camp)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [doctors, camp])

  const selectedDoctors = useMemo(
    () => campDoctors.filter((d) => selected.includes(d.id)),
    [campDoctors, selected],
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
  const doctorCount = selectedDoctors.length
  const pharmacyCount = pharmacies.length

  return (
    <section className="page visits">
      <div className="visit-toolbar">
        <label className="visit-date">
          <span className="visit-field-head">
            Date
            <span className="day-meta">
              {weekday}
              {sunday ? ' · no visit' : ''}
            </span>
          </span>
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

        <label className="visit-camp">
          <span className="visit-field-head">Camp</span>
          <select
            value={camp}
            onChange={(e) => {
              setCamp(e.target.value)
              setSelected([])
              setError('')
            }}
          >
            <option value="">Select</option>
            {camps.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        {!sunday && (
          <button
            type="button"
            className={`visit-off ${offDay ? 'on' : ''}`}
            aria-pressed={offDay}
            aria-label="Mark as Holiday/Leave (no visit today)"
            title="Holiday/Leave"
            onClick={() => {
              setOffDay((v) => !v)
              setError('')
            }}
          >
            <Ban size={20} />
          </button>
        )}
      </div>

      {!noVisit && (
        <>
          <div className="picker">
            <p className="picker-label">Doctors</p>
            <div className="picker-pane">
              {!camp && <p className="muted pad">Select a camp to see doctors</p>}
              {camp &&
                campDoctors.map((d) => {
                  const on = selected.includes(d.id)
                  return (
                    <button
                      key={d.id}
                      type="button"
                      className={`picker-item ${on ? 'on' : ''}`}
                      onClick={() => toggle(d)}
                    >
                      <input type="checkbox" checked={on} readOnly tabIndex={-1} />
                      <span className="picker-name">{d.name}</span>
                      <span className="muted">{d.area}</span>
                    </button>
                  )
                })}
              {camp && campDoctors.length === 0 && (
                <p className="muted pad">No active doctors in this camp</p>
              )}
            </div>
          </div>

          <div className="preview">
            <p>
              {doctorCount} doctor{doctorCount === 1 ? '' : 's'} · {pharmacyCount}{' '}
              {pharmacyCount === 1 ? 'pharmacy' : 'pharmacies'} selected
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
