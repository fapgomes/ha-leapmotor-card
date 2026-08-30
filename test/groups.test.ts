import { describe, expect, it } from 'vitest'
import { GROUP_CATALOGUE, GROUP_ORDER, missingForGroups, resolveGrid } from '../src/groups'
import { resolveEntities } from '../src/resolver'
import type { EntityMap, LeapmotorCardConfig } from '../src/types'
import { realHass } from './fixtures/real-states'

const CONFIG: LeapmotorCardConfig = { type: 'custom:leapmotor-card' }

/** O mapa de entidades do carro real das fixtures. */
function realMap(): EntityMap {
  return resolveEntities(realHass(), CONFIG).map
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
