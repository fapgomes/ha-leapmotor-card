import { DASH, formatDuration, type TranslateFn } from './localize'
import type { VehicleState } from './types'

export function formatTimeOfDay(d: Date, language: string): string {
  return new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function formatDayLabel(d: Date, now: Date, t: TranslateFn, language: string): string {
  if (sameDay(d, now)) return t('today')
  const yesterday = new Date(now.getTime() - 86_400_000)
  if (sameDay(d, yesterday)) return t('yesterday')
  return new Intl.DateTimeFormat(language, { day: '2-digit', month: 'short' }).format(d)
}

/**
 * A week's period, written in the card's language: `24 – 30 de ago.` in
 * Portuguese, `Aug 24 – 30` in English. Returns `undefined` when either of
 * the dates does not read, so the caller can label it as having no period
 * instead of writing an `Invalid Date`.
 *
 * Two choices that are not obvious:
 *
 *  - **`formatRange`, and not two dates glued together.** It is the one that
 *    knows how to collapse the repeated month — joining `Intl.format()` from
 *    each end gave `Aug 24 – Aug 30` in English and an extra month in
 *    Portuguese. The options are the same as `formatDayLabel` right above,
 *    day and short month, so the card does not invent a date scale here that
 *    it does not use anywhere else.
 *  - **`timeZone: 'UTC'`.** The API sends calendar days (`2026-08-24`), which
 *    `Date` reads as midnight UTC. Formatted in the reader's timezone, in a
 *    timezone west of Greenwich they would all move to the previous day —
 *    the week of 24–30 would show up to someone as 23–29.
 */
export function formatWeekRange(start: string, end: string, language: string): string | undefined {
  const from = new Date(start)
  const to = new Date(end)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return undefined
  return new Intl.DateTimeFormat(language, { day: '2-digit', month: 'short', timeZone: 'UTC' })
    .formatRange(from, to)
}

export function formatUpdated(d: Date | undefined, now: Date, t: TranslateFn, language: string): string {
  if (!d) return DASH
  return t('updated', { time: `${formatTimeOfDay(d, language)} ${formatDayLabel(d, now, t, language)}` })
}

export function formatAgo(seconds: number, t: TranslateFn): string {
  return t('stale_since', { ago: formatDuration(seconds / 60, t) })
}

export function formatNumber(n: number | undefined, digits = 0): string {
  if (n === undefined || !Number.isFinite(n)) return DASH
  return n.toFixed(digits)
}

/**
 * A window counts as open by the boolean `open` or by a position > 0. Lives
 * here (instead of in `vehicle-state.ts`) because `src/sections/openings.ts`
 * cannot import `vehicle-state.ts` — that boundary is what guarantees no
 * section reaches `hass`. `format.ts` is pure and is already imported by the
 * sections, so it serves as neutral ground for this predicate, also shared
 * by `vehicle-state.ts` and `actions.ts`.
 */
export function isWindowOpen(w: { open?: boolean; position?: number }): boolean {
  return w.open === true || (w.position !== undefined && w.position > 0)
}

type Openings = VehicleState['openings']

/** A window with no reading at all: neither the open boolean nor the position. */
function isWindowUnknown(w: Openings['windows'][keyof Openings['windows']]): boolean {
  return w.open === undefined && w.position === undefined
}

export function areWindowsUnknown(windows: Openings['windows']): boolean {
  return Object.values(windows).every(isWindowUnknown)
}

export function areDoorsUnknown(doors: Openings['doors']): boolean {
  return Object.values(doors).every(value => value === undefined)
}

/**
 * True when the car has not reported A SINGLE opening. Exists because
 * `openCount` is a number and a zero does not distinguish "nothing open"
 * from "nothing known": without this question, a car that reported nothing
 * would assert "everything closed", which is exactly what the card cannot
 * know. See spec §9.
 */
export function areOpeningsUnknown(o: Openings): boolean {
  return areDoorsUnknown(o.doors) && areWindowsUnknown(o.windows)
    && o.trunk === undefined && o.roof === undefined
}
