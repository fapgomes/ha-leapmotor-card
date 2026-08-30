import { describe, expect, it } from 'vitest'
import { DEFAULT_MAP_ZOOM, clampMapZoom, mapRequestChanged, DEFAULT_TIRE_RANGE, clampTireRange } from '../src/types'

describe('clampMapZoom', () => {
  it('deixa passar um valor válido sem alteração', () => {
    expect(clampMapZoom(12)).toBe(12)
  })

  it('corta para o mínimo do Leaflet quando o valor é demasiado baixo', () => {
    expect(clampMapZoom(0)).toBe(1)
    expect(clampMapZoom(-5)).toBe(1)
  })

  it('corta para o máximo do Leaflet quando o valor é demasiado alto', () => {
    expect(clampMapZoom(25)).toBe(20)
    expect(clampMapZoom(100)).toBe(20)
  })

  it('usa o valor por omissão quando não há configuração', () => {
    expect(clampMapZoom(undefined)).toBe(DEFAULT_MAP_ZOOM)
  })

  it('usa o valor por omissão perante um valor não numérico vindo de YAML escrito à mão', () => {
    expect(clampMapZoom(Number.NaN)).toBe(DEFAULT_MAP_ZOOM)
    expect(clampMapZoom('16' as unknown as number)).toBe(DEFAULT_MAP_ZOOM)
  })

  it('arredonda um valor fraccionário', () => {
    expect(clampMapZoom(14.6)).toBe(15)
  })
})

/**
 * `mapRequestChanged` é a decisão que evita que o `ensureMap` do card
 * reconstrua o mapa a cada `render()` — só entidade ou zoom diferentes é que
 * contam. Testável sem DOM porque é pura; o resto do `ensureMap` (o `then` da
 * promessa, o `loadCardHelpers`, o `_mapElement`) vive numa `LitElement` e este
 * projeto corre os testes em `environment: 'node'`, sem harness de DOM — por
 * isso essa parte fica sem teste, e não com um teste que não afirma nada.
 */
describe('mapRequestChanged', () => {
  it('diz que mudou quando não havia pedido anterior', () => {
    expect(mapRequestChanged(undefined, { entityId: 'device_tracker.a', zoom: 16 })).toBe(true)
  })

  it('diz que não mudou quando entidade e zoom se mantêm', () => {
    const previous = { entityId: 'device_tracker.a', zoom: 16 }
    expect(mapRequestChanged(previous, { entityId: 'device_tracker.a', zoom: 16 })).toBe(false)
  })

  it('diz que mudou quando só o zoom muda', () => {
    const previous = { entityId: 'device_tracker.a', zoom: 16 }
    expect(mapRequestChanged(previous, { entityId: 'device_tracker.a', zoom: 18 })).toBe(true)
  })

  it('diz que mudou quando só a entidade muda', () => {
    const previous = { entityId: 'device_tracker.a', zoom: 16 }
    expect(mapRequestChanged(previous, { entityId: 'device_tracker.b', zoom: 16 })).toBe(true)
  })
})

/**
 * `tire_range` vem de YAML escrito à mão, sem validação de esquema, e alimenta
 * um alerta visível na grelha: um par trocado ou um texto por engano pintava um
 * tile de vermelho para sempre. O corte é aqui, na leitura, pela mesma razão do
 * `clampMapZoom` — o editor não vê configurações escritas à mão.
 */
describe('clampTireRange', () => {
  it('deixa passar uma faixa válida sem alteração', () => {
    expect(clampTireRange([2.4, 3.0])).toEqual([2.4, 3.0])
  })

  it('usa a faixa por omissão quando não há configuração', () => {
    expect(clampTireRange(undefined)).toEqual([...DEFAULT_TIRE_RANGE])
  })

  it('usa a omissão quando o mínimo não é menor que o máximo', () => {
    expect(clampTireRange([2.6, 2.0])).toEqual([...DEFAULT_TIRE_RANGE])
    expect(clampTireRange([2.4, 2.4])).toEqual([...DEFAULT_TIRE_RANGE])
  })

  it('usa a omissão perante valores não numéricos vindos de YAML escrito à mão', () => {
    expect(clampTireRange(['2.0', '2.6'])).toEqual([...DEFAULT_TIRE_RANGE])
    expect(clampTireRange([Number.NaN, 2.6])).toEqual([...DEFAULT_TIRE_RANGE])
    expect(clampTireRange([2.0, Number.POSITIVE_INFINITY])).toEqual([...DEFAULT_TIRE_RANGE])
  })

  it('usa a omissão quando o comprimento não é dois', () => {
    expect(clampTireRange([2.0])).toEqual([...DEFAULT_TIRE_RANGE])
    expect(clampTireRange([2.0, 2.6, 3.0])).toEqual([...DEFAULT_TIRE_RANGE])
    expect(clampTireRange([])).toEqual([...DEFAULT_TIRE_RANGE])
  })

  it('usa a omissão quando não é sequer uma lista', () => {
    expect(clampTireRange(2.6)).toEqual([...DEFAULT_TIRE_RANGE])
    expect(clampTireRange(null)).toEqual([...DEFAULT_TIRE_RANGE])
    expect(clampTireRange({ min: 2, max: 3 })).toEqual([...DEFAULT_TIRE_RANGE])
  })

  it('devolve uma cópia, para ninguém escrever na constante por omissão', () => {
    const first = clampTireRange(undefined)
    first[0] = 99
    expect(clampTireRange(undefined)).toEqual([...DEFAULT_TIRE_RANGE])
  })
})
