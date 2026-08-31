import { fakeHass, type FakeEntitySpec } from '../helpers/fake-hass'

/**
 * Copy of the real output of the `leapmotor` integration, with personal data
 * replaced: the vehicle identifier is `000000`, the device name is `Demo`,
 * and the coordinates are those of the Torre de Belém, a public monument.
 * The SHAPE is the real one and that's what matters — same keys, same units,
 * same value formats — because this fixture is the only description the
 * project has of what the integration produces. Nothing here points to a car
 * or to an address.
 */

/** Reference instant for the fixtures: 2026-08-27 13:36 UTC. */
export const REAL_NOW = new Date('2026-08-27T13:36:00+00:00')

const P = 'leapmotor_b10_000000_demo'
const M = 'leapmotor_b10_000000_main'

export const REAL_SPECS: FakeEntitySpec[] = [
  { key: 'sensor/battery_percent', entity_id: `sensor.${P}_battery`, state: '60', unit: '%' },
  { key: 'sensor/battery_percent_precise', entity_id: `sensor.${P}_precise_battery`, state: '60.3', unit: '%' },
  { key: 'sensor/remaining_range_km', entity_id: `sensor.${P}_range`, state: '217', unit: 'km' },
  { key: 'sensor/live_remaining_range_km', entity_id: `sensor.${M}_live_range`, state: '261', unit: 'km' },
  { key: 'sensor/wltp_max_range_km', entity_id: `sensor.${M}_cltc_remaining_range`, state: '434', unit: 'km' },
  { key: 'sensor/range_mode', entity_id: `sensor.${P}_range_mode`, state: 'CLTC' },
  { key: 'sensor/last_vehicle_update', entity_id: `sensor.${P}_last_vehicle_update`, state: '2026-08-27T10:16:33+00:00' },
  { key: 'sensor/last_successful_refresh', entity_id: `sensor.${P}_last_cloud_refresh`, state: '2026-08-27T13:35:24+00:00' },
  { key: 'image/vehicle_picture', entity_id: `image.${P}_vehicle_picture`, state: '2026-08-22T19:14:33.693886+00:00', attributes: { entity_picture: '/api/image_proxy/image.vehicle_picture' } },
  { key: 'device_tracker/location', entity_id: `device_tracker.${P}_location`, state: 'home', attributes: {
    latitude: 38.691584, longitude: -9.215939, gps_accuracy: 0, source_type: 'gps',
    location_age_seconds: 2017, location_is_stale: true, location_source: 'cloud_stale',
  } },

  { key: 'lock/vehicle_lock', entity_id: `lock.${P}_lock`, state: 'locked' },
  { key: 'sensor/lock_state_source', entity_id: `sensor.${P}_lock_state_source`, state: 'cloud_stale' },
  { key: 'sensor/lock_state_age_seconds', entity_id: `sensor.${P}_lock_state_age`, state: '11930', unit: 's' },

  { key: 'sensor/vehicle_state', entity_id: `sensor.${P}_vehicle_state`, state: 'unknown' },
  { key: 'sensor/gear', entity_id: `sensor.${P}_gear`, state: 'P' },
  { key: 'sensor/speed_kmh', entity_id: `sensor.${P}_speed`, state: '0.0', unit: 'km/h' },
  { key: 'binary_sensor/is_driving', entity_id: `binary_sensor.${P}_driving`, state: 'off' },
  { key: 'binary_sensor/parking_brake_active', entity_id: `binary_sensor.${P}_parking_brake_active`, state: 'on' },
  { key: 'binary_sensor/vehicle_ready', entity_id: `binary_sensor.${P}_vehicle_ready`, state: 'off' },

  { key: 'sensor/charge_limit_percent', entity_id: `sensor.${P}_charge_limit`, state: '80', unit: '%' },
  { key: 'number/charge_limit_setting', entity_id: `number.${P}_set_charge_limit`, state: '80', attributes: { min: 50, max: 100, step: 5 } },
  { key: 'binary_sensor/is_charging', entity_id: `binary_sensor.${P}_charging`, state: 'off' },
  { key: 'binary_sensor/is_plugged_in', entity_id: `binary_sensor.${P}_charge_cable_plugged_in`, state: 'off' },
  { key: 'binary_sensor/dc_cable_connected', entity_id: `binary_sensor.${P}_dc_charge_cable_plugged_in`, state: 'off' },
  { key: 'binary_sensor/fully_charged', entity_id: `binary_sensor.${P}_fully_charged`, state: 'off' },
  { key: 'sensor/charging_connection_state', entity_id: `sensor.${P}_charging_connection`, state: 'unplugged' },
  { key: 'sensor/charging_power_kw', entity_id: `sensor.${P}_charging_power`, state: '0.0', unit: 'kW' },
  { key: 'sensor/charging_voltage_v', entity_id: `sensor.${P}_charging_voltage`, state: '426.6', unit: 'V' },
  { key: 'sensor/charging_current_a', entity_id: `sensor.${P}_battery_current`, state: '0.1', unit: 'A' },
  { key: 'sensor/remaining_charge_minutes', entity_id: `sensor.${P}_remaining_charge_time`, state: 'unavailable', unit: 'min' },
  { key: 'sensor/charging_finish_time', entity_id: `sensor.${P}_estimated_charging_finish_time`, state: 'unavailable' },
  { key: 'binary_sensor/charging_planned_enabled', entity_id: `binary_sensor.${P}_scheduled_charging`, state: 'off' },
  { key: 'button/unlock_charger', entity_id: `button.${P}_unlock_charger`, state: 'unknown' },

  { key: 'binary_sensor/driver_door_open', entity_id: `binary_sensor.${P}_driver_door`, state: 'off' },
  { key: 'binary_sensor/passenger_door_open', entity_id: `binary_sensor.${P}_passenger_door`, state: 'off' },
  { key: 'binary_sensor/rear_left_door_open', entity_id: `binary_sensor.${P}_rear_left_door`, state: 'off' },
  { key: 'binary_sensor/rear_right_door_open', entity_id: `binary_sensor.${P}_rear_right_door`, state: 'off' },
  { key: 'binary_sensor/front_left_window_open', entity_id: `binary_sensor.${P}_front_left_window`, state: 'off' },
  { key: 'binary_sensor/front_right_window_open', entity_id: `binary_sensor.${P}_front_right_window`, state: 'off' },
  { key: 'binary_sensor/rear_left_window_open', entity_id: `binary_sensor.${P}_rear_left_window`, state: 'off' },
  { key: 'binary_sensor/rear_right_window_open', entity_id: `binary_sensor.${P}_rear_right_window`, state: 'off' },
  { key: 'sensor/front_left_window_position_percent', entity_id: `sensor.${P}_front_left_window_position`, state: '0', unit: '%' },
  { key: 'sensor/front_right_window_position_percent', entity_id: `sensor.${P}_front_right_window_position`, state: '0', unit: '%' },
  { key: 'sensor/rear_left_window_position_percent', entity_id: `sensor.${P}_rear_left_window_position`, state: '0', unit: '%' },
  { key: 'sensor/rear_right_window_position_percent', entity_id: `sensor.${P}_rear_right_window_position`, state: '0', unit: '%' },
  { key: 'binary_sensor/trunk_open', entity_id: `binary_sensor.${P}_trunk`, state: 'off' },
  { key: 'binary_sensor/skylight_open', entity_id: `binary_sensor.${P}_panoramic_roof_open`, state: 'off' },

  { key: 'switch/climate_control', entity_id: `switch.${P}_climate`, state: 'off' },
  { key: 'binary_sensor/climate_on', entity_id: `binary_sensor.${P}_climate_control`, state: 'off' },
  { key: 'sensor/interior_temp_c', entity_id: `sensor.${P}_interior_temperature`, state: '24.0', unit: '°C' },
  { key: 'sensor/climate_set_temp_left_c', entity_id: `sensor.${P}_target_temperature_left`, state: '24.0', unit: '°C' },
  { key: 'sensor/climate_mode', entity_id: `sensor.${P}_climate_mode`, state: 'off' },
  { key: 'binary_sensor/air_recirculation', entity_id: `binary_sensor.${P}_air_recirculation`, state: 'off' },

  { key: 'button/open_trunk', entity_id: `button.${P}_open_trunk`, state: '2026-08-20T15:10:21.352007+00:00' },
  { key: 'button/close_trunk', entity_id: `button.${P}_close_trunk`, state: '2026-08-20T15:10:36.879985+00:00' },
  { key: 'button/open_windows', entity_id: `button.${P}_open_windows`, state: '2026-08-20T15:09:33.389385+00:00' },
  { key: 'button/close_windows', entity_id: `button.${P}_close_windows`, state: '2026-08-20T15:10:52.583774+00:00' },
  { key: 'button/quick_cool', entity_id: `button.${P}_quick_cool`, state: 'unknown' },
  { key: 'button/quick_heat', entity_id: `button.${P}_quick_heat`, state: 'unknown' },
  { key: 'button/windshield_defrost', entity_id: `button.${P}_windshield_defrost`, state: 'unknown' },
  { key: 'button/find_vehicle', entity_id: `button.${P}_find_vehicle`, state: '2026-08-20T16:15:33.432408+00:00' },
  { key: 'button/refresh_data', entity_id: `button.${P}_refresh_data`, state: 'unknown' },

  { key: 'sensor/tire_pressure_front_left_bar', entity_id: `sensor.${P}_front_left_tire_pressure`, state: '2.11', unit: 'bar' },
  { key: 'sensor/tire_pressure_front_right_bar', entity_id: `sensor.${P}_front_right_tire_pressure`, state: '2.17', unit: 'bar' },
  { key: 'sensor/tire_pressure_rear_left_bar', entity_id: `sensor.${P}_rear_left_tire_pressure`, state: '2.17', unit: 'bar' },
  { key: 'sensor/tire_pressure_rear_right_bar', entity_id: `sensor.${P}_rear_right_tire_pressure`, state: '2.17', unit: 'bar' },

  { key: 'sensor/odometer_km', entity_id: `sensor.${P}_odometer`, state: '659', unit: 'km' },
  { key: 'sensor/total_mileage_km', entity_id: `sensor.${P}_total_mileage`, state: '661', unit: 'km' },
  { key: 'sensor/last_7_days_mileage_km', entity_id: `sensor.${P}_last_7_days_mileage`, state: '642', unit: 'km' },
  {
    key: 'sensor/average_consumption_6w_kwh_100km',
    entity_id: `sensor.${P}_6_week_average_consumption_kwh_100_km`,
    state: '20.6',
    unit: 'kWh/100 km',
    // The week-by-week series, oldest to most recent. The first four at zero
    // are real: the car was new and hadn't been driven. Note that
    // `hundredKmEC` comes as a number and `hundredMiKwhEC` comes as text in
    // the SAME object — the inconsistency is the API's, and that's exactly
    // what the fixture has to preserve.
    attributes: {
      weekly_consumption: [
        { weekStart: '2026-07-20', weekEnd: '2026-07-26', hundredKmEC: 0.0, hundredMiKwhEC: '0.0', xWeekStart: 1784505600000, xWeekEnd: 1785110399000 },
        { weekStart: '2026-07-27', weekEnd: '2026-08-02', hundredKmEC: 0.0, hundredMiKwhEC: '0.0', xWeekStart: 1785110400000, xWeekEnd: 1785715199000 },
        { weekStart: '2026-08-03', weekEnd: '2026-08-09', hundredKmEC: 0.0, hundredMiKwhEC: '0.0', xWeekStart: 1785715200000, xWeekEnd: 1786319999000 },
        { weekStart: '2026-08-10', weekEnd: '2026-08-16', hundredKmEC: 0.0, hundredMiKwhEC: '0.0', xWeekStart: 1786320000000, xWeekEnd: 1786924799000 },
        { weekStart: '2026-08-17', weekEnd: '2026-08-23', hundredKmEC: 20.7, hundredMiKwhEC: '6.2', xWeekStart: 1786924800000, xWeekEnd: 1787529599000 },
        { weekStart: '2026-08-24', weekEnd: '2026-08-30', hundredKmEC: 14.2, hundredMiKwhEC: '4.3', xWeekStart: 1787529600000, xWeekEnd: 1788134399000 },
      ],
    },
  },
  { key: 'sensor/total_energy_kwh', entity_id: `sensor.${P}_total_energy_consumption`, state: '131.0', unit: 'kWh' },

  /*
   * The three slices of last week's energy. The `state` is the percentage
   * and the kWh figures come in the attributes — repeated, the SAME three in
   * each of the three entities. The repetition is not a fixture bug: it's
   * what the integration produces, and it's what justifies the card being
   * able to read the kWh from any one of them.
   */
  ...(['driving', 'climate', 'other'] as const).map((slice, i) => ({
    key: `sensor/last_week_${slice}_energy_percent`,
    entity_id: `sensor.${P}_last_week_${slice}_energy`,
    state: ['96.3', '0.9', '2.8'][i]!,
    unit: '%',
    attributes: { driving_energy_kwh: 10.4, climate_energy_kwh: 0.1, other_energy_kwh: 0.3 },
  })),

  { key: 'number/driver_seat_heating', entity_id: `number.${P}_driver_seat_heating`, state: '0', attributes: { min: 0, max: 3, step: 1 } },
  { key: 'number/driver_seat_ventilation', entity_id: `number.${P}_driver_seat_ventilation`, state: '0', attributes: { min: 0, max: 3, step: 1 } },
  { key: 'number/passenger_seat_heating', entity_id: `number.${P}_passenger_seat_heating`, state: '0', attributes: { min: 0, max: 3, step: 1 } },
  { key: 'number/passenger_seat_ventilation', entity_id: `number.${P}_passenger_seat_ventilation`, state: '0', attributes: { min: 0, max: 3, step: 1 } },
  { key: 'switch/steering_wheel_heat', entity_id: `switch.${P}_steering_wheel_heating`, state: 'off' },
  { key: 'sensor/steering_wheel_heating_remaining_minutes', entity_id: `sensor.${P}_steering_wheel_heating_remaining_time`, state: '15', unit: 'min' },
  { key: 'switch/rearview_mirror_heat', entity_id: `switch.${P}_mirror_heating`, state: 'off' },
  { key: 'switch/battery_preheat', entity_id: `switch.${P}_battery_preheat`, state: 'off' },

  { key: 'switch/charging_schedule', entity_id: `switch.${P}_charging_schedule`, state: 'off' },
  { key: 'sensor/charging_planned_start', entity_id: `sensor.${P}_charging_schedule_start`, state: '22:00' },
  { key: 'sensor/charging_planned_end', entity_id: `sensor.${P}_charging_schedule_end`, state: '08:00' },
  { key: 'sensor/charging_planned_circulation', entity_id: `sensor.${P}_charging_schedule_recurrence`, state: '1' },
  { key: 'binary_sensor/charging_planned_weekly', entity_id: `binary_sensor.${P}_weekly_charging_schedule`, state: 'on' },
  { key: 'binary_sensor/charging_schedule_cancelled_once', entity_id: `binary_sensor.${P}_charging_schedule_cancelled_once`, state: 'on' },
]

/**
 * `overrides` is indexed by `domain/translation_key`, so tests can change a
 * state without repeating the whole fixture.
 */
export function realHass(overrides: Record<string, string> = {}) {
  const specs = REAL_SPECS.map(s => (overrides[s.key] !== undefined ? { ...s, state: overrides[s.key] } : s))
  return fakeHass(specs, { dev1: { name: 'Leapmotor B10 2025 Demo (Shared)', name_by_user: 'Leapmotor B10 000000 (Demo)' } })
}
