import { css, type CSSResult } from 'lit'

export function batteryColor(percent: number | undefined): string {
  if (percent === undefined) return 'var(--leapmotor-battery-unknown, var(--disabled-text-color, #9e9e9e))'
  if (percent >= 50) return 'var(--leapmotor-battery-high, #2fbf5c)'
  if (percent >= 20) return 'var(--leapmotor-battery-mid, #f5a623)'
  return 'var(--leapmotor-battery-low, #e5484d)'
}

export const sharedStyles: CSSResult = css`
  :host {
    --lm-gap: 16px;
    --lm-radius: 18px;
    --lm-text: var(--primary-text-color);
    --lm-muted: var(--secondary-text-color);
    --lm-surface: var(--leapmotor-surface, var(--card-background-color));
    --lm-chip: var(--leapmotor-chip, rgba(127, 127, 127, 0.12));
    /*
     * Warn and alert with their own name. Before this, the tire pressure
     * warning in tires.ts used --leapmotor-battery-mid: a tire warning
     * borrowing the battery's color. The default values are the same they
     * were, so nothing changes in appearance — only in meaning, and meaning
     * is what a user theme needs to be able to redefine.
     */
    --lm-warn: var(--leapmotor-warn, #f5a623);
    --lm-alert: var(--leapmotor-alert, #e5484d);
    color: var(--lm-text);
    font-family: var(--paper-font-body1_-_font-family, inherit);
  }
  .muted { color: var(--lm-muted); }
  .chip {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 10px; border-radius: 999px;
    background: var(--lm-chip); font-size: 0.8rem; white-space: nowrap;
  }
  .panel {
    background: var(--lm-chip); border-radius: var(--lm-radius);
    padding: var(--lm-gap); margin-top: var(--lm-gap);
  }
  .row { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--lm-gap); }
  /*
   * WARNING: all: unset resets ALL properties, not just the button look —
   * background, padding, corners, dimensions, position and box-sizing
   * included. This rule sits at (0,1,1), so any single-class rule loses to
   * it. An element with class="plain x" needs a compound selector
   * button.plain.x that RESTORES everything its box requires. This has
   * already produced six defects in this project, two of them visible on a
   * user's dashboard.
   */
  button.plain {
    all: unset; cursor: pointer; display: flex;
    align-items: center; gap: 8px; -webkit-tap-highlight-color: transparent;
  }
  button.plain[disabled] { cursor: not-allowed; opacity: 0.4; }
  /*
   * The all: unset above also wipes the focus outline, and the browser does
   * not restore it on its own: any button in the card was left with no
   * visible mark at all when reached by keyboard. That hurt most on a seat's
   * pill, whose two halves are contiguous with no separator — without a
   * focus ring there was no way to tell which one would fire.
   *
   * Lives here, and not in a section, because all: unset also lives here:
   * the rule has to cover every class="plain …" in the card, not just a
   * panel's. It sits at (0,2,1), so above the button.plain (0,1,1) that
   * wiped it. A section that needs the ring INSIDE its own box — the case of
   * the pill's halves, which live inside a container with
   * overflow: hidden — only has to declare the outline-offset on its own
   * compound selector, which at (0,3,1) beats this one.
   */
  button.plain:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }
`
