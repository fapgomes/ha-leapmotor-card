import { describe, expect, it } from 'vitest'
import { resolveEntities } from '../src/resolver'
import { buildVehicleState } from '../src/vehicle-state'
import { fakeHass } from './helpers/fake-hass'
import { REAL_NOW, realHass } from './fixtures/real-states'

const CONFIG = { type: 'custom:leapmotor-card' }

function build(overrides: Record<string, string> = {}, now = REAL_NOW) {
  const hass = realHass(overrides)
  const { map } = resolveEntities(hass, CONFIG)
  return buildVehicleState(hass, map, now)
}

describe('buildVehicleState — bateria e autonomia', () => {
  it('prefere a bateria precisa', () => {
    expect(build().battery).toBe(60.3)
  })

  it('cai para a bateria inteira quando a precisa falta', () => {
    expect(build({ 'sensor/battery_percent_precise': 'unavailable' }).battery).toBe(60)
  })

  it('usa live_range, que é o número que a app mostra, e não remaining_range', () => {
    // App: 126 km a 29 % → razão ~434. live=261 a 60 % → 435. range=217 → 361.
    expect(build().range).toEqual({ km: 261, unit: 'km', mode: 'CLTC' })
  })

  it('não usa wltp_max quando rangeLive está presente — a precedência é rangeLive > range > rangeMax', () => {
    // wltp_max_range_km é 434 na fixture; se a precedência fosse invertida
    // (['rangeMax', 'range', 'rangeLive']) este valor apareceria em vez de 261.
    expect(build().range?.km).not.toBe(434)
  })

  it('cai para remaining_range e depois para wltp_max', () => {
    expect(build({ 'sensor/live_remaining_range_km': 'unavailable' }).range?.km).toBe(217)
    expect(build({ 'sensor/live_remaining_range_km': 'unavailable', 'sensor/remaining_range_km': 'unknown' }).range?.km).toBe(434)
  })

  it('deixa range undefined quando nenhum sensor de autonomia é válido', () => {
    expect(build({
      'sensor/live_remaining_range_km': 'unavailable',
      'sensor/remaining_range_km': 'unavailable',
      'sensor/wltp_max_range_km': 'unavailable',
    }).range).toBeUndefined()
  })

  it('lê o limite de carga', () => {
    expect(build().chargeLimit).toBe(80)
  })
})

describe('buildVehicleState — última atualização', () => {
  it('usa last_vehicle_update', () => {
    expect(build().lastUpdate?.toISOString()).toBe('2026-08-27T10:16:33.000Z')
  })

  it('cai para last_cloud_refresh', () => {
    expect(build({ 'sensor/last_vehicle_update': 'unavailable' }).lastUpdate?.toISOString())
      .toBe('2026-08-27T13:35:24.000Z')
  })
})

describe('buildVehicleState — trancas', () => {
  it('lê o estado trancado', () => {
    expect(build().lock.locked).toBe(true)
  })

  it('marca stale por causa do lock_state_source cloud_stale', () => {
    const s = build()
    expect(s.lock.stale).toBe(true)
    expect(s.lock.source).toBe('cloud_stale')
    expect(s.lock.ageSeconds).toBe(11930)
  })

  it('marca stale por idade acima de 900 s mesmo com fonte fresca', () => {
    expect(build({ 'sensor/lock_state_source': 'cloud', 'sensor/lock_state_age_seconds': '901' }).lock.stale).toBe(true)
  })

  it('não marca stale com fonte fresca e idade baixa', () => {
    expect(build({ 'sensor/lock_state_source': 'cloud', 'sensor/lock_state_age_seconds': '60' }).lock.stale).toBe(false)
  })

  it('deixa locked undefined quando a entidade está indisponível', () => {
    expect(build({ 'lock/vehicle_lock': 'unavailable' }).lock.locked).toBeUndefined()
  })

  it('lê o estado destrancado, distinto de indisponível', () => {
    expect(build({ 'lock/vehicle_lock': 'unlocked' }).lock.locked).toBe(false)
  })
})

