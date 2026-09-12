import { describe, expect, it, vi } from 'vitest'
import { nothing } from 'lit'
import { resolveEntities } from '../src/resolver'
import { buildVehicleState } from '../src/vehicle-state'
import type { VehicleState } from '../src/types'
import { fakeHass } from './helpers/fake-hass'
import { EXPECTED_DAYS, REAL_NOW, REAL_SPECS, SEVEN_DAY_ATTRIBUTES } from './fixtures/real-states'

/**
 * The first test in this project that runs a section's real `render()`.
 *
 * Until it existed, `src/sections/trip.ts` was loaded by nothing: replacing a
 * method header in it with syntax garbage still left the suite reporting all
 * green, and three of the rules this sub-view exists to keep — the energy
 * disappearing when the API says it is incomplete, no per-day consumption
 * figure ever, and no block at all when the car does not send the data — were
 * guarded by `tsc` and by nothing else. Five separate mutations of the render
 * path survived a full run.
 *
 * The suite runs on `environment: 'node'`, and it stays there: what this file
 * does is replace `lit` with a stub through `vi.mock`, which is vitest's own
 * and needs no dependency and no DOM. `html` becomes a tag that keeps its
 * strings and values instead of building a template, `LitElement` becomes an
 * empty class, and the decorators become no-ops — so the component is an
 * ordinary object whose `render()` can be called and read. There is no
 * `document`, no `window` and no `customElements` anywhere in here, and
 * nothing about the browser is being tested: what is being tested is what the
 * card decides to write.
 */
vi.mock('lit', () => {
  const tag = (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })
  return { LitElement: class { }, html: tag, css: tag, svg: tag, nothing: { lit: 'nothing' } }
})
vi.mock('lit/decorators.js', () => ({
  customElement: () => (target: unknown) => target,
  property: () => () => undefined,
  state: () => () => undefined,
}))

// After the mock, so that the class it extends is the stub.
const { LeapmotorTrip } = await import('../src/sections/trip')

/** The nested templates the stub collects, flattened back into markup. */
function flatten(node: unknown): string {
  if (node === null || node === undefined || node === nothing) return ''
  if (Array.isArray(node)) return node.map(flatten).join('')
  if (typeof node === 'object' && 'strings' in (node as object)) {
    const { strings, values } = node as { strings: string[]; values: unknown[] }
    return strings.map((piece, i) => piece + (i < values.length ? flatten(values[i]) : '')).join('')
  }
  return String(node)
}

/**
 * The sub-view as rendered, from a fixture whose two seven-day sensors carry
 * the attributes given. `null` — and NOT `undefined`, which would only ask
 * for the default back — is an integration that publishes none.
 *
 * `t` returns the key itself, so the assertions below name keys and never
 * translated text: what belongs to a catalog is tested against the catalogs,
 * in `localize.test.ts`.
 */
function render(
  km: Record<string, unknown> | null = SEVEN_DAY_ATTRIBUTES,
  energy: Record<string, unknown> | null = km,
  mutate: (state: VehicleState) => void = () => undefined,
): string {
  const specs = REAL_SPECS.map(spec => {
    if (spec.key === 'sensor/last_7_days_mileage_km') return { ...spec, attributes: km ?? undefined }
    if (spec.key === 'sensor/last_7_days_energy_kwh') return { ...spec, attributes: energy ?? undefined }
    return spec
  })
  const hass = fakeHass(specs)
  const state = buildVehicleState(hass, resolveEntities(hass, { type: 'custom:leapmotor-card' }).map, REAL_NOW)
  mutate(state)

  const panel = new LeapmotorTrip()
  panel.state = state
  panel.t = (key: string) => key
  panel.language = 'en'
  return flatten(panel.render())
}

