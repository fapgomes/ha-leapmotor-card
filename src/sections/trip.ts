import { LitElement, css, html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { formatNumber, formatWeekRange } from '../format'
import { DASH, type TranslateFn } from '../localize'
import { sharedStyles } from '../theme'
import type { EnergySlice, VehicleState } from '../types'

interface Row {
  label: string
  value: string
}

/**
 * A heading and the rows it covers. This sub-view's rows used to mix things
 * of a different nature — kilometers driven and energy spent — and without
 * the split it was the reader who had to do it in their head.
 *
 * The optional `value` serves the energy heading, which carries the week's
 * total on the right. It sits in the heading and not in a row of its own
 * because the three slices below are parts of it: a closing "Total" row
 * repeated, as a sum, what the section title already names, and put the
 * number further from the parts that make it up. The other two headings have
 * no total because they don't have one: an odometer and an average don't add
 * up.
 *
 * The `unit` serves the weekly series heading, whose rows are bare numbers.
 * It occupies the same right side, but with its own styling: a total is a
 * value, a unit is the label of the column below it — and the heading goes
 * through `text-transform: uppercase`, which mangles a unit symbol's spelling
 * ("KWH/100 KM"). That's why it's a separate field and not text inside
 * `heading`: the uppercase comes from CSS and can't be switched off for part
 * of a text node.
 */
interface Section {
  heading: string
  value?: string
  unit?: string
  rows: Row[]
}

@customElement('leapmotor-trip')
export class LeapmotorTrip extends LitElement {
  @property({ attribute: false }) state!: VehicleState
  @property({ attribute: false }) t!: TranslateFn
  @property({ type: String }) language = 'en'

  /** The parts that exist, joined with the card's separator. No parts, DASH. */
  private joined(parts: string[]): string {
    return parts.length > 0 ? parts.join(' · ') : DASH
  }

  /**
   * The lifetime average and the total energy are the SAME fact stated twice:
   * the average is the total divided by the odometer (133.0 kWh / 679 km ×
   * 100 = 19.6 kWh/100 km, which is exactly what the card used to show on
   * both lines). They therefore live on a single line, with the numerator
   * next to the result.
   *
   * This is also what does away with the "(calculated)" qualifier the label
   * used to carry: it existed to warn that the number didn't come from the
   * car, and with the numerator visible the derivation speaks for itself.
   *
   * Additive, not "both or neither": in practice the average only exists if
   * the total exists — it's derived from it — but whoever reads the total
   * without an odometer reading still has a genuine value to show, and
   * hiding it would mean losing information.
   */
  private lifetimeValue(): string {
    const { lifetimeConsumption, totalEnergyKwh } = this.state.trip
    const parts: string[] = []
    if (lifetimeConsumption !== undefined) parts.push(`${formatNumber(lifetimeConsumption, 1)} kWh/100 km`)
    if (totalEnergyKwh !== undefined) parts.push(`${formatNumber(totalEnergyKwh, 1)} kWh`)
    return this.joined(parts)
  }

  /**
   * A slice of the week's energy: the kWh and the percentage, side by side.
   * The two numbers come from different places — the percentage is the
   * entity's `state`, the kWh is an attribute — and both are needed: the
   * percentage says the slice's weight without saying how much it is, and
   * the kWh says how much it is without saying whether that's a lot.
   */
  private sliceValue(slice: EnergySlice): string {
    const parts: string[] = []
    if (slice.kwh !== undefined) parts.push(`${formatNumber(slice.kwh, 1)} kWh`)
    if (slice.percent !== undefined) parts.push(`${formatNumber(slice.percent, 1)} %`)
    return this.joined(parts)
  }

  /**
   * The weekly series: one row per week, with the period as the label and
   * the consumption as the value.
   *
   * Unlike the other three, this block has no FIXED set of rows: its rows
   * are the data itself. That changes what to do when there's nothing — no
   * series, no block. A heading on its own, with no row underneath it, is
   * the orphan heading that the doctrine of always-visible rows exists to
   * avoid, and there's nowhere to write the dash: a row without a period
   * can't be labeled. In the other three blocks each row is a question the
   * card always knows how to ask, and the dash is a valid answer.
   *
   * The unit goes in the heading and not in each row: repeated six times it
   * was noise, and that's what the card already does at the tire corners,
   * where "bar" appears once per corner next to the number instead of being
   * spelled out. It sits aligned to the right, above the column of numbers
   * it labels.
   */
  private weeklySection(): Section | undefined {
    const weeks = this.state.trip.weeklyConsumption
    if (weeks.length === 0) return undefined

    return {
      heading: this.t('trip.heading_weekly'),
      unit: 'kWh/100 km',
      /*
       * Most recent to oldest, the opposite of the order the API returns
       * them in. The week that matters is the last one, and with the API's
       * order it ended up at the end, after every week the car didn't drive
       * — that was four dashes before the first number, on the real car.
       */
      rows: [...weeks].reverse().map(week => ({
        // The dash should never happen: the parser drops weeks whose dates
        // can't be read, precisely so that every row has a label. It stays
        // as a safety net, because it's the card's answer to "there's
        // nothing here".
        label: formatWeekRange(week.start, week.end, this.language) ?? DASH,
        // A week at zero is a week the car didn't drive, and that's what the
        // dash says. "0.0" would say it drove without spending anything.
        value: week.kwhPer100Km !== undefined ? formatNumber(week.kwhPer100Km, 1) : DASH,
      })),
    }
  }

  private sections(): Section[] {
    const trip = this.state.trip
    const energy = trip.weekEnergy
    const weekly = this.weeklySection()
    return [
      {
        heading: this.t('trip.heading_distance'),
        rows: [
          {
            label: this.t('trip.odometer'),
            value: trip.odometerKm !== undefined ? `${formatNumber(trip.odometerKm)} km` : DASH,
          },
          {
            label: this.t('trip.last7days'),
            value: trip.last7DaysKm !== undefined ? `${formatNumber(trip.last7DaysKm)} km` : DASH,
          },
        ],
      },
      {
        heading: this.t('trip.heading_consumption'),
        rows: [
          {
            label: this.t('trip.consumption'),
            value: trip.avgConsumption !== undefined ? `${formatNumber(trip.avgConsumption, 1)} kWh/100 km` : DASH,
          },
          { label: this.t('trip.lifetime'), value: this.lifetimeValue() },
        ],
      },
      {
        heading: this.t('trip.heading_week_energy'),
        value: energy.totalKwh !== undefined ? `${formatNumber(energy.totalKwh, 1)} kWh` : DASH,
        rows: [
          { label: this.t('trip.energy_driving'), value: this.sliceValue(energy.driving) },
          { label: this.t('trip.energy_climate'), value: this.sliceValue(energy.climate) },
          { label: this.t('trip.energy_other'), value: this.sliceValue(energy.other) },
        ],
      },
      // The series goes last: it's the most detailed and least urgent thing
      // in the sub-view, and it's six rows where the others are two or
      // three.
      ...(weekly ? [weekly] : []),
    ]
  }

  override render() {
    /*
     * Headings always appear, even with every row in DASH: the rows also
     * always appear — a missing value is written as DASH, not hidden — and
     * a heading exists to say what the rows below it are. Hiding it would
     * leave orphan rows, which is exactly the problem it solves.
     *
     * That also holds for the energy block, which on a car that doesn't
     * report the breakdown is four rows in a row of DASH. Hiding only this
     * block would make the sub-view two things at once: one that says what
     * it doesn't know and another that stays silent. And the argument for
     * hiding it — saving empty rows — holds exactly as well for the other
     * two, which the card has already decided to show. Whoever lacks these
     * entities is already warned by the missing-entities notice, and a
     * group with no entity resolved at all doesn't even reach the grid.
     *
     * The weekly series block is the only exception, and it is one because
     * it has no fixed rows: with no series there's no row at all to write
     * the dash on, and the rule ends up producing an orphan heading instead
     * of avoiding one. See `weeklySection`.
     */
    return html`<div class="panel">
      <div class="title">${this.t('trip.title')}</div>
      ${this.sections().map(section => html`
        <div class="heading muted">
          <span>${section.heading}</span>
          ${section.value !== undefined ? html`<span class="total">${section.value}</span>` : nothing}
          ${section.unit !== undefined ? html`<span class="unit">${section.unit}</span>` : nothing}
        </div>
        ${section.rows.map(row => html`
          <div class="line"><span class="muted">${row.label}</span><span>${row.value}</span></div>
        `)}
      `)}
    </div>`
  }

  static override styles = [sharedStyles, css`
    .title { font-size: 1.05rem; font-weight: 600; margin-bottom: 8px; }
    /*
     * The scale is that of the tire corner label (tires.ts): small,
     * uppercase and with the same amount of letter spacing. It's
     * deliberately not a new scale — a section heading and a value's label
     * are the same kind of secondary text, and the card already had one.
     *
     * The first heading carries no top margin: the .title above already has
     * its own, and the two added together opened a gap at the start of the
     * panel. The selector is the adjacent sibling and not a :first-of-type —
     * .title is also a div, so it is the panel's first div and
     * :first-of-type would never match any heading. The markers Lit leaves
     * between the two are comments, which don't count for adjacency.
     */
    .heading {
      display: flex; justify-content: space-between; gap: 12px; align-items: baseline;
      font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em;
      font-weight: 600; margin: 12px 0 2px;
    }
    .title + .heading { margin-top: 0; }
    /*
     * The total steps out of the scale of the heading that carries it: in
     * uppercase, small and dimmed, "10.8 kWh" read like a decoration on the
     * title and not like the number it actually is. It keeps the body size
     * and color of the value rows below, which is what it is — their sum.
     */
    .heading .total {
      font-size: 0.9rem; text-transform: none; letter-spacing: normal;
      font-weight: 600; color: var(--lm-text);
    }
    /*
     * The unit stays in the heading's scale — it's a label, not a value —
     * but without the uppercase, which mangles a unit symbol's spelling: kWh
     * is not KWH.
     * (No backticks in this area: this block is a CSS template literal.)
     */
    .heading .unit { text-transform: none; letter-spacing: normal; font-weight: 400; }
    .line { display: flex; justify-content: space-between; gap: 12px; padding: 5px 0; font-size: 0.9rem; }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-trip': LeapmotorTrip }
}
