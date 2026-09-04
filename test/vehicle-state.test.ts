import { describe, expect, it } from 'vitest'
import { resolveEntities } from '../src/resolver'
import { buildVehicleState, parseWeeklyConsumption } from '../src/vehicle-state'
import { fakeHass, type FakeEntitySpec } from './helpers/fake-hass'
import { REAL_NOW, realHass } from './fixtures/real-states'

const CONFIG = { type: 'custom:leapmotor-card' }

function build(overrides: Record<string, string> = {}, now = REAL_NOW) {
  const hass = realHass(overrides)
  const { map } = resolveEntities(hass, CONFIG)
  return buildVehicleState(hass, map, now)
}

describe('buildVehicleState — battery and range', () => {
  it('prefers the precise battery', () => {
    expect(build().battery).toBe(60.3)
  })

  it('falls back to the integer battery when the precise one is missing', () => {
    expect(build({ 'sensor/battery_percent_precise': 'unavailable' }).battery).toBe(60)
  })

  it('uses live_range, which is the number the app shows, and not remaining_range', () => {
    // App: 126 km at 29% → ratio ~434. live=261 at 60% → 435. range=217 → 361.
    expect(build().range).toEqual({
      km: 261, unit: 'km', mode: 'CLTC', entityId: 'sensor.leapmotor_b10_000000_main_live_range',
    })
  })

  it('does not use wltp_max when rangeLive is present — the precedence is rangeLive > range > rangeMax', () => {
    // wltp_max_range_km is 434 in the fixture; if the precedence were
    // reversed (['rangeMax', 'range', 'rangeLive']) this value would show up
    // instead of 261.
    expect(build().range?.km).not.toBe(434)
  })

  it('says which sensor the number came from', () => {
    // The value comes from whichever of the three sensors reads first, so
    // the entity has to travel with it: a tap that opened the more-info of
    // `range` while the screen shows `live_range`'s number would graph a
    // different number from the one the user is looking at.
    expect(build().range?.entityId).toBe('sensor.leapmotor_b10_000000_main_live_range')
    expect(build({ 'sensor/live_remaining_range_km': 'unavailable' }).range?.entityId)
      .toBe('sensor.leapmotor_b10_000000_demo_range')
  })

  it('falls back to remaining_range and then to wltp_max', () => {
    expect(build({ 'sensor/live_remaining_range_km': 'unavailable' }).range?.km).toBe(217)
    expect(build({ 'sensor/live_remaining_range_km': 'unavailable', 'sensor/remaining_range_km': 'unknown' }).range?.km).toBe(434)
  })

  it('leaves range undefined when no range sensor is valid', () => {
    expect(build({
      'sensor/live_remaining_range_km': 'unavailable',
      'sensor/remaining_range_km': 'unavailable',
      'sensor/wltp_max_range_km': 'unavailable',
    }).range).toBeUndefined()
  })

  it('reads the charge limit', () => {
    expect(build().chargeLimit).toBe(80)
  })
})

describe('buildVehicleState — last update', () => {
  it('uses last_vehicle_update', () => {
    expect(build().lastUpdate?.toISOString()).toBe('2026-08-27T10:16:33.000Z')
  })

  it('falls back to last_cloud_refresh', () => {
    expect(build({ 'sensor/last_vehicle_update': 'unavailable' }).lastUpdate?.toISOString())
      .toBe('2026-08-27T13:35:24.000Z')
  })
})

