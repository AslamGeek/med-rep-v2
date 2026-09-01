import { useState } from 'react'
import { Moon, Plus, Sun, Trash2 } from 'lucide-react'
import { db, newProductId } from '../db/database'
import { useLiveQuery } from '../hooks/useLiveQuery'
import { applyTheme, storedTheme } from '../lib/dates'
import { persistProduct, persistSettings, removeProduct } from '../sync/engine'
import { SETTING_KEYS, type Product, type SettingKey, type SettingList } from '../types'

const EMPTY_LISTS: SettingList[] = []
const EMPTY_PRODUCTS: Product[] = []

export function SettingsPage() {
  const lists = useLiveQuery(() => db.settingLists.toArray(), []) ?? EMPTY_LISTS
  const products = useLiveQuery(() => db.products.toArray(), []) ?? EMPTY_PRODUCTS
  const [theme, setTheme] = useState(storedTheme)

  function setThemeMode(next: 'light' | 'dark' | 'system') {
    setTheme(next)
    applyTheme(next)
  }

  return (
    <section className="page settings">
      <h3>Appearance</h3>
      <div className="seg">
        {(['system', 'light', 'dark'] as const).map((t) => (
          <button key={t} type="button" className={theme === t ? 'on' : ''} onClick={() => setThemeMode(t)}>
            {t === 'light' ? <Sun size={16} /> : t === 'dark' ? <Moon size={16} /> : null}
            {t}
          </button>
        ))}
      </div>

      {SETTING_KEYS.map((key) => {
        const row = lists.find((l) => l.key === key)
        return <ListEditor key={key} title={key} values={row?.values ?? []} onSave={(values) => persistSettings(key, values)} />
      })}

      <h3>Products</h3>
      <ProductEditor products={products} />
    </section>
  )
}

function ListEditor({
  title,
  values,
  onSave,
}: {
  title: SettingKey
  values: string[]
  onSave: (values: string[]) => Promise<void>
}) {
  const [draft, setDraft] = useState('')

  return (
    <div className="list-block">
      <h3>{title}</h3>
      <ul>
        {values.map((v) => (
          <li key={v}>
            <span>{v}</span>
            <button
              type="button"
              className="icon-btn"
              aria-label={`Remove ${v}`}
              onClick={() => void onSave(values.filter((x) => x !== v))}
            >
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="add-row"
        onSubmit={(e) => {
          e.preventDefault()
          const v = draft.trim()
          if (!v || values.includes(v)) return
          void onSave([...values, v])
          setDraft('')
        }}
      >
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Add ${title}`} />
        <button type="submit" className="icon-btn" aria-label="Add">
          <Plus size={18} />
        </button>
      </form>
    </div>
  )
}

function ProductEditor({ products }: { products: Product[] }) {
  const [name, setName] = useState('')
  const [form, setForm] = useState('')

  return (
    <div className="list-block">
      <ul>
        {products.map((p) => (
          <li key={p.prodId}>
            <span>
              {p.name}
              {p.dosageForm ? ` · ${p.dosageForm}` : ''}
            </span>
            <button
              type="button"
              className="icon-btn"
              aria-label={`Remove ${p.name}`}
              onClick={() => void removeProduct(p)}
            >
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="add-row"
        onSubmit={(e) => {
          e.preventDefault()
          const n = name.trim()
          if (!n) return
          void persistProduct({ prodId: newProductId(), name: n, dosageForm: form.trim() })
          setName('')
          setForm('')
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Product name" />
        <input value={form} onChange={(e) => setForm(e.target.value)} placeholder="Dosage form" />
        <button type="submit" className="icon-btn" aria-label="Add product">
          <Plus size={18} />
        </button>
      </form>
    </div>
  )
}
