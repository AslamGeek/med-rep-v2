import { useEffect, useMemo, useState } from 'react'
import { Ban } from 'lucide-react'
import { db, newVisitId } from '../db/database'
import { useLiveQuery } from '../hooks/useLiveQuery'
import { addDaysIso, isSunday, joinList, lastVisitByDoctorName, todayIso, visitRecencyLabel, weekdayName } from '../lib/dates'
import { persistVisit, undoVisit } from '../sync/engine'
import { VisitHistory } from './VisitHistory'
import { TwoColumnLists } from '../components/NumberedList'
import { FilterChip } from '../components/FilterChip'
import type { Doctor, SettingList, Visit } from '../types'

const EMPTY_DOCTORS: Doctor[] = []
const EMPTY_VISITS: Visit[] = []
const EMPTY_LISTS: SettingList[] = []
const SUGGEST_KEY = 'visitSuggestedDate'
const OFF_DAY = 'Holiday/Leave'

export function Visits() {
  const doctors = useLiveQuery(() => db.doctors.filter((d) => d.active).toArray(), []) ?? EMPTY_DOCTORS
  const lists = useLiveQuery(() => db.settingLists.get('Camps'), [])
  const allLists = useLiveQuery(() => db.settingLists.toArray(), []) ?? EMPTY_LISTS
  // Order by id (which is timestamp-based) descending so the most recently
  // saved bundle is always first — not just the latest calendar date, since
  // catch-up entries for older dates can be logged after newer ones.
  const history = useLiveQuery(() => db.visits.orderBy('id').reverse().toArray(), []) ?? EMPTY_VISITS

  const [tab, setTab] = useState<'log' | 'history'>('log')
  const [date, setDate] = useState(todayIso)
  const [offDay, setOffDay] = useState(false)
  const [camp, setCamp] = useState('')
  const [campTouched, setCampTouched] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [openFilter, setOpenFilter] = useState<string | null>(null)
  const [scheduleFilter, setScheduleFilter] = useState<string[]>([])
  const [scheduleTouched, setScheduleTouched] = useState(false)
  const [specialtyFilter, setSpecialtyFilter] = useState<string[]>([])
  const [undo, setUndo] = useState<Visit | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    void db.meta.get(SUGGEST_KEY).then((row) => {
      const suggested = row?.value || todayIso()
      const min = todayIso()
      setDate(suggested < min ? min : suggested)
    })
  }, [])

  const camps = lists?.values ?? []
  const scheduleOptions = useMemo(
    () => allLists.find((l) => l.key === 'Call Schedule')?.values ?? [],
    [allLists],
  )
  const specialtyOptions = useMemo(
    () => allLists.find((l) => l.key === 'Specialties')?.values ?? [],
    [allLists],
  )

  // Default the schedule filter to "Everyday" once it's available, unless
  // the user has deliberately changed it. Specialty stays unset (= all).
  useEffect(() => {
    if (!scheduleTouched && scheduleFilter.length === 0 && scheduleOptions.includes('Everyday')) {
      setScheduleFilter(['Everyday'])
    }
  }, [scheduleOptions, scheduleTouched, scheduleFilter])

  // Default to the first camp once camps load, unless the user has already
  // picked one themselves.
  useEffect(() => {
    if (!campTouched && !camp && camps.length > 0) {
      setCamp(camps[0])
    }
  }, [camps, camp, campTouched])

  const weekday = weekdayName(date)
  const sunday = isSunday(date)
  const noVisit = sunday || offDay

  const campDoctors = useMemo(() => {
    if (!camp) return EMPTY_DOCTORS
    return doctors
      .filter((d) => d.camp === camp)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [doctors, camp])

  const visibleDoctors = useMemo(() => {
    let list = campDoctors
    if (scheduleFilter.length) {
      list = list.filter((d) => scheduleFilter.includes(d.callSchedule))
    }
    if (specialtyFilter.length) {
      list = list.filter((d) => d.specialties.some((s) => specialtyFilter.includes(s)))
    }
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter((d) => {
        const hay = [d.name, d.specialties.join(' '), d.hospital, d.attachedPharmacy].join(' ').toLowerCase()
        return hay.includes(q)
      })
    }
    return list
  }, [campDoctors, search, scheduleFilter, specialtyFilter])

  const selectedDoctors = useMemo(
    () => campDoctors.filter((d) => selected.includes(d.id)),
    [campDoctors, selected],
  )
  const pharmacies = useMemo(() => {
    const names = selectedDoctors.map((d) => d.attachedPharmacy.trim()).filter(Boolean)
    return [...new Set(names)]
  }, [selectedDoctors])

  const lastVisits = useMemo(() => lastVisitByDoctorName(history), [history])
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
    // Always advance from the date just used, never back to today.
    const min = todayIso()
    const next = addDaysIso(date, 1)
    const nextDate = next < min ? min : next
    setDate(nextDate)
    await db.meta.put({ key: SUGGEST_KEY, value: nextDate })
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

  function selectAllVisible() {
    setSelected((ids) => [...new Set([...ids, ...visibleDoctors.map((d) => d.id)])])
    setError('')
  }

  function clearAllVisible() {
    const visibleIds = new Set(visibleDoctors.map((d) => d.id))
    setSelected((ids) => ids.filter((id) => !visibleIds.has(id)))
    setError('')
  }

  const minDate = todayIso()
  const doctorCount = selectedDoctors.length
  const pharmacyCount = pharmacies.length

  return (
    <section className="page visits">
      <div className="visit-tabs">
        <button
          type="button"
          className={`visit-tab ${tab === 'log' ? 'on' : ''}`}
          onClick={() => setTab('log')}
        >
          Log Visits
        </button>
        <button
          type="button"
          className={`visit-tab ${tab === 'history' ? 'on' : ''}`}
          onClick={() => setTab('history')}
        >
          Visit History
        </button>
      </div>

      {tab === 'history' ? (
        <VisitHistory history={history} camps={camps} />
      ) : (
        <>
          <div className="visit-toolbar">
            <label className="visit-date">
              <span className="visit-field-head">Date</span>
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
              <span className="day-meta">
                {weekday}
                {sunday ? ' · no visit' : ''}
              </span>
            </label>

            <label className="visit-camp">
              <span className="visit-field-head">Camp</span>
              {camps.length === 0 ? (
                <p className="muted pad">No camps configured yet — add one in Settings</p>
              ) : (
                <select
                  value={camp}
                  onChange={(e) => {
                    setCamp(e.target.value)
                    setCampTouched(true)
                    setSelected([])
                    setSearch('')
                    setError('')
                  }}
                >
                  {camps.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
            </label>

        {!sunday && (
          <div className="visit-off-wrap">
            <span className="visit-field-head" aria-hidden="true">
              &nbsp;
            </span>
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
          </div>
        )}
          </div>

          {!noVisit && (
            <>
              <div className="picker">
                <div className="picker-head-row">
                  <p className="picker-label">Doctors</p>
                  <div className="picker-bulk-actions">
                    <button type="button" onClick={selectAllVisible} disabled={visibleDoctors.length === 0}>
                      Select all
                    </button>
                    <button type="button" onClick={clearAllVisible} disabled={visibleDoctors.length === 0}>
                      Clear all
                    </button>
                  </div>
                </div>
                {camp && (
                  <>
                    {openFilter && (
                      <button
                        type="button"
                        className="chip-backdrop"
                        aria-label="Close filters"
                        onClick={() => setOpenFilter(null)}
                      />
                    )}
                    <div className={`chips ${openFilter ? 'chips--open' : ''}`}>
                      <FilterChip
                        id="schedule"
                        label="Schedule"
                        options={scheduleOptions}
                        selected={scheduleFilter}
                        open={openFilter === 'schedule'}
                        onOpenChange={setOpenFilter}
                        onChange={(next) => {
                          setScheduleTouched(true)
                          setScheduleFilter(next)
                        }}
                      />
                      <FilterChip
                        id="specialty"
                        label="Specialty"
                        options={specialtyOptions}
                        selected={specialtyFilter}
                        open={openFilter === 'specialty'}
                        onOpenChange={setOpenFilter}
                        onChange={setSpecialtyFilter}
                      />
                    </div>
                    <input
                      className="picker-search"
                      placeholder="Search doctors"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </>
                )}
                <div className="picker-pane">
                  {!camp && <p className="muted pad">Select a camp to see doctors</p>}
                  {camp &&
                    visibleDoctors.map((d) => {
                      const on = selected.includes(d.id)
                      const recency = visitRecencyLabel(lastVisits.get(d.name.toLowerCase()))
                      const subtitle = [d.specialties.join(', '), d.hospital, d.attachedPharmacy]
                        .map((s) => s.trim())
                        .filter(Boolean)
                        .join(' · ')
                      return (
                        <button
                          key={d.id}
                          type="button"
                          className={`picker-item ${on ? 'on' : ''}`}
                          onClick={() => toggle(d)}
                        >
                          <input type="checkbox" checked={on} readOnly tabIndex={-1} />
                          <span className="picker-body">
                            <strong className="picker-name">{d.name}</strong>
                            {subtitle && <span className="picker-sub">{subtitle}</span>}
                            <span className={`visit-tag visit-tag--${recency.tone}`}>{recency.text}</span>
                          </span>
                        </button>
                      )
                    })}
                  {camp && campDoctors.length === 0 && (
                    <p className="muted pad">No active doctors in this camp</p>
                  )}
                  {camp && campDoctors.length > 0 && visibleDoctors.length === 0 && (
                    <p className="muted pad">No doctors match your search</p>
                  )}
                </div>
              </div>

              <div className="preview">
                <p>
                  {doctorCount} doctor{doctorCount === 1 ? '' : 's'} · {pharmacyCount}{' '}
                  {pharmacyCount === 1 ? 'pharmacy' : 'pharmacies'} selected
                </p>
                <TwoColumnLists
                  leftLabel="Doctors"
                  leftItems={selectedDoctors.map((d) => d.name)}
                  rightLabel="Pharmacies"
                  rightItems={pharmacies}
                />
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
        </>
      )}
    </section>
  )
}