import { useMemo, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

type Props = {
  label: string
  options: string[]
  selected: string[]
  onChange: (next: string[]) => void
}

export function FilterChip({ label, options, selected, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const count = selected.length
  const title = useMemo(
    () => (count ? `${label} · ${count}` : label),
    [label, count],
  )

  return (
    <div className="chip-wrap">
      <button
        type="button"
        className={`chip ${count ? 'chip--on' : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        {title}
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="chip-menu" role="listbox">
          {options.length === 0 && <p className="muted">No options yet</p>}
          {options.map((opt) => {
            const on = selected.includes(opt)
            return (
              <button
                key={opt}
                type="button"
                className={`chip-option ${on ? 'on' : ''}`}
                onClick={() =>
                  onChange(on ? selected.filter((s) => s !== opt) : [...selected, opt])
                }
              >
                <Check size={16} className={on ? '' : 'invisible'} />
                {opt}
              </button>
            )
          })}
          {count > 0 && (
            <button type="button" className="text-btn" onClick={() => onChange([])}>
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  )
}
