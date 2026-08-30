import { describe, expect, it } from 'vitest'
import { GROUP_CATALOGUE, GROUP_ORDER, missingForGroups, resolveGrid, summaryFor } from '../src/groups'
import { createTranslator, DASH } from '../src/localize'
import { resolveEntities } from '../src/resolver'
import type { EntityMap, GroupId, LeapmotorCardConfig } from '../src/types'
import { buildVehicleState } from '../src/vehicle-state'
import { REAL_NOW, realHass } from './fixtures/real-states'

const CONFIG: LeapmotorCardConfig = { type: 'custom:leapmotor-card' }
const t = createTranslator('en')

/** O mapa de entidades do carro real das fixtures. */
function realMap(): EntityMap {
  return resolveEntities(realHass(), CONFIG).map
}

/** O estado do carro real das fixtures, com sobreposições por chave. */
function realState(overrides: Record<string, string> = {}) {
  const hass = realHass(overrides)
  return buildVehicleState(hass, resolveEntities(hass, CONFIG).map, REAL_NOW)
}

/** Um grupo resolvido com o resumo escolhido à mão. */
function group(id: GroupId, summary?: string) {
  const config = { ...CONFIG, grid: [{ group: id, summary }] } as LeapmotorCardConfig
  return resolveGrid(config, realMap()).groups[0]!
}

describe('resolveGrid — grelha por omissão', () => {
  it('devolve o catálogo inteiro pela ordem do catálogo', () => {
    const { groups, explicit } = resolveGrid(CONFIG, realMap())
    expect(groups.map(g => g.id)).toEqual([...GROUP_ORDER])
    expect(explicit).toBe(false)
  })

  it('deixa cair em silêncio um grupo sem nenhuma entidade resolvível', () => {
    // Sem nenhuma das quatro chaves de pneu, o grupo `tires` não tem o que
    // mostrar. Numa grelha por omissão desaparece: a configuração zero mostra
    // o que ESTE carro dá, e não uma lista de secções vazias.
    const map = realMap()
    delete map.tireFL; delete map.tireFR; delete map.tireRL; delete map.tireRR
    expect(resolveGrid(CONFIG, map).groups.map(g => g.id)).not.toContain('tires')
  })

  it('mantém um grupo a que falte só parte das entidades', () => {
    // Um carro que reporte dois pneus continua a ter pneus para mostrar.
    const map = realMap()
    delete map.tireRL; delete map.tireRR
    expect(resolveGrid(CONFIG, map).groups.map(g => g.id)).toContain('tires')
  })

  it('dá o primeiro resumo do grupo como resumo por omissão', () => {
    const { groups } = resolveGrid(CONFIG, realMap())
    for (const group of groups) {
      expect(group.summary).toBe(GROUP_CATALOGUE[group.id].summaries[0])
    }
  })
})

