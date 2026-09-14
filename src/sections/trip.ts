import { LitElement, css, html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { formatCalendarDay, formatDayRange, formatNumber } from '../format'
import { DASH, type TranslateFn } from '../localize'
import { sharedStyles } from '../theme'
import type { DailyEnergy, EnergyScope, EnergySlice, TripDay, VehicleState } from '../types'

interface Row {
  label: string
  value: string
}

/**
 * The catalog key for each energy scope, in both of its wordings.
 *
 * A table rather than a conditional expression, and a pair rather than a
 * single key with a suffix bolted on, because the choice between them is data
 * the integration sends: `energy_scope_confirmed` is false today and the card
 * must stop hedging on the day it is true WITHOUT anyone editing a sentence.
 * A scope added here without both of its labels does not compile, which is
 * the only enforcement that survives the person who wrote this leaving.
 *
 * Exported for the tests alone, and for one specific hole: the confirmed
 * wording is the branch that fires the day upstream flips the flag, so it is
 * the branch nobody will notice is broken. `tsc` cannot check a catalog key,
 * the parity test only compares the two catalogs against each other, and the
 * section's own tests stub the translator to the identity — so a key renamed
 * in BOTH catalogs left the whole suite green while every dashboard would
 * have printed the literal `trip.daily_energy_driving`. The test that
 * resolves every entry below against the real catalogs is what closes that,
 * and it needs this table to be reachable.
 */
export const SCOPE_KEYS: Record<EnergyScope, { confirmed: string; presumed: string }> = {
  driving: {
    confirmed: 'trip.daily_energy_driving',
    presumed: 'trip.daily_energy_driving_presumed',
  },
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
        label: formatDayRange(week.start, week.end, this.language) ?? DASH,
        // A week at zero is a week the car didn't drive, and that's what the
        // dash says. "0.0" would say it drove without spending anything.
        value: week.kwhPer100Km !== undefined ? formatNumber(week.kwhPer100Km, 1) : DASH,
      })),
    }
  }

  /**
   * One day's readings, written on the right of its bar: `39 km · 3 kWh`.
   * What the car did not report is left out, and a day that reported neither
   * gets the card's dash — which is what "not known" looks like everywhere
   * else in this sub-view.
   *
   * **Whether there is an energy at all is not this method's decision.**
   * 0.4.10 took the per-day energy off the screen because it disagreed with a
   * charger's meter by roughly a factor of two and nothing said what it
   * counted; it is back because integration v0.7.2 says what it presumes the
   * number to be, and `vehicle-state.ts` puts an `energyKwh` on a `TripDay`
   * only for a presumption this card knows how to state. On an integration
   * that says nothing there is no field here to print, exactly as there was
   * not between 0.4.10 and now, and this method needs no flag to check for
   * that.
   *
   * Whole kilowatt-hours, because whole kilowatt-hours are what the API
   * sends: a `.0` after every one of them would be a precision the source
   * does not have.
   *
   * **No kWh/100 km per day, and these figures are never summed into any
   * consumption the card shows.** Two reasons, either of them sufficient. The
   * card does not know what this energy counts — the integration's own
   * reading of it leaves out climate and accessories, and that reading is
   * unconfirmed by upstream and unclosed by our own measurements — so a
   * quotient built from it would be a consumption figure with no defensible
   * meaning, low by an amount known to exist and not known in size. And one
   * kilowatt-hour of rounding on an eleven-kilometer day moves a kWh/100 km
   * result by nine units, so it would look like a measurement and be noise.
   * Consumption is a question the weekly series above already answers, over
   * periods where both problems wash out.
   */
  private dayValue(day: TripDay): string {
    const parts: string[] = []
    if (day.distanceKm !== undefined) parts.push(`${formatNumber(day.distanceKm)} km`)
    if (day.energyKwh !== undefined) parts.push(`${formatNumber(day.energyKwh)} kWh`)
    return this.joined(parts)
  }

  /**
   * The one line that says what the energy on these rows counts.
   *
   * **Once, under the heading, and not on the rows.** It is a property of the
   * source and not of any day, so eight repetitions of it would be noise the
   * reader learns to skip past — and a qualification that is skipped is a
   * qualification that is not made. It sits below the heading rather than
   * beside it because the heading's right-hand slot already carries the
   * period, and because this is a sentence: the `unit` slot is sized for a
   * label and a sentence in it would not read as one.
   *
   * The wording comes from `SCOPE_KEYS` indexed by the scope and chosen by
   * `confirmed`, which is the integration's own flag. While it is false the
   * label says the scope is presumed; the day it turns true the hedge is gone
   * with nothing edited here or in either catalog.
   */
  private scopeNote(energy: DailyEnergy) {
    const keys = SCOPE_KEYS[energy.scope]
    return html`<div class="scope muted">${this.t(energy.confirmed ? keys.confirmed : keys.presumed)}</div>`
  }

  /**
   * A day's row: the date, a bar, and the distance.
   *
   * The bar is scaled to the LARGEST distance in the period and not to a
   * fixed ceiling, because there is no meaningful ceiling for a day's
   * driving — the point of the bar is which days were the long ones, which
   * is a comparison inside the block. A day with no distance reported gets a
   * bar of zero and a dash: zero width here means "nothing to draw", and the
   * text next to it is what says so — the bar never speaks on its own, which
   * is also why it is hidden from assistive technology.
   */
  private dayRow(day: TripDay, maxKm: number) {
    const km = day.distanceKm
    // One decimal is plenty for a width in percent, and it keeps a
    // 93.33333333333333% out of the DOM of every row.
    const width = (maxKm > 0 && km !== undefined ? (km / maxKm) * 100 : 0).toFixed(1)
    return html`<div class="day">
      <span class="muted">${formatCalendarDay(day.date, this.language) ?? DASH}</span>
      <span class="bar" aria-hidden="true"><span class="fill" style="width:${width}%"></span></span>
      <span class="value">${this.dayValue(day)}</span>
    </div>`
  }

  /**
   * The per-day breakdown, or nothing at all.
   *
   * **The heading never names a number of days.** The sensors behind this
   * are called "last 7 days" and the API answered with eight, so the block
   * is titled by what it is — one line per day — and the period it covers is
   * written out beside it, from the first and last day actually in hand. A
   * heading that said seven above eight rows would be the card lying about
   * data it is displaying.
   *
   * The period sits in the `unit` slot of the heading, not the `total` one:
   * it is what the column below is, not a sum of it — and that slot is the
   * one that does not go through `text-transform: uppercase`, which would
   * otherwise mangle the month's abbreviation.
   *
   * Under the heading, and only when the rows carry an energy, comes the one
   * line that says what that energy counts — see `scopeNote`. The rows
   * themselves stay bare numbers; the qualification is made once, where it
   * cannot be missed on the way down to them.
   *
   * Rendered by hand instead of through `sections()` for the one reason its
   * `Row` cannot express: the bar. Same headings and the same spacing, so it
   * reads as another block of the same sub-view.
   *
   * Absent data, absent block — the rule the weekly series already follows,
   * and for the same reason: these rows ARE the data, so with no data there
   * is no row to write a dash on, and all that would be left is an orphan
   * heading. Most cars out there run an integration that never sends this.
   */
  private dailyBlock() {
    const daily = this.state.trip.dailyBreakdown
    if (!daily) return nothing

    const maxKm = Math.max(0, ...daily.days.map(day => day.distanceKm ?? 0))
    const period = formatDayRange(daily.start, daily.end, this.language)
    // Most recent first, like the weekly series right above it: the day the
    // reader came to look at is the last one, and it should not be at the
    // bottom of eight rows.
    const newestFirst = [...daily.days].reverse()
    return html`
      <div class="heading muted">
        <span>${this.t('trip.heading_daily')}</span>
        ${period !== undefined ? html`<span class="unit">${period}</span>` : nothing}
      </div>
      ${daily.energy !== undefined ? this.scopeNote(daily.energy) : nothing}
      ${newestFirst.map(day => this.dayRow(day, maxKm))}
    `
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
            /*
             * NOT "last 7 days", which is what this row said until the block
             * below started drawing the days it actually covers: on the car
             * this was built against the sensor answered with eight of them,
             * and the row sat three lines above eight bars adding up to
             * exactly the number beside it. The sensor's own name in Home
             * Assistant is upstream's and stays as it is; what the card
             * prints is the card's, and it now names the period the only way
             * it honestly can from a bare total — as the recent one.
             */
            label: this.t('trip.recent_days'),
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
      ${this.dailyBlock()}
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
    /*
     * A day's row is a grid and not a flex like .line because of the middle
     * column: the date and the numbers have to take exactly the width of
     * their text — otherwise the bars start and end at a different place on
     * every row and stop being comparable, which is the only thing they are
     * for — and it is the bar that absorbs whatever is left over. The
     * minmax() is what lets it shrink on a phone instead of pushing the
     * numbers out of the panel; below its floor it would be honester to have
     * no bar than a stub, but it never gets there inside a card.
     */
    .day {
      display: grid; grid-template-columns: auto minmax(32px, 1fr) auto;
      align-items: center; gap: 10px; padding: 4px 0; font-size: 0.9rem;
    }
    /*
     * Tabular figures: without them a column of proportional digits wanders,
     * and this block is eight rows of numbers meant to be read down.
     */
    .day .value { text-align: end; font-variant-numeric: tabular-nums; }
    /*
     * The scope line under the per-day heading. Muted and below the size of a
     * row, because it is not one of the numbers — but it is a sentence and it
     * wraps on a phone, so it takes a line-height and a margin instead of the
     * heading's uppercase and letter spacing, which are for labels of two or
     * three words and turn a wrapped sentence into a ransom note.
     */
    .scope { font-size: 0.72rem; line-height: 1.35; margin: 0 0 4px; }
    /*
     * The same fully round ends as the battery bar in hero.ts — one bar
     * idiom in the card, not two — but NOT its --lm-chip track. That bar
     * sits on the card; this one sits inside a .panel, which is itself
     * --lm-chip, and the only reason the two do not cancel out today is that
     * the token's default value happens to be translucent. A user who points
     * --leapmotor-chip at an opaque color would lose the track entirely and
     * have no way to know why.
     *
     * So the track mixes its own tint out of the text color, which no token
     * can flatten and which follows a light or a dark theme without being
     * told. The flat gray on the line before is the fallback for a renderer
     * without color-mix: same weight, just not theme-aware.
     */
    .bar {
      height: 6px; border-radius: 999px; overflow: hidden;
      background: rgba(127, 127, 127, 0.25);
      background: color-mix(in srgb, currentColor 15%, transparent);
    }
    /*
     * The fill is the muted text color, which is a token the theme already
     * defines and the reader already reads as secondary. A bar of days is
     * not a warning and not a battery, and it must not out-shout the numbers
     * beside it.
     */
    .bar .fill { display: block; height: 100%; border-radius: 999px; background: var(--lm-muted); }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-trip': LeapmotorTrip }
}
