import { describe, expect, it } from 'vitest'
import { SWIPE_THRESHOLD_PX, decideSwipe } from '../src/swipe'

/**
 * A decisão do gesto vive numa função pura pela mesma razão do `decideAction`
 * e do `mapRequestChanged`: é aqui que está o que pode estar errado. A cola no
 * DOM — três listeners de pointer que chamam esta função — fica sem teste, e
 * de propósito: este projeto corre os testes em `environment: 'node'` e um
 * jsdom que não faz scroll não afirmaria nada sobre o conflito com o scroll do
 * dashboard, que é o único risco real do gesto.
 */
describe('decideSwipe', () => {
  it('entrega o gesto ao dashboard quando o dedo vai mais para baixo que para o lado', () => {
    expect(decideSwipe(20, 60)).toBe('scroll')
    expect(decideSwipe(-20, -60)).toBe('scroll')
  })

  it('entrega ao dashboard um arrasto puramente vertical', () => {
    expect(decideSwipe(0, 120)).toBe('scroll')
  })

  it('ignora um movimento horizontal curto demais para ser intenção', () => {
    expect(decideSwipe(10, 0)).toBe('none')
    expect(decideSwipe(-10, 4)).toBe('none')
  })

  it('ignora um toque sem movimento', () => {
    expect(decideSwipe(0, 0)).toBe('none')
  })

  it('traz o anterior quando se arrasta para a direita', () => {
    expect(decideSwipe(80, 0)).toBe('prev')
    expect(decideSwipe(80, 20)).toBe('prev')
  })

  it('leva ao seguinte quando se arrasta para a esquerda', () => {
    expect(decideSwipe(-80, 0)).toBe('next')
    expect(decideSwipe(-80, -20)).toBe('next')
  })

  it('trata o limiar como inclusivo no valor exacto', () => {
    expect(decideSwipe(SWIPE_THRESHOLD_PX, 0)).toBe('prev')
    expect(decideSwipe(SWIPE_THRESHOLD_PX - 1, 0)).toBe('none')
  })

  it('aceita um limiar próprio, para quem teste com outros valores', () => {
    expect(decideSwipe(30, 0, 20)).toBe('prev')
    expect(decideSwipe(30, 0, 100)).toBe('none')
  })

  it('prefere o scroll ao gesto quando os dois eixos empatam', () => {
    // Empate não é intenção horizontal. Na dúvida, o scroll do dashboard ganha:
    // perder um deslize é um inconveniente, prender o scroll é uma avaria.
    expect(decideSwipe(80, 80)).toBe('scroll')
    expect(decideSwipe(-80, 80)).toBe('scroll')
  })
})
