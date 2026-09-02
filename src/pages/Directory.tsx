import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Search, SlidersHorizontal, X } from 'lucide-react'
import { db, newTemplateId, notifyDb } from '../db/database'
import { useLiveQuery } from '../hooks/useLiveQuery'
import type { Doctor, FilterTemplate, Prescriber, Product, SavedFilters, SettingList } from '../types'
import { DoctorForm } from '../components/DoctorForm'
import { FilterSheet } from '../components/FilterSheet'

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
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
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