import type { HassEntity, HassEntityDisplayEntry, HomeAssistant } from '../../src/ha-types'

export interface FakeEntitySpec {
  /** `domain/translation_key`, e.g. `sensor/battery_percent` */
  key: string
  entity_id: string
  device_id?: string
  state?: string
  unit?: string
  attributes?: Record<string, unknown>
}

export function fakeHass(
  specs: FakeEntitySpec[],
  devices: Record<string, { name?: string; name_by_user?: string }> = {},
  opts: { omitEntities?: boolean } = {},
): HomeAssistant {
  const entities: Record<string, HassEntityDisplayEntry> = {}
  const states: Record<string, HassEntity> = {}

  for (const spec of specs) {
    const [, tk] = spec.key.split('/')
    entities[spec.entity_id] = {
      entity_id: spec.entity_id,
      device_id: spec.device_id ?? 'dev1',
      platform: 'leapmotor',
      translation_key: tk,
    }
    states[spec.entity_id] = {
      entity_id: spec.entity_id,
      state: spec.state ?? 'off',
      attributes: { ...(spec.unit ? { unit_of_measurement: spec.unit } : {}), ...spec.attributes },
      last_changed: '2026-08-27T10:00:00+00:00',
      last_updated: '2026-08-27T10:00:00+00:00',
    }
  }

  return {
    states,
    entities: opts.omitEntities ? {} : entities,
    devices: Object.fromEntries(Object.entries(devices).map(([id, d]) => [id, { id, ...d }])),
    locale: { language: 'pt' },
    callService: async () => undefined,
    callWS: async () => [] as never,
  }
}

export function displayEntry(key: string, entity_id: string, device_id = 'dev1'): HassEntityDisplayEntry {
  const [, tk] = key.split('/')
  return { entity_id, device_id, platform: 'leapmotor', translation_key: tk }
}
