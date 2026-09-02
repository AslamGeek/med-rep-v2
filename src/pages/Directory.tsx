import { useEffect, useMemo, useRef, useState } from 'react'
  const [editing, setEditing] = useState<Doctor | null | undefined>(undefined)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

const EMPTY_DOCTORS: Doctor[] = []
const EMPTY_LISTS: SettingList[] = []
const EMPTY_PRODUCTS: Product[] = []
const EMPTY_TEMPLATES: FilterTemplate[] = []

const emptyFilters: SavedFilters = {
  id: 'directory',
  query: '',
  areas: [],
  camps: [],
  specialties: [],
  callSchedules: [],
  products: [],
  prescribers: [],
}

export function Directory({ searchOpen }: { searchOpen: boolean }) {
  const doctors = useLiveQuery(() => db.doctors.toArray(), []) ?? EMPTY_DOCTORS
  const lists = useLiveQuery(() => db.settingLists.toArray(), []) ?? EMPTY_LISTS
  const products = useLiveQuery(() => db.products.toArray(), []) ?? EMPTY_PRODUCTS
  const saved = useLiveQuery(() => db.savedFilters.get('directory'), []) ?? emptyFilters
  const templates = useLiveQuery(() => db.filterTemplates.toArray(), []) ?? EMPTY_TEMPLATES
  const [editing, setEditing] = useState<Doctor | null | undefined>(undefined)
  const [openFilter, setOpenFilter] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const hasActiveFilters =
    saved.areas.length > 0 ||
    saved.camps.length > 0 ||
    saved.specialties.length > 0 ||
    saved.callSchedules.length > 0 ||
    saved.products.length > 0 ||
    saved.prescribers.length > 0

  function clearAllFilters() {
    patchFilters({
      areas: [],
      camps: [],
      specialties: [],
      callSchedules: [],
      products: [],
      prescribers: [],
    })
  }

  function applyTemplate(t: FilterTemplate) {
    patchFilters({
      areas: t.areas,
      camps: t.camps,
      specialties: t.specialties,
      callSchedules: t.callSchedules,
      products: t.products,
      prescribers: t.prescribers,
    })
  }

  async function saveTemplate() {
    const parts: string[] = []
    if (saved.areas.length) parts.push(`Area: ${saved.areas.join('/')}`)
    if (saved.camps.length) parts.push(`Camp: ${saved.camps.join('/')}`)
    if (saved.specialties.length) parts.push(`Specialty: ${saved.specialties.join('/')}`)
    if (saved.callSchedules.length) parts.push(`Call: ${saved.callSchedules.join('/')}`)
    if (saved.products.length) parts.push(`Product: ${saved.products.join('/')}`)
    if (saved.prescribers.length) parts.push(`Prescriber: ${saved.prescribers.join('/')}`)
    if (parts.length === 0) return
    const name = parts.join(' + ')

    // Don't create a duplicate if this exact combo is already saved.
    const isDuplicate = templates.some(
      (t) =>
        t.areas.join() === saved.areas.join() &&
        t.camps.join() === saved.camps.join() &&
        t.specialties.join() === saved.specialties.join() &&
        t.callSchedules.join() === saved.callSchedules.join() &&
        t.products.join() === saved.products.join() &&
        t.prescribers.join() === saved.prescribers.join(),
    )
    if (isDuplicate) return

    await db.filterTemplates.put({
      id: newTemplateId(),
      name,
      areas: saved.areas,
      camps: saved.camps,
      specialties: saved.specialties,
      callSchedules: saved.callSchedules,
      products: saved.products,
      prescribers: saved.prescribers,
    })
    notifyDb()
  }

  async function deleteTemplate(id: string) {
    await db.filterTemplates.delete(id)
    notifyDb()
  }

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])

  const listMap = useMemo(() => {
    const m: Record<string, string[]> = {}
    for (const row of lists) m[row.key] = row.values
    return m
  }, [lists])

  const metrics = useMemo(() => {
    const active = doctors.filter((d) => d.active)
    return {
      total: active.length,
      rx: active.filter((d) => d.prescriber === 'Rx').length,
      nrx: active.filter((d) => d.prescriber === 'NRx').length,
      hosp: active.filter((d) => d.hospital.trim()).length,
      pharm: active.filter((d) => d.attachedPharmacy.trim()).length,
    }
  }, [doctors])

  const filtered = useMemo(() => {
    const q = saved.query.trim().toLowerCase()
    return doctors
      .filter((d) => {
        if (q) {
          const hay = [d.name, d.hospital, d.attachedPharmacy, d.area, d.notes, d.camp]
            .join(' ')
            .toLowerCase()
          if (!hay.includes(q)) return false
        }
        if (saved.areas.length && !saved.areas.includes(d.area)) return false
        if (saved.camps.length && !saved.camps.includes(d.camp)) return false
        if (
          saved.specialties.length &&
          !d.specialties.some((s) => saved.specialties.includes(s))
        )
          return false
        if (saved.callSchedules.length && !saved.callSchedules.includes(d.callSchedule))
          return false
        if (
          saved.products.length &&
          !d.prescribingProducts.some((p) => saved.products.includes(p))
        )
          return false
        if (saved.prescribers.length && !saved.prescribers.includes(d.prescriber)) return false
        return true
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [doctors, saved])

  function patchFilters(partial: Partial<SavedFilters>) {
    const next = { ...saved, ...partial, id: 'directory' as const }
    void db.savedFilters.put(next).then(() => window.dispatchEvent(new Event('medrep-db')))
  }

  return (
    <section className="page">
      {searchOpen && (
        <div className="search-row">
          <Search size={18} />
          <input
            ref={searchInputRef}
            placeholder="Search doctors"
            value={saved.query}
            onChange={(e) => patchFilters({ query: e.target.value })}
          />
          {saved.query && (
            <button
              type="button"
              className="icon-btn"
              aria-label="Clear search"
              onClick={() => patchFilters({ query: '' })}
            >
              <X size={16} />
            </button>
          )}
        </div>
      )}

      <div className="metrics">
        <Metric label="Total" value={metrics.total} />
        <Metric label="Rx" value={metrics.rx} />
        <Metric label="NRx" value={metrics.nrx} />
        <Metric label="Hosp" value={metrics.hosp} />
        <Metric label="Pharm" value={metrics.pharm} />
      </div>

      <>
          <div className="templates-row">
            {templates.map((t) => (
              <div key={t.id} className="template-chip">
                <button type="button" onClick={() => applyTemplate(t)}>
                  {t.name}
                </button>
                <button
                  type="button"
                  className="template-chip-delete"
                  aria-label={`Delete ${t.name}`}
                  onClick={() => void deleteTemplate(t.id)}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="template-add"
              disabled={!hasActiveFilters}
              title={hasActiveFilters ? 'Save current filters as a template' : 'Set some filters first'}
              onClick={() => void saveTemplate()}
            >
              <Plus size={14} />
              Save filters
            </button>
            <button
              type="button"
              className="template-clear"
              disabled={!hasActiveFilters}
              onClick={clearAllFilters}
            >
              Clear all
            </button>
          </div>
          <button
            type="button"
            className={`filter-trigger ${hasActiveFilters ? 'filter-trigger--on' : ''}`}
            onClick={() => setFilterSheetOpen(true)}
          >
            <SlidersHorizontal size={16} />
            Filters
            {hasActiveFilters && (
              <span className="filter-trigger-count">
                {saved.areas.length +
                  saved.camps.length +
                  saved.specialties.length +
                  saved.callSchedules.length +
                  saved.products.length +
                  saved.prescribers.length}
              </span>
            )}
          </button>
          <FilterSheet
            open={filterSheetOpen}
            draftSource={{
              prescribers: saved.prescribers,
              specialties: saved.specialties,
              camps: saved.camps,
              areas: saved.areas,
              callSchedules: saved.callSchedules,
              products: saved.products,
            }}
            specialtyOptions={listMap.Specialties ?? []}
            campOptions={listMap.Camps ?? []}
            areaOptions={listMap.Areas ?? []}
            callOptions={listMap['Call Schedule'] ?? []}
            productOptions={products.map((p) => p.name)}
            onClose={() => setFilterSheetOpen(false)}
            onApply={(next) => {
              patchFilters(next)
              setFilterSheetOpen(false)
            }}
          />
      </>

      <ul className="cards">
        {filtered.map((d) => (
          <li key={d.id}>
            <button type="button" className={`card ${d.prescriber === 'Rx' ? 'card--rx' : ''}`} onClick={() => setEditing(d)}>
              <div className="card-top">
                <strong>{d.name}</strong>
                <span className={`badge ${d.prescriber === 'Rx' ? 'badge--rx' : ''}`}>
                  {d.prescriber}
                </span>
              </div>
              <p className="muted">
                {[d.specialties.join(', '), d.area, d.camp, d.hospital]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {d.prescriber === 'Rx' && d.prescribingProducts.length > 0 && (
                <p className="products">{d.prescribingProducts.join(' · ')}</p>
              )}
            </button>
          </li>
        ))}
        {filtered.length === 0 && <p className="muted pad">No doctors match</p>}
      </ul>

      <button type="button" className="fab" onClick={() => setEditing(null)} aria-label="Add doctor">
        <Plus size={24} />
      </button>

      {editing !== undefined && (
        <DoctorForm doctor={editing} onClose={() => setEditing(undefined)} />
      )}
    </section>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <span>{value}</span>
      {label}
    </div>
  )
}
