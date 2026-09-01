import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { db, newDoctorId } from '../db/database'
import { persistDoctor } from '../sync/engine'
import type { Doctor, Prescriber, SettingKey } from '../types'
import { SETTING_KEYS } from '../types'

type Props = {
  doctor: Doctor | null
  onClose: () => void
}

const empty = (): Doctor => ({
  id: newDoctorId(),
  name: '',
  specialties: [],
  hospital: '',
  attachedPharmacy: '',
  area: '',
  camp: '',
  potential: '',
  stockist: '',
  prescriber: 'NRx',
  opTiming: '',
  callSchedule: '',
  prescribingProducts: [],
  notes: '',
  active: true,
  updatedAt: new Date().toISOString(),
})

export function DoctorForm({ doctor, onClose }: Props) {
  const [form, setForm] = useState<Doctor>(doctor ? { ...doctor } : empty())
  const [lists, setLists] = useState<Record<SettingKey, string[]>>(
    Object.fromEntries(SETTING_KEYS.map((k) => [k, [] as string[]])) as unknown as Record<
      SettingKey,
      string[]
    >,
  )
  const [products, setProducts] = useState<{ name: string }[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    void (async () => {
      const rows = await db.settingLists.toArray()
      const next = { ...lists }
      for (const row of rows) next[row.key] = row.values
      setLists(next)
      setProducts(await db.products.toArray())
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const productNames = useMemo(() => products.map((p) => p.name), [products])

  function set<K extends keyof Doctor>(key: K, value: Doctor[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function save() {
    if (!form.name.trim()) {
      setError('Name is required')
      return
    }
    const next: Doctor = {
      ...form,
      name: form.name.trim(),
      prescribingProducts: form.prescriber === 'Rx' ? form.prescribingProducts : [],
      updatedAt: new Date().toISOString(),
    }
    await persistDoctor(next)
    onClose()
  }

  return (
    <div className="sheet" role="dialog" aria-labelledby="doc-form-title">
      <header className="sheet-bar">
        <h2 id="doc-form-title">{doctor ? 'Edit doctor' : 'Add doctor'}</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          <X size={22} />
        </button>
      </header>
      <div className="sheet-body">
        <label>
          Name
          <input value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
        </label>

        <fieldset>
          <legend>Prescriber</legend>
          <div className="seg">
            {(['NRx', 'Rx'] as Prescriber[]).map((p) => (
              <button
                key={p}
                type="button"
                className={form.prescriber === p ? 'on' : ''}
                onClick={() => set('prescriber', p)}
              >
                {p}
              </button>
            ))}
          </div>
        </fieldset>

        <Select label="Area" value={form.area} options={lists.Areas} onChange={(v) => set('area', v)} />
        <Select label="Camp" value={form.camp} options={lists.Camps} onChange={(v) => set('camp', v)} />

        <fieldset>
          <legend>Active</legend>
          <div className="seg">
            <button type="button" className={form.active ? 'on' : ''} onClick={() => set('active', true)}>
              Yes
            </button>
            <button type="button" className={!form.active ? 'on' : ''} onClick={() => set('active', false)}>
              No
            </button>
          </div>
        </fieldset>

        {form.prescriber === 'Rx' && (
          <Multi
            label="Prescribing products"
            options={productNames}
            selected={form.prescribingProducts}
            onChange={(v) => set('prescribingProducts', v)}
          />
        )}

        <Multi
          label="Specialties"
          options={lists.Specialties}
          selected={form.specialties}
          onChange={(v) => set('specialties', v)}
        />
        <Select
          label="Potential"
          value={form.potential}
          options={lists.Potentials}
          onChange={(v) => set('potential', v)}
        />
        <Select
          label="Stockist"
          value={form.stockist}
          options={lists.Stockist}
          onChange={(v) => set('stockist', v)}
        />
        <Select
          label="OP timing"
          value={form.opTiming}
          options={lists['OP Timings']}
          onChange={(v) => set('opTiming', v)}
        />
        <Select
          label="Call schedule"
          value={form.callSchedule}
          options={lists['Call Schedule']}
          onChange={(v) => set('callSchedule', v)}
        />

        <label>
          Hospital
          <input value={form.hospital} onChange={(e) => set('hospital', e.target.value)} />
        </label>
        <label>
          Attached pharmacy
          <input
            value={form.attachedPharmacy}
            onChange={(e) => set('attachedPharmacy', e.target.value)}
          />
        </label>
        <label>
          Notes
          <textarea rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </label>

        {error && <p className="error">{error}</p>}
      </div>
      <footer className="sheet-foot">
        <button type="button" className="primary" onClick={() => void save()}>
          Save
        </button>
      </footer>
    </div>
  )
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
}) {
  return (
    <label>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  )
}

function Multi({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: string[]
  selected: string[]
  onChange: (v: string[]) => void
}) {
  return (
    <fieldset>
      <legend>{label}</legend>
      <div className="pill-row">
        {options.map((o) => {
          const on = selected.includes(o)
          return (
            <button
              key={o}
              type="button"
              className={`pill ${on ? 'on' : ''}`}
              onClick={() => onChange(on ? selected.filter((s) => s !== o) : [...selected, o])}
            >
              {o}
            </button>
          )
        })}
        {options.length === 0 && <p className="muted">Add values in Settings</p>}
      </div>
    </fieldset>
  )
}
