/**
 * Quanto tem de andar um dedo, na horizontal, para contar como intenção de
 * passar de sub-vista. Abaixo disto é o tremor de um toque.
 */
export const SWIPE_THRESHOLD_PX = 48

export type SwipeDecision = 'prev' | 'next' | 'none' | 'scroll'

/**
 * Decide o que fazer com um arrasto. Metade do conflito com o scroll vertical
 * do dashboard resolve-se em CSS, com `touch-action: pan-y` no contentor da
 * sub-vista; a outra metade é esta função.
 *
 * O empate entre eixos vai para `'scroll'` de propósito: perder um deslize é um
 * inconveniente, prender o scroll do dashboard é uma avaria.
 */
export function decideSwipe(dx: number, dy: number, threshold = SWIPE_THRESHOLD_PX): SwipeDecision {
  if (Math.abs(dy) >= Math.abs(dx) && dy !== 0) return 'scroll'
  if (Math.abs(dx) < threshold) return 'none'
  return dx > 0 ? 'prev' : 'next'
}
