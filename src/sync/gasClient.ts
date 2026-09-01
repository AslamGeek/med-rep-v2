import { GAS_WEBAPP_URL } from '../config'
import type { Doctor, Product, SettingKey, Visit } from '../types'

export type PullRequest = {
  action: 'pull'
  sinceUpdatedAt?: string
  settingsHash?: string
  productsHash?: string
  visitsSinceDate?: string
}

export type PullResponse = {
  ok: boolean
  error?: string
  doctors?: Doctor[]
  visits?: Visit[]
  settings?: Partial<Record<SettingKey, string[]>>
  products?: Product[]
  settingsHash?: string
  productsHash?: string
}

async function post<T>(body: unknown): Promise<T> {
  const res = await fetch(GAS_WEBAPP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
    redirect: 'follow',
  })
  const text = await res.text()
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(text.slice(0, 200) || `HTTP ${res.status}`)
  }
}

export function pull(params: Omit<PullRequest, 'action'>) {
  return post<PullResponse>({ action: 'pull', ...params })
}

export function mutate(action: string, payload: unknown) {
  return post<{ ok: boolean; error?: string }>({ action, ...((payload as object) ?? {}) })
}
