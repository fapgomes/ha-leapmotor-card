import { LitElement, css, html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { formatNumber } from '../format'
import type { TranslateFn } from '../localize'
import { sharedStyles } from '../theme'
import type { VehicleState } from '../types'

const TIRE_MIN = 2.0
const TIRE_MAX = 2.6

const CORNERS = [
  { key: 'fl', tk: 'tires.corner_fl' },
  { key: 'fr', tk: 'tires.corner_fr' },
  { key: 'rl', tk: 'tires.corner_rl' },
  { key: 'rr', tk: 'tires.corner_rr' },
] as const

@customElement('leapmotor-tires')
export class LeapmotorTires extends LitElement {
  @property({ attribute: false }) state!: VehicleState
  @property({ attribute: false }) t!: TranslateFn

  private outOfRange(v: number | undefined): boolean {
    return v !== undefined && (v < TIRE_MIN || v > TIRE_MAX)
  }

  override render() {
    const tires = this.state.tires
    const anyWarning = CORNERS.some(c => this.outOfRange(tires[c.key]))
    return html`<div class="panel">
      <div class="title">${this.t('tires.title')}</div>
      <div class="grid">
        ${CORNERS.map(c => html`
          <div class="corner ${this.outOfRange(tires[c.key]) ? 'warn' : ''}">
            <div class="pressure">${formatNumber(tires[c.key], 2)}</div>
            <div class="corner-label muted">${this.t(c.tk)} · bar</div>
          </div>
        `)}
      </div>
      ${anyWarning ? html`<div class="warning">${this.t('tires.warning')}</div>` : nothing}
    </div>`
  }

  static override styles = [sharedStyles, css`
    .title { font-size: 1.05rem; font-weight: 600; margin-bottom: 12px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .corner { background: var(--card-background-color); border-radius: 12px; padding: 10px 12px; }
    .corner.warn { color: var(--leapmotor-battery-mid, #f5a623); }
    .pressure { font-size: 1.3rem; font-weight: 500; }
    .corner-label { font-size: 0.72rem; }
    .warning { margin-top: 10px; font-size: 0.78rem; color: var(--leapmotor-battery-mid, #f5a623); }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-tires': LeapmotorTires }
}
