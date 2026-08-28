import { LitElement, css, html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { DASH, type TranslateFn } from '../localize'
import { sharedStyles } from '../theme'
import type { EntityMap, VehicleState } from '../types'

@customElement('leapmotor-schedule')
export class LeapmotorSchedule extends LitElement {
  @property({ attribute: false }) state!: VehicleState
  @property({ attribute: false }) t!: TranslateFn
  @property({ attribute: false }) map!: EntityMap

  private toggle() {
    this.dispatchEvent(new CustomEvent('leapmotor-set-switch', {
      detail: { key: 'scheduleSwitch', on: !this.state.schedule.enabled },
      bubbles: true, composed: true,
    }))
  }

  override render() {
    const s = this.state.schedule
    return html`<div class="panel">
      <div class="row head">
        <div class="title">${this.t('schedule.title')}</div>
        ${this.map.scheduleSwitch
          ? html`<button class="plain toggle ${s.enabled ? 'on' : ''}" @click=${this.toggle}>
              <ha-icon icon=${s.enabled ? 'mdi:toggle-switch' : 'mdi:toggle-switch-off-outline'}></ha-icon>
            </button>`
          : nothing}
      </div>
      <div class="window">
        ${s.start && s.end ? this.t('schedule.window', { start: s.start, end: s.end }) : DASH}
      </div>
      <div class="flags muted">
        ${s.enabled === false ? html`<span class="chip">${this.t('schedule.disabled')}</span>` : nothing}
        ${s.weekly ? html`<span class="chip">${this.t('schedule.weekly')}</span>` : nothing}
        ${s.cancelledOnce ? html`<span class="chip">${this.t('schedule.cancelled_once')}</span>` : nothing}
      </div>
    </div>`
  }

  static override styles = [sharedStyles, css`
    .head { align-items: center; }
    .title { font-size: 1.05rem; font-weight: 600; }
    .window { font-size: 1.2rem; margin: 8px 0; }
    .flags { display: flex; flex-wrap: wrap; gap: 6px; font-size: 0.75rem; }
    /* button.plain (theme.ts) está a (0,1,1): a convenção do projeto é o
       seletor composto, para nenhuma regra desta folha depender de contar
       classes contra o all: unset. */
    button.plain.toggle.on { color: var(--primary-color); }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-schedule': LeapmotorSchedule }
}
