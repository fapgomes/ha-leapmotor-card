import { LitElement, css, html, nothing, type PropertyValues } from 'lit'
import { customElement, property, state as internalState } from 'lit/decorators.js'
import { formatAgo, formatNumber, formatTimeOfDay, formatUpdated } from '../format'
import { DASH, formatDuration, type TranslateFn } from '../localize'
import { batteryColor, sharedStyles } from '../theme'
import type { VehicleState } from '../types'
import { CAR_SILHOUETTE } from '../car-silhouette'

@customElement('leapmotor-hero')
export class LeapmotorHero extends LitElement {
  @property({ attribute: false }) state!: VehicleState
  @property({ attribute: false }) t!: TranslateFn
  @property({ attribute: false }) now!: Date
  @property({ type: String }) name = ''
  @property({ type: String }) language = 'en'
  @property({ type: String }) imageUrl?: string
  @property({ type: Boolean }) showImage = true
  // Espelha a regra do §6 da spec: no modo `image: 'entity'` não há recurso à
  // silhueta, nem quando a `entity_picture` (com token assinado) expira mais
  // tarde e o <img> dá erro. `showImage` já resolve o caso "sem URL de
  // entrada"; esta prop cobre o caso "URL que falha depois de montado".
  @property({ type: Boolean }) allowSilhouette = true

  @internalState() private imageFailed = false

  override willUpdate(changed: PropertyValues) {
    if (changed.has('imageUrl')) this.imageFailed = false
  }

  private lockLabel(): string {
    const { locked } = this.state.lock
    if (locked === undefined) return this.t('doors_unknown')
    return this.t(locked ? 'doors_locked' : 'doors_unlocked')
  }

  private chargingChip() {
    const c = this.state.charging
    if (c.phase === 'unplugged') return nothing

    const parts: string[] = []
    if (c.phase === 'complete') parts.push(this.t('charging.complete'))
    else if (c.phase === 'scheduled') {
      parts.push(this.t('charging.scheduled', {
        start: this.state.schedule.start ?? DASH,
        end: this.state.schedule.end ?? DASH,
      }))
    } else if (c.phase === 'plugged') parts.push(this.t('charging.plugged'))
    else parts.push(this.t(c.speed === 'fast' ? 'charging.fast' : 'charging.slow'))

    if (c.remainingMinutes !== undefined) {
      parts.push(this.t('charging.remaining', { duration: formatDuration(c.remainingMinutes, this.t) }))
    } else if (c.finishTime) {
      parts.push(this.t('charging.finish', { time: formatTimeOfDay(c.finishTime, this.language) }))
    }

    return html`<div class="chip charge">
      <ha-icon icon="mdi:lightning-bolt"></ha-icon>${parts.join(', ')}
    </div>`
  }

  private bar() {
    const battery = this.state.battery
    const limit = this.state.chargeLimit
    return html`<div class="bar" role="img" aria-label="${formatNumber(battery)}%">
      ${limit !== undefined
        ? html`<div class="limit" style="width:${Math.min(100, Math.max(0, limit))}%"></div>`
        : nothing}
      <div class="fill" style="width:${Math.min(100, Math.max(0, battery ?? 0))}%;background:${batteryColor(battery)}"></div>
    </div>`
  }

  override render() {
    const { range, lock, activity } = this.state
    return html`
      <div class="head">
        <div class="title">${this.name || DASH}</div>
        <div class="sub muted">${formatUpdated(this.state.lastUpdate, this.now, this.t, this.language)}</div>
      </div>

      <div class="row main">
        <div class="range">
          <div class="value">
            <span class="big">${range ? formatNumber(range.km) : DASH}</span>
            <span class="unit muted">${range?.unit ?? ''}</span>
          </div>
          ${this.bar()}
          ${this.chargingChip()}
        </div>

        <div class="lock ${lock.stale ? 'stale' : ''}">
          <ha-icon icon=${lock.locked === false ? 'mdi:lock-open-variant-outline' : 'mdi:lock-outline'}></ha-icon>
          <div class="lock-text">
            <div>${this.lockLabel()}</div>
            ${lock.stale && lock.ageSeconds !== undefined
              ? html`<div class="ago muted">${formatAgo(lock.ageSeconds, this.t)}</div>`
              : nothing}
          </div>
        </div>
      </div>

      ${this.showImage
        ? html`<div class="image">
            ${this.imageUrl && !this.imageFailed
              ? html`<img src=${this.imageUrl} alt=${this.name} @error=${() => { this.imageFailed = true }} />`
              : (this.allowSilhouette ? CAR_SILHOUETTE : nothing)}
          </div>`
        : nothing}

      ${activity === 'unknown'
        ? nothing
        : html`<div class="activity muted">${this.t(`activity.${activity}`)}</div>`}
    `
  }

  static override styles = [sharedStyles, css`
    .title { font-size: 1.4rem; font-weight: 600; }
    .sub { font-size: 0.8rem; margin-top: 2px; }
    .main { margin-top: var(--lm-gap); align-items: flex-start; }
    .range { min-width: 0; flex: 1 1 auto; }
    .value { display: flex; align-items: baseline; gap: 6px; }
    .big { font-size: 2.6rem; font-weight: 300; line-height: 1; }
    .unit { font-size: 1rem; }
    .bar {
      position: relative; height: 6px; border-radius: 999px;
      background: var(--lm-chip); margin: 10px 0; max-width: 220px; overflow: hidden;
    }
    .bar .limit, .bar .fill { position: absolute; inset-block: 0; inset-inline-start: 0; border-radius: 999px; }
    .bar .limit { background: var(--leapmotor-battery-high, #2fbf5c); opacity: 0.28; }
    .chip.charge { margin-top: 4px; }
    .lock { display: flex; align-items: flex-start; gap: 8px; text-align: start; flex: 0 0 auto; }
    .lock.stale { opacity: 0.55; }
    .lock-text { font-size: 1.05rem; line-height: 1.2; }
    .ago { font-size: 0.75rem; }
    .image { display: flex; justify-content: center; margin: var(--lm-gap) 0 4px; }
    .image img, .image svg { max-width: 100%; height: auto; max-height: 160px; }
    .activity { text-align: center; font-size: 0.95rem; }
    @media (max-width: 360px) {
      .big { font-size: 2.1rem; }
      .lock-text { font-size: 0.9rem; }
    }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-hero': LeapmotorHero }
}
