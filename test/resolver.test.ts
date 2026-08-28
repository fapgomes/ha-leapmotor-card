import { describe, expect, it, vi } from 'vitest'
import { loadRegistryFallback, resolveEntities } from '../src/resolver'
import { displayEntry, fakeHass } from './helpers/fake-hass'

const CONFIG = { type: 'custom:leapmotor-card' }

const BASE = [
  { key: 'sensor/battery_percent', entity_id: 'sensor.b10_battery', state: '60', unit: '%' },
  { key: 'sensor/remaining_range_km', entity_id: 'sensor.b10_range', state: '217', unit: 'km' },
  { key: 'sensor/live_remaining_range_km', entity_id: 'sensor.b10_main_live_range', state: '261', unit: 'km' },
  { key: 'lock/vehicle_lock', entity_id: 'lock.b10_lock', state: 'locked' },
]

describe('resolveEntities', () => {
  it('descobre o único device Leapmotor quando config.device é omitido', () => {
    const hass = fakeHass(BASE, { dev1: { name_by_user: 'B10 Demo' } })
    const r = resolveEntities(hass, CONFIG)
    expect(r.error).toBeUndefined()
    expect(r.deviceId).toBe('dev1')
    expect(r.deviceName).toBe('B10 Demo')
    expect(r.map.battery).toBe('sensor.b10_battery')
  })

  it('resolve entidades com prefixo de entity_id diferente do device', () => {
    // `..._main_live_range` não partilha o prefixo das restantes; o mapeamento
    // é por translation_key, logo tem de ser encontrado.
    const hass = fakeHass(BASE, { dev1: {} })
    expect(resolveEntities(hass, CONFIG).map.rangeLive).toBe('sensor.b10_main_live_range')
  })

  it('devolve erro ambiguous quando há dois carros e nenhum device na config', () => {
    const hass = fakeHass(
      [...BASE, { key: 'sensor/battery_percent', entity_id: 'sensor.t03_battery', device_id: 'dev2', state: '40', unit: '%' }],
      { dev1: { name_by_user: 'B10 Demo' }, dev2: { name: 'T03' } },
    )
    const r = resolveEntities(hass, CONFIG)
    expect(r.error).toBe('ambiguous')
    expect(r.candidates.map(c => c.name).sort()).toEqual(['B10 Demo', 'T03'])
  })

  it('aceita um device_id explícito', () => {
    const hass = fakeHass(BASE, { dev1: {} })
    expect(resolveEntities(hass, { ...CONFIG, device: 'dev1' }).deviceId).toBe('dev1')
  })

  it('aceita um entity_id como device', () => {
    const hass = fakeHass(BASE, { dev1: {} })
    expect(resolveEntities(hass, { ...CONFIG, device: 'lock.b10_lock' }).deviceId).toBe('dev1')
  })

  it('devolve unknown_device para um device que não existe', () => {
    const hass = fakeHass(BASE, { dev1: {} })
    expect(resolveEntities(hass, { ...CONFIG, device: 'dev9' }).error).toBe('unknown_device')
  })

  it('devolve not_found depois de o fallback também não trazer nada', () => {
    // Com `extra` fornecido (mesmo vazio), o fallback já correu: o estado
    // terminal é not_found, não needsFallback.
    const hass = fakeHass([], {})
    expect(resolveEntities(hass, CONFIG, []).error).toBe('not_found')
  })

  it('deixa os overrides da config ganharem sobre a descoberta', () => {
    const hass = fakeHass(BASE, { dev1: {} })
    const r = resolveEntities(hass, { ...CONFIG, entities: { range: 'sensor.b10_main_live_range' } })
    expect(r.map.range).toBe('sensor.b10_main_live_range')
  })

  it('lista as chaves não resolvidas em missing', () => {
    const hass = fakeHass(BASE, { dev1: {} })
    const r = resolveEntities(hass, CONFIG)
    expect(r.missing).toContain('interiorTemp')
    expect(r.missing).not.toContain('battery')
  })

  it('sinaliza needsFallback quando hass.entities está vazio e resolve com extra', () => {
    const hass = fakeHass(BASE, { dev1: {} }, { omitEntities: true })
    expect(resolveEntities(hass, CONFIG).needsFallback).toBe(true)

    const extra = BASE.map(s => displayEntry(s.key, s.entity_id))
    const r = resolveEntities(hass, CONFIG, extra)
    expect(r.needsFallback).toBe(false)
    expect(r.map.battery).toBe('sensor.b10_battery')
  })

  it('prefere name_by_user ao name do device', () => {
    const hass = fakeHass(BASE, { dev1: { name: 'Leapmotor B10 2025', name_by_user: 'B10 Demo' } })
    expect(resolveEntities(hass, CONFIG).deviceName).toBe('B10 Demo')
  })
})

describe('loadRegistryFallback', () => {
  it('pede config/entity_registry/list e filtra pela integração', async () => {
    const callWS = vi.fn().mockResolvedValue([
      { entity_id: 'sensor.b10_battery', device_id: 'dev1', platform: 'leapmotor', translation_key: 'battery_percent' },
      { entity_id: 'sensor.other', device_id: 'dev5', platform: 'mqtt', translation_key: null },
    ])
    const hass = { ...fakeHass([], {}), callWS } as never
    const out = await loadRegistryFallback(hass)
    expect(callWS).toHaveBeenCalledWith({ type: 'config/entity_registry/list' })
    expect(out).toHaveLength(1)
    expect(out[0].translation_key).toBe('battery_percent')
  })
})
