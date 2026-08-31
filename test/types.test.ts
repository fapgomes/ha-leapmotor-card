import { describe, expect, it } from 'vitest'
import { DEFAULT_MAP_ZOOM, clampMapZoom, mapRequestChanged, DEFAULT_TIRE_RANGE, clampTireRange } from '../src/types'

describe('clampMapZoom', () => {
  it('lets a valid value pass through unchanged', () => {
    expect(clampMapZoom(12)).toBe(12)
  })

  it('clamps to Leaflet\'s minimum when the value is too low', () => {
    expect(clampMapZoom(0)).toBe(1)
    expect(clampMapZoom(-5)).toBe(1)
  })

  it('clamps to Leaflet\'s maximum when the value is too high', () => {
    expect(clampMapZoom(25)).toBe(20)
    expect(clampMapZoom(100)).toBe(20)
  })

  it('uses the default value when there is no configuration', () => {
    expect(clampMapZoom(undefined)).toBe(DEFAULT_MAP_ZOOM)
  })

  it('uses the default value for a non-numeric value coming from hand-written YAML', () => {
    expect(clampMapZoom(Number.NaN)).toBe(DEFAULT_MAP_ZOOM)
    expect(clampMapZoom('16' as unknown as number)).toBe(DEFAULT_MAP_ZOOM)
  })

  it('rounds a fractional value', () => {
    expect(clampMapZoom(14.6)).toBe(15)
  })
})

/**
 * `mapRequestChanged` is the decision that keeps the card's `ensureMap` from
 * rebuilding the map on every `render()` — only a different entity or zoom
 * counts. Testable without DOM because it's pure; the rest of `ensureMap`
 * (the promise's `then`, `loadCardHelpers`, `_mapElement`) lives in a
 * `LitElement`, and this project runs its tests in `environment: 'node'`,
 * with no DOM harness — so that part is left untested, rather than covered
 * by a test that asserts nothing.
 */
describe('mapRequestChanged', () => {
  it('says it changed when there was no previous request', () => {
    expect(mapRequestChanged(undefined, { entityId: 'device_tracker.a', zoom: 16 })).toBe(true)
  })

  it('says it did not change when entity and zoom stay the same', () => {
    const previous = { entityId: 'device_tracker.a', zoom: 16 }
    expect(mapRequestChanged(previous, { entityId: 'device_tracker.a', zoom: 16 })).toBe(false)
  })

  it('says it changed when only the zoom changes', () => {
    const previous = { entityId: 'device_tracker.a', zoom: 16 }
    expect(mapRequestChanged(previous, { entityId: 'device_tracker.a', zoom: 18 })).toBe(true)
  })

  it('says it changed when only the entity changes', () => {
    const previous = { entityId: 'device_tracker.a', zoom: 16 }
    expect(mapRequestChanged(previous, { entityId: 'device_tracker.b', zoom: 16 })).toBe(true)
  })
})

/**
 * `tire_range` comes from hand-written YAML, with no schema validation, and
 * feeds a visible alert in the grid: a swapped pair or a typo would paint a
 * tile red forever. The clamp happens here, on read, for the same reason as
 * `clampMapZoom` — the editor doesn't see hand-written configurations.
 */
describe('clampTireRange', () => {
  it('lets a valid range pass through unchanged', () => {
    expect(clampTireRange([2.4, 3.0])).toEqual([2.4, 3.0])
  })

  it('uses the default range when there is no configuration', () => {
    expect(clampTireRange(undefined)).toEqual([...DEFAULT_TIRE_RANGE])
  })

  it('uses the default when the minimum is not less than the maximum', () => {
    expect(clampTireRange([2.6, 2.0])).toEqual([...DEFAULT_TIRE_RANGE])
    expect(clampTireRange([2.4, 2.4])).toEqual([...DEFAULT_TIRE_RANGE])
  })

  it('uses the default for non-numeric values coming from hand-written YAML', () => {
    expect(clampTireRange(['2.0', '2.6'])).toEqual([...DEFAULT_TIRE_RANGE])
    expect(clampTireRange([Number.NaN, 2.6])).toEqual([...DEFAULT_TIRE_RANGE])
    expect(clampTireRange([2.0, Number.POSITIVE_INFINITY])).toEqual([...DEFAULT_TIRE_RANGE])
  })

  it('uses the default when the length is not two', () => {
    expect(clampTireRange([2.0])).toEqual([...DEFAULT_TIRE_RANGE])
    expect(clampTireRange([2.0, 2.6, 3.0])).toEqual([...DEFAULT_TIRE_RANGE])
    expect(clampTireRange([])).toEqual([...DEFAULT_TIRE_RANGE])
  })

  it('uses the default when it is not even a list', () => {
    expect(clampTireRange(2.6)).toEqual([...DEFAULT_TIRE_RANGE])
    expect(clampTireRange(null)).toEqual([...DEFAULT_TIRE_RANGE])
    expect(clampTireRange({ min: 2, max: 3 })).toEqual([...DEFAULT_TIRE_RANGE])
  })

  it('returns a copy, so nobody writes into the default constant', () => {
    const first = clampTireRange(undefined)
    first[0] = 99
    expect(clampTireRange(undefined)).toEqual([...DEFAULT_TIRE_RANGE])
  })
})