describe('buildVehicleState — atividade', () => {
  it('deriva parked apesar de vehicle_state estar unknown', () => {
    expect(build().activity).toBe('parked')
  })

  it('respeita vehicle_state quando tem um valor conhecido', () => {
    expect(build({ 'sensor/vehicle_state': 'driving' }).activity).toBe('driving')
  })

  it('deriva driving de is_driving', () => {
    expect(build({ 'binary_sensor/is_driving': 'on' }).activity).toBe('driving')
  })

  it('deriva driving de velocidade positiva', () => {
    expect(build({ 'sensor/speed_kmh': '43.5', 'sensor/gear': 'D' }).activity).toBe('driving')
  })

  it('deriva ready de vehicle_ready', () => {
    expect(build({ 'binary_sensor/vehicle_ready': 'on', 'sensor/gear': 'N', 'binary_sensor/parking_brake_active': 'off' }).activity).toBe('ready')
  })

  it('devolve unknown quando nada permite decidir', () => {
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
  it('está online com estados válidos', () => {
    expect(build().online).toBe(true)
  })

  it('está offline quando bateria, autonomia e tranca estão indisponíveis', () => {
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

describe('buildVehicleState — fase de carregamento', () => {
  it('unplugged com os estados reais', () => {
    expect(build().charging.phase).toBe('unplugged')
  })

  it('charging quando is_charging está on', () => {
    expect(build({ 'binary_sensor/is_charging': 'on', 'binary_sensor/is_plugged_in': 'on' }).charging.phase).toBe('charging')
  })

  it('complete tem prioridade sobre charging', () => {
    expect(build({ 'binary_sensor/fully_charged': 'on', 'binary_sensor/is_charging': 'on' }).charging.phase).toBe('complete')
  })

  it('plugged com cabo AC ligado mas sem carregar', () => {
    expect(build({ 'binary_sensor/is_plugged_in': 'on', 'sensor/charging_connection_state': 'plugged' }).charging.phase).toBe('plugged')
  })

  it('plugged com cabo DC ligado', () => {
    expect(build({ 'binary_sensor/dc_cable_connected': 'on' }).charging.phase).toBe('plugged')
  })

  it('plugged quando só o sensor de conexão indica cabo', () => {
    expect(build({ 'sensor/charging_connection_state': 'plugged' }).charging.phase).toBe('plugged')
  })

  it('não infere plugged de um sensor de conexão inválido', () => {
    expect(build({ 'sensor/charging_connection_state': 'unknown' }).charging.phase).toBe('unplugged')
    expect(build({ 'sensor/charging_connection_state': 'unavailable' }).charging.phase).toBe('unplugged')
  })

  it('scheduled quando há agendamento activo e nenhum cabo', () => {
    expect(build({ 'binary_sensor/charging_planned_enabled': 'on' }).charging.phase).toBe('scheduled')
    expect(build({ 'switch/charging_schedule': 'on' }).charging.phase).toBe('scheduled')
  })

  it('o cabo ganha ao agendamento', () => {
    expect(build({ 'binary_sensor/charging_planned_enabled': 'on', 'binary_sensor/is_plugged_in': 'on' }).charging.phase).toBe('plugged')
  })
})

describe('buildVehicleState — velocidade de carregamento', () => {
  it('lento em AC de baixa potência, como na app', () => {
    const s = build({ 'binary_sensor/is_charging': 'on', 'binary_sensor/is_plugged_in': 'on', 'sensor/charging_power_kw': '2.2' })
    expect(s.charging.speed).toBe('slow')
  })

  it('rápido acima de 7.4 kW', () => {
    const s = build({ 'binary_sensor/is_charging': 'on', 'binary_sensor/is_plugged_in': 'on', 'sensor/charging_power_kw': '11.0' })
    expect(s.charging.speed).toBe('fast')
  })

  it('rápido sempre que o cabo DC está ligado', () => {
    const s = build({ 'binary_sensor/is_charging': 'on', 'binary_sensor/dc_cable_connected': 'on', 'sensor/charging_power_kw': '3.0' })
    expect(s.charging.speed).toBe('fast')
  })

  it('sem velocidade quando não está a carregar', () => {
    expect(build().charging.speed).toBeUndefined()
  })
})

describe('buildVehicleState — tempo e métricas de carregamento', () => {
  it('não inventa tempo restante quando o sensor está indisponível', () => {
    const s = build()
    expect(s.charging.remainingMinutes).toBeUndefined()
    expect(s.charging.finishTime).toBeUndefined()
  })

  it('lê o tempo restante e deriva a hora de fim a partir de now', () => {
    const s = build({
      'binary_sensor/is_charging': 'on',
      'binary_sensor/is_plugged_in': 'on',
      'sensor/remaining_charge_minutes': '835',
    })
    expect(s.charging.remainingMinutes).toBe(835)
    // REAL_NOW 13:36 UTC + 835 min = 2026-08-28T03:31:00Z
    expect(s.charging.finishTime?.toISOString()).toBe('2026-08-28T03:31:00.000Z')
  })

  it('prefere o sensor de hora de fim ao valor derivado', () => {
    const s = build({
      'binary_sensor/is_charging': 'on',
      'binary_sensor/is_plugged_in': 'on',
      'sensor/remaining_charge_minutes': '835',
      'sensor/charging_finish_time': '2026-08-28T04:00:00+00:00',
    })
    expect(s.charging.finishTime?.toISOString()).toBe('2026-08-28T04:00:00.000Z')
  })

  it('expõe potência, tensão e corrente', () => {
    const s = build({ 'binary_sensor/is_charging': 'on', 'binary_sensor/is_plugged_in': 'on', 'sensor/charging_power_kw': '6.9' })
    expect(s.charging.powerKw).toBe(6.9)
    expect(s.charging.voltageV).toBe(426.6)
    expect(s.charging.currentA).toBe(0.1)
  })
})

describe('buildVehicleState — aberturas', () => {
  it('tudo fechado nos estados reais', () => {
    const s = build()
    expect(s.openings.openCount).toBe(0)
    expect(s.openings.doors.driver).toBe(false)
    expect(s.openings.trunk).toBe(false)
    expect(s.openings.roof).toBe(false)
  })

  it('conta uma porta aberta', () => {
    expect(build({ 'binary_sensor/rear_left_door_open': 'on' }).openings.openCount).toBe(1)
  })

  it('conta a mala e o teto', () => {
    expect(build({ 'binary_sensor/trunk_open': 'on', 'binary_sensor/skylight_open': 'on' }).openings.openCount).toBe(2)
  })

  it('conta um vidro aberto pelo binary_sensor', () => {
    const s = build({ 'binary_sensor/front_left_window_open': 'on' })
    expect(s.openings.windows.fl.open).toBe(true)
    expect(s.openings.openCount).toBe(1)
  })

  it('conta um vidro aberto por posição, mesmo com o binary_sensor a off', () => {
    const s = build({ 'sensor/rear_right_window_position_percent': '35' })
    expect(s.openings.windows.rr.position).toBe(35)
    expect(s.openings.openCount).toBe(1)
  })

  it('não conta duas vezes o mesmo vidro', () => {
    const s = build({ 'binary_sensor/front_right_window_open': 'on', 'sensor/front_right_window_position_percent': '80' })
    expect(s.openings.openCount).toBe(1)
  })

  it('ignora aberturas indisponíveis em vez de as contar', () => {
    const s = build({ 'binary_sensor/driver_door_open': 'unavailable' })
    expect(s.openings.doors.driver).toBeUndefined()
    expect(s.openings.openCount).toBe(0)
  })
})

describe('buildVehicleState — clima', () => {
  it('lê temperatura interior, alvo e estado', () => {
    const s = build()
    expect(s.climate.interiorC).toBe(24)
    expect(s.climate.targetC).toBe(24)
    expect(s.climate.on).toBe(false)
    expect(s.climate.mode).toBe('off')
  })

  it('considera ligado quando o switch ou o binary_sensor estão on', () => {
    expect(build({ 'switch/climate_control': 'on' }).climate.on).toBe(true)
    expect(build({ 'binary_sensor/climate_on': 'on' }).climate.on).toBe(true)
  })
})

describe('buildVehicleState — pneus, viagem, conforto, agendamento', () => {
  it('lê as quatro pressões', () => {
    expect(build().tires).toEqual({ fl: 2.11, fr: 2.17, rl: 2.17, rr: 2.17 })
  })

  it('lê a viagem', () => {
    expect(build().trip).toEqual({
      odometerKm: 659, last7DaysKm: 642, last7DaysKwh: 118, avgConsumption: 20.6, totalEnergyKwh: 131,
      lifetimeConsumption: (131.0 / 661) * 100,
    })
  })

  it('usa total_mileage como recurso do odómetro', () => {
    // total_mileage_km é 661 na fixture, distinto de odometer_km (659), para
    // provar que o valor veio mesmo do fallback e não sobrou do sensor principal.
    expect(build({ 'sensor/odometer_km': 'unavailable' }).trip.odometerKm).toBe(661)
  })

  it('lê o conforto', () => {
    const s = build({ 'switch/steering_wheel_heat': 'on' })
    expect(s.comfort.driverSeatHeat).toBe(0)
    expect(s.comfort.steeringWheelHeat).toBe(true)
    expect(s.comfort.steeringWheelHeatRemaining).toBe(15)
    expect(s.comfort.mirrorHeat).toBe(false)
    expect(s.comfort.batteryPreheat).toBe(false)
  })

  it('lê o agendamento', () => {
    expect(build().schedule).toEqual({
      enabled: false, start: '22:00', end: '08:00', recurrence: '1', weekly: true, cancelledOnce: true,
    })
  })

  it('schedule.enabled concorda com charging.phase quando só charging_planned_enabled está on', () => {
    // charging_planned_enabled e charging_schedule são duas entidades distintas
    // que podem divergir. charging.phase já aceita qualquer uma para 'scheduled';
    // schedule.enabled tem de concordar, senão o hero e o painel contradizem-se.
    const s = build({ 'binary_sensor/charging_planned_enabled': 'on' })
    expect(s.charging.phase).toBe('scheduled')
    expect(s.schedule.enabled).toBe(true)
  })
})

describe('buildVehicleState — posição', () => {
  it('lê as coordenadas reais', () => {
    const s = build()
    expect(s.location?.latitude).toBe(38.691584)
    expect(s.location?.longitude).toBe(-9.215939)
  })

  it('marca a posição como obsoleta e expõe a idade', () => {
    const s = build()
    expect(s.location?.stale).toBe(true)
    expect(s.location?.ageSeconds).toBe(2017)
  })

  it('usa o estado do device_tracker como zona', () => {
    expect(build().location?.zone).toBe('home')
  })

  it('não devolve posição quando a entidade falta', () => {
    const hass = realHass()
    const { map } = resolveEntities(hass, CONFIG)
    delete map.location
    expect(buildVehicleState(hass, map, REAL_NOW).location).toBeUndefined()
  })

  // `realHass(overrides)` só substitui `state`, não `attributes` (ver
  // test/fixtures/real-states.ts) — e a fixture partilhada tem as três
  // condições de staleness satisfeitas ao mesmo tempo
  // (`location_is_stale: true`, fonte `cloud_stale`, idade 2017 s > 900 s), o
  // que deixaria passar a mesma asserção mesmo que duas das três condições no
  // OR de `buildLocation` fossem apagadas. Por isso este caso usa `fakeHass`
  // diretamente, com um `device_tracker` cujos atributos isolam a terceira
  // condição: sem `location_is_stale`, fonte fresca `cloud` (não contém
  // "stale"), idade 60 s (bem abaixo do limiar) — só fica `false` se as três
  // condições do OR estiverem mesmo a ser avaliadas.
  it('não marca stale com fonte fresca, idade baixa e sem location_is_stale', () => {
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

describe('buildVehicleState — recirculação e consumo de sempre', () => {
  it('lê a recirculação', () => {
    expect(build().climate.recirculating).toBe(false)
    expect(build({ 'binary_sensor/air_recirculation': 'on' }).climate.recirculating).toBe(true)
  })

  it('deixa a recirculação undefined quando a entidade falta', () => {
    expect(build({ 'binary_sensor/air_recirculation': 'unavailable' }).climate.recirculating).toBeUndefined()
  })

  it('deriva o consumo de sempre da energia total e da quilometragem total', () => {
    // 131.0 kWh / 661 km * 100 = 19.82 kWh/100 km
    expect(build().trip.lifetimeConsumption).toBeCloseTo(19.82, 2)
  })

  it('não deriva o consumo de sempre sem energia total', () => {
    expect(build({ 'sensor/total_energy_kwh': 'unavailable' }).trip.lifetimeConsumption).toBeUndefined()
  })

  it('não divide por zero', () => {
    expect(build({ 'sensor/total_mileage_km': '0' }).trip.lifetimeConsumption).toBeUndefined()
  })
})
