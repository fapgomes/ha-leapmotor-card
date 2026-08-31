import { html, type TemplateResult } from 'lit'

/**
 * The cabin seen from above, to serve as the base for the comfort controls.
 * Original drawing, made of rectangles and circles; the repository is GPL v3
 * and does not distribute — nor trace — Leapmotor artwork.
 *
 * It is not a car seen from outside: there is no bodywork, no nose, no
 * wheels. It is just the cabin, cut off at the front on the fascia line and
 * at the back right after the bench seat, which is where the controls end.
 * That is what fixes the reason for the `viewBox` being 200 x 240 (1 : 1.2)
 * — the full car top view that used to be here was 1 : 2.5 and forced the
 * controls to be squeezed into a narrow band.
 *
 * The box was 200 x 228 and grew 12 units AT THE BOTTOM, with nothing
 * changing size: the fascia stayed where it was and everything that comes
 * after it — seats, console, rear bench, rear panels — moved down 12, with
 * the front door panels stretching the same 12 to keep starting at the
 * fascia's ends. What was gained was the distance between the fascia and the
 * seats, which is where the steering wheel lives: at 228 there was no way to
 * place the steering wheel chip in front of the driver without it touching
 * the headrest or without the fascia's line cutting into its rounded corner.
 * Now there are 36.9 units of free band for a 25-unit chip, leaving ~6 on
 * each side.
 *
 * WHERE THERE IS A CONTROL THERE IS NO DRAWING. This is the rule that
 * governs what is here and, above all, what is no longer here. A chip is an
 * opaque box with rounded corners: putting another piece of the same shape
 * underneath it — the steering wheel was an ellipse, the mirror a rounded
 * rectangle — adds no readability at all, it only lets a rim peek out around
 * the chip that reads as a stain. That is what happened on the dashboard,
 * and it is why neither the steering wheel nor the mirrors are drawn: the
 * chip that controls them IS the piece. Whoever edits this file should not
 * add them back.
 *
 * What is drawn, from top to bottom:
 *   - the fascia line, which is the cabin's front cut. It does not go from
 *     mirror to mirror: its ends fall at (11.5, 46) and (188.5, 46), which
 *     are the tops of the front door panels, and the line enters into them.
 *     It had to be this way: without the mirrors at the ends, a line ending
 *     in mid-air read as a loose stroke and not as the fascia. In the
 *     middle it rises to y = 29.5. It now does not pass behind any chip —
 *     neither the mirrors' nor the steering wheel's touch it, and the
 *     shortest clearance for each of them is noted in `climate-panel.ts`;
 *   - two front seats, each with a headrest (y 72), backrest (y 90 to 138)
 *     and cushion (y 141 to 168), centered at x = 57 and x = 143;
 *   - the center console between them (x 88 to 112), with two cup holders
 *     on top (y 100) and the armrest below (y 124 to 164);
 *   - the rear bench seat spanning the full width (x 24 to 176), with the
 *     backrest split down the middle (y 176 to 212) and the cushion below
 *     (y 215 to 234);
 *   - the door panels, two on each side (front and rear), at the margins.
 *
 * The `left`/`top` percentages of the controls in `climate-panel.ts` resolve
 * against this box and are calculated over these coordinates: each control
 * sits where the piece it commands sits (a mirror chip at each front
 * corner, the steering wheel's in front of the driver's seat, and each
 * seat's pill over its respective backrest). Changing the drawing requires
 * revisiting them — and the `top` values resolve against the box's HEIGHT,
 * so changing the 240 changes all of them.
 */
export const CABIN_TOPVIEW: TemplateResult = html`
  <svg viewBox="0 0 200 240" aria-hidden="true" part="topview">
    <g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" opacity="0.3">
      <path d="M11.5 46 C56 24 144 24 188.5 46" />

      <rect x="6" y="46" width="11" height="96" rx="5" />
      <rect x="6" y="148" width="11" height="66" rx="5" />
      <rect x="183" y="46" width="11" height="96" rx="5" />
      <rect x="183" y="148" width="11" height="66" rx="5" />

      <rect x="44" y="72" width="26" height="15" rx="7" />
      <rect x="30" y="90" width="54" height="48" rx="13" />
      <rect x="33" y="141" width="48" height="27" rx="11" />

      <rect x="130" y="72" width="26" height="15" rx="7" />
      <rect x="116" y="90" width="54" height="48" rx="13" />
      <rect x="119" y="141" width="48" height="27" rx="11" />

      <rect x="88" y="82" width="24" height="86" rx="8" />
      <circle cx="94" cy="100" r="4.5" />
      <circle cx="106" cy="100" r="4.5" />
      <rect x="91" y="124" width="18" height="40" rx="7" />

      <rect x="24" y="176" width="152" height="36" rx="10" />
      <path d="M100 176 L100 212" />
      <rect x="24" y="215" width="152" height="19" rx="8" />
    </g>
  </svg>
`
