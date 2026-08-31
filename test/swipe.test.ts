import { describe, expect, it } from 'vitest'
import { GESTURE_OWNER_CLASS, INTERACTIVE_SELECTOR, SWIPE_THRESHOLD_PX, decideSwipe } from '../src/swipe'

/**
 * The gesture decision lives in a pure function for the same reason as
 * `decideAction` and `mapRequestChanged`: this is where what can go wrong
 * lives. The DOM glue — three pointer listeners that call this function, and
 * the controls guard, whose contract is tested further below — is left
 * untested, and on purpose: this project runs its tests in
 * `environment: 'node'`, and a jsdom that doesn't scroll wouldn't assert
 * anything about the conflict with the dashboard's scroll, which is the only
 * real risk in the gesture.
 */
describe('decideSwipe', () => {
  it('hands the gesture to the dashboard when the finger moves more downward than sideways', () => {
    expect(decideSwipe(20, 60)).toBe('scroll')
    expect(decideSwipe(-20, -60)).toBe('scroll')
  })

  it('hands a purely vertical drag to the dashboard', () => {
    expect(decideSwipe(0, 120)).toBe('scroll')
  })

  it('ignores a horizontal movement too short to be intentional', () => {
    expect(decideSwipe(10, 0)).toBe('none')
    expect(decideSwipe(-10, 4)).toBe('none')
  })

  it('ignores a touch with no movement', () => {
    expect(decideSwipe(0, 0)).toBe('none')
  })

  it('brings the previous one when dragging to the right', () => {
    expect(decideSwipe(80, 0)).toBe('prev')
    expect(decideSwipe(80, 20)).toBe('prev')
  })

  it('moves to the next one when dragging to the left', () => {
    expect(decideSwipe(-80, 0)).toBe('next')
    expect(decideSwipe(-80, -20)).toBe('next')
  })

  it('treats the threshold as inclusive at the exact value', () => {
    expect(decideSwipe(SWIPE_THRESHOLD_PX, 0)).toBe('prev')
    expect(decideSwipe(SWIPE_THRESHOLD_PX - 1, 0)).toBe('none')
  })

  it('accepts its own threshold, for whoever tests with other values', () => {
    expect(decideSwipe(30, 0, 20)).toBe('prev')
    expect(decideSwipe(30, 0, 100)).toBe('none')
  })

  it('prefers scroll over the gesture when both axes tie', () => {
    // A tie is not horizontal intent. When in doubt, the dashboard's scroll
    // wins: losing a swipe is an inconvenience, trapping the scroll is a
    // malfunction.
    expect(decideSwipe(80, 80)).toBe('scroll')
    expect(decideSwipe(-80, 80)).toBe('scroll')
  })
})

/**
 * The guard that withholds controls from the swipe is not testable here: the
 * `composedPath()`'s `matches()` is DOM, and this project runs in
 * `environment: 'node'` on purpose. A stand-in for `matches` would only prove
 * that `Array.some` works.
 *
 * What **is** testable, and where the real defect fits, is the contract
 * between the two files: `sections/location.ts` marks the map container with
 * `GESTURE_OWNER_CLASS`, and `INTERACTIVE_SELECTOR` has to look for it. The
 * shared constant keeps the two literals from diverging; these tests keep the
 * class from being forgotten in the list, which is the same defect wearing a
 * different face.
 */
describe('INTERACTIVE_SELECTOR', () => {
  it('looks for the class the map marks itself with', () => {
    expect(INTERACTIVE_SELECTOR).toContain(`.${GESTURE_OWNER_CLASS}`)
  })

  it('the class is a usable CSS class name', () => {
    // Without this, a class with spaces or a dot would pass into the selector
    // list, becoming selectors that match things that aren't the map.
    expect(GESTURE_OWNER_CLASS).toMatch(/^[a-z][a-z0-9-]*$/)
  })

  it('covers the controls the finger grabs inside a sub-view', () => {
    // The charge-limit and fan sliders are `input`; the bar and row buttons
    // are `button`.
    for (const selector of ['input', 'button', 'ha-icon-button', '[role="slider"]']) {
      expect(INTERACTIVE_SELECTOR.split(', '), selector).toContain(selector)
    }
  })
})
