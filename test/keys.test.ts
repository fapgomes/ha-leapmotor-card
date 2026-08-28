import { describe, expect, it } from 'vitest'
import readme from '../README.md?raw'
import { ENTITY_KEYS, SEAT_LEVEL_KEYS, isSeatLevelKey } from '../src/keys'

const VALID_DOMAINS = ['sensor', 'binary_sensor', 'lock', 'button', 'switch', 'number', 'image', 'device_tracker']

describe('ENTITY_KEYS', () => {
  it('todos os translation_key têm a forma que o Home Assistant usa', () => {
    // O `toBeTruthy()` que aqui estava não podia falhar: o objeto é `as const`,
    // portanto o tipo já garantia strings não vazias. Isto apanha o que o tipo
    // não apanha — maiúsculas, espaços, um domínio colado à frente, um `.`.
    for (const [key, def] of Object.entries(ENTITY_KEYS)) {
      expect(def.tk, key).toMatch(/^[a-z][a-z0-9_]*$/)
    }
  })

  it('o catálogo do README cobre todas as entradas, e diz o número certo', () => {
    // O README é a única documentação dos nomes que o `entities:` aceita. Já
    // esteve uma linha e uma contagem atrás do código, e ninguém deu por isso.
    for (const [key, def] of Object.entries(ENTITY_KEYS)) {
      expect(readme, key).toContain(`| \`${key}\` | ${def.domain} | \`${def.tk}\` |`)
    }
    const rows = readme.match(/^\| `[A-Za-z0-9]+` \| [a-z_]+ \| `[a-z0-9_]+` \|/gm) ?? []
    expect(rows).toHaveLength(Object.keys(ENTITY_KEYS).length)
    expect(readme).toContain(`all ${Object.keys(ENTITY_KEYS).length} logical names`)
  })

  it('só usa domínios suportados', () => {
    for (const [key, def] of Object.entries(ENTITY_KEYS)) {
      expect(VALID_DOMAINS, key).toContain(def.domain)
    }
  })

  it('não tem pares domínio/translation_key duplicados', () => {
    const seen = new Map<string, string>()
    for (const [key, def] of Object.entries(ENTITY_KEYS)) {
      const id = `${def.domain}/${def.tk}`
      expect(seen.get(id), `${key} duplica ${seen.get(id)}`).toBeUndefined()
      seen.set(id, key)
    }
  })

  it('as chaves de nível de assento existem e são entidades number', () => {
    // O card guarda os pedidos por confirmar destas quatro e lê o nível
    // reportado por `state.comfort[chave]`. Uma chave com um nome errado
    // compilava na mesma (é uma união de literais) e ficava sem entidade.
    for (const key of SEAT_LEVEL_KEYS) {
      expect(Object.keys(ENTITY_KEYS), key).toContain(key)
      expect(ENTITY_KEYS[key].domain, key).toBe('number')
      expect(isSeatLevelKey(key)).toBe(true)
    }
    expect(isSeatLevelKey('steeringWheelHeat')).toBe(false)
  })

  it('inclui as chaves que a app exige', () => {
    for (const k of ['battery', 'rangeLive', 'lock', 'isCharging', 'chargeLimit', 'interiorTemp', 'trunk']) {
      expect(Object.keys(ENTITY_KEYS)).toContain(k)
    }
  })
})
