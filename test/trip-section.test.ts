import { describe, expect, it, vi } from 'vitest'
import { nothing } from 'lit'
import { resolveEntities } from '../src/resolver'
import { buildVehicleState } from '../src/vehicle-state'
import type { VehicleState } from '../src/types'
import { fakeHass } from './helpers/fake-hass'
import {
  EXPECTED_DAYS, REAL_NOW, REAL_SPECS, SEVEN_DAY_ATTRIBUTES, SEVEN_DAY_ATTRIBUTES_SCOPED,
} from './fixtures/real-states'

/**
 * The first test in this project that runs a section's real `render()`.
 *
 * Until it existed, `src/sections/trip.ts` was loaded by nothing: replacing a
 * method header in it with syntax garbage still left the suite reporting all
 * green, and three of the rules this sub-view exists to keep — no unexplained
 * energy on a day's row, no per-day consumption figure ever, and no block at
 * all when the car does not send the data — were guarded by `tsc` and by
 * nothing else.
 * Five separate mutations of the render path survived a full run.
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

/** The text of each day row, tags stripped: `Aug 26 99 km`. */
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
      'Aug 27 0 km',
      'Aug 26 99 km',
      'Aug 25 133 km',
      'Aug 24 47 km',
      'Aug 23 120 km',
      'Aug 22 88 km',
      'Aug 21 95 km',
      'Aug 20 60 km',
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
    expect(dayRows(markup)).toEqual(['Aug 9 20 km', 'Aug 1 40 km'])
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

  it('writes a day as its distance and NOTHING else, with no scope declared', () => {
    /*
     * This is the version the card's author is running — the seven-day
     * sensors publish `daily_detail` with an `energy_kwh` on every row and no
     * `energy_scope` anywhere. 0.4.9 printed that energy as `40 km · 5 kWh`
     * and 0.4.10 removed it: measured against the garage charger's meter over
     * 2026-09-04 to 2026-09-12 — 217 km, 21.0 kWh claimed, 53.56 kWh
     * delivered, the battery ending the window where it started — the field
     * was about half of what the car used, and nothing named the quantity.
     *
     * The quantity has a name now, but it is the INTEGRATION that has to give
     * it: on this payload the card is still silent, and that is what this
     * test pins. The fixture still SENDS the energy, byte for byte, so what
     * is asserted is the card dropping it and not the fixture lacking it. The
     * whole block is checked and not just the rows: a kWh anywhere under the
     * heading is one the reader would read as the day's.
     */
    const markup = render()
    const rows = dayRows(markup)
    expect(rows).toHaveLength(8)
    for (const row of rows) {
      expect(row, row).toContain('km')
      expect(row, row).not.toContain('kWh')
    }
    // The week's energy block, three headings up, is untouched by this and
    // keeps its own kWh — so the search is for the day rows' own markup.
    const block = markup.slice(markup.indexOf('trip.heading_daily'))
    expect(block).not.toContain('kWh')
    // And with no energy there is nothing to qualify, so neither label for
    // the scope is written either.
    expect(block).not.toContain('trip.daily_energy_driving')
  })

  it('shows no energy for a scope it cannot name', () => {
    // A later integration counting something this card has no wording for.
    // The rows carry their `driving_energy_kwh` and it stops at the parser:
    // an unknown scope is the situation 0.4.10 was released to avoid, so it
    // lands exactly where a missing one does.
    const markup = render({ ...SEVEN_DAY_ATTRIBUTES_SCOPED, energy_scope: 'battery_delta' })
    const block = markup.slice(markup.indexOf('trip.heading_daily'))
    expect(block).not.toContain('kWh')
    expect(block).not.toContain('trip.daily_energy_driving')
    expect(dayRows(markup)[1]).toBe('Aug 26 99 km')
  })

  it('shows no energy even when the API vouches for its completeness', () => {
    // `energy_complete` used to decide whether the kWh appeared. It is not
    // the gate any more — scope is — and a `true` must not bring the number
    // back on a payload that declares no scope.
    for (const flag of [true, false, undefined]) {
      const markup = render({ ...SEVEN_DAY_ATTRIBUTES, energy_complete: flag })
      const block = markup.slice(markup.indexOf('trip.heading_daily'))
      expect(block, String(flag)).not.toContain('kWh')
      expect(dayRows(markup)[0], String(flag)).toBe('Aug 27 0 km')
    }
  })

  it('writes the energy beside the distance once the scope is declared', () => {
    const markup = render(SEVEN_DAY_ATTRIBUTES_SCOPED)
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
    // The bars are the distances' and are unmoved by the second number.
    expect(barWidths(markup)).toEqual(['0.0', '74.4', '100.0', '35.3', '90.2', '66.2', '71.4', '45.1'])
  })

  it('qualifies the energy ONCE, under the heading and above the rows', () => {
    // Eight repetitions of the qualification would be noise the reader skips,
    // and a qualification that is skipped is one that was not made. It goes
    // between the heading and the first row, where the eye passes on the way
    // down.
    const markup = render(SEVEN_DAY_ATTRIBUTES_SCOPED)
    const note = 'trip.daily_energy_driving_presumed'
    expect(markup.split(note)).toHaveLength(2)
    expect(markup.indexOf(note)).toBeGreaterThan(markup.indexOf('trip.heading_daily'))
    expect(markup.indexOf(note)).toBeLessThan(markup.indexOf('class="day"'))
    // The hedged wording while the integration says the scope is unconfirmed,
    // and never both wordings at once.
    expect(markup).not.toContain('>trip.daily_energy_driving<')
    // Not on the rows: the qualification is the block's, not a day's.
    for (const row of dayRows(markup)) expect(row, row).not.toContain('trip.daily_energy')
  })

  it('drops the hedge when the integration confirms the scope', () => {
    // The one field changes and the wording follows, with no string edited
    // here, in the section or in either catalog.
    const markup = render({ ...SEVEN_DAY_ATTRIBUTES_SCOPED, energy_scope_confirmed: true })
    expect(markup).toContain('trip.daily_energy_driving<')
    expect(markup).not.toContain('trip.daily_energy_driving_presumed')
    expect(dayRows(markup)[1]).toBe('Aug 26 99 km · 14 kWh')
  })

  it('never writes a consumption figure for a single day', () => {
    /*
     * Two independent reasons, and the test covers the scoped rendering as
     * well as the bare one because the scoped one is where the temptation
     * lives: the energy excludes climate and accessories, so a per-day
     * kWh/100 km would understate the car by a margin known to exist and not
     * known in size; and one kilowatt-hour of rounding on a short day moves
     * the result by tens of units. The sub-view answers consumption over six
     * weeks, where both wash out.
     */
    for (const attributes of [SEVEN_DAY_ATTRIBUTES, SEVEN_DAY_ATTRIBUTES_SCOPED]) {
      for (const row of dayRows(render(attributes))) {
        expect(row, row).not.toContain('/100')
        expect(row, row).not.toContain('%')
      }
    }
  })

  it('writes no total of the day energies anywhere in the block', () => {
    // Summing them would produce a week's "consumption" that leaves out
    // climate and accessories — 53.1 kWh of real energy reported as 40.5 on
    // the week upstream measured. The block states days and states nothing
    // about them together; the heading's right side carries the period, which
    // is a label and not a number.
    const markup = render(SEVEN_DAY_ATTRIBUTES_SCOPED)
    const block = markup.slice(markup.indexOf('trip.heading_daily'))
    expect(block).not.toContain('class="total"')
    // 12 + 20 + 18 + 25 + 7 + 19 + 14 + 0 — the sum that must not appear.
    expect(block).not.toContain('115 kWh')
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
      'Aug 25 133 km',
    ])
    expect(barWidths(markup)).toEqual(['0.0', '0.0', '100.0'])
  })

  it('writes a scoped day that reported no distance as its energy alone', () => {
    // The parts that exist, joined; the parts that do not, left out. A dash
    // for the whole row would hide a reading the car did send, and a `0 km`
    // would invent one it did not.
    const markup = render({ ...SEVEN_DAY_ATTRIBUTES_SCOPED, daily_detail: [
      { date: '2026-08-25', mileage_km: 133.0, driving_energy_kwh: 19.0 },
      { date: '2026-08-26', driving_energy_kwh: 3.0 },
      { date: '2026-08-27', mileage_km: 12.0 },
      { date: '2026-08-28' },
    ] })
    expect(dayRows(markup)).toEqual([
      'Aug 28 —',
      'Aug 27 12 km',
      'Aug 26 3 kWh',
      'Aug 25 133 km · 19 kWh',
    ])
    // One reading of any kind is enough to keep the qualification honest.
    expect(markup).toContain('trip.daily_energy_driving_presumed')
  })

  it('survives a period in which nothing at all was driven', () => {
    // Every distance zero means the bar has no scale to divide by. Nothing
    // may become a NaN width, and the rows still have to say what they know.
    const markup = render({ ...SEVEN_DAY_ATTRIBUTES, daily_detail: [
      { date: '2026-08-26', mileage_km: 0.0, energy_kwh: 0.0 },
      { date: '2026-08-27', mileage_km: 0.0, energy_kwh: 0.0 },
    ] })
    expect(barWidths(markup)).toEqual(['0.0', '0.0'])
    expect(dayRows(markup)).toEqual(['Aug 27 0 km', 'Aug 26 0 km'])
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
    expect(dayRows(markup)).toEqual(['Aug 27 12 km'])
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