describe('buildVehicleState — locks', () => {
  it('reads the locked state', () => {
    expect(build().lock.locked).toBe(true)
  })

  it('marks stale because of the cloud_stale lock_state_source', () => {
    const s = build()
    expect(s.lock.stale).toBe(true)
    expect(s.lock.source).toBe('cloud_stale')
    expect(s.lock.ageSeconds).toBe(11930)
  })

  it('marks stale for an age above 900 s even with a fresh source', () => {
    expect(build({ 'sensor/lock_state_source': 'cloud', 'sensor/lock_state_age_seconds': '901' }).lock.stale).toBe(true)
  })

  it('does not mark stale with a fresh source and a low age', () => {
    expect(build({ 'sensor/lock_state_source': 'cloud', 'sensor/lock_state_age_seconds': '60' }).lock.stale).toBe(false)
  })

  it('leaves locked undefined when the entity is unavailable', () => {
    expect(build({ 'lock/vehicle_lock': 'unavailable' }).lock.locked).toBeUndefined()
  })

  it('reads the unlocked state, distinct from unavailable', () => {
    expect(build({ 'lock/vehicle_lock': 'unlocked' }).lock.locked).toBe(false)
  })
})

describe('buildVehicleState — activity', () => {
  it('derives parked despite vehicle_state being unknown', () => {
    expect(build().activity).toBe('parked')
  })

  it('respects vehicle_state when it has a known value', () => {
    expect(build({ 'sensor/vehicle_state': 'driving' }).activity).toBe('driving')
  })

  it('derives driving from is_driving', () => {
    expect(build({ 'binary_sensor/is_driving': 'on' }).activity).toBe('driving')
  })

  it('derives driving from a positive speed', () => {
    expect(build({ 'sensor/speed_kmh': '43.5', 'sensor/gear': 'D' }).activity).toBe('driving')
  })

  it('derives ready from vehicle_ready', () => {
    expect(build({ 'binary_sensor/vehicle_ready': 'on', 'sensor/gear': 'N', 'binary_sensor/parking_brake_active': 'off' }).activity).toBe('ready')
  })

  it('returns unknown when nothing allows a decision', () => {
    expect(build({
      'sensor/gear': 'unavailable',
      'sensor/speed_kmh': 'unavailable',
      'binary_sensor/is_driving': 'unavailable',
      'binary_sensor/parking_brake_active': 'unavailable',
      'binary_sensor/vehicle_ready': 'unavailable',
    }).activity).toBe('unknown')
  })
})

describe('buildVehicleState — online', () => {
  it('is online with valid states', () => {
    expect(build().online).toBe(true)
  })

  it('is offline when battery, range and lock are all unavailable', () => {
    expect(build({
      'sensor/battery_percent': 'unavailable',
      'sensor/battery_percent_precise': 'unavailable',
      'sensor/live_remaining_range_km': 'unavailable',
      'sensor/remaining_range_km': 'unavailable',
      'sensor/wltp_max_range_km': 'unavailable',
      'lock/vehicle_lock': 'unavailable',
    }).online).toBe(false)
  })
})

describe('buildVehicleState — charging phase', () => {
  it('unplugged with the real states', () => {
    expect(build().charging.phase).toBe('unplugged')
  })

  it('charging when is_charging is on', () => {
    expect(build({ 'binary_sensor/is_charging': 'on', 'binary_sensor/is_plugged_in': 'on' }).charging.phase).toBe('charging')
  })

  it('complete takes priority over charging', () => {
    expect(build({ 'binary_sensor/fully_charged': 'on', 'binary_sensor/is_charging': 'on' }).charging.phase).toBe('complete')
  })

  it('plugged with the AC cable connected but not charging', () => {
    expect(build({ 'binary_sensor/is_plugged_in': 'on', 'sensor/charging_connection_state': 'plugged' }).charging.phase).toBe('plugged')
  })

  it('plugged with the DC cable connected', () => {
    expect(build({ 'binary_sensor/dc_cable_connected': 'on' }).charging.phase).toBe('plugged')
  })

  it('plugged when only the connection sensor indicates a cable', () => {
    expect(build({ 'sensor/charging_connection_state': 'plugged' }).charging.phase).toBe('plugged')
  })

  it('does not infer plugged from an invalid connection sensor', () => {
    expect(build({ 'sensor/charging_connection_state': 'unknown' }).charging.phase).toBe('unplugged')
    expect(build({ 'sensor/charging_connection_state': 'unavailable' }).charging.phase).toBe('unplugged')
  })

  it('scheduled when there is an active schedule and no cable', () => {
    expect(build({ 'binary_sensor/charging_planned_enabled': 'on' }).charging.phase).toBe('scheduled')
    expect(build({ 'switch/charging_schedule': 'on' }).charging.phase).toBe('scheduled')
  })

  it('the cable wins over the schedule', () => {
    expect(build({ 'binary_sensor/charging_planned_enabled': 'on', 'binary_sensor/is_plugged_in': 'on' }).charging.phase).toBe('plugged')
  })
})

