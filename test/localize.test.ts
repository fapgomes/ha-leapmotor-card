import { describe, expect, it } from 'vitest'
import { createTranslator, formatDuration, pickLanguage } from '../src/localize'
import en from '../src/translations/en.json'
import pt from '../src/translations/pt.json'

describe('pickLanguage', () => {
  it('config wins over hass\'s language', () => {
    expect(pickLanguage('pt', 'en')).toBe('pt')
  })
  it('uses hass\'s language when the config does not set one', () => {
    expect(pickLanguage(undefined, 'pt')).toBe('pt')
  })
  it('reduces a regional tag to the base language', () => {
    expect(pickLanguage(undefined, 'pt-PT')).toBe('pt')
  })
  it('falls back to English for a language without a catalog', () => {
    expect(pickLanguage(undefined, 'de')).toBe('en')
  })
  it('falls back to English with no information at all', () => {
    expect(pickLanguage(undefined, undefined)).toBe('en')
  })
})

describe('createTranslator', () => {
  it('translates to Portuguese', () => {
    expect(createTranslator('pt')('openings.all_closed')).toBe('Tudo fechado')
  })
  it('translates to English', () => {
    expect(createTranslator('en')('openings.all_closed')).toBe('All closed')
  })
  it('interpolates variables', () => {
    expect(createTranslator('pt')('charging.title', { percent: 60 })).toBe('Carregado a 60%')
  })
  it('leaves the placeholder literal when the variable is missing', () => {
    expect(createTranslator('pt')('charging.title')).toBe('Carregado a {percent}%')
  })
  it('returns the key itself when no catalog has a translation', () => {
    expect(createTranslator('pt')('nao.existe')).toBe('nao.existe')
  })
})

describe('formatDuration', () => {
  const pt = createTranslator('pt')
  const en = createTranslator('en')

  it('formats hours and minutes like the app does', () => {
    // 835 min = 13h 55min, the value from the screenshot
    expect(formatDuration(835, pt)).toBe('13h e 55min')
    expect(formatDuration(835, en)).toBe('13h 55min')
  })
  it('formats only hours when the minutes are zero', () => {
    expect(formatDuration(120, pt)).toBe('2h')
  })
  it('formats only minutes below one hour', () => {
    expect(formatDuration(45, pt)).toBe('45min')
  })
  it('formats zero as 0min', () => {
    expect(formatDuration(0, pt)).toBe('0min')
  })
})

/**
 * Flattens a catalog into complete dot-separated paths.
 *
 * Today's keys are already flat (`"comfort.mirrors"` is a single key, not two
 * levels), but the format Home Assistant uses is nested, and it takes only
 * someone nesting a branch for a top-level key comparison to start lying:
 * `comfort` would exist on both sides, and the absence of `comfort.mirrors` on
 * one of them would go unnoticed. That's why the whole tree is walked, and it
 * is the complete path that gets compared.
 */
function flattenKeys(node: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(node).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return value !== null && typeof value === 'object'
      ? flattenKeys(value as Record<string, unknown>, path)
      : [path]
  })
}

describe('translation catalogs', () => {
  /*
   * There was no test at all comparing the two catalogs. The 115 names
   * matched only because everyone who touched them was careful: a new key
   * written in only one of the files would still compile, still pass the
   * tests, and the user of the other language would see the English text —
   * or, if the key was missing from `en` too, would see the key itself,
   * because that's what `createTranslator` returns when neither the primary
   * catalog nor the fallback one has it.
   */
  it('pt and en have exactly the same keys', () => {
    const ptKeys = new Set(flattenKeys(pt))
    const enKeys = new Set(flattenKeys(en))
    const missingInEn = [...ptKeys].filter(key => !enKeys.has(key)).sort()
    const missingInPt = [...enKeys].filter(key => !ptKeys.has(key)).sort()
    // The message NAMES the missing keys on each side. Whoever breaks parity
    // needs to know which ones, not just that the counts don't match.
    expect({ missingInEn, missingInPt }, [
      `missing from en.json: ${missingInEn.join(', ') || '(none)'}`,
      `missing from pt.json: ${missingInPt.join(', ') || '(none)'}`,
    ].join('\n')).toEqual({ missingInEn: [], missingInPt: [] })
  })

  /*
   * Two empty catalogs have the same keys — none — and would pass the test
   * above without saying anything. This one closes that gap.
   */
  it('neither catalog is empty', () => {
    expect(flattenKeys(pt).length).toBeGreaterThan(0)
    expect(flattenKeys(en).length).toBe(flattenKeys(pt).length)
  })
})
