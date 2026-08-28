import type { LogicalKey } from './keys'

export type EntityMap = Partial<Record<LogicalKey, string>>

export type SectionId = 'location' | 'charging' | 'tiles' | 'tires' | 'trip' | 'comfort' | 'schedule'

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
  sections?: Partial<Record<SectionId, boolean>>
  entities?: EntityMap
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
export const DEFAULT_SECTIONS: Record<SectionId, boolean> = {
  location: false, charging: true, tiles: true, tires: false, trip: false, comfort: false, schedule: false,
}