describe('buildVehicleState — charging speed', () => {
  it('slow on low-power AC, like in the app', () => {
    const s = build({ 'binary_sensor/is_charging': 'on', 'binary_sensor/is_plugged_in': 'on', 'sensor/charging_power_kw': '2.2' })
    expect(s.charging.speed).toBe('slow')
  })

  it('fast above 7.4 kW', () => {
    const s = build({ 'binary_sensor/is_charging': 'on', 'binary_sensor/is_plugged_in': 'on', 'sensor/charging_power_kw': '11.0' })
    expect(s.charging.speed).toBe('fast')
  })

  it('fast whenever the DC cable is connected', () => {
    const s = build({ 'binary_sensor/is_charging': 'on', 'binary_sensor/dc_cable_connected': 'on', 'sensor/charging_power_kw': '3.0' })
    expect(s.charging.speed).toBe('fast')
  })

  it('no speed when it is not charging', () => {
    expect(build().charging.speed).toBeUndefined()
  })
})

describe('buildVehicleState — charging time and metrics', () => {
  it('does not invent a remaining time when the sensor is unavailable', () => {
    const s = build()
    expect(s.charging.remainingMinutes).toBeUndefined()
    expect(s.charging.finishTime).toBeUndefined()
  })

  it('reads the remaining time and derives the finish time from now', () => {
    const s = build({
      'binary_sensor/is_charging': 'on',
      'binary_sensor/is_plugged_in': 'on',
      'sensor/remaining_charge_minutes': '835',
    })
    expect(s.charging.remainingMinutes).toBe(835)
    // REAL_NOW 13:36 UTC + 835 min = 2026-08-28T03:31:00Z
    expect(s.charging.finishTime?.toISOString()).toBe('2026-08-28T03:31:00.000Z')
  })

  it('prefers the finish-time sensor over the derived value', () => {
    const s = build({
      'binary_sensor/is_charging': 'on',
      'binary_sensor/is_plugged_in': 'on',
      'sensor/remaining_charge_minutes': '835',
      'sensor/charging_finish_time': '2026-08-28T04:00:00+00:00',
    })
    expect(s.charging.finishTime?.toISOString()).toBe('2026-08-28T04:00:00.000Z')
  })

  it('exposes power, voltage and current', () => {
    const s = build({ 'binary_sensor/is_charging': 'on', 'binary_sensor/is_plugged_in': 'on', 'sensor/charging_power_kw': '6.9' })
    expect(s.charging.powerKw).toBe(6.9)
    expect(s.charging.voltageV).toBe(426.6)
    expect(s.charging.currentA).toBe(0.1)
  })
})

