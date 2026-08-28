import { LitElement, css, html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { shownLevel, type ActionEventDetail, type SeatLevels } from '../actions'
import type { LogicalKey, SeatLevelKey } from '../keys'
import type { TranslateFn } from '../localize'
import { sharedStyles } from '../theme'
import type { ActionId, EntityMap, VehicleState } from '../types'

interface LevelRow { key: SeatLevelKey; label: string; value: number | undefined; icon: string }

@customElement('leapmotor-comfort')
export class LeapmotorComfort extends LitElement {
  @property({ attribute: false }) state!: VehicleState
  @property({ attribute: false }) t!: TranslateFn
  @property({ attribute: false }) map!: EntityMap
  /** Nível máximo, lido do atributo `max` das entidades number. */
  @property({ type: Number }) maxLevel = 3
  /**
   * Os níveis que esta secção mostra, já reconciliados pelo card. O pino do
   * painel de clima comanda estas mesmas quatro entidades e recebe exactamente
   * o mesmo objecto; sem ele aqui, um toque numa das secções deixava a outra a
   * assinalar o nível antigo, e o mesmo banco aparecia com dois valores
   * diferentes no mesmo ecrã.
   */
  @property({ attribute: false }) shownLevels: SeatLevels = {}

  private setNumber(key: LogicalKey, value: number) {
    this.dispatchEvent(new CustomEvent('leapmotor-set-number', {
      detail: { key, value }, bubbles: true, composed: true,
    }))
  }

  private fireAction(action: ActionId) {
    this.dispatchEvent(new CustomEvent<ActionEventDetail>('leapmotor-action', {
      detail: { action }, bubbles: true, composed: true,
    }))
  }

  private levelRow(row: LevelRow) {
    if (!this.map[row.key]) return nothing
    // `shownLevel` é partilhado com o pino do painel de clima, que comanda estas
    // mesmas entidades: é o que garante que as duas secções, visíveis ao mesmo
    // tempo, nunca assinalam níveis diferentes para o mesmo banco.
    const { level: shown, pending } = shownLevel(this.shownLevels[row.key], row.value)
    return html`<div class="line">
      <span class="muted"><ha-icon icon=${row.icon}></ha-icon> ${row.label}</span>
      <span class="steps ${pending ? 'pending' : ''}">
        ${Array.from({ length: this.maxLevel + 1 }, (_, level) => level).map(level => html`
          <button
            class="plain step ${shown === level ? 'active' : ''}"
            @click=${() => this.setNumber(row.key, level)}
            title="${row.label} ${level}"
          >${level === 0 ? '·' : level}</button>
        `)}
      </span>
    </div>`
  }

  private toggleRow(action: ActionId, key: LogicalKey, label: string, on: boolean | undefined, icon: string) {
    if (!this.map[key]) return nothing
    return html`<div class="line">
      <span class="muted"><ha-icon icon=${icon}></ha-icon> ${label}</span>
      <button class="plain toggle ${on ? 'on' : ''}" @click=${() => this.fireAction(action)}>
        <ha-icon icon=${on ? 'mdi:toggle-switch' : 'mdi:toggle-switch-off-outline'}></ha-icon>
      </button>
    </div>`
  }

  override render() {
    const c = this.state.comfort
    const wheelSuffix = c.steeringWheelHeat && c.steeringWheelHeatRemaining !== undefined
      ? ` · ${this.t('comfort.remaining', { minutes: c.steeringWheelHeatRemaining })}`
      : ''

    return html`<div class="panel">
      <div class="title">${this.t('comfort.title')}</div>
      ${this.levelRow({ key: 'driverSeatHeat', label: `${this.t('comfort.driver_seat')} · ${this.t('comfort.heating')}`, value: c.driverSeatHeat, icon: 'mdi:car-seat-heater' })}
      ${this.levelRow({ key: 'driverSeatVent', label: `${this.t('comfort.driver_seat')} · ${this.t('comfort.ventilation')}`, value: c.driverSeatVent, icon: 'mdi:car-seat-cooler' })}
      ${this.levelRow({ key: 'passengerSeatHeat', label: `${this.t('comfort.passenger_seat')} · ${this.t('comfort.heating')}`, value: c.passengerSeatHeat, icon: 'mdi:car-seat-heater' })}
      ${this.levelRow({ key: 'passengerSeatVent', label: `${this.t('comfort.passenger_seat')} · ${this.t('comfort.ventilation')}`, value: c.passengerSeatVent, icon: 'mdi:car-seat-cooler' })}
      ${this.toggleRow('steeringWheelHeat', 'steeringWheelHeat', `${this.t('comfort.steering_wheel')}${wheelSuffix}`, c.steeringWheelHeat, 'mdi:steering')}
      ${this.toggleRow('mirrorHeat', 'mirrorHeat', this.t('comfort.mirrors'), c.mirrorHeat, 'mdi:mirror-rectangle')}
      ${this.toggleRow('batteryPreheat', 'batteryPreheat', this.t('comfort.battery_preheat'), c.batteryPreheat, 'mdi:battery-heart-variant')}
    </div>`
  }

  static override styles = [sharedStyles, css`
    .title { font-size: 1.05rem; font-weight: 600; margin-bottom: 8px; }
    .line { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 6px 0; font-size: 0.88rem; }
    .steps { display: flex; gap: 6px; }
    /* Pedido por confirmar, como o pino do painel de clima: (0,2,0) sobre
       .steps (0,1,0), e nenhum botão envolvido, portanto sem armadilha do
       all: unset. */
    .steps.pending { opacity: 0.6; }
    button.plain.step {
      width: 28px; height: 28px; border-radius: 50%;
      display: grid; place-items: center; background: var(--card-background-color); font-size: 0.8rem;
    }
    button.plain.step.active { background: var(--primary-color); color: var(--text-primary-color, #fff); }
    /* button.plain (theme.ts) está a (0,1,1): a convenção do projeto é o
       seletor composto, para nenhuma regra desta folha depender de contar
       classes contra o all: unset. */
    button.plain.toggle.on { color: var(--primary-color); }
    ha-icon { --mdc-icon-size: 18px; vertical-align: -3px; }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-comfort': LeapmotorComfort }
}
