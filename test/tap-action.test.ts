import { describe, expect, it } from 'vitest'
import { resolveTapAction } from '../src/tap-action'

const RANGE = 'sensor.leapmotor_b10_000000_demo_range'

describe('resolveTapAction', () => {
  it('with no configuration, opens the more-info of the range entity', () => {
    // This is the whole point of the default: tapping the kilometres shows
    // the history graph without anybody writing YAML.
    expect(resolveTapAction(undefined, RANGE)).toEqual({ kind: 'more-info', entityId: RANGE })
  })

  it('with no configuration and no entity resolved, does nothing', () => {
    // A card without a range sensor has no dialog to open: the number must
    // stay inert text instead of becoming a button that does nothing.
    expect(resolveTapAction(undefined, undefined)).toEqual({ kind: 'none' })
  })

  it("action: 'none' gives the number back as inert text", () => {
    expect(resolveTapAction({ action: 'none' }, RANGE)).toEqual({ kind: 'none' })
  })

  it('more-info without an entity falls back to the resolved one', () => {
    expect(resolveTapAction({ action: 'more-info' }, RANGE)).toEqual({ kind: 'more-info', entityId: RANGE })
  })

  it('more-info with an entity points the dialog at that one', () => {
    expect(resolveTapAction({ action: 'more-info', entity: 'sensor.other' }, RANGE))
      .toEqual({ kind: 'more-info', entityId: 'sensor.other' })
  })

  it('navigates to the configured path', () => {
    expect(resolveTapAction({ action: 'navigate', navigation_path: '/history' }, RANGE))
      .toEqual({ kind: 'navigate', path: '/history' })
  })

  it('navigate without a path does nothing', () => {
    // There is nowhere to go, and navigating to '' would drop the user on
    // an empty dashboard.
    expect(resolveTapAction({ action: 'navigate' }, RANGE)).toEqual({ kind: 'none' })
  })

  it('opens the configured url', () => {
    expect(resolveTapAction({ action: 'url', url_path: 'https://example.org' }, RANGE))
      .toEqual({ kind: 'url', url: 'https://example.org' })
  })

  it('url without a path does nothing', () => {
    expect(resolveTapAction({ action: 'url' }, RANGE)).toEqual({ kind: 'none' })
  })

  it('splits perform_action into domain and service', () => {
    expect(resolveTapAction({
      action: 'perform-action',
      perform_action: 'script.show_range',
      data: { mode: 'week' },
      target: { entity_id: 'sensor.other' },
    }, RANGE)).toEqual({
      kind: 'perform-action',
      domain: 'script',
      service: 'show_range',
      data: { mode: 'week' },
      target: { entity_id: 'sensor.other' },
    })
  })

  it('perform-action without data or target sends empty ones', () => {
    expect(resolveTapAction({ action: 'perform-action', perform_action: 'script.x' }, RANGE))
      .toEqual({ kind: 'perform-action', domain: 'script', service: 'x', data: {}, target: {} })
  })

  it("accepts the old call-service form, which is what most YAML on the internet still says", () => {
    // Home Assistant renamed `call-service`/`service` to
    // `perform-action`/`perform_action` and still accepts both. A user
    // pasting an older snippet must not get a number that silently does
    // nothing.
    expect(resolveTapAction({ action: 'call-service', service: 'script.x', service_data: { a: 1 } }, RANGE))
      .toEqual({ kind: 'perform-action', domain: 'script', service: 'x', data: { a: 1 }, target: {} })
  })

  it('a service without a domain does nothing', () => {
    expect(resolveTapAction({ action: 'perform-action', perform_action: 'script' }, RANGE))
      .toEqual({ kind: 'none' })
    expect(resolveTapAction({ action: 'perform-action' }, RANGE)).toEqual({ kind: 'none' })
  })

  it('an empty key is worth the same as no key at all', () => {
    // `range_tap_action:` with nothing after it parses to null. That is a
    // user who started configuring and left it empty, not garbage: it has
    // to behave exactly like the absent key, or the number would go inert
    // for the one person who was reaching for this option.
    expect(resolveTapAction(null, RANGE)).toEqual({ kind: 'more-info', entityId: RANGE })
  })

  it("the editor's 'default' is worth the same as no configuration", () => {
    // HA's action editor (the `ui_action` selector) writes
    // `{ action: 'default' }` when the user picks the default entry. Read as
    // an unknown action it would give `none`, and the number would go
    // silently dead for whoever used the editor instead of YAML.
    expect(resolveTapAction({ action: 'default' }, RANGE)).toEqual({ kind: 'more-info', entityId: RANGE })
  })

  it('hand-written garbage does nothing instead of throwing', () => {
    // `range_tap_action` comes from YAML with no schema validation. Every
    // one of these used to be a card that failed to render at all.
    for (const bad of [{ action: 'bananas' }, {}, 'more-info', 42, [], { action: 7 }]) {
      expect(resolveTapAction(bad, RANGE), JSON.stringify(bad)).toEqual({ kind: 'none' })
    }
  })
})
