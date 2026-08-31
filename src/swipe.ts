/**
 * How far a finger has to travel, horizontally, to count as intent to move
 * to another sub-view. Below this is the tremor of a tap.
 */
export const SWIPE_THRESHOLD_PX = 48

export type SwipeDecision = 'prev' | 'next' | 'none' | 'scroll'

/**
 * Decides what to do with a drag. Half of the conflict with the dashboard's
 * vertical scroll is resolved in CSS, with `touch-action: pan-y` on the
 * sub-view's container; the other half is this function.
 *
 * A tie between axes resolves to `'scroll'` on purpose: losing a swipe is an
 * inconvenience, trapping the dashboard's scroll is a fault.
 */
export function decideSwipe(dx: number, dy: number, threshold = SWIPE_THRESHOLD_PX): SwipeDecision {
  if (Math.abs(dy) >= Math.abs(dx) && dy !== 0) return 'scroll'
  if (Math.abs(dx) < threshold) return 'none'
  return dx > 0 ? 'prev' : 'next'
}

/**
 * The class that marks a subtree that handles its own gestures: whoever
 * carries it is left out of the swipe between sub-views. Lives here, and
 * not hand-written on both sides, because it is a contract between two
 * files — `sections/location.ts` puts it on the map's container and
 * `INTERACTIVE_SELECTOR` here looks for it. Two copies of the literal would
 * one day silently diverge, and the symptom would be the map stealing the
 * swipe again.
 */
export const GESTURE_OWNER_CLASS = 'lm-owns-gesture'

/**
 * Where a drag is NOT a swipe.
 *
 *  - The sliders (charge limit, fan) live inside the sub-view's slot and a
 *    horizontal drag of the thumb is, pixel by pixel, indistinguishable
 *    from a swipe — the card would jump from group to group mid-gesture.
 *  - The bar's buttons belong on the same list: before, they only escaped
 *    because the 48px threshold was larger than their 34px width, which was
 *    a coincidence and not a rule.
 *  - The Home Assistant map is matched by class, not by tag name: Leaflet
 *    installs its drag on `touchstart`/`mousedown` (verified in Draggable.js
 *    1.9.4; the pointer events shortcut only kicks in when the browser has
 *    no native touch events, which is to say never on a phone), so nothing
 *    it does — not even the `stopPropagation` it has — reaches our
 *    `pointerdown`, and none of its elements match the selectors above.
 *    Marking it by `GESTURE_OWNER_CLASS`, which is ours, instead of by
 *    `hui-map-card` or `.leaflet-container`, survives HA swapping cards or
 *    map libraries.
 *
 * Whoever adds a new entry here: the sections' controls arrive through
 * `<slot>`, from the card's light DOM, so the lookup has to be on the
 * event's `composedPath()` and not on `e.target`.
 */
export const INTERACTIVE_SELECTOR = [
  'input', 'button', 'ha-icon-button', 'a',
  '[role="slider"]', '[role="button"]',
  '.' + GESTURE_OWNER_CLASS,
].join(', ')
