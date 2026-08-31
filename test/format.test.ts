import { describe, expect, it } from 'vitest'
import {
  areDoorsUnknown, areOpeningsUnknown, areWindowsUnknown, formatAgo, formatNumber, formatUpdated,
  formatWeekRange,
} from '../src/format'
import { createTranslator } from '../src/localize'

const pt = createTranslator('pt')
const NOW = new Date('2026-08-27T19:50:00+00:00')

describe('formatUpdated', () => {
  it('shows the time and "Hoje" for the same day', () => {
    expect(formatUpdated(new Date('2026-08-27T19:49:00+00:00'), NOW, pt, 'pt'))
      .toBe('Atualização do estado 19:49 Hoje')
  })
  it('shows "Ontem" for the previous day', () => {
    expect(formatUpdated(new Date('2026-08-26T08:05:00+00:00'), NOW, pt, 'pt'))
      .toBe('Atualização do estado 08:05 Ontem')
  })
  it('shows the date for older days', () => {
    expect(formatUpdated(new Date('2026-08-20T08:05:00+00:00'), NOW, pt, 'pt'))
      .toContain('08:05')
  })
  it('returns a dash when there is no date', () => {
    expect(formatUpdated(undefined, NOW, pt, 'pt')).toBe('—')
  })
})

describe('formatAgo', () => {
  it('formats seconds as hours and minutes', () => {
    // 11930 s = 198.83 min, which formatDuration rounds to 199 = 3h 19min
    expect(formatAgo(11930, pt)).toBe('há 3h e 19min')
  })
  it('formats less than an hour', () => {
    expect(formatAgo(300, pt)).toBe('há 5min')
  })
})

describe('formatNumber', () => {
  it('returns a dash for undefined', () => {
    expect(formatNumber(undefined)).toBe('—')
  })
  it('rounds to an integer by default', () => {
    expect(formatNumber(60.3)).toBe('60')
  })
  it('respects the requested decimal places', () => {
    expect(formatNumber(2.174, 2)).toBe('2.17')
  })
})

describe('areOpeningsUnknown', () => {
  const closed = {
    doors: { driver: false, passenger: false, rearLeft: false, rearRight: false },
    windows: { fl: { open: false }, fr: { open: false }, rl: { open: false }, rr: { open: false } },
    trunk: false,
    roof: false,
    openCount: 0,
  }
  const nothing = {
    doors: { driver: undefined, passenger: undefined, rearLeft: undefined, rearRight: undefined },
    windows: { fl: {}, fr: {}, rl: {}, rr: {} },
    trunk: undefined,
    roof: undefined,
    openCount: 0,
  }

  it('a car that reported everything closed is known', () => {
    expect(areOpeningsUnknown(closed)).toBe(false)
    expect(areDoorsUnknown(closed.doors)).toBe(false)
    expect(areWindowsUnknown(closed.windows)).toBe(false)
  })

  it('a car that reported nothing is unknown', () => {
    expect(areOpeningsUnknown(nothing)).toBe(true)
    expect(areDoorsUnknown(nothing.doors)).toBe(true)
    expect(areWindowsUnknown(nothing.windows)).toBe(true)
  })

  it('a single reading is enough to stop being unknown', () => {
    expect(areOpeningsUnknown({ ...nothing, roof: false })).toBe(false)
    // The window position counts as a reading, even without the open boolean.
    expect(areWindowsUnknown({ ...nothing.windows, fl: { position: 0 } })).toBe(false)
  })
})

describe('formatWeekRange', () => {
  /*
   * The separator that `Intl` puts between the two ends of a range is NOT a
   * hyphen between spaces: it's a short dash (U+2013) between two thin spaces
   * (U+2009). Written by hand, the test failed with two visually identical
   * strings, and written as escapes the reason is immediately visible.
   */
  const TO = '\u2009\u2013\u2009'

  it('collapses the repeated month in Portuguese', () => {
    // `formatRange` is what knows how to do this: two dates formatted
    // separately and glued together gave "24 de ago. – 30 de ago.", with an
    // extra month.
    expect(formatWeekRange('2026-08-24', '2026-08-30', 'pt')).toBe(`24${TO}30 de ago.`)
  })

  it('collapses the repeated month in English, in the language\'s own order', () => {
    expect(formatWeekRange('2026-08-24', '2026-08-30', 'en')).toBe(`Aug 24${TO}30`)
  })

  it('writes both months when the week spans them', () => {
    expect(formatWeekRange('2026-07-27', '2026-08-02', 'pt')).toBe(`27 de jul.${TO}2 de ago.`)
  })

  it('names the days the API sent, without rolling them back', () => {
    /*
     * There is no test that forces a timezone mid-process — `npm test` pins
     * `TZ=UTC` and `Intl` keeps the resolved timezone — so what is verified
     * here is the consequence: day 1 shows up as 1. In a timezone west of
     * Greenwich, and without the `timeZone: 'UTC'` in `formatWeekRange`, the
     * UTC midnight that `Date` derives from `2026-08-01` would roll back to
     * July 31, and the whole week would show up shifted by one day.
     */
    expect(formatWeekRange('2026-08-01', '2026-08-07', 'pt')).toBe(`1${TO}7 de ago.`)
  })

  it('returns undefined when one of the dates cannot be parsed', () => {
    // The caller labels it with no period instead of writing "Invalid Date".
    expect(formatWeekRange('semana', '2026-08-30', 'pt')).toBeUndefined()
    expect(formatWeekRange('2026-08-24', '', 'pt')).toBeUndefined()
  })
})