describe('buildVehicleState — openings', () => {
  it('everything closed in the real states', () => {
    const s = build()
    expect(s.openings.openCount).toBe(0)
    expect(s.openings.doors.driver).toBe(false)
    expect(s.openings.trunk).toBe(false)
    expect(s.openings.roof).toBe(false)
  })

  it('counts one open door', () => {
    expect(build({ 'binary_sensor/rear_left_door_open': 'on' }).openings.openCount).toBe(1)
  })

  it('counts the trunk and the roof', () => {
    expect(build({ 'binary_sensor/trunk_open': 'on', 'binary_sensor/skylight_open': 'on' }).openings.openCount).toBe(2)
  })

  it('counts a window open via the binary_sensor', () => {
    const s = build({ 'binary_sensor/front_left_window_open': 'on' })
    expect(s.openings.windows.fl.open).toBe(true)
    expect(s.openings.openCount).toBe(1)
  })

  it('counts a window open by position, even with the binary_sensor off', () => {
    const s = build({ 'sensor/rear_right_window_position_percent': '35' })
    expect(s.openings.windows.rr.position).toBe(35)
    expect(s.openings.openCount).toBe(1)
  })

  it('does not count the same window twice', () => {
    const s = build({ 'binary_sensor/front_right_window_open': 'on', 'sensor/front_right_window_position_percent': '80' })
    expect(s.openings.openCount).toBe(1)
  })

  it('ignores unavailable openings instead of counting them', () => {
    const s = build({ 'binary_sensor/driver_door_open': 'unavailable' })
    expect(s.openings.doors.driver).toBeUndefined()
    expect(s.openings.openCount).toBe(0)
  })
})

describe('buildVehicleState — climate', () => {
  it('reads the interior temperature, target and state', () => {
    const s = build()
    expect(s.climate.interiorC).toBe(24)
    expect(s.climate.targetC).toBe(24)
    expect(s.climate.on).toBe(false)
    expect(s.climate.mode).toBe('off')
  })

  it('considers it on when either the switch or the binary_sensor is on', () => {
    expect(build({ 'switch/climate_control': 'on' }).climate.on).toBe(true)
    expect(build({ 'binary_sensor/climate_on': 'on' }).climate.on).toBe(true)
  })
})

describe('buildVehicleState — tires, trip, comfort, schedule', () => {
  it('reads the four pressures', () => {
    expect(build().tires).toEqual({ fl: 2.11, fr: 2.17, rl: 2.17, rr: 2.17 })
  })

  it('reads the trip', () => {
    expect(build().trip).toEqual({
      odometerKm: 659, last7DaysKm: 642, avgConsumption: 20.6, totalEnergyKwh: 131,
      lifetimeConsumption: (131.0 / 661) * 100,
      weeklyConsumption: [
        { kwhPer100Km: undefined, start: '2026-07-20', end: '2026-07-26' },
        { kwhPer100Km: undefined, start: '2026-07-27', end: '2026-08-02' },
        { kwhPer100Km: undefined, start: '2026-08-03', end: '2026-08-09' },
        { kwhPer100Km: undefined, start: '2026-08-10', end: '2026-08-16' },
        { kwhPer100Km: 20.7, start: '2026-08-17', end: '2026-08-23' },
        { kwhPer100Km: 14.2, start: '2026-08-24', end: '2026-08-30' },
      ],
      weekEnergy: {
        driving: { kwh: 10.4, percent: 96.3 },
        climate: { kwh: 0.1, percent: 0.9 },
        other: { kwh: 0.3, percent: 2.8 },
        totalKwh: 10.4 + 0.1 + 0.3,
      },
    })
  })

  it('uses total_mileage as a fallback for the odometer', () => {
    // total_mileage_km is 661 in the fixture, distinct from odometer_km
    // (659), to prove the value really came from the fallback and wasn't
    // left over from the main sensor.
    expect(build({ 'sensor/odometer_km': 'unavailable' }).trip.odometerKm).toBe(661)
  })

  it('reads the comfort settings', () => {
    const s = build({ 'switch/steering_wheel_heat': 'on' })
    expect(s.comfort.driverSeatHeat).toBe(0)
    expect(s.comfort.steeringWheelHeat).toBe(true)
    expect(s.comfort.steeringWheelHeatRemaining).toBe(15)
    expect(s.comfort.mirrorHeat).toBe(false)
    expect(s.comfort.batteryPreheat).toBe(false)
  })

  it('reads the schedule', () => {
    expect(build().schedule).toEqual({
      enabled: false, start: '22:00', end: '08:00', recurrence: '1', weekly: true, cancelledOnce: true,
    })
  })

  it('schedule.enabled agrees with charging.phase when only charging_planned_enabled is on', () => {
    // charging_planned_enabled and charging_schedule are two distinct
    // entities that can diverge. charging.phase already accepts either one
    // for 'scheduled'; schedule.enabled has to agree, or the hero and the
    // panel would contradict each other.
    const s = build({ 'binary_sensor/charging_planned_enabled': 'on' })
    expect(s.charging.phase).toBe('scheduled')
    expect(s.schedule.enabled).toBe(true)
  })
})

