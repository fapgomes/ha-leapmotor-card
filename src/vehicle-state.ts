import { isWindowOpen } from './format'
import type { HassEntity, HomeAssistant } from './ha-types'
import type { LogicalKey } from './keys'
import type { Activity, ChargingPhase, EntityMap, VehicleState } from './types'

const INVALID = new Set(['unknown', 'unavailable', 'none', ''])
const STALE_AFTER_SECONDS = 900

function entity(hass: HomeAssistant, map: EntityMap, key: LogicalKey): HassEntity | undefined {
  const id = map[key]
  if (!id) return undefined
  const st = hass.states[id]
  if (!st || INVALID.has(st.state)) return undefined
  return st
}

export function str(hass: HomeAssistant, map: EntityMap, key: LogicalKey): string | undefined {
  return entity(hass, map, key)?.state
}

export function num(hass: HomeAssistant, map: EntityMap, key: LogicalKey): number | undefined {
  const raw = str(hass, map, key)
  if (raw === undefined) return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

export function bool(hass: HomeAssistant, map: EntityMap, key: LogicalKey): boolean | undefined {
  const raw = str(hass, map, key)
  if (raw === undefined) return undefined
  if (raw === 'on' || raw === 'locked' || raw === 'true') return true
  if (raw === 'off' || raw === 'unlocked' || raw === 'false') return false
  return undefined
}

export function unit(hass: HomeAssistant, map: EntityMap, key: LogicalKey): string | undefined {
  return entity(hass, map, key)?.attributes.unit_of_measurement
}

export function date(hass: HomeAssistant, map: EntityMap, key: LogicalKey): Date | undefined {
  const raw = str(hass, map, key)
  if (raw === undefined) return undefined
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? undefined : d
}

export function attr<T>(hass: HomeAssistant, map: EntityMap, key: LogicalKey, name: string): T | undefined {
  const id = map[key]
  const st = id ? hass.states[id] : undefined
  return st?.attributes[name] as T | undefined
}

function firstNum(hass: HomeAssistant, map: EntityMap, keys: LogicalKey[]): { key: LogicalKey; value: number } | undefined {
  for (const key of keys) {
    const value = num(hass, map, key)
    if (value !== undefined) return { key, value }
  }
  return undefined
}

const KNOWN_ACTIVITIES: Activity[] = ['parked', 'driving', 'ready']

function buildActivity(hass: HomeAssistant, map: EntityMap): Activity {
  const declared = str(hass, map, 'vehicleState')?.toLowerCase()
  if (declared && (KNOWN_ACTIVITIES as string[]).includes(declared)) return declared as Activity

  if (bool(hass, map, 'isDriving') === true) return 'driving'
  const speed = num(hass, map, 'speed')
  if (speed !== undefined && speed > 0) return 'driving'
  if (bool(hass, map, 'vehicleReady') === true) return 'ready'
  if (str(hass, map, 'gear') === 'P') return 'parked'
  if (bool(hass, map, 'parkingBrake') === true) return 'parked'
  return 'unknown'
}

const FAST_CHARGE_KW = 7.4

function buildCharging(hass: HomeAssistant, map: EntityMap, now: Date): VehicleState['charging'] {
  const dcCable = bool(hass, map, 'dcCableConnected') === true
  const acCable = bool(hass, map, 'isPluggedIn') === true
  const connection = str(hass, map, 'chargingConnection')
  const connectionSaysPlugged = connection !== undefined && connection !== 'unplugged'
  const cable = dcCable || acCable || connectionSaysPlugged
  const scheduled = bool(hass, map, 'schedulePlanned') === true || bool(hass, map, 'scheduleSwitch') === true

  let phase: ChargingPhase = 'unplugged'
  if (bool(hass, map, 'fullyCharged') === true) phase = 'complete'
  else if (bool(hass, map, 'isCharging') === true) phase = 'charging'
  else if (cable) phase = 'plugged'
  else if (scheduled) phase = 'scheduled'

  const powerKw = num(hass, map, 'chargingPower')
  const speed = phase === 'charging'
    ? (dcCable || (powerKw !== undefined && powerKw >= FAST_CHARGE_KW) ? 'fast' : 'slow')
    : undefined

  const remainingMinutes = num(hass, map, 'remainingChargeMinutes')
  const sensorFinish = date(hass, map, 'chargingFinishTime')
  const finishTime = sensorFinish
    ?? (remainingMinutes !== undefined ? new Date(now.getTime() + remainingMinutes * 60_000) : undefined)

  return {
    phase,
    speed,
    powerKw,
    voltageV: num(hass, map, 'chargingVoltage'),
    currentA: num(hass, map, 'chargingCurrent'),
    remainingMinutes,
    finishTime,
  }
}

const WINDOW_KEYS = [
  { side: 'fl', open: 'windowFL', pos: 'windowPosFL' },
  { side: 'fr', open: 'windowFR', pos: 'windowPosFR' },
  { side: 'rl', open: 'windowRL', pos: 'windowPosRL' },
  { side: 'rr', open: 'windowRR', pos: 'windowPosRR' },
] as const

function buildOpenings(hass: HomeAssistant, map: EntityMap): VehicleState['openings'] {
  const doors = {
    driver: bool(hass, map, 'doorDriver'),
    passenger: bool(hass, map, 'doorPassenger'),
    rearLeft: bool(hass, map, 'doorRearLeft'),
    rearRight: bool(hass, map, 'doorRearRight'),
  }

  const windows = { fl: {}, fr: {}, rl: {}, rr: {} } as VehicleState['openings']['windows']
  for (const w of WINDOW_KEYS) {
    windows[w.side] = { open: bool(hass, map, w.open), position: num(hass, map, w.pos) }
  }

  const trunk = bool(hass, map, 'trunk')
  const roof = bool(hass, map, 'roof')

  let openCount = 0
  for (const v of Object.values(doors)) if (v === true) openCount++
  for (const w of Object.values(windows)) if (isWindowOpen(w)) openCount++
  if (trunk === true) openCount++
  if (roof === true) openCount++

  return { doors, windows, trunk, roof, openCount }
}

function buildClimate(hass: HomeAssistant, map: EntityMap): VehicleState['climate'] {
  const sw = bool(hass, map, 'climateSwitch')
  const sensorOn = bool(hass, map, 'climateOn')
  const on = sw === true || sensorOn === true ? true : (sw ?? sensorOn)
  return {
    on,
    interiorC: num(hass, map, 'interiorTemp'),
    targetC: num(hass, map, 'targetTemp'),
    mode: str(hass, map, 'climateMode'),
    recirculating: bool(hass, map, 'recirculation'),
  }
}

function buildLocation(hass: HomeAssistant, map: EntityMap): VehicleState['location'] {
  const id = map.location
  const st = id ? hass.states[id] : undefined
  if (!st) return undefined

  // As coordenadas vivem nos atributos, e o `state` de um device_tracker é o
  // nome da zona (`home`, `not_home`), que não passa pelo filtro INVALID. Por
  // isso esta derivação lê os atributos diretamente em vez de usar `entity()`.
  const latitude = Number(st.attributes.latitude)
  const longitude = Number(st.attributes.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined

  const rawAge = Number(st.attributes.location_age_seconds)
  const ageSeconds = Number.isFinite(rawAge) ? rawAge : undefined
  const source = typeof st.attributes.location_source === 'string' ? st.attributes.location_source : undefined

  return {
    latitude,
    longitude,
    zone: INVALID.has(st.state) ? undefined : st.state,
    ageSeconds,
    stale: st.attributes.location_is_stale === true
      || (source?.includes('stale') ?? false)
      || (ageSeconds !== undefined && ageSeconds > STALE_AFTER_SECONDS),
  }
}

export function buildVehicleState(hass: HomeAssistant, map: EntityMap, now: Date): VehicleState {
  const battery = num(hass, map, 'batteryPrecise') ?? num(hass, map, 'battery')

  const rangePick = firstNum(hass, map, ['rangeLive', 'range', 'rangeMax'])
  const range = rangePick
    ? { km: rangePick.value, unit: unit(hass, map, rangePick.key) ?? 'km', mode: str(hass, map, 'rangeMode') }
    : undefined

  const locked = bool(hass, map, 'lock')
  const ageSeconds = num(hass, map, 'lockStateAge')
  const source = str(hass, map, 'lockStateSource')
  const stale = (source?.includes('stale') ?? false) || (ageSeconds !== undefined && ageSeconds > STALE_AFTER_SECONDS)

  return {
    online: battery !== undefined || range !== undefined || locked !== undefined,
    lastUpdate: date(hass, map, 'lastVehicleUpdate') ?? date(hass, map, 'lastCloudRefresh'),
    battery,
    range,
    chargeLimit: num(hass, map, 'chargeLimit') ?? num(hass, map, 'chargeLimitSet'),
    charging: buildCharging(hass, map, now),
    lock: { locked, stale, ageSeconds, source },
    activity: buildActivity(hass, map),
    location: buildLocation(hass, map),
    openings: buildOpenings(hass, map),
    climate: buildClimate(hass, map),
    tires: {
      fl: num(hass, map, 'tireFL'),
      fr: num(hass, map, 'tireFR'),
      rl: num(hass, map, 'tireRL'),
      rr: num(hass, map, 'tireRR'),
    },
    trip: {
      odometerKm: num(hass, map, 'odometer') ?? num(hass, map, 'totalMileage'),
      last7DaysKm: num(hass, map, 'last7DaysKm'),
      last7DaysKwh: num(hass, map, 'last7DaysKwh'),
      avgConsumption: num(hass, map, 'avgConsumption6w'),
      totalEnergyKwh: num(hass, map, 'totalEnergy'),
      // Não existe como sensor: deriva-se da energia acumulada a dividir pela
      // quilometragem acumulada. Só quando ambas existem e a distância não é
      // zero — um carro acabado de entregar dividiria por zero.
      lifetimeConsumption: (() => {
        const energy = num(hass, map, 'totalEnergy')
        const distance = num(hass, map, 'totalMileage') ?? num(hass, map, 'odometer')
        if (energy === undefined || distance === undefined || distance <= 0) return undefined
        return (energy / distance) * 100
      })(),
    },
    comfort: {
      driverSeatHeat: num(hass, map, 'driverSeatHeat'),
      driverSeatVent: num(hass, map, 'driverSeatVent'),
      passengerSeatHeat: num(hass, map, 'passengerSeatHeat'),
      passengerSeatVent: num(hass, map, 'passengerSeatVent'),
      steeringWheelHeat: bool(hass, map, 'steeringWheelHeat'),
      steeringWheelHeatRemaining: num(hass, map, 'steeringWheelHeatRemaining'),
      mirrorHeat: bool(hass, map, 'mirrorHeat'),
      batteryPreheat: bool(hass, map, 'batteryPreheat'),
    },
    schedule: {
      // Coerente com `charging.phase === 'scheduled'`, que aceita qualquer dos
      // dois sinais. Derivar só de `scheduleSwitch` fazia o hero dizer
      // «Agendado» e o painel dizer «Desativado» a partir do mesmo estado.
      enabled: bool(hass, map, 'scheduleSwitch') === true || bool(hass, map, 'schedulePlanned') === true
        ? true
        : bool(hass, map, 'scheduleSwitch'),
      start: str(hass, map, 'scheduleStart'),
      end: str(hass, map, 'scheduleEnd'),
      recurrence: str(hass, map, 'scheduleRecurrence'),
      weekly: bool(hass, map, 'scheduleWeekly'),
      cancelledOnce: bool(hass, map, 'scheduleCancelledOnce'),
    },
  }
}
