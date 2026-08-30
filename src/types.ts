import type { LogicalKey } from './keys'

export type EntityMap = Partial<Record<LogicalKey, string>>

/** Os grupos que a grelha pode mostrar. */
export type GroupId = 'charging' | 'status' | 'climate' | 'tires' | 'trip' | 'location'

/**
 * As secções que uma sub-vista pode instanciar. Nomeia componentes, não grupos:
 * um grupo pode instanciar mais do que um.
 */
export type PanelId =
  | 'charging' | 'schedule' | 'climate' | 'comfort'
  | 'openings' | 'tires' | 'trip' | 'location'

/**
 * Uma entrada da grelha. A forma curta é só o nome do grupo; a longa existe
 * para sobrepor o ícone, o título ou qual dos resumos do grupo se mostra.
 */
export type GridEntry = GroupId | {
  group: GroupId
  icon?: string
  title?: string
  summary?: string
}

export type ActionId =
  | 'unlock' | 'lock' | 'trunk' | 'windows' | 'sunshade'
  | 'quickCool' | 'quickHeat' | 'defrost'
  | 'findVehicle' | 'unlockCharger' | 'refresh'
  | 'climate' | 'steeringWheelHeat' | 'mirrorHeat' | 'batteryPreheat'
  | 'setChargeLimit' | 'setClimate'

export interface LeapmotorCardConfig {
  type: string
  device?: string
  name?: string
  language?: string
  image?: 'auto' | 'entity' | 'none' | string
  actions?: ActionId[]
  confirm_actions?: ActionId[]
  entities?: EntityMap
  map_zoom?: number
  tire_range?: [number, number]
  grid?: GridEntry[]
}

export type ChargingPhase = 'unplugged' | 'plugged' | 'charging' | 'complete' | 'scheduled'
export type Activity = 'parked' | 'driving' | 'ready' | 'unknown'

export interface VehicleState {
  online: boolean
  lastUpdate?: Date
  battery?: number
  range?: { km: number; unit: string; mode?: string }
  chargeLimit?: number
  charging: {
    phase: ChargingPhase
    speed?: 'slow' | 'fast'
    powerKw?: number
    voltageV?: number
    currentA?: number
    remainingMinutes?: number
    finishTime?: Date
  }
  lock: { locked?: boolean; stale: boolean; ageSeconds?: number; source?: string }
  activity: Activity
  location?: {
    latitude: number
    longitude: number
    zone?: string
    ageSeconds?: number
    stale: boolean
  }
  openings: {
    doors: Record<'driver' | 'passenger' | 'rearLeft' | 'rearRight', boolean | undefined>
    windows: Record<'fl' | 'fr' | 'rl' | 'rr', { open?: boolean; position?: number }>
    trunk?: boolean
    roof?: boolean
    openCount: number
  }
  climate: { on?: boolean; interiorC?: number; targetC?: number; mode?: string; recirculating?: boolean }
  tires: Record<'fl' | 'fr' | 'rl' | 'rr', number | undefined>
  trip: { odometerKm?: number; last7DaysKm?: number; last7DaysKwh?: number; avgConsumption?: number; totalEnergyKwh?: number; lifetimeConsumption?: number }
  comfort: {
    driverSeatHeat?: number; driverSeatVent?: number
    passengerSeatHeat?: number; passengerSeatVent?: number
    steeringWheelHeat?: boolean; steeringWheelHeatRemaining?: number
    mirrorHeat?: boolean; batteryPreheat?: boolean
  }
  schedule: { enabled?: boolean; start?: string; end?: string; recurrence?: string; weekly?: boolean; cancelledOnce?: boolean }
}

export const DEFAULT_ACTIONS: ActionId[] = ['unlock', 'lock', 'trunk', 'windows', 'findVehicle', 'sunshade']
export const DEFAULT_CONFIRM_ACTIONS: ActionId[] = ['unlock']

export const DEFAULT_MAP_ZOOM = 16
export const MAP_ZOOM_MIN = 1
export const MAP_ZOOM_MAX = 20

/**
 * `map_zoom` vem de YAML escrito à mão, sem validação de esquema — um utilizador
 * pode pôr `50`, `0` ou um texto por engano. Sem isto, o `default_zoom` que
 * chega ao card `map` do HA ficaria fora do que o Leaflet aceita para estas
 * peças (1 a 20) e o mapa apareceria em branco. O corte é aqui, na leitura, e
 * não no editor: o editor não vê configurações escritas à mão.
 */
export function clampMapZoom(zoom: number | undefined): number {
  if (typeof zoom !== 'number' || !Number.isFinite(zoom)) return DEFAULT_MAP_ZOOM
  return Math.min(MAP_ZOOM_MAX, Math.max(MAP_ZOOM_MIN, Math.round(zoom)))
}

/**
 * A faixa de pressão considerada normal, em bar. A omissão são os valores que
 * o `tires.ts` tinha fixos no código, para não mudar o comportamento de
 * ninguém sem que o peça — mas são estreitos: um carro a 2,8 bar cai fora
 * dela. Qual é a faixa certa depende da medida do pneu e da carga, não se
 * verifica a partir do código, e é por isso que passou a ser configurável.
 */
export const DEFAULT_TIRE_RANGE: readonly [number, number] = [2.0, 2.6]

export function clampTireRange(value: unknown): [number, number] {
  const fallback = (): [number, number] => [DEFAULT_TIRE_RANGE[0], DEFAULT_TIRE_RANGE[1]]
  if (!Array.isArray(value) || value.length !== 2) return fallback()
  const [min, max] = value as unknown[]
  if (typeof min !== 'number' || typeof max !== 'number') return fallback()
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) return fallback()
  return [min, max]
}

/** O que identifica o pedido de mapa em curso: a que entidade e com que zoom. */
export interface MapRequest {
  entityId: string
  zoom: number
}

/**
 * Diz se o pedido de mapa guardado já não serve para o pedido seguinte. Pura,
 * para poder ser testada sem DOM — quem decide se o `ensureMap` do card deve
 * reconstruir o mapa é esta função, não o `render()`, que corre a cada
 * actualização de estado e reconstruiria o mapa sem necessidade nenhuma.
 */
export function mapRequestChanged(previous: MapRequest | undefined, next: MapRequest): boolean {
  return !previous || previous.entityId !== next.entityId || previous.zoom !== next.zoom
}
