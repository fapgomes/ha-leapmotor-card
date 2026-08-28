# Leapmotor Card

A Lovelace custom card for Home Assistant that replicates the main vehicle
screen of the Leapmotor mobile app, built for a Leapmotor B10 running the
[kerniger/leapmotor-ha](https://github.com/kerniger/leapmotor-ha) integration.

The card renders a single `ha-card`: range and battery at the top, a row of
action buttons, then the sections you enable — charging, the interior/openings
tiles with the expandable climate panel drawn over a top view of the cabin,
tyres, trip, comfort, charging schedule and the map.

## Requirements

- Home Assistant **2026.8** or later (developed and tested against
  2026.8.3).
- The [kerniger/leapmotor-ha](https://github.com/kerniger/leapmotor-ha)
  integration already installed and configured, with your vehicle added as
  a device.

## Installation — HACS

1. In HACS, open the three-dot menu and choose **Custom repositories**.
2. Add this repository's URL with category **Lovelace**.
3. Install **Leapmotor Card** from HACS. The Lovelace resource is
   registered automatically.

> **A tagged release is required.** `dist/` is listed in `.gitignore`, so
> the built `leapmotor-card.js` file does not exist in the repository
> tree. HACS resolves the file from a GitHub release asset first, and only
> falls back to the repository tree afterwards — with no tagged release,
> neither source has the file and the card cannot be installed. Install a
> tagged version (`vX.Y.Z`), not an arbitrary commit or branch.

## Installation — manual

1. Download `leapmotor-card.js` from a
   [tagged release](https://github.com/fapgomes/ha-leapmotor-card/releases)
   (or build it yourself — see [Development](#development)).
2. Copy it to `config/www/leapmotor-card/leapmotor-card.js`.
3. Go to **Settings → Dashboards → three-dot menu → Resources** and add a
   new resource:
   - URL: `/local/leapmotor-card/leapmotor-card.js`
   - Resource type: **JavaScript module**

## Configuration

Minimal configuration:

```yaml
type: custom:leapmotor-card
```

Full example with every option:

```yaml
type: custom:leapmotor-card
device: a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6
name: My Leapmotor
language: en
image: auto
actions:
  - unlock
  - lock
  - trunk
  - windows
  - findVehicle
  - sunshade
confirm_actions:
  - unlock
sections:
  location: true
  charging: true
  tiles: true
  tires: true
  trip: true
  comfort: true
  schedule: true
entities:
  rangeLive: sensor.my_car_live_remaining_range_km
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `device` | string | *(auto-detected)* | Device ID, or any entity ID belonging to the car. May be omitted if only one Leapmotor device exists in your Home Assistant instance; if there is more than one, `device` is required. |
| `name` | string | device name | Overrides the name shown in the card header. |
| `language` | string | `hass.locale.language` (falls back to `en` if unsupported) | Forces the card's language regardless of the Home Assistant UI language. Supported values: `pt`, `en`. |
| `image` | `auto` \| `entity` \| `none` \| URL | `auto` | `auto` shows the vehicle's `entity_picture` when available and falls back to the built-in silhouette; `entity` shows only the picture from the vehicle's image entity (no silhouette fallback); `none` hides the image entirely; any other string is used as a literal image URL. |
| `actions` | list of action IDs | `[unlock, lock, trunk, windows, findVehicle, sunshade]` | Which action buttons appear in the action row. Valid IDs: `unlock`, `lock`, `trunk`, `windows`, `sunshade`, `quickCool`, `quickHeat`, `defrost`, `findVehicle`, `unlockCharger`, `refresh`, `climate`, `steeringWheelHeat`, `mirrorHeat`, `batteryPreheat`. |
| `confirm_actions` | list of action IDs | `[unlock]` | Subset of `actions` (or any of the same valid action IDs) that ask for confirmation before calling the service. |
| `sections` | map of section id → boolean | `location: false, charging: true, tiles: true, tires: false, trip: false, comfort: false, schedule: false` | Toggles optional sections. Valid keys: `location`, `charging`, `tiles`, `tires`, `trip`, `comfort`, `schedule`. `location` shows the vehicle's position on the Home Assistant map, off by default, and displays the position's age because the integration flags it as stale. |
| `entities` | map of logical name → entity ID | *(none)* | Overrides automatic entity resolution for individual logical names — see [Entity overrides](#entity-overrides) below. |

`setChargeLimit` and `setClimate` are absent from the `actions`/
`confirm_actions` list above: neither works as an action-row button, because
their service call needs a value (the charge limit, the target temperature)
that only their own control — the charging section's slider, the climate
panel's stepper — can supply.

`findVehicle` triggers the vehicle's horn: the integration itself describes
its underlying `find_car` action as "Trigger the horn/find-vehicle action".

The sunshade's position is not exposed as an entity, so `sunshade` is not a
toggle — a toggle would have to lie about the current state. It opens a
single position control (0–10) instead, and there is no way to stop the
sunshade mid-travel, because the integration exposes no stop service.

The visual editor (opened from Lovelace's card picker) covers all of the
above except `entities`: it offers a device picker scoped to the
`leapmotor` integration, plus fields for name, language, image, actions,
confirm actions, and section toggles. Its action picker offers only 12 of
the 15 action IDs — `steeringWheelHeat`, `mirrorHeat` and
`batteryPreheat` belong to the comfort section rather than the quick-action
row, so they can be added to `actions`/`confirm_actions` only via YAML.

## Entity overrides

The card never guesses an entity ID by concatenating strings (e.g. it does
not build `sensor.<device>_battery_percent`). Instead, for the resolved
`device`, it reads every entity registered under the `leapmotor` platform
and matches each one by its **`translation_key`** plus domain. This is not
a stylistic choice: on the real vehicle two sensors —
`live_remaining_range_km` and `wltp_max_range_km` — sit under a different
`entity_id` prefix than the other 84, so string concatenation cannot find
them. Matching by `translation_key` works regardless of how an entity was
renamed or which prefix it was assigned.

If your entity registry doesn't expose a `translation_key` for some
entity, or you renamed things in a way the resolver can't follow, use the
`entities:` option to point a logical name directly at an entity ID:

```yaml
entities:
  rangeLive: sensor.my_car_live_remaining_range_km
```

The catalogue below lists all 86 logical names the card knows about, the
Home Assistant domain each one expects, and the `translation_key` it is
matched against. Every key is valid as an override target under
`entities:`.

#### Identity & range

| Logical name | Domain | `translation_key` |
| --- | --- | --- |
| `battery` | sensor | `battery_percent` |
| `batteryPrecise` | sensor | `battery_percent_precise` |
| `range` | sensor | `remaining_range_km` |
| `rangeLive` | sensor | `live_remaining_range_km` |
| `rangeMax` | sensor | `wltp_max_range_km` |
| `rangeMode` | sensor | `range_mode` |
| `lastVehicleUpdate` | sensor | `last_vehicle_update` |
| `lastCloudRefresh` | sensor | `last_successful_refresh` |
| `vehiclePicture` | image | `vehicle_picture` |
| `location` | device_tracker | `location` |

#### Locks

| Logical name | Domain | `translation_key` |
| --- | --- | --- |
| `lock` | lock | `vehicle_lock` |
| `lockStateSource` | sensor | `lock_state_source` |
| `lockStateAge` | sensor | `lock_state_age_seconds` |

#### Activity

| Logical name | Domain | `translation_key` |
| --- | --- | --- |
| `vehicleState` | sensor | `vehicle_state` |
| `gear` | sensor | `gear` |
| `speed` | sensor | `speed_kmh` |
| `isDriving` | binary_sensor | `is_driving` |
| `parkingBrake` | binary_sensor | `parking_brake_active` |
| `vehicleReady` | binary_sensor | `vehicle_ready` |

#### Charging

| Logical name | Domain | `translation_key` |
| --- | --- | --- |
| `chargeLimit` | sensor | `charge_limit_percent` |
| `chargeLimitSet` | number | `charge_limit_setting` |
| `isCharging` | binary_sensor | `is_charging` |
| `isPluggedIn` | binary_sensor | `is_plugged_in` |
| `dcCableConnected` | binary_sensor | `dc_cable_connected` |
| `fullyCharged` | binary_sensor | `fully_charged` |
| `chargingConnection` | sensor | `charging_connection_state` |
| `chargingPower` | sensor | `charging_power_kw` |
| `chargingVoltage` | sensor | `charging_voltage_v` |
| `chargingCurrent` | sensor | `charging_current_a` |
| `remainingChargeMinutes` | sensor | `remaining_charge_minutes` |
| `chargingFinishTime` | sensor | `charging_finish_time` |
| `schedulePlanned` | binary_sensor | `charging_planned_enabled` |
| `unlockCharger` | button | `unlock_charger` |

#### Openings (doors, windows, trunk, roof)

| Logical name | Domain | `translation_key` |
| --- | --- | --- |
| `doorDriver` | binary_sensor | `driver_door_open` |
| `doorPassenger` | binary_sensor | `passenger_door_open` |
| `doorRearLeft` | binary_sensor | `rear_left_door_open` |
| `doorRearRight` | binary_sensor | `rear_right_door_open` |
| `windowFL` | binary_sensor | `front_left_window_open` |
| `windowFR` | binary_sensor | `front_right_window_open` |
| `windowRL` | binary_sensor | `rear_left_window_open` |
| `windowRR` | binary_sensor | `rear_right_window_open` |
| `windowPosFL` | sensor | `front_left_window_position_percent` |
| `windowPosFR` | sensor | `front_right_window_position_percent` |
| `windowPosRL` | sensor | `rear_left_window_position_percent` |
| `windowPosRR` | sensor | `rear_right_window_position_percent` |
| `trunk` | binary_sensor | `trunk_open` |
| `roof` | binary_sensor | `skylight_open` |

#### Climate

| Logical name | Domain | `translation_key` |
| --- | --- | --- |
| `climateSwitch` | switch | `climate_control` |
| `climateOn` | binary_sensor | `climate_on` |
| `interiorTemp` | sensor | `interior_temp_c` |
| `targetTemp` | sensor | `climate_set_temp_left_c` |
| `climateMode` | sensor | `climate_mode` |
| `recirculation` | binary_sensor | `air_recirculation` |

#### Buttons

| Logical name | Domain | `translation_key` |
| --- | --- | --- |
| `openTrunk` | button | `open_trunk` |
| `closeTrunk` | button | `close_trunk` |
| `openWindows` | button | `open_windows` |
| `closeWindows` | button | `close_windows` |
| `quickCool` | button | `quick_cool` |
| `quickHeat` | button | `quick_heat` |
| `windshieldDefrost` | button | `windshield_defrost` |
| `findVehicle` | button | `find_vehicle` |
| `refreshData` | button | `refresh_data` |

#### Tires

| Logical name | Domain | `translation_key` |
| --- | --- | --- |
| `tireFL` | sensor | `tire_pressure_front_left_bar` |
| `tireFR` | sensor | `tire_pressure_front_right_bar` |
| `tireRL` | sensor | `tire_pressure_rear_left_bar` |
| `tireRR` | sensor | `tire_pressure_rear_right_bar` |

#### Trip

| Logical name | Domain | `translation_key` |
| --- | --- | --- |
| `odometer` | sensor | `odometer_km` |
| `totalMileage` | sensor | `total_mileage_km` |
| `last7DaysKm` | sensor | `last_7_days_mileage_km` |
| `last7DaysKwh` | sensor | `last_7_days_energy_kwh` |
| `avgConsumption6w` | sensor | `average_consumption_6w_kwh_100km` |
| `totalEnergy` | sensor | `total_energy_kwh` |

#### Comfort

| Logical name | Domain | `translation_key` |
| --- | --- | --- |
| `driverSeatHeat` | number | `driver_seat_heating` |
| `driverSeatVent` | number | `driver_seat_ventilation` |
| `passengerSeatHeat` | number | `passenger_seat_heating` |
| `passengerSeatVent` | number | `passenger_seat_ventilation` |
| `steeringWheelHeat` | switch | `steering_wheel_heat` |
| `steeringWheelHeatRemaining` | sensor | `steering_wheel_heating_remaining_minutes` |
| `mirrorHeat` | switch | `rearview_mirror_heat` |
| `batteryPreheat` | switch | `battery_preheat` |

#### Schedule

| Logical name | Domain | `translation_key` |
| --- | --- | --- |
| `scheduleSwitch` | switch | `charging_schedule` |
| `scheduleStart` | sensor | `charging_planned_start` |
| `scheduleEnd` | sensor | `charging_planned_end` |
| `scheduleRecurrence` | sensor | `charging_planned_circulation` |
| `scheduleWeekly` | binary_sensor | `charging_planned_weekly` |
| `scheduleCancelledOnce` | binary_sensor | `charging_schedule_cancelled_once` |

## Development

```bash
npm install
npm run build
npm test
npm run watch
```

## License

GNU General Public License v3.0 or later.

Copyright (C) 2026 Fernando A. P. Gomes

See [LICENSE](LICENSE) for the full text.
