import { LitElement, css, html } from 'lit'
import { customElement, property, state as internalState } from 'lit/decorators.js'
import type { ActionEventDetail } from '../actions'
import type { TranslateFn } from '../localize'
import { sharedStyles } from '../theme'

@customElement('leapmotor-sunshade-control')
export class LeapmotorSunshadeControl extends LitElement {
  @property({ attribute: false }) t!: TranslateFn

  /**
   * The sunshade's position isn't exposed as an entity (spec v2 §2.4), so
   * there's no current position to show. The control starts at the middle
   * and what counts is the position the user confirms. It's called
   * `position` like the matching field of `ActionPayload`: it's the same
   * value, from the slider all the way to the service.
   */
  @internalState() private position = 5

  private commit() {
    this.dispatchEvent(new CustomEvent<ActionEventDetail>('leapmotor-action', {
      detail: { action: 'sunshade', payload: { position: this.position } }, bubbles: true, composed: true,
    }))
  }

  private close() {
    this.dispatchEvent(new CustomEvent('leapmotor-expand', {
      detail: { panel: null }, bubbles: true, composed: true,
    }))
  }

  override render() {
    return html`<div class="panel">
      <div class="row head">
        <div class="title">${this.t('sunshade.title')}</div>
        <div class="reading">${this.position}/10</div>
        <button class="plain close" @click=${this.close} title=${this.t('collapse')} aria-label=${this.t('collapse')}>
          <ha-icon icon="mdi:close"></ha-icon>
        </button>
      </div>
      <input
        class="slider" type="range" min="0" max="10" step="1"
        aria-label=${this.t('sunshade.title')}
        .value=${String(this.position)}
        @input=${(e: Event) => { this.position = Number((e.target as HTMLInputElement).value) }}
        @change=${this.commit}
      />
      <div class="hint muted">${this.t('sunshade.hint')}</div>
    </div>`
  }

  static override styles = [sharedStyles, css`
    .head { align-items: center; }
    .title { font-size: 1.05rem; font-weight: 600; flex: 1; }
    .reading { font-size: 1.1rem; font-variant-numeric: tabular-nums; }
    button.plain.close {
      display: grid; place-items: center; width: 28px; height: 28px;
      border-radius: 50%; color: var(--lm-muted);
    }
    .slider { width: 100%; margin-top: 12px; accent-color: var(--primary-color); }
    .hint { font-size: 0.75rem; margin-top: 6px; }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-sunshade-control': LeapmotorSunshadeControl }
}
