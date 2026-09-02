import { useState } from 'react'
import { X } from 'lucide-react'

type Draft = {
  prescribers: string[]
  specialties: string[]
  camps: string[]
  areas: string[]
  callSchedules: string[]
  products: string[]
}

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
          onToggle={(v) =>