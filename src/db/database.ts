import Dexie, { type Table } from 'dexie'
import type {
  Doctor,
  FilterTemplate,
  OutboxItem,
  Product,
  SavedFilters,
  SettingKey,
  SettingList,
  Visit,
} from '../types'
import { SETTING_KEYS } from '../types'

export type MetaRow = { key: string; value: string }

class MedRepDB extends Dexie {
  doctors!: Table<Doctor, string>
  visits!: Table<Visit, string>
  products!: Table<Product, string>
  settingLists!: Table<SettingList, SettingKey>
  savedFilters!: Table<SavedFilters, string>
  filterTemplates!: Table<FilterTemplate, string>
  meta!: Table<MetaRow, string>
  outbox!: Table<OutboxItem, number>

  constructor() {
    super('medrep-v1')
    this.version(1).stores({
      doctors: 'id, name, area, camp, prescriber, active, updatedAt, callSchedule',
      visits: 'id, date',
      products: 'prodId, name',
      settingLists: 'key',
      savedFilters: 'id',
      meta: 'key',
      outbox: '++id, action, createdAt',
    })
    // Saved filter templates (e.g. "Camp + Prescriber") are device-local —
    // they don't need to sync to Sheets, so they're a plain new table.
    this.version(2).stores({
      filterTemplates: 'id, name',
    })
  }
}

export const db = new MedRepDB()

export function notifyDb() {
  window.dispatchEvent(new Event('medrep-db'))
}

export async function getMeta(key: string): Promise<string | undefined> {
  const row = await db.meta.get(key)
  return row?.value
}

export async function setMeta(key: string, value: string) {
  await db.meta.put({ key, value })
}

export async function enqueue(item: Omit<OutboxItem, 'id' | 'createdAt'> & { createdAt?: string }) {
  await db.outbox.add({
    ...item,
    createdAt: item.createdAt ?? new Date().toISOString(),
  })
}

export async function ensureDefaults() {
  const existing = await db.settingLists.count()
  if (existing === 0) {
    await db.settingLists.bulkPut(
      SETTING_KEYS.map((key) => ({ key, values: [] })),
    )
  }
  const filters = await db.savedFilters.get('directory')
  if (!filters) {
    await db.savedFilters.put({
      id: 'directory',
      query: '',
      areas: [],
      camps: [],
      specialties: [],
      callSchedules: [],
      products: [],
      prescribers: [],
    })
  }
}

export function newDoctorId() {
  return `D${Date.now().toString(36)}`
}

export function newProductId() {
  return `P${Date.now().toString(36)}`
}

export function newVisitId() {
  return `V${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export function newTemplateId() {
  return `T${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}
