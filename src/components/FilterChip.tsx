import { useMemo } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

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
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <div className="chip-options" role="listbox">
          {options.length === 0 && <p className="muted">No options yet</p>}
          {options.map((opt) => {
            const on = selected.includes(opt)
            return (
              <button
                key={opt}
                type="button"
                className={`chip ${on ? 'chip--on' : ''}`}
                onClick={() =>
                  onChange(on ? selected.filter((s) => s !== opt) : [...selected, opt])
                }
              >
                {opt}
              </button>
            )
          })}
          {count > 0 && (
            <button type="button" className="chip chip-clear" onClick={() => onChange([])}>
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  )
}