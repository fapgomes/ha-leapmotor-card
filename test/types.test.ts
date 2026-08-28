import { describe, expect, it } from 'vitest'
import { DEFAULT_MAP_ZOOM, clampMapZoom, mapRequestChanged } from '../src/types'

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