/** The text of each day row, tags stripped: `Aug 26 99 km · 14 kWh`. */
function dayRows(markup: string): string[] {
  return [...markup.matchAll(/<div class="day">([\s\S]*?)<\/div>/g)]
    .map(match => (match[1] ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim())
}

/**
 * The separator `Intl` puts between the ends of a range: a short dash between
 * two thin spaces, and not the hyphen-with-normal-spaces it looks like. Same
 * constant, and same reason, as in `format.test.ts`.
 */
const TO = '\u2009\u2013\u2009'

/** Each row's bar width, as the percentage written into its style attribute. */
function barWidths(markup: string): string[] {
  return [...markup.matchAll(/class="fill" style="width:([\d.]+)%"/g)].map(match => match[1] ?? '')
}

describe('leapmotor-trip — the per-day block', () => {
  it('draws one row per day, newest first, over the period the data covers', () => {
    const markup = render()
    expect(markup).toContain('trip.heading_daily')
    // The period is written from the data. Eight days, and the heading says
    // so by naming them, not by counting them.
    expect(markup).toContain(`<span class="unit">Aug 20${TO}27</span>`)
    expect(dayRows(markup)).toEqual([
      'Aug 27 0 km · 0 kWh',
      'Aug 26 99 km · 14 kWh',
      'Aug 25 133 km · 19 kWh',
      'Aug 24 47 km · 7 kWh',
      'Aug 23 120 km · 25 kWh',
      'Aug 22 88 km · 18 kWh',
      'Aug 21 95 km · 20 kWh',
      'Aug 20 60 km · 12 kWh',
    ])
  })

  it('writes the days on the same scale as the period above them', () => {
    // `Intl` pads a single date and does not pad the ends of a range, so this
    // block once read `Sep 4 – 11` over rows reading `Sep 04`.
    const markup = render({ ...SEVEN_DAY_ATTRIBUTES, daily_detail: [
      { date: '2026-08-01', mileage_km: 40.0, energy_kwh: 8.0 },
      { date: '2026-08-09', mileage_km: 20.0, energy_kwh: 4.0 },
    ] })
    expect(markup).toContain(`<span class="unit">Aug 1${TO}9</span>`)
    expect(dayRows(markup)).toEqual(['Aug 9 20 km · 4 kWh', 'Aug 1 40 km · 8 kWh'])
  })

  it('scales every bar to the longest day of the period', () => {
    // 133 km is the longest, 99 of it is 74.4%, and the day at zero draws
    // nothing. The bar says which days were the long ones; it is a comparison
    // inside the block and has no other ceiling.
    expect(barWidths(render())).toEqual(['0.0', '74.4', '100.0', '35.3', '90.2', '66.2', '71.4', '45.1'])
  })

  it('renders NOTHING when the integration does not publish the breakdown', () => {
    // Not an empty frame, not a heading with no rows, not a column of dashes.
    // This is what most cars out there will do.
    const markup = render(null)
    expect(markup).not.toContain('trip.heading_daily')
    expect(markup).not.toContain('class="day"')
    expect(dayRows(markup)).toEqual([])
    // And the rest of the sub-view is untouched by its absence.
    expect(markup).toContain('trip.heading_distance')
    expect(markup).toContain('trip.heading_weekly')
  })

  it('takes the energy off every row when the API says it is incomplete', () => {
    const markup = render({ ...SEVEN_DAY_ATTRIBUTES, energy_complete: false })
    const rows = dayRows(markup)
    expect(rows).toHaveLength(8)
    for (const row of rows) {
      expect(row, row).not.toContain('kWh')
      expect(row, row).toContain('km')
    }
    // Said once, where it belongs, instead of eight dashes saying it eight
    // times.
    expect(markup).toContain('trip.energy_incomplete')
  })

  it('does not say the energy is incomplete when it is not', () => {
    expect(render()).not.toContain('trip.energy_incomplete')
  })

  it('never writes a consumption figure for a single day', () => {
    // One kilowatt-hour of rounding on a short day moves kWh/100 km by tens
    // of units. The sub-view answers that question over six weeks, where the
    // rounding washes out, and never per day.
    for (const row of dayRows(render())) {
      expect(row, row).not.toContain('/100')
      expect(row, row).not.toContain('%')
    }
  })

  it('writes an absent reading as a dash and an empty bar, never as a zero', () => {
    const markup = render({ ...SEVEN_DAY_ATTRIBUTES, daily_detail: [
      { date: '2026-08-25', mileage_km: 133.0, energy_kwh: 19.0 },
      { date: '2026-08-26' },
      { date: '2026-08-27', mileage_km: '', energy_kwh: '' },
    ] })
    expect(dayRows(markup)).toEqual([
      'Aug 27 —',
      'Aug 26 —',
      'Aug 25 133 km · 19 kWh',
    ])
    expect(barWidths(markup)).toEqual(['0.0', '0.0', '100.0'])
  })

  it('survives a period in which nothing at all was driven', () => {
    // Every distance zero means the bar has no scale to divide by. Nothing
    // may become a NaN width, and the rows still have to say what they know.
    const markup = render({ ...SEVEN_DAY_ATTRIBUTES, daily_detail: [
      { date: '2026-08-26', mileage_km: 0.0, energy_kwh: 0.0 },
      { date: '2026-08-27', mileage_km: 0.0, energy_kwh: 0.0 },
    ] })
    expect(barWidths(markup)).toEqual(['0.0', '0.0'])
    expect(dayRows(markup)).toEqual(['Aug 27 0 km · 0 kWh', 'Aug 26 0 km · 0 kWh'])
  })

  it('labels the recent total without counting its days either', () => {
    // The row three lines above the block. It used to read "Last 7 days" over
    // a block drawing eight of them.
    const markup = render()
    expect(markup).toContain('trip.recent_days')
    expect(markup).not.toContain('trip.last7days')
  })

  it('holds together when the state carries a breakdown of a single day', () => {
    // `formatRange` collapses a range whose ends are equal, and a lone row
    // must not divide by a zero maximum either.
    const markup = render({ ...SEVEN_DAY_ATTRIBUTES, daily_detail: [
      { date: '2026-08-27', mileage_km: 12.0, energy_kwh: 2.0 },
    ] })
    expect(dayRows(markup)).toEqual(['Aug 27 12 km · 2 kWh'])
    expect(barWidths(markup)).toEqual(['100.0'])
  })

  it('writes a dash for a day the formatter cannot name', () => {
    // The parser makes this unreachable — it is the safety net, and it is
    // reached here only by putting a state together by hand.
    const markup = render(SEVEN_DAY_ATTRIBUTES, SEVEN_DAY_ATTRIBUTES, state => {
      state.trip.dailyBreakdown = {
        days: [{ date: 'nunca', distanceKm: 10 }],
        start: 'nunca',
        end: 'nunca',
        energyComplete: true,
      }
    })
    expect(dayRows(markup)).toEqual(['— 10 km'])
    // With no period to write, the heading carries the label alone.
    expect(markup).toContain('trip.heading_daily')
    expect(markup).not.toContain('class="unit">undefined')
  })

  it('the block is the last thing in the sub-view', () => {
    const markup = render()
    expect(markup.indexOf('trip.heading_daily')).toBeGreaterThan(markup.indexOf('trip.heading_weekly'))
  })

  it('the fixture the section renders is the one the parser was tested on', () => {
    // Ties this file to the other: if the fixture's days change, the row text
    // above is wrong and both files have to be looked at.
    expect(EXPECTED_DAYS.map(day => `${day.distanceKm} km`)).toEqual([
      '60 km', '95 km', '88 km', '120 km', '47 km', '133 km', '99 km', '0 km',
    ])
  })
})
