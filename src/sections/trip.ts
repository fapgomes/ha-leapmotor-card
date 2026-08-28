import { LitElement, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { formatNumber } from '../format'
import { DASH, type TranslateFn } from '../localize'
import { sharedStyles } from '../theme'
import type { VehicleState } from '../types'

@customElement('leapmotor-trip')
export class LeapmotorTrip extends LitElement {
  @property({ attribute: false }) state!: VehicleState
  @property({ attribute: false }) t!: TranslateFn

  override render() {
    const trip = this.state.trip
    const rows: { label: string; value: string }[] = [
      { label: this.t('trip.odometer'), value: trip.odometerKm !== undefined ? `${formatNumber(trip.odometerKm)} km` : DASH },
      {
        label: this.t('trip.last7days'),
        value: trip.last7DaysKm === undefined && trip.last7DaysKwh === undefined
          ? DASH
          : `${formatNumber(trip.last7DaysKm)} km · ${formatNumber(trip.last7DaysKwh, 1)} kWh`,
      },
      { label: this.t('trip.consumption'), value: trip.avgConsumption !== undefined ? `${formatNumber(trip.avgConsumption, 1)} kWh/100 km` : DASH },
      {
        label: `${this.t('trip.lifetime')} (${this.t('trip.lifetime_note')})`,
        value: trip.lifetimeConsumption !== undefined
          ? `${formatNumber(trip.lifetimeConsumption, 1)} kWh/100 km`
          : DASH,
      },
      { label: this.t('trip.total_energy'), value: trip.totalEnergyKwh !== undefined ? `${formatNumber(trip.totalEnergyKwh, 1)} kWh` : DASH },
    ]

    return html`<div class="panel">
      <div class="title">${this.t('trip.title')}</div>
      ${rows.map(r => html`<div class="line"><span class="muted">${r.label}</span><span>${r.value}</span></div>`)}
    </div>`
  }

  static override styles = [sharedStyles, css`
    .title { font-size: 1.05rem; font-weight: 600; margin-bottom: 8px; }
    .line { display: flex; justify-content: space-between; gap: 12px; padding: 5px 0; font-size: 0.9rem; }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-trip': LeapmotorTrip }
}
