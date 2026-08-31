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
 * O período de uma semana, escrito no idioma do card: `24 – 30 de ago.` em
 * português, `Aug 24 – 30` em inglês. Devolve `undefined` quando alguma das
 * datas não se lê, para que quem chama possa etiquetar sem período em vez de
 * escrever um `Invalid Date`.
 *
 * Duas escolhas que não são óbvias:
 *
 *  - **`formatRange`, e não duas datas coladas.** É ele que sabe colapsar o mês
 *    repetido — juntar `Intl.format()` de cada ponta dava `Aug 24 – Aug 30` em
 *    inglês e um mês a mais em português. As opções são as do `formatDayLabel`
 *    logo acima, dia e mês curto, para o card não inventar aqui uma escala de
 *    data que não usa em mais sítio nenhum.
 *  - **`timeZone: 'UTC'`.** A API manda dias de calendário (`2026-08-24`), que
 *    o `Date` lê como meia-noite UTC. Formatados no fuso do leitor, num fuso a
 *    ocidente de Greenwich passavam todos para o dia anterior — a semana de
 *    24–30 aparecia a alguém como 23–29.
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
 * Um vidro conta como aberto pelo `open` booleano ou por uma posição > 0.
 * Vive aqui (em vez de `vehicle-state.ts`) porque `src/sections/openings.ts`
 * não pode importar `vehicle-state.ts` — essa fronteira é o que garante que
 * nenhuma secção alcança o `hass`. `format.ts` é puro e já é importado
 * pelas secções, por isso serve de casa neutra para este predicado partilhado
 * também por `vehicle-state.ts` e `actions.ts`.
 */
export function isWindowOpen(w: { open?: boolean; position?: number }): boolean {
  return w.open === true || (w.position !== undefined && w.position > 0)
}

type Openings = VehicleState['openings']

/** Um vidro sem leitura nenhuma: nem o booleano de aberto, nem a posição. */
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
 * Verdadeiro quando o carro não reportou UMA ÚNICA abertura. Existe porque
 * `openCount` é um número e um zero não distingue «nada aberto» de «nada
 * sabido»: sem esta pergunta, um carro que não reportou nada afirmava «tudo
 * fechado», que é precisamente o que o card não pode saber. Ver spec §9.
 */
export function areOpeningsUnknown(o: Openings): boolean {
  return areDoorsUnknown(o.doors) && areWindowsUnknown(o.windows)
    && o.trunk === undefined && o.roof === undefined
}