describe('resolveGrid — grelha escrita à mão', () => {
  it('respeita a ordem escrita, que não é a do catálogo', () => {
    const config: LeapmotorCardConfig = { ...CONFIG, grid: ['tires', 'charging'] }
    expect(resolveGrid(config, realMap()).groups.map(g => g.id)).toEqual(['tires', 'charging'])
  })

  it('marca-se como explícita, para o aviso de entidades em falta saber que foi pedida', () => {
    expect(resolveGrid({ ...CONFIG, grid: ['trip'] }, realMap()).explicit).toBe(true)
  })

  it('trata a forma curta e a forma longa como o mesmo grupo', () => {
    const short = resolveGrid({ ...CONFIG, grid: ['tires'] }, realMap())
    const long = resolveGrid({ ...CONFIG, grid: [{ group: 'tires' }] }, realMap())
    expect(long.groups.map(g => g.id)).toEqual(short.groups.map(g => g.id))
    expect(long.groups[0]?.icon).toBe(short.groups[0]?.icon)
  })

  it('sobrepõe o ícone e o título quando a forma longa os traz', () => {
    const config: LeapmotorCardConfig = {
      ...CONFIG,
      grid: [{ group: 'tires', icon: 'mdi:test-tube', title: 'Pressões' }],
    }
    const group = resolveGrid(config, realMap()).groups[0]
    expect(group?.icon).toBe('mdi:test-tube')
    expect(group?.titleOverride).toBe('Pressões')
  })

  it('deixa o titleOverride indefinido quando não é escrito, para o card usar a tradução', () => {
    const group = resolveGrid({ ...CONFIG, grid: ['tires'] }, realMap()).groups[0]
    expect(group?.titleOverride).toBeUndefined()
    expect(group?.titleKey).toBe(GROUP_CATALOGUE.tires.titleKey)
  })

  it('aceita um resumo alternativo do próprio grupo', () => {
    const config: LeapmotorCardConfig = { ...CONFIG, grid: [{ group: 'tires', summary: 'worst' }] }
    expect(resolveGrid(config, realMap()).groups[0]?.summary).toBe('worst')
  })

  it('cai na omissão do grupo perante um resumo que não é dele', () => {
    // `odometer` é um resumo do grupo `trip`, não do `tires`. Escrito no
    // grupo errado não é erro fatal: mostra-se o resumo por omissão.
    const config: LeapmotorCardConfig = { ...CONFIG, grid: [{ group: 'tires', summary: 'odometer' }] }
    expect(resolveGrid(config, realMap()).groups[0]?.summary).toBe(GROUP_CATALOGUE.tires.summaries[0])
  })

  it('nomeia um grupo desconhecido em vez de o ignorar em silêncio', () => {
    const config = { ...CONFIG, grid: ['tires', 'radio'] } as unknown as LeapmotorCardConfig
    const { groups, unknown } = resolveGrid(config, realMap())
    expect(groups.map(g => g.id)).toEqual(['tires'])
    expect(unknown).toEqual(['radio'])
  })

  it('mostra um grupo repetido uma só vez', () => {
    const config: LeapmotorCardConfig = { ...CONFIG, grid: ['tires', 'tires'] }
    expect(resolveGrid(config, realMap()).groups).toHaveLength(1)
  })

  it('mantém um grupo sem entidades quando foi escrito à mão', () => {
    // Ao contrário da grelha por omissão: quem o escreveu quer saber que está
    // vazio, e o aviso de entidades em falta é que lho diz. Sumir com ele era
    // esconder um erro de configuração.
    const map = realMap()
    delete map.tireFL; delete map.tireFR; delete map.tireRL; delete map.tireRR
    expect(resolveGrid({ ...CONFIG, grid: ['tires'] }, map).groups.map(g => g.id)).toEqual(['tires'])
  })

  it('aceita uma grelha vazia como forma de esconder a grelha', () => {
    const { groups, explicit } = resolveGrid({ ...CONFIG, grid: [] }, realMap())
    expect(groups).toEqual([])
    expect(explicit).toBe(true)
  })
})

describe('catálogo', () => {
  it('a ordem por omissão nomeia todos os grupos do catálogo, e só uma vez', () => {
    expect([...GROUP_ORDER].sort()).toEqual(Object.keys(GROUP_CATALOGUE).sort())
    expect(new Set(GROUP_ORDER).size).toBe(GROUP_ORDER.length)
  })

  it('cada grupo tem pelo menos um resumo, um painel e uma chave', () => {
    for (const def of Object.values(GROUP_CATALOGUE)) {
      expect(def.summaries.length, def.id).toBeGreaterThan(0)
      expect(def.panels.length, def.id).toBeGreaterThan(0)
      expect(def.keys.length, def.id).toBeGreaterThan(0)
    }
  })

  it('o id de cada entrada bate com a chave que a indexa', () => {
    for (const [id, def] of Object.entries(GROUP_CATALOGUE)) expect(def.id).toBe(id)
  })
})

describe('missingForGroups', () => {
  it('só reporta as chaves que algum grupo da grelha pede', () => {
    const { groups } = resolveGrid({ ...CONFIG, grid: ['tires'] }, realMap())
    expect(missingForGroups(groups, ['tireFL', 'odometer'])).toEqual(['tireFL'])
  })

  it('devolve vazio quando a grelha não pede nada do que falta', () => {
    const { groups } = resolveGrid({ ...CONFIG, grid: ['tires'] }, realMap())
    expect(missingForGroups(groups, ['odometer'])).toEqual([])
  })
})

