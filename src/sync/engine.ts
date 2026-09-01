import { db, enqueue, getMeta, notifyDb, setMeta } from '../db/database'
import type { Doctor, OutboxItem, Product, SettingKey, SyncStatus, Visit } from '../types'
import { SETTING_KEYS } from '../types'
import { mutate, pull } from './gasClient'

let status: SyncStatus = navigator.onLine ? 'idle' : 'offline'
const listeners = new Set<(s: SyncStatus) => void>()
let running = false
let queued = false

export function getSyncStatus() {
  return status
}

export function subscribeSync(fn: (s: SyncStatus) => void) {
  listeners.add(fn)
  fn(status)
  return () => {
    listeners.delete(fn)
  }
}

function setStatus(next: SyncStatus) {
  status = next
  listeners.forEach((fn) => fn(next))
}

function doctorFromRemote(d: Doctor): Doctor {
  return {
    ...d,
    specialties: Array.isArray(d.specialties)
      ? d.specialties
      : String(d.specialties || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
    prescribingProducts: Array.isArray(d.prescribingProducts)
      ? d.prescribingProducts
      : String(d.prescribingProducts || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
    active:
      d.active === true ||
      String(d.active).toLowerCase() === 'yes' ||
      String(d.active) === 'true',
    prescriber: d.prescriber === 'Rx' ? 'Rx' : 'NRx',
  }
}

async function applyPull() {
  const sinceUpdatedAt = await getMeta('sinceUpdatedAt')
  const settingsHash = await getMeta('settingsHash')
  const productsHash = await getMeta('productsHash')
  const visitsSinceDate = await getMeta('visitsSinceDate')

  const data = await pull({
    sinceUpdatedAt,
    settingsHash,
    productsHash,
    visitsSinceDate,
  })

  if (!data.ok) throw new Error(data.error || 'Pull failed')

  if (data.doctors?.length) {
    await db.doctors.bulkPut(data.doctors.map(doctorFromRemote))
    const latest = data.doctors.reduce(
      (max, d) => (d.updatedAt > max ? d.updatedAt : max),
      sinceUpdatedAt ?? '',
    )
    if (latest) await setMeta('sinceUpdatedAt', latest)
  }

  if (data.settings) {
    for (const key of SETTING_KEYS) {
      const values = data.settings[key]
      if (values) await db.settingLists.put({ key, values })
    }
  }
  if (data.settingsHash) await setMeta('settingsHash', data.settingsHash)

  if (data.products) {
    await db.products.clear()
    if (data.products.length) {
      await db.products.bulkPut(
        data.products.map((p: Product) => ({
          prodId: p.prodId,
          name: p.name,
          dosageForm: p.dosageForm ?? '',
        })),
      )
    }
  }
  if (data.productsHash) await setMeta('productsHash', data.productsHash)

  if (data.visits?.length) {
    const existing = await db.visits.toArray()
    const byFingerprint = new Map(
      existing.map((v) => [`${v.date}|${v.day}|${v.doctors}`, v]),
    )
    for (const v of data.visits) {
      const fp = `${v.date}|${v.day}|${v.doctors}`
      const prev = byFingerprint.get(fp)
      if (prev) {
        await db.visits.put({ ...prev, ...v, id: prev.id })
      } else {
        await db.visits.put({
          id: v.id || `S${v.date}${v.doctors}`.slice(0, 40),
          date: v.date,
          day: v.day,
          camp: v.camp ?? '',
          doctorsCount: Number(v.doctorsCount) || 0,
          pharmacyCount: Number(v.pharmacyCount) || 0,
          doctors: v.doctors ?? '',
          pharmacy: v.pharmacy ?? '',
        })
      }
    }
    const overlap = new Date()
    overlap.setDate(overlap.getDate() - 14)
    const y = overlap.getFullYear()
    const m = String(overlap.getMonth() + 1).padStart(2, '0')
    const d = String(overlap.getDate()).padStart(2, '0')
    await setMeta('visitsSinceDate', `${y}-${m}-${d}`)
  }

  notifyDb()
}

async function flushOutbox() {
  const items = await db.outbox.orderBy('id').toArray()
  for (const item of items) {
    const result = await mutate(item.action, flattenPayload(item))
    if (!result.ok) throw new Error(result.error || `${item.action} failed`)
    if (item.id != null) await db.outbox.delete(item.id)
  }
}

function flattenPayload(item: OutboxItem): Record<string, unknown> {
  const payload = item.payload as Record<string, unknown>
  if (item.action === 'upsertDoctor') {
    const d = payload as unknown as Doctor
    return {
      doctor: {
        ID: d.id,
        Name: d.name,
        Specialties: d.specialties.join(', '),
        Hospital: d.hospital,
        'Attached Pharmacy': d.attachedPharmacy,
        Area: d.area,
        Camp: d.camp,
        Potential: d.potential,
        Stockist: d.stockist,
        Prescriber: d.prescriber,
        'OP Timing': d.opTiming,
        'Call Schedule': d.callSchedule,
        'Prescribing Products': d.prescribingProducts.join(', '),
        Notes: d.notes,
        Active: d.active ? 'Yes' : 'No',
        'Updated At': d.updatedAt,
      },
    }
  }
  if (item.action === 'appendVisit' || item.action === 'undoVisit') {
    const v = payload as unknown as Visit
    return {
      visit: {
        Date: v.date,
        Day: v.day,
        Camp: v.camp,
        'Doctors (count)': v.doctorsCount,
        'Pharmacy (count)': v.pharmacyCount,
        Doctors: v.doctors,
        Pharmacy: v.pharmacy,
      },
    }
  }
  if (item.action === 'saveSettings') {
    return payload
  }
  if (item.action === 'upsertProduct') {
    const p = payload as unknown as Product
    return {
      product: { ProdID: p.prodId, Name: p.name, DosageForm: p.dosageForm },
    }
  }
  if (item.action === 'deleteProduct') {
    return { prodId: (payload as Product).prodId }
  }
  return payload
}

export async function runSync() {
  if (!navigator.onLine) {
    setStatus('offline')
    return
  }
  if (running) {
    queued = true
    return
  }
  running = true
  setStatus('syncing')
  try {
    await flushOutbox()
    await applyPull()
    setStatus(navigator.onLine ? 'idle' : 'offline')
  } catch {
    setStatus(navigator.onLine ? 'error' : 'offline')
  } finally {
    running = false
    if (queued) {
      queued = false
      void runSync()
    }
  }
}

export function requestSync() {
  void runSync()
}

export async function persistDoctor(doctor: Doctor) {
  await db.doctors.put(doctor)
  await enqueue({ action: 'upsertDoctor', payload: doctor })
  notifyDb()
  requestSync()
}

export async function persistVisit(visit: Visit) {
  await db.visits.put(visit)
  await enqueue({ action: 'appendVisit', payload: visit })
  notifyDb()
  requestSync()
}

export async function undoVisit(visit: Visit) {
  await db.visits.delete(visit.id)
  await enqueue({ action: 'undoVisit', payload: visit })
  notifyDb()
  requestSync()
}

export async function persistSettings(key: SettingKey, values: string[]) {
  await db.settingLists.put({ key, values })
  await enqueue({ action: 'saveSettings', payload: { key, values } })
  notifyDb()
  requestSync()
}

export async function persistProduct(product: Product) {
  await db.products.put(product)
  await enqueue({ action: 'upsertProduct', payload: product })
  notifyDb()
  requestSync()
}

export async function removeProduct(product: Product) {
  await db.products.delete(product.prodId)
  await enqueue({ action: 'deleteProduct', payload: product })
  notifyDb()
  requestSync()
}

let listenersBound = false

export function startSyncListeners() {
  if (listenersBound) {
    requestSync()
    return
  }
  listenersBound = true
  window.addEventListener('online', () => {
    setStatus('idle')
    requestSync()
  })
  window.addEventListener('offline', () => setStatus('offline'))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') requestSync()
  })
  window.setInterval(() => requestSync(), 5 * 60 * 1000)
  requestSync()
}
