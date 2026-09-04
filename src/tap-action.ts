/**
 * What a tap on a read-only value does. It is its own module, and pure,
 * for the same reason as `resolveAction`: `range_tap_action` comes from
 * hand-written YAML with no schema validation, so every branch here has to
 * be reachable by a test — including the ones that exist only to survive
 * garbage.
 */

/**
 * The configured form, in Home Assistant's own action vocabulary, so that
 * what a user already knows from the tile card works here too.
 *
 * `call-service` is the name HA used before renaming it to
 * `perform-action`; it still accepts both, and so does this card — most
 * YAML snippets on the internet still say the old one.
 */
export type TapActionConfig =
  | { action: 'more-info'; entity?: string }
  | { action: 'navigate'; navigation_path?: string }
  | { action: 'url'; url_path?: string }
  | {
      action: 'perform-action' | 'call-service'
      perform_action?: string
      service?: string
      data?: Record<string, unknown>
      service_data?: Record<string, unknown>
      target?: Record<string, unknown>
    }
  | { action: 'none' }

/**
 * What the card is to do, with everything already decided: the entity to
 * open, the path to follow, the service already split into domain and
 * service. `none` is not an error — it is the value being inert text, which
 * is also what every unusable configuration collapses to.
 */
export type TapDecision =
  | { kind: 'none' }
  | { kind: 'more-info'; entityId: string }
  | { kind: 'navigate'; path: string }
  | { kind: 'url'; url: string }
  | {
      kind: 'perform-action'
      domain: string
      service: string
      data: Record<string, unknown>
      target: Record<string, unknown>
    }

const NONE: TapDecision = { kind: 'none' }

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

function record(value: unknown): Record<string, unknown> {
  // Arrays are objects too, and `{ ...[] }` would silently give `{}` — but
  // so would returning it, and an array here is a configuration mistake
  // that must not reach `callService`.
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

/**
 * `config` is typed `unknown` on purpose: `TapActionConfig` describes what
 * a correct configuration looks like, not what arrives. Nothing validates
 * the YAML a user writes, and a card that throws while rendering shows
 * nothing at all — so an unrecognised action is `none`, never an exception.
 *
 * `defaultEntity` is the resolved range sensor. It is what makes the
 * default work with no configuration at all, and it is also the fallback
 * for a `more-info` written without an `entity`.
 */
export function resolveTapAction(config: unknown, defaultEntity: string | undefined): TapDecision {
  // No configuration: the more-info of the value itself, whose dialog
  // already carries the history graph.
  if (config === undefined || config === null) {
    return defaultEntity ? { kind: 'more-info', entityId: defaultEntity } : NONE
  }
  if (typeof config !== 'object' || Array.isArray(config)) return NONE

  const cfg = config as Record<string, unknown>
  switch (cfg.action) {
    // What HA's own action editor writes when the user picks the default
    // entry. Falling through to `default:` would give `none`, and the
    // number would go silently dead for whoever used the editor instead of
    // writing YAML.
    case 'default':
    case 'more-info': {
      const entityId = text(cfg.entity) ?? defaultEntity
      return entityId ? { kind: 'more-info', entityId } : NONE
    }
    case 'navigate': {
      const path = text(cfg.navigation_path)
      return path ? { kind: 'navigate', path } : NONE
    }
    case 'url': {
      const url = text(cfg.url_path)
      return url ? { kind: 'url', url } : NONE
    }
    case 'perform-action':
    case 'call-service': {
      const name = text(cfg.perform_action) ?? text(cfg.service)
      if (!name) return NONE
      const dot = name.indexOf('.')
      // A service always has both halves. Without the domain there is
      // nothing to call, and `callService('script', undefined)` would be a
      // silent failure in the console.
      if (dot <= 0 || dot === name.length - 1) return NONE
      return {
        kind: 'perform-action',
        domain: name.slice(0, dot),
        service: name.slice(dot + 1),
        data: record(cfg.data ?? cfg.service_data),
        target: record(cfg.target),
      }
    }
    default:
      return NONE
  }
}