describe('buildVehicleState — position', () => {
  it('reads the real coordinates', () => {
    const s = build()
    expect(s.location?.latitude).toBe(38.691584)
    expect(s.location?.longitude).toBe(-9.215939)
  })

  it('marks the position as stale and exposes its age', () => {
    const s = build()
    expect(s.location?.stale).toBe(true)
    expect(s.location?.ageSeconds).toBe(2017)
  })

  it('uses the device_tracker\'s state as the zone', () => {
    expect(build().location?.zone).toBe('home')
  })

  it('returns no position when the entity is missing', () => {
    const hass = realHass()
    const { map } = resolveEntities(hass, CONFIG)
    delete map.location
    expect(buildVehicleState(hass, map, REAL_NOW).location).toBeUndefined()
  })

  // `realHass(overrides)` only replaces `state`, not `attributes` (see
  // test/fixtures/real-states.ts) — and the shared fixture has all three
  // staleness conditions satisfied at the same time (`location_is_stale:
  // true`, source `cloud_stale`, age 2017 s > 900 s), which would let the
  // same assertion pass even if two of the three conditions in
  // `buildLocation`'s OR were deleted. That's why this case uses `fakeHass`
  // directly, with a `device_tracker` whose attributes isolate the third
  // condition: no `location_is_stale`, a fresh source `cloud` (which doesn't
  // contain "stale"), an age of 60 s (well below the threshold) — it only
  // comes out `false` if all three conditions of the OR are actually being
  // evaluated.
  it('does not mark stale with a fresh source, a low age, and no location_is_stale', () => {
    const hass = fakeHass([
      { key: 'sensor/battery_percent', entity_id: 'sensor.b10_battery', state: '60', unit: '%' },
      { key: 'lock/vehicle_lock', entity_id: 'lock.b10_lock', state: 'locked' },
      {
        key: 'device_tracker/location',
        entity_id: 'device_tracker.b10_location',
        state: 'home',
        attributes: { latitude: 38.7, longitude: -9.2, location_source: 'cloud', location_age_seconds: 60 },
      },
    ])
    const { map } = resolveEntities(hass, CONFIG)
    const s = buildVehicleState(hass, map, REAL_NOW)
    expect(s.location?.stale).toBe(false)
    expect(s.location?.latitude).toBe(38.7)
    expect(s.location?.longitude).toBe(-9.2)
  })
})

describe('buildVehicleState — recirculation and lifetime consumption', () => {
  it('reads the recirculation', () => {
    expect(build().climate.recirculating).toBe(false)
    expect(build({ 'binary_sensor/air_recirculation': 'on' }).climate.recirculating).toBe(true)
  })

  it('leaves the recirculation undefined when the entity is missing', () => {
    expect(build({ 'binary_sensor/air_recirculation': 'unavailable' }).climate.recirculating).toBeUndefined()
  })

  it('derives the lifetime consumption from the total energy and the total mileage', () => {
    // 131.0 kWh / 661 km * 100 = 19.82 kWh/100 km
    expect(build().trip.lifetimeConsumption).toBeCloseTo(19.82, 2)
  })

  it('does not derive the lifetime consumption without total energy', () => {
    expect(build({ 'sensor/total_energy_kwh': 'unavailable' }).trip.lifetimeConsumption).toBeUndefined()
  })

  it('does not divide by zero', () => {
    expect(build({ 'sensor/total_mileage_km': '0' }).trip.lifetimeConsumption).toBeUndefined()
  })
})

