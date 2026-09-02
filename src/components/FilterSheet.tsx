import { useState } from 'react'
import { X } from 'lucide-react'
import type { Prescriber, SavedFilters } from '../types'

type Draft = Pick
  SavedFilters,
  'prescribers' | 'specialties' | 'camps' | 'areas' | 'callSchedules' | 'products'
>

type Props = {
  open: boolean
  draftSource: Draft
  specialtyOptions: string[]
  campOptions: string[]
  areaOptions: string[]
  callOptions: string[]
  productOptions: string[]
  onClose: () => void
  onApply: (next: Draft) => void
}

export function FilterSheet({
  open,
  draftSource,
  specialtyOptions,
  campOptions,
  areaOptions,
  callOptions,
  productOptions,
  onClose,
  onApply,
}: Props) {
  const [draft, setDraft] = useState<Draft>(draftSource)
  const [seeded, setSeeded] = useState(false)

  if (!open) {
    if (seeded) setSeeded(false)
    return null
  }
  if (!seeded) {
    setDraft(draftSource)
    setSeeded(true)
  }

  const count =
    draft.prescribers.length +
    draft.specialties.length +
    draft.camps.length +
    draft.areas.length +
    draft.callSchedules.length +
    draft.products.length

  function toggle(key: keyof Draft, value: string) {
    setDraft((d) => {
      const list = d[key] as string[]
      const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
      return { ...d, [key]: next }
    })
  }

  function clearAll() {
    setDraft({
      prescribers: [],
      specialties: [],
      camps: [],
      areas: [],
      callSchedules: [],
      products: [],
    })
  }

  return (
    <div className="sheet" role="dialog" aria-labelledby="filter-sheet-title">
      <header className="sheet-bar">
        <div>
          <h2 id="filter-sheet-title">Filter Doctors</h2>
          <p className="muted filter-sheet-sub">Multi-select filters (Tap items to toggle)</p>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          <X size={22} />
        </button>
      </header>
      <div className="sheet-body">
        <FilterGroup
          label="Prescriber Status"
          options={['Rx', 'NRx']}
          selected={draft.prescribers}
          onToggle={(v) => toggle('prescribers', v)}
        />
        <FilterGroup
          label="Specialty"
          options={specialtyOptions}
          selected={draft.specialties}
          onToggle={(v) => toggle('specialties', v)}
        />
        <FilterGroup
          label="Camp"
          options={campOptions}
          selected={draft.camps}
          onToggle={(v) => toggle('camps', v)}
        />
        <FilterGroup
          label="Area"
          options={areaOptions}
          selected={draft.areas}
          onToggle={(v) => toggle('areas', v)}
        />
        <FilterGroup
          label="Call Schedule"
          options={callOptions}
          selected={draft.callSchedules}
          onToggle={(v) => toggle('callSchedules', v)}
        />
        <FilterGroup
          label="Prescribing Product"
          options={productOptions}
          selected={draft.products}
          onToggle={(v) => toggle('products', v)}
        />
      </div>
      <footer className="sheet-foot filter-sheet-foot">
        <button type="button" className="text-btn" onClick={clearAll}>
          Clear All
        </button>
        <button type="button" className="primary" onClick={() => onApply(draft)}>
          Apply Filters ({count})
        </button>
      </footer>
    </div>
  )
}

function FilterGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string
  options: string[]
  selected: string[]
  onToggle: (value: string) => void
}) {
  return (
    <fieldset>
      <legend>{label.toUpperCase()}</legend>
      <div className="pill-row">
        {options.map((opt) => {
          const on = selected.includes(opt)
          return (
            <button
              key={opt}
              type="button"
              className={`pill ${on ? 'on' : ''}`}
              onClick={() => onToggle(opt)}
            >
              {opt}
            </button>
          )
        })}
        {options.length === 0 && <p className="muted">No options yet</p>}
      </div>
    </fieldset>
  )
}