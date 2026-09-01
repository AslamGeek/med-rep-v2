import { useEffect, useMemo, useState } from 'react'
import { db, newVisitId } from '../db/database'
import { useLiveQuery } from '../hooks/useLiveQuery'
import { addDaysIso, isSunday, joinList, todayIso, weekdayName } from '../lib/dates'
import { persistVisit, undoVisit } from '../sync/engine'
import type { Doctor, Visit, VisitKind } from '../types'

const EMPTY_DOCTORS: Doctor[] = []
const EMPTY_VISITS: Visit[] = []
const SUGGEST_KEY = 'visitSuggestedDate'

export function Visits() {
  const doctors = useLiveQuery(() => db.doctors.filter((d) => d.active).toArray(), []) ?? EMPTY_DOCTORS
  const lists = useLiveQuery(() => db.settingLists.get('Camps'), [])
  const history = useLiveQuery(() => db.visits.orderBy('date').reverse().toArray(), []) ?? EMPTY_VISITS

  const [date, setDate] = useState(todayIso)
  const [kind, setKind] = useState<VisitKind>('working')
  const [camp, setCamp] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [undo, setUndo] = useState<Visit | null>(null)

  useEffect(() => {
    void db.meta.get(SUGGEST_KEY).then((row) => {
      const suggested = row?.value || todayIso()
      const min = todayIso()
      setDate(suggested < min ? min : suggested)
    })
  }, [])

  useEffect(() => {
    if (isSunday(date)) setKind('Sunday')
    else setKind((k) => (k === 'Sunday' ? 'working' : k))
  }, [date])

  const noDoctors = kind !== 'working'
  const camps = lists?.values ?? []

  const selectedDoctors = useMemo(
    () => doctors.filter((d) => selected.includes(d.id)),
    [doctors, selected],
  )
  const pharmacies = useMemo(() => {
    const names = selectedDoctors.map((d) => d.attachedPharmacy.trim()).filter(Boolean)
    return [...new Set(names)]
  }, [selectedDoctors])

  async function save() {
    const day = kind === 'working' ? weekdayName(date) : kind
    const visit: Visit = {
      id: newVisitId(),
      date,
      day,
      camp: noDoctors ? '' : camp,
      doctorsCount: noDoctors ? 0 : selectedDoctors.length,
      pharmacyCount: noDoctors ? 0 : pharmacies.length,
      doctors: noDoctors ? '' : joinList(selectedDoctors.map((d) => d.name)),
      pharmacy: noDoctors ? '' : joinList(pharmacies),
    }
    await persistVisit(visit)
    setUndo(visit)
    setSelected([])
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
            if (v && v >= minDate) setDate(v)
          }}
        />
      </label>

      <fieldset>
        <legend>Day type</legend>
        <div className="seg">
          {(['working', 'Sunday', 'Holiday', 'Leave'] as VisitKind[]).map((k) => (
            <button
              key={k}
              type="button"
              className={kind === k ? 'on' : ''}
              onClick={() => setKind(k)}
              disabled={k === 'working' && isSunday(date)}
            >
              {k === 'working' ? weekdayName(date) : k}
            </button>
          ))}
        </div>
      </fieldset>

      {!noDoctors && (
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

      <button type="button" className="primary" onClick={() => void save()}>
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
