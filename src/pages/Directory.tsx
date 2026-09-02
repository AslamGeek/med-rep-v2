import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Plus, Search, X } from 'lucide-react'
import { db, newTemplateId, notifyDb } from '../db/database'
import { useLiveQuery } from '../hooks/useLiveQuery'
import type { Doctor, FilterTemplate, Prescriber, Product, SavedFilters, SettingList } from '../types'
import { DoctorForm } from '../components/DoctorForm'
import { FilterChip } from '../components/FilterChip'

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

export function Directory({
  searchOpen,
  onSearchOpenChange,
}: {
  searchOpen: boolean
  onSearchOpenChange: (open: boolean) => void
}) {
  const doctors = useLiveQuery(() => db.doctors.toArray(), []) ?? EMPTY_DOCTORS
  const lists = useLiveQuery(() => db.settingLists.toArray(), []) ?? EMPTY_LISTS
  const products = useLiveQuery(() => db.products.toArray(), []) ?? EMPTY_PRODUCTS
  const saved = useLiveQuery(() => db.savedFilters.get('directory'), []) ?? emptyFilters
  const templates = useLiveQuery(() => db.filterTemplates.toArray(), []) ?? EMPTY_TEMPLATES
  const [editing, setEditing] = useState<Doctor | null | undefined>(undefined)
  const [openFilter, setOpenFilter] = useState<string | null>(null)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  const hasActiveFilters =
    saved.areas.length > 0 ||
    saved.camps.length > 0 ||
    saved.specialties.length > 0 ||
    saved.callSchedules.length > 0 ||
    saved.products.length > 0 ||
    saved.prescribers.length > 0

  function applyTemplate(t: FilterTemplate) {
    patchFilters({
      areas: t.areas,
      camps: t.camps,
      specialties: t.specialties,
      callSchedules: t.callSchedules,
      products: t.products,
      prescribers: t.prescribers,
    })
    setOpenFilter(null)
  }

  async function saveTemplate() {
    const name = templateName.trim()
    if (!name) return
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
    setTemplateName('')
    setSavingTemplate(false)
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

      {searchOpen && (
        <>
          {openFilter && (
            <button
              type="button"
              className="chip-backdrop"
              aria-label="Close filters"
              onClick={() => setOpenFilter(null)}
            />
          )}
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
            {savingTemplate ? (
              <form
                className="template-save-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  void saveTemplate()
                }}
              >
                <input
                  autoFocus
                  placeholder="Template name"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                />
                <button type="submit" className="icon-btn" aria-label="Save template">
                  <Check size={16} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Cancel"
                  onClick={() => {
                    setSavingTemplate(false)
                    setTemplateName('')
                  }}
                >
                  <X size={16} />
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="template-add"
                disabled={!hasActiveFilters}
                title={hasActiveFilters ? 'Save current filters as a template' : 'Set some filters first'}
                onClick={() => setSavingTemplate(true)}
              >
                <Plus size={14} />
                Save filters
              </button>
            )}
          </div>
          <div className={`chips ${openFilter ? 'chips--open' : ''}`}>
        <FilterChip
          id="area"
          label="Area"
          options={listMap.Areas ?? []}
          selected={saved.areas}
          open={openFilter === 'area'}
          onOpenChange={setOpenFilter}
          onChange={(areas) => patchFilters({ areas })}
        />
        <FilterChip
          id="camp"
          label="Camp"
          options={listMap.Camps ?? []}
          selected={saved.camps}
          open={openFilter === 'camp'}
          onOpenChange={setOpenFilter}
          onChange={(camps) => patchFilters({ camps })}
        />
        <FilterChip
          id="specialty"
          label="Specialty"
          options={listMap.Specialties ?? []}
          selected={saved.specialties}
          open={openFilter === 'specialty'}
          onOpenChange={setOpenFilter}
          onChange={(specialties) => patchFilters({ specialties })}
        />
        <FilterChip
          id="call"
          label="Call"
          options={listMap['Call Schedule'] ?? []}
          selected={saved.callSchedules}
          open={openFilter === 'call'}
          onOpenChange={setOpenFilter}
          onChange={(callSchedules) => patchFilters({ callSchedules })}
        />
        <FilterChip
          id="product"
          label="Product"
          options={products.map((p) => p.name)}
          selected={saved.products}
          open={openFilter === 'product'}
          onOpenChange={setOpenFilter}
          onChange={(next) => patchFilters({ products: next })}
        />
        <FilterChip
          id="prescriber"
          label="Prescriber"
          options={['NRx', 'Rx']}
          selected={saved.prescribers}
          open={openFilter === 'prescriber'}
          onOpenChange={setOpenFilter}
          onChange={(next) => patchFilters({ prescribers: next as Prescriber[] })}
        />
          </div>
        </>
      )}

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