/*
 * The `weekly_consumption` series is the first STRUCTURED thing this card
 * reads from an attribute, and it comes from a cloud API that has already
 * shown itself inconsistent with types — in the same object, `hundredKmEC`
 * comes as a number and `hundredMiKwhEC` comes as text. That's why the
 * parser is a pure function tested here on its own, with inputs that no
 * test `hass` could produce on purpose. And since now EVERY entry in the
 * series becomes a row, a malformed one is a wrong row in plain sight —
 * which raises the value of these guards, not lowers it.
 */
describe('parseWeeklyConsumption', () => {
  /** The user's real series: a new car, four weeks at zero, two with use. */
  const REAL_SERIES = [
    { weekStart: '2026-07-20', weekEnd: '2026-07-26', hundredKmEC: 0.0, hundredMiKwhEC: '0.0' },
    { weekStart: '2026-07-27', weekEnd: '2026-08-02', hundredKmEC: 0.0, hundredMiKwhEC: '0.0' },
    { weekStart: '2026-08-03', weekEnd: '2026-08-09', hundredKmEC: 0.0, hundredMiKwhEC: '0.0' },
    { weekStart: '2026-08-10', weekEnd: '2026-08-16', hundredKmEC: 0.0, hundredMiKwhEC: '0.0' },
    { weekStart: '2026-08-17', weekEnd: '2026-08-23', hundredKmEC: 20.7, hundredMiKwhEC: '6.2' },
    { weekStart: '2026-08-24', weekEnd: '2026-08-30', hundredKmEC: 14.2, hundredMiKwhEC: '4.3' },
  ]

  it('returns the six weeks of the real series, with the first four having no consumption', () => {
    // The first four at zero are real: the car was new and hadn't been
    // driven. They stay as a row — the dates say which week it is — but with
    // no number.
    expect(parseWeeklyConsumption(REAL_SERIES)).toEqual([
      { kwhPer100Km: undefined, start: '2026-07-20', end: '2026-07-26' },
      { kwhPer100Km: undefined, start: '2026-07-27', end: '2026-08-02' },
      { kwhPer100Km: undefined, start: '2026-08-03', end: '2026-08-09' },
      { kwhPer100Km: undefined, start: '2026-08-10', end: '2026-08-16' },
      { kwhPer100Km: 20.7, start: '2026-08-17', end: '2026-08-23' },
      { kwhPer100Km: 14.2, start: '2026-08-24', end: '2026-08-30' },
    ])
  })

  it('keeps the API\'s order, from oldest to most recent', () => {
    // The order is information: the series reads as a progression, and
    // reversing it or sorting it by value would destroy that.
    const weeks = parseWeeklyConsumption(REAL_SERIES)
    expect(weeks.map(w => w.start)).toEqual([
      '2026-07-20', '2026-07-27', '2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24',
    ])
  })

  it('returns an empty list for an empty list', () => {
    expect(parseWeeklyConsumption([])).toEqual([])
  })

  it('returns an empty list for something that is not a list', () => {
    // The attribute might simply not exist, or the API might change shape
    // without warning — none of these inputs may reach `render()`.
    for (const value of [undefined, null, 0, 14.2, 'weekly', {}, { weekly_consumption: [] }, true]) {
      expect(parseWeeklyConsumption(value), String(value)).toEqual([])
    }
  })

  it('keeps weeks at zero as rows with no consumption', () => {
    // Zero is the API's way of saying "I didn't drive this week." The row
    // stays, because it has a period; the number doesn't, because "0.0
    // kWh/100 km" would claim an efficiency the car never had.
    const weeks = parseWeeklyConsumption(REAL_SERIES.slice(0, 4))
    expect(weeks).toHaveLength(4)
    expect(weeks.every(w => w.kwhPer100Km === undefined)).toBe(true)
  })

  it('the current week at zero does not erase the previous ones', () => {
    // The current week enters the series before the car has driven in it.
    const series = [...REAL_SERIES, { weekStart: '2026-08-31', weekEnd: '2026-09-06', hundredKmEC: 0.0 }]
    const weeks = parseWeeklyConsumption(series)
    expect(weeks).toHaveLength(7)
    expect(weeks[5]).toEqual({ kwhPer100Km: 14.2, start: '2026-08-24', end: '2026-08-30' })
    expect(weeks[6]?.kwhPer100Km).toBeUndefined()
  })

  it('accepts the consumption as text', () => {
    // The API already sends `hundredMiKwhEC` as text in the same object
    // where it sends `hundredKmEC` as a number. Nothing guarantees it won't
    // swap the two.
    expect(parseWeeklyConsumption([{ weekStart: '2026-08-24', weekEnd: '2026-08-30', hundredKmEC: '14.2' }]))
      .toEqual([{ kwhPer100Km: 14.2, start: '2026-08-24', end: '2026-08-30' }])
  })

  it('drops entries without two dates that can be read', () => {
    // A row with no period can't be labeled, and that — a number the card
    // shows without knowing which week it belongs to — is exactly the row
    // this version came to remove. The dates are required to be READABLE,
    // not just present.
    for (const row of [
      { hundredKmEC: 14.2 },
      { weekStart: '2026-08-24', hundredKmEC: 14.2 },
      { weekEnd: '2026-08-30', hundredKmEC: 14.2 },
      { weekStart: '', weekEnd: '2026-08-30', hundredKmEC: 14.2 },
      { weekStart: '2026-08-24', weekEnd: '', hundredKmEC: 14.2 },
      { weekStart: 20260824, weekEnd: 20260830, hundredKmEC: 14.2 },
      { weekStart: 'a semana passada', weekEnd: '2026-08-30', hundredKmEC: 14.2 },
    ]) {
      expect(parseWeeklyConsumption([row]), JSON.stringify(row)).toEqual([])
    }
  })

  it('drops the malformed entries without taking the good ones down with them', () => {
    // Now that EVERY entry becomes a row, a malformed entry is a wrong row
    // in plain sight of whoever reads it — and it must not silence its
    // valid neighbors.
    const series = [
      null,
      'nada',
      42,
      { weekStart: '2026-08-17', weekEnd: '2026-08-23', hundredKmEC: 20.7 },
      { weekStart: 'sem data', weekEnd: 'sem data', hundredKmEC: 9.9 },
      { weekStart: '2026-08-24', weekEnd: '2026-08-30', hundredKmEC: 14.2 },
      [],
    ]
    expect(parseWeeklyConsumption(series)).toEqual([
      { kwhPer100Km: 20.7, start: '2026-08-17', end: '2026-08-23' },
      { kwhPer100Km: 14.2, start: '2026-08-24', end: '2026-08-30' },
    ])
  })

  it('an unreadable consumption leaves the row, but with no number', () => {
    // The dates are what makes the row; the number is what it shows. A
    // value that can't be read is worth no more than a zero, and gets
    // written the same way.
    for (const value of [null, 'muito', { valor: 9 }, Number.NaN, -14.2, []]) {
      expect(parseWeeklyConsumption([
        { weekStart: '2026-08-24', weekEnd: '2026-08-30', hundredKmEC: value },
      ]), String(value)).toEqual([{ kwhPer100Km: undefined, start: '2026-08-24', end: '2026-08-30' }])
    }
  })

  it('does not throw for values that `Number()` alone can\'t handle', () => {
    // `Number(Symbol())` throws, and `Number(null)` returns 0 — which would
    // pass for a valid reading if the guard were only `Number.isFinite`.
    // Hence the parser requiring a number or text before coercing.
    expect(() => parseWeeklyConsumption([
      { weekStart: '2026-08-24', weekEnd: '2026-08-30', hundredKmEC: Symbol('14.2') },
    ])).not.toThrow()
    expect(parseWeeklyConsumption([
      { weekStart: '2026-08-24', weekEnd: '2026-08-30', hundredKmEC: Symbol('14.2') },
    ])[0]?.kwhPer100Km).toBeUndefined()
  })
})

