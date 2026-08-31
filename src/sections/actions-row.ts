import { LitElement, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import {
  BLOCKED_WHILE_DRIVING, CONTROL_PANEL, actionIcon, actionLabel, isActionAvailable, type ActionEventDetail,
} from '../actions'
import type { TranslateFn } from '../localize'
import { sharedStyles } from '../theme'
import type { ActionId, EntityMap, VehicleState } from '../types'

@customElement('leapmotor-actions-row')
export class LeapmotorActionsRow extends LitElement {
  @property({ attribute: false }) state!: VehicleState
  @property({ attribute: false }) t!: TranslateFn
  @property({ attribute: false }) map!: EntityMap
  @property({ attribute: false }) actions: ActionId[] = []
  @property({ attribute: false }) pending?: ActionId

  private disabled(action: ActionId): boolean {
    if (!isActionAvailable(action, this.state, this.map)) return true
    if (this.state.activity === 'driving' && BLOCKED_WHILE_DRIVING.includes(action)) return true
    return this.pending !== undefined
  }

  private fire(action: ActionId) {
    // Actions with a panel (e.g. sunshade) don't call a service from here:
    // they need a value that only their own panel supplies. The button only
    // asks the card to expand that panel — see spec v2, finding 4. The
    // panel comes from a per-action map, not from a fixed constant: a
    // value-taking action with no panel of its own (e.g. setClimate)
    // already fails `isActionAvailable` and never becomes a button here —
    // see the additional finding after item 8.
    const panel = CONTROL_PANEL[action]
    if (panel) {
      this.dispatchEvent(new CustomEvent('leapmotor-expand', {
        detail: { panel }, bubbles: true, composed: true,
      }))
      return
    }
    this.dispatchEvent(new CustomEvent<ActionEventDetail>('leapmotor-action', {
      detail: { action }, bubbles: true, composed: true,
    }))
  }

  override render() {
    return html`<div class="grid">
      ${this.actions.map(action => html`
        <button
          class="plain"
          ?disabled=${this.disabled(action)}
          title=${actionLabel(action, this.state, this.t)}
          @click=${() => this.fire(action)}
        >
          <span class="circle ${this.pending === action ? 'busy' : ''}">
            <ha-icon icon=${actionIcon(action, this.state)}></ha-icon>
          </span>
          <span class="label">${actionLabel(action, this.state, this.t)}</span>
        </button>
      `)}
    </div>`
  }

  static override styles = [sharedStyles, css`
    button.plain { flex-direction: column; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(64px, 1fr));
      gap: 8px; margin-top: var(--lm-gap);
    }
    .circle {
      display: grid; place-items: center;
      width: 56px; height: 56px; border-radius: 50%;
      background: var(--lm-chip);
      transition: background 120ms ease, transform 120ms ease;
    }
    button.plain:not([disabled]):active .circle { transform: scale(0.94); }
    .circle.busy { animation: pulse 900ms ease-in-out infinite; }
    @keyframes pulse { 50% { opacity: 0.45; } }
    .label { font-size: 0.78rem; text-align: center; line-height: 1.15; }
    @media (max-width: 360px) {
      .circle { width: 46px; height: 46px; }
      .label { font-size: 0.7rem; }
    }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-actions-row': LeapmotorActionsRow }
}
