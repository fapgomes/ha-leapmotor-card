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

/**
 * A classe que marca uma subárvore que trata dos seus próprios gestos: quem a
 * leva fica de fora do deslize entre sub-vistas. Vive aqui, e não escrita à mão
 * nos dois lados, porque é um contrato entre dois ficheiros —
 * `sections/location.ts` põe-na no contentor do mapa e o
 * `INTERACTIVE_SELECTOR` daqui procura-a. Duas cópias do literal divergiam um
 * dia em silêncio, e o sintoma seria o mapa a roubar outra vez o deslize.
 */
export const GESTURE_OWNER_CLASS = 'lm-owns-gesture'

/**
 * Onde um arrasto NÃO é um deslize.
 *
 *  - Os sliders (limite de carga, ventoinha) vivem dentro do slot da sub-vista
 *    e um arrasto horizontal do polegar é, pixel a pixel, indistinguível de um
 *    deslize — o card saltava de grupo a meio do gesto.
 *  - Os botões da barra entram na mesma lista: antes só escapavam por o limiar
 *    de 48px ser maior que os seus 34px de largura, o que era coincidência e
 *    não regra.
 *  - O mapa do Home Assistant entra pela classe, e não pelo nome da tag: o
 *    Leaflet instala o arrasto em `touchstart`/`mousedown` (verificado no
 *    Draggable.js da 1.9.4; o atalho por pointer events só entra quando o
 *    browser não tem touch events nativos, ou seja nunca num telefone), por
 *    isso nada do que ele faz — nem o `stopPropagation` que lá tem — alcança
 *    o nosso `pointerdown`, e nenhum elemento seu casa com os seletores acima.
 *    Marcar pela `GESTURE_OWNER_CLASS`, que é nossa, em vez de por
 *    `hui-map-card` ou `.leaflet-container`, sobrevive a o HA trocar de card ou
 *    de biblioteca de mapas.
 *
 * Quem acrescentar aqui uma entrada nova: os controlos das secções chegam por
 * `<slot>`, do DOM claro do card, por isso a procura tem de ser no
 * `composedPath()` do evento e não no `e.target`.
 */
export const INTERACTIVE_SELECTOR = [
  'input', 'button', 'ha-icon-button', 'a',
  '[role="slider"]', '[role="button"]',
  '.' + GESTURE_OWNER_CLASS,
].join(', ')