describe('buildVehicleState — week energy', () => {
  const SLICE_KWH = { driving_energy_kwh: 10.4, climate_energy_kwh: 0.1, other_energy_kwh: 0.3 }

  /** A `hass` with only the entities the test names. */
  function trip(specs: FakeEntitySpec[]) {
    const hass = fakeHass(specs)
    return buildVehicleState(hass, resolveEntities(hass, CONFIG).map, REAL_NOW).trip
  }

  it('reads the kWh from another of the three entities when the driving one is not mapped', () => {
    // The three attributes come repeated in the three entities, and whoever
    // overrode `entities:` by hand may have mapped only one. The driving
    // percentage is missing, but its kWh isn't: it's in the climate
    // entity's attribute.
    const { weekEnergy } = trip([{
      key: 'sensor/last_week_climate_energy_percent',
      entity_id: 'sensor.demo_last_week_climate_energy',
      state: '0.9',
      unit: '%',
      attributes: SLICE_KWH,
    }])
    expect(weekEnergy.driving).toEqual({ kwh: 10.4, percent: undefined })
    expect(weekEnergy.climate).toEqual({ kwh: 0.1, percent: 0.9 })
    expect(weekEnergy.totalKwh).toBeCloseTo(10.8, 10)
  })

  it('leaves the total undefined, not zero, when no slice carries kWh', () => {
    // Zero would claim a week with no consumption at all. The absence of a
    // reading claims neither that — nor the opposite.
    const { weekEnergy } = trip([{
      key: 'sensor/last_week_driving_energy_percent',
      entity_id: 'sensor.demo_last_week_driving_energy',
      state: '96.3',
      unit: '%',
    }])
    expect(weekEnergy.totalKwh).toBeUndefined()
    expect(weekEnergy.driving).toEqual({ kwh: undefined, percent: 96.3 })
  })

  it('adds up only the slices that exist', () => {
    const { weekEnergy } = trip([{
      key: 'sensor/last_week_driving_energy_percent',
      entity_id: 'sensor.demo_last_week_driving_energy',
      state: '96.3',
      unit: '%',
      attributes: { driving_energy_kwh: 10.4, other_energy_kwh: 0.3 },
    }])
    expect(weekEnergy.climate.kwh).toBeUndefined()
    expect(weekEnergy.totalKwh).toBeCloseTo(10.7, 10)
  })

  it('with none of the three entities, the breakdown is entirely empty', () => {
    expect(build({
      'sensor/last_week_driving_energy_percent': 'unavailable',
      'sensor/last_week_climate_energy_percent': 'unavailable',
      'sensor/last_week_other_energy_percent': 'unavailable',
    }).trip.weekEnergy.driving.percent).toBeUndefined()
  })

  it('an unavailable percentage does not erase that slice\'s kWh', () => {
    // `unavailable` is the entity's state; the attributes are still there,
    // and the other two entities carry the same kWh anyway.
    const { weekEnergy } = build({ 'sensor/last_week_driving_energy_percent': 'unavailable' }).trip
    expect(weekEnergy.driving.percent).toBeUndefined()
    expect(weekEnergy.driving.kwh).toBe(10.4)
  })

  it('does not read any series without the attribute', () => {
    expect(trip([{
      key: 'sensor/average_consumption_6w_kwh_100km',
      entity_id: 'sensor.demo_6_week_average',
      state: '20.6',
      unit: 'kWh/100 km',
    }]).weeklyConsumption).toEqual([])
  })
})
