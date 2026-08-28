import { LitElement, css, html, nothing } from 'lit'
import { customElement, property, state as internalState } from 'lit/decorators.js'
import { formatNumber, formatTimeOfDay } from '../format'
import { DASH, formatDuration, type TranslateFn } from '../localize'
import { sharedStyles } from '../theme'
import type { VehicleState } from '../types'

@customElement('leapmotor-charging')
export class LeapmotorCharging extends LitElement {
  @property({ attribute: false }) state!: VehicleState
  @property({ attribute: false }) t!: TranslateFn
  @property({ type: String }) language = 'en'
  @property({ type: Boolean }) limitEditable = false
  @property({ type: Number }) limitMin = 50
  @property({ type: Number }) limitMax = 100
  @property({ type: Number }) limitStep = 5

  @internalState() private editing = false

  private phaseChip() {
    const c = this.state.charging
    if (c.phase === 'charging') return this.t(c.speed === 'fast' ? 'charging.fast' : 'charging.slow')
    if (c.phase === 'complete') return this.t('charging.complete')
    if (c.phase === 'plugged') return this.t('charging.plugged')
    if (c.phase === 'scheduled') {
      return this.t('charging.scheduled', {
        start: this.state.schedule.start ?? DASH,
        end: this.state.schedule.end ?? DASH,
      })
    }
    return this.t('charging.unplugged')
  }

  private timing() {
    const c = this.state.charging
    if (c.remainingMinutes !== undefined) {
      return this.t('charging.remaining', { duration: formatDuration(c.remainingMinutes, this.t) })
    }
    if (c.finishTime) return this.t('charging.finish', { time: formatTimeOfDay(c.finishTime, this.language) })
    return undefined
  }

  private metrics() {
    const c = this.state.charging
    if (c.phase !== 'charging') return nothing
    return html`<div class="metrics muted">${this.t('charging.metrics', {
      voltage: formatNumber(c.voltageV, 1),
      current: formatNumber(c.currentA, 1),
      power: formatNumber(c.powerKw, 1),
    })}</div>`
  }

  private onSlider(e: Event) {
    const value = Number((e.target as HTMLInputElement).value)
    this.dispatchEvent(new CustomEvent('leapmotor-set-charge-limit', {
      detail: { value }, bubbles: true, composed: true,
    }))
    this.editing = false
  }

  override render() {
    const { battery, chargeLimit } = this.state
    const timing = this.timing()
    return html`<div class="panel">
      <div class="row head">
        <div class="title">${this.t('charging.title', { percent: formatNumber(battery, battery !== undefined && !Number.isInteger(battery) ? 1 : 0) })}</div>
        ${this.limitEditable
          ? html`<button class="plain limit" @click=${() => { this.editing = !this.editing }}>
              <span>${this.t('charging.limit', { percent: formatNumber(chargeLimit) })}</span>
              <ha-icon icon=${this.editing ? 'mdi:chevron-up' : 'mdi:chevron-down'}></ha-icon>
            </button>`
          : html`<div class="limit muted">${this.t('charging.limit', { percent: formatNumber(chargeLimit) })}</div>`}
      </div>

      ${this.editing
        ? html`<input
            class="slider"
            type="range"
            min=${this.limitMin}
            max=${this.limitMax}
            step=${this.limitStep}
            .value=${String(chargeLimit ?? this.limitMax)}
            @change=${this.onSlider}
          />`
        : nothing}

      <div class="row status">
        <span class="chip"><ha-icon icon="mdi:lightning-bolt"></ha-icon>${this.phaseChip()}</span>
        ${timing ? html`<span class="timing muted">${timing}</span>` : nothing}
      </div>

      ${this.metrics()}
    </div>`
  }

  static override styles = [sharedStyles, css`
    .head { align-items: center; }
    .title { font-size: 1.05rem; font-weight: 600; }
    .limit { font-size: 0.95rem; display: flex; align-items: center; gap: 2px; }
    /*
     * A regra .limit acima chega para o <div class="limit muted"> (o caso só
     * de leitura). Mas quando o limite é editável o elemento é
     * <button class="plain limit">, e button.plain (theme.ts) faz all: unset
     * a (0,1,1) — mais alto que .limit sozinha a (0,1,0). display e
     * align-items calham a coincidir com os valores de button.plain, mas gap
     * não: sem este seletor composto, o botão ficava com gap: 8px em vez dos
     * 2px pretendidos, e font-size herdava do pai em vez de 0.95rem.
     */
    button.plain.limit { font-size: 0.95rem; display: flex; align-items: center; gap: 2px; }
    .status { align-items: center; margin-top: 10px; gap: 10px; flex-wrap: wrap; justify-content: flex-start; }
    .timing { font-size: 0.85rem; }
    .metrics { font-size: 0.78rem; margin-top: 8px; }
    .slider { width: 100%; margin-top: 12px; accent-color: var(--primary-color); }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-charging': LeapmotorCharging }
}
