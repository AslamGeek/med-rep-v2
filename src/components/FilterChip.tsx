import { useMemo } from 'react'
import { Check, ChevronDown } from 'lucide-react'

type Props = {
  id: string
  label: string
  options: string[]
  selected: string[]
  open: boolean
  onOpenChange: (id: string | null) => void
  onChange: (next: string[]) => void
}

export function FilterChip({
  id,
  label,
  options,
  selected,
  open,
  onOpenChange,
  onChange,
}: Props) {
  const count = selected.length
  const title = useMemo(
    () => (count ? `${label} · ${count}` : label),
    [label, count],
  )

  return (
    <div className={`chip-wrap ${open ? 'chip-wrap--open' : ''}`}>
      <button
        type="button"
        className={`chip ${count ? 'chip--on' : ''}`}
        aria-expanded={open}
        onClick={() => onOpenChange(open ? null : id)}
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
