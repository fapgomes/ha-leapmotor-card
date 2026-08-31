import { describe, expect, it } from 'vitest'
import readme from '../README.md?raw'
import { ENTITY_KEYS, SEAT_LEVEL_KEYS, isSeatLevelKey } from '../src/keys'

const VALID_DOMAINS = ['sensor', 'binary_sensor', 'lock', 'button', 'switch', 'number', 'image', 'device_tracker']

describe('ENTITY_KEYS', () => {
  it('every translation_key has the shape Home Assistant uses', () => {
    // The `toBeTruthy()` that used to be here could never fail: the object is
    // `as const`, so the type already guaranteed non-empty strings. This
    // catches what the type doesn't — uppercase letters, spaces, a domain
    // glued to the front, a `.`.
    for (const [key, def] of Object.entries(ENTITY_KEYS)) {
      expect(def.tk, key).toMatch(/^[a-z][a-z0-9_]*$/)
    }
  })

  it('the README catalog covers every entry, and states the right count', () => {
    // The README is the only documentation of the names that `entities:`
    // accepts. It has been a line and a count behind the code before, and
    // nobody noticed.
    for (const [key, def] of Object.entries(ENTITY_KEYS)) {
      expect(readme, key).toContain(`| \`${key}\` | ${def.domain} | \`${def.tk}\` |`)
    }
    const rows = readme.match(/^\| `[A-Za-z0-9]+` \| [a-z_]+ \| `[a-z0-9_]+` \|/gm) ?? []
    expect(rows).toHaveLength(Object.keys(ENTITY_KEYS).length)
    expect(readme).toContain(`all ${Object.keys(ENTITY_KEYS).length} logical names`)
  })

  it('only uses supported domains', () => {
    for (const [key, def] of Object.entries(ENTITY_KEYS)) {
      expect(VALID_DOMAINS, key).toContain(def.domain)
    }
  })

  it('has no duplicate domain/translation_key pairs', () => {
    const seen = new Map<string, string>()
    for (const [key, def] of Object.entries(ENTITY_KEYS)) {
      const id = `${def.domain}/${def.tk}`
      expect(seen.get(id), `${key} duplicates ${seen.get(id)}`).toBeUndefined()
      seen.set(id, key)
    }
  })

  it('the seat level keys exist and are number entities', () => {
    // The card stores the unconfirmed requests for these four and reads the
    // level reported by `state.comfort[key]`. A key with a wrong name would
    // still compile (it's a union of literals) and end up without an entity.
    for (const key of SEAT_LEVEL_KEYS) {
      expect(Object.keys(ENTITY_KEYS), key).toContain(key)
      expect(ENTITY_KEYS[key].domain, key).toBe('number')
      expect(isSeatLevelKey(key)).toBe(true)
    }
    expect(isSeatLevelKey('steeringWheelHeat')).toBe(false)
  })

  it('includes the keys the app requires', () => {
    for (const k of ['battery', 'rangeLive', 'lock', 'isCharging', 'chargeLimit', 'interiorTemp', 'trunk']) {
      expect(Object.keys(ENTITY_KEYS)).toContain(k)
    }
  })
})