describe('summaryFor — carga', () => {
  it('mostra a percentagem de bateria por omissão', () => {
    expect(summaryFor(group('charging'), realState(), t, 'en')).toBe('60.3 %')
  })

  it('mostra o limite de carga', () => {
    expect(summaryFor(group('charging', 'limit'), realState(), t, 'en')).toBe(t('charging.limit', { percent: 80 }))
  })

  it('mostra a fase, e distingue sem cabo de a carregar', () => {
    expect(summaryFor(group('charging', 'phase'), realState(), t, 'en')).toBe(t('charging.unplugged'))
  })

  it('dá DASH no tempo restante quando não há carregamento em curso', () => {
    expect(summaryFor(group('charging', 'eta'), realState(), t, 'en')).toBe(DASH)
  })

  it('dá DASH na bateria quando nenhum sensor de bateria é válido', () => {
    const state = realState({ 'sensor/battery_percent': 'unavailable', 'sensor/battery_percent_precise': 'unavailable' })
    expect(summaryFor(group('charging'), state, t, 'en')).toBe(DASH)
  })
})

describe('summaryFor — estado', () => {
  it('mostra o estado das trancas por omissão', () => {
    expect(summaryFor(group('status'), realState(), t, 'en')).toBe(t('doors_locked'))
  })

  it('mostra tudo fechado quando não há aberturas', () => {
    expect(summaryFor(group('status', 'openings'), realState(), t, 'en')).toBe(t('openings.all_closed'))
  })

  it('conta as aberturas no singular e no plural', () => {
    const one = realState({ 'binary_sensor/trunk_open': 'on' })
    expect(summaryFor(group('status', 'openings'), one, t, 'en')).toBe(t('openings.open_one'))
    const two = realState({ 'binary_sensor/trunk_open': 'on', 'binary_sensor/skylight_open': 'on' })
    expect(summaryFor(group('status', 'openings'), two, t, 'en')).toBe(t('openings.open_count', { count: 2 }))
  })

  it('mostra a bagageira', () => {
    expect(summaryFor(group('status', 'trunk'), realState(), t, 'en')).toBe(t('openings.closed'))
    const open = realState({ 'binary_sensor/trunk_open': 'on' })
    expect(summaryFor(group('status', 'trunk'), open, t, 'en')).toBe(t('openings.open'))
  })
})

describe('summaryFor — clima, pneus, viagem e localização', () => {
  it('mostra a temperatura interior por omissão', () => {
    expect(summaryFor(group('climate'), realState(), t, 'en')).toMatch(/°C$/)
  })

  it('mostra a faixa de pressão dos pneus por omissão, do mais baixo ao mais alto', () => {
    const summary = summaryFor(group('tires'), realState(), t, 'en')
    expect(summary).toMatch(/^\d+\.\d – \d+\.\d bar$/)
  })

  it('mostra o pneu mais baixo com o seu canto no resumo `worst`', () => {
    const summary = summaryFor(group('tires', 'worst'), realState(), t, 'en')
    expect(summary).toContain('bar')
    expect(summary).toMatch(/(FL|FR|RL|RR)$/)
  })

  it('dá DASH nos pneus quando nenhum é válido', () => {
    const state = realState({
      'sensor/tire_pressure_front_left_bar': 'unavailable',
      'sensor/tire_pressure_front_right_bar': 'unavailable',
      'sensor/tire_pressure_rear_left_bar': 'unavailable',
      'sensor/tire_pressure_rear_right_bar': 'unavailable',
    })
    expect(summaryFor(group('tires'), state, t, 'en')).toBe(DASH)
    expect(summaryFor(group('tires', 'worst'), state, t, 'en')).toBe(DASH)
  })

  it('mostra o odómetro por omissão na viagem', () => {
    expect(summaryFor(group('trip'), realState(), t, 'en')).toMatch(/ km$/)
  })

  it('mostra a atividade por omissão na localização', () => {
    const summary = summaryFor(group('location'), realState(), t, 'en')
    expect(summary === DASH || summary.length > 0).toBe(true)
  })

  it('mostra a idade da posição, que nas fixtures está obsoleta', () => {
    expect(summaryFor(group('location', 'age'), realState(), t, 'en')).not.toBe(DASH)
  })
})

describe('summaryFor — o resumo desconhecido nunca chega aqui', () => {
  it('um resumo fora do grupo já foi trocado pela omissão em resolveGrid', () => {
    // A validação é do resolveGrid; este teste fixa o contrato entre os dois,
    // para ninguém acrescentar mais tarde um `default:` que devolva a chave.
    const g = group('tires', 'odometer')
    expect(g.summary).toBe('range')
    expect(summaryFor(g, realState(), t, 'en')).not.toBe('odometer')
  })
})
