import { LitElement, css, html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { formatAgo } from '../format'
import { DASH, type TranslateFn } from '../localize'
import { sharedStyles } from '../theme'
import type { VehicleState } from '../types'

@customElement('leapmotor-location')
export class LeapmotorLocation extends LitElement {
  @property({ attribute: false }) state!: VehicleState
  @property({ attribute: false }) t!: TranslateFn
  /**
   * O card `map` do Home Assistant, já criado e alimentado com `hass` pelo
   * elemento principal. Esta secção nunca vê `hass` — ver a nota da Task 3.
   */
  @property({ attribute: false }) mapElement?: HTMLElement

  override render() {
    const loc = this.state.location
    return html`<div class="panel">
      <div class="row head">
        <div class="title">${this.t('location.title')}</div>
        ${loc?.stale && loc.ageSeconds !== undefined
          ? html`<span class="chip stale">${formatAgo(loc.ageSeconds, this.t)}</span>`
          : nothing}
      </div>

      ${loc
        ? html`
            <div class="zone muted">${loc.zone ?? DASH}</div>
            ${this.mapElement
              ? html`<div class="map ${loc.stale ? 'stale' : ''}">${this.mapElement}</div>`
              : html`<div class="fallback muted">${this.t('location.map_unavailable')}</div>`}
          `
        : html`<div class="fallback muted">${this.t('location.unknown')}</div>`}
    </div>`
  }

  static override styles = [sharedStyles, css`
    .head { align-items: center; }
    .title { font-size: 1.05rem; font-weight: 600; }
    .chip.stale { opacity: 0.7; }
    .zone { font-size: 0.85rem; margin-top: 4px; }
    .map { margin-top: 10px; border-radius: 12px; overflow: hidden; }
    /* Posição obsoleta desenha-se esbatida, pela mesma razão que a pill das
       trancas: o card não apresenta como atual o que sabe estar velho. */
    .map.stale { opacity: 0.72; }
    .fallback { margin-top: 10px; font-size: 0.85rem; }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-location': LeapmotorLocation }
}
