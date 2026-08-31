import { isWindowOpen } from './format'
import type { HassEntity, HomeAssistant } from './ha-types'
import type { LogicalKey } from './keys'
import type {
  Activity, ChargingPhase, EntityMap, VehicleState, WeekEnergy, WeeklyConsumption,
} from './types'

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

  // The coordinates live in the attributes, and a device_tracker's `state`
  // is the zone's name (`home`, `not_home`), which does not pass through the
  // INVALID filter. That is why this derivation reads the attributes
  // directly instead of using `entity()`.
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

/**
 * Coerces to a number only what is a number or a string. `Number()` alone
 * does not work as a guard: faced with a `Symbol` it throws, and faced with
 * an object or a `null` it returns `NaN` or `0` — and the zero would pass
 * for a valid reading where none exists.
 */
function coerceNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

/** A date that reads: a calendar day that `Date` manages to parse. */
function isReadableDate(value: unknown): value is string {
  return typeof value === 'string' && value !== '' && !Number.isNaN(new Date(value).getTime())
}

/**
 * The weekly series of the `weekly_consumption` attribute of the 6-week
 * average sensor, in the order the API sends it — from the oldest week to
 * the most recent. Returns `[]` for anything unusable, and never throws.
 *
 * It is the first structured thing this card reads from an attribute, and
 * the cloud API has already shown itself inconsistent with types — in the
 * SAME object, `hundredKmEC` comes as a number and `hundredMiKwhEC` comes as
 * text. Hence it being a pure function, exported and tested separately,
 * instead of being embedded in `buildVehicleState`: the shape comes from
 * outside, no one controls it, and what defends against it has to be
 * verifiable without assembling a whole `hass`. Now that ALL entries become
 * a row, and not just one, every malformed entry is a wrong row in plain
 * sight — which raises the value of these guards, not lowers it.
 *
 * Two rules, and the boundary between them is what matters:
 *
 *  - **With no period, the entry is DROPPED.** A row with no dates cannot
 *    be labeled, and a row with a number no one knows which week it belongs
 *    to is exactly the defect this version came to fix. Both dates are
 *    required to actually read, not just to be non-empty: a date `Date`
 *    cannot parse also gives no label at all.
 *  - **With no consumption, the entry STAYS, with the consumption as
 *    `undefined`.** A `hundredKmEC` of zero is the API's way of saying "I
 *    did not drive this week" — the first weeks of a freshly delivered car
 *    all come in as zero — and with the dates alongside it, the reader
 *    understands it. What cannot be written is "0.0", which would assert an
 *    efficiency the car never had. A negative or unreadable value amounts
 *    to the same thing: there is a week, there is no number.
 */
export function parseWeeklyConsumption(value: unknown): WeeklyConsumption[] {
  if (!Array.isArray(value)) return []

  const weeks: WeeklyConsumption[] = []
  for (const entry of value as unknown[]) {
    if (entry === null || typeof entry !== 'object') continue
    const { weekStart, weekEnd, hundredKmEC } = entry as Record<string, unknown>
    if (!isReadableDate(weekStart) || !isReadableDate(weekEnd)) continue

    const parsed = coerceNumber(hundredKmEC)
    weeks.push({
      kwhPer100Km: parsed !== undefined && parsed > 0 ? parsed : undefined,
      start: weekStart,
      end: weekEnd,
    })
  }
  return weeks
}

/**
 * The three entities of the breakdown, in the order in which the kWh are
 * looked up. Any one of them works — they all carry the same three
 * attributes — and the order only decides who answers first. All three are
 * iterated over, and not just the driving one, because whoever overrode
 * `entities:` by hand may have mapped only one of them.
 */
const WEEK_ENERGY_KEYS: readonly LogicalKey[] = [
  'lastWeekDrivingPercent', 'lastWeekClimatePercent', 'lastWeekOtherPercent',
]

/** A slice's kWh, from the first of the three entities that carries them. */
function weekEnergyKwh(hass: HomeAssistant, map: EntityMap, name: string): number | undefined {
  for (const key of WEEK_ENERGY_KEYS) {
    const value = coerceNumber(attr<unknown>(hass, map, key, name))
    if (value !== undefined) return value
  }
  return undefined
}

function buildWeekEnergy(hass: HomeAssistant, map: EntityMap): WeekEnergy {
  const driving = {
    kwh: weekEnergyKwh(hass, map, 'driving_energy_kwh'),
    percent: num(hass, map, 'lastWeekDrivingPercent'),
  }
  const climate = {
    kwh: weekEnergyKwh(hass, map, 'climate_energy_kwh'),
    percent: num(hass, map, 'lastWeekClimatePercent'),
  }
  const other = {
    kwh: weekEnergyKwh(hass, map, 'other_energy_kwh'),
    percent: num(hass, map, 'lastWeekOtherPercent'),
  }

  // The sum is of the slices that exist, and not a sum with zeros mixed in:
  // a missing slice is a reading that did not come through, and summing it
  // as zero would make the total assert more than is known. With no slice
  // at all there is no total.
  const present = [driving.kwh, climate.kwh, other.kwh].filter((v): v is number => v !== undefined)
  const totalKwh = present.length > 0 ? present.reduce((a, b) => a + b, 0) : undefined

  return { driving, climate, other, totalKwh }
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
      avgConsumption: num(hass, map, 'avgConsumption6w'),
      totalEnergyKwh: num(hass, map, 'totalEnergy'),
      // This sensor's `state` is the 6-week average; the week-by-week
      // series, which is what backs the average, comes in the attribute.
      weeklyConsumption: parseWeeklyConsumption(attr<unknown>(hass, map, 'avgConsumption6w', 'weekly_consumption')),
      weekEnergy: buildWeekEnergy(hass, map),
      // Does not exist as a sensor: derived from the accumulated energy
      // divided by the accumulated mileage. Only when both exist and the
      // distance is not zero — a freshly delivered car would divide by
      // zero.
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
      // Consistent with `charging.phase === 'scheduled'`, which accepts
      // either of the two signals. Deriving only from `scheduleSwitch` would
      // make the hero say "Agendado" and the panel say "Desativado" from the
      // same state.
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
