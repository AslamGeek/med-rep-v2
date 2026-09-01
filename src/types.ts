export type Prescriber = 'NRx' | 'Rx'

export type SettingKey =
  | 'Areas'
  | 'Specialties'
  | 'Camps'
  | 'Potentials'
  | 'Stockist'
  | 'OP Timings'
  | 'Call Schedule'

export const SETTING_KEYS: SettingKey[] = [
  'Areas',
  'Specialties',
  'Camps',
  'Potentials',
  'Stockist',
  'OP Timings',
  'Call Schedule',
]

export type Doctor = {
  id: string
  name: string
  specialties: string[]
  hospital: string
  attachedPharmacy: string
  area: string
  camp: string
  potential: string
  stockist: string
  prescriber: Prescriber
  opTiming: string
  callSchedule: string
  prescribingProducts: string[]
  notes: string
  active: boolean
  updatedAt: string
}

export type Visit = {
  id: string
  date: string
  day: string
  camp: string
  doctorsCount: number
  pharmacyCount: number
  doctors: string
  pharmacy: string
}

export type Product = {
  prodId: string
  name: string
  dosageForm: string
}

export type SettingList = {
  key: SettingKey
  values: string[]
}

export type SavedFilters = {
  id: 'directory'
  query: string
  areas: string[]
  camps: string[]
  specialties: string[]
  callSchedules: string[]
  products: string[]
  prescribers: Prescriber[]
}

export type OutboxItem = {
  id?: number
  action:
    | 'upsertDoctor'
    | 'appendVisit'
    | 'undoVisit'
    | 'saveSettings'
    | 'upsertProduct'
    | 'deleteProduct'
  payload: unknown
  createdAt: string
}

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error'

export type VisitKind = 'working' | 'Sunday' | 'Holiday' | 'Leave'
