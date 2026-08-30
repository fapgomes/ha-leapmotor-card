import { DASH, formatDuration, type TranslateFn } from './localize'

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
