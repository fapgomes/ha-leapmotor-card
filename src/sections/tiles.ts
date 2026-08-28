import { LitElement, css, html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { TARGET_TEMP_DECIMALS, type ActionEventDetail, type ExpandPanel } from '../actions'
import { formatNumber, isWindowOpen } from '../format'
import { DASH, type TranslateFn } from '../localize'
import { sharedStyles } from '../theme'
import type { VehicleState } from '../types'

@customElement('leapmotor-tiles')
export class LeapmotorTiles extends LitElement {
  @property({ attribute: false }) state!: VehicleState
  @property({ attribute: false }) t!: TranslateFn
  @property({ type: Boolean }) climateToggleable = false
  /** Qual painel está expandido, decidido pelo card. */
  @property({ type: String }) expanded?: ExpandPanel | null
  /**
   * A temperatura pedida e ainda não confirmada, vinda do card. O painel de
   * clima só aparece com este tile visível, oito píxeis abaixo: sem isto, o
   * stepper mostrava 25 (pendente) enquanto o tile mostrava «Alvo 24,0 °C».
   */
  @property({ attribute: false }) pendingTemp?: number

  private openingsSummary(): string {
    const { openCount } = this.state.openings
    if (openCount === 0) return this.t('tiles.all_closed')
    if (openCount === 1) return this.t('tiles.open_one')
    return this.t('tiles.open_count', { count: openCount })
  }

  private openingsDetail(): string {
    const o = this.state.openings
    const names: string[] = []
    if (Object.values(o.doors).some(d => d === true)) names.push(this.t('tiles.doors'))
    if (o.trunk) names.push(this.t('action.trunk_open'))
    if (o.roof) names.push(this.t('tiles.roof'))
    const openWindows = Object.values(o.windows).filter(isWindowOpen).length
    if (openWindows > 0) names.push(this.t('action.windows_open'))
    return names.join(' · ')
  }

  /**
   * Versão itemizada das aberturas, usada só quando o tile está expandido. Ao
   * contrário de `openingsDetail`, que agrupa por categoria ("Doors"), esta
   * lista uma linha por porta/vidro concretamente aberto.
   */
  private openingsRows(): string[] {
    const o = this.state.openings
    const rows: string[] = []
    const doors: [boolean | undefined, string][] = [
      [o.doors.driver, 'openings.door_driver'],
      [o.doors.passenger, 'openings.door_passenger'],
      [o.doors.rearLeft, 'openings.door_rear_left'],
      [o.doors.rearRight, 'openings.door_rear_right'],
    ]
    for (const [open, key] of doors) if (open === true) rows.push(this.t(key))
    const windows: [keyof typeof o.windows, string][] = [
      ['fl', 'openings.window_fl'], ['fr', 'openings.window_fr'],
      ['rl', 'openings.window_rl'], ['rr', 'openings.window_rr'],
    ]
    for (const [side, key] of windows) if (isWindowOpen(o.windows[side])) rows.push(this.t(key))
    if (o.trunk === true) rows.push(this.t('action.trunk_open'))
    if (o.roof === true) rows.push(this.t('tiles.roof'))
    // Nada aberto: sem isto a lista expandida ficaria vazia e o toque pareceria
    // não ter feito nada. Reaproveita a mesma chave usada na legenda recolhida.
    if (rows.length === 0) rows.push(this.t('tiles.all_closed'))
    return rows
  }

  private toggle(panel: 'climate' | 'openings') {
    this.dispatchEvent(new CustomEvent('leapmotor-expand', {
      detail: { panel: this.expanded === panel ? null : panel },
      bubbles: true, composed: true,
    }))
  }

  private toggleClimate(e: Event) {
    // O botão da ventoinha vive dentro do tile de clima, que agora é também um
    // botão de expansão. Sem parar a propagação, ligar a climatização também
    // expandiria o painel.
    e.stopPropagation()
    if (!this.climateToggleable) return
    this.dispatchEvent(new CustomEvent<ActionEventDetail>('leapmotor-action', {
      detail: { action: 'climate' }, bubbles: true, composed: true,
    }))
  }

  override render() {
    const { climate } = this.state
    const climateExpanded = this.expanded === 'climate'
    // O mesmo alvo que o painel de clima mostra, pela mesma regra: o pedido por
    // confirmar ganha à leitura, e vê-se que está pendente.
    const target = this.pendingTemp ?? climate.targetC
    const targetPending = this.pendingTemp !== undefined
    const openingsExpanded = this.expanded === 'openings'
    return html`<div class="tiles">
      <div class="tile-shell">
        <button
          class="plain tile"
          @click=${() => this.toggle('climate')}
          aria-expanded=${climateExpanded ? 'true' : 'false'}
          title=${climateExpanded ? this.t('collapse') : this.t('expand')}
        >
          <div class="value">
            <span class="big">${formatNumber(climate.interiorC, 0)}</span>
            <span class="unit muted">°C</span>
          </div>
          <div class="caption muted">${this.t('tiles.interior')}</div>
          <div class="caption muted">
            ${target !== undefined
              ? html`<span class="${targetPending ? 'pending' : ''}">${this.t('tiles.target', { temp: `${formatNumber(target, TARGET_TEMP_DECIMALS)} °C` })}</span>`
              : DASH}
          </div>
        </button>
        ${this.climateToggleable
          ? html`<button class="plain fab ${climate.on ? 'on' : ''}" @click=${this.toggleClimate} title=${this.t('action.climate')}>
              <ha-icon icon="mdi:fan"></ha-icon>
            </button>`
          : nothing}
      </div>

      <button
        class="plain tile"
        @click=${() => this.toggle('openings')}
        aria-expanded=${openingsExpanded ? 'true' : 'false'}
        title=${openingsExpanded ? this.t('collapse') : this.t('expand')}
      >
        <div class="value"><span class="mid">${this.openingsSummary()}</span></div>
        <div class="caption muted">${this.t('tiles.openings')}</div>
        ${openingsExpanded
          ? html`<div class="detail-list">${this.openingsRows().map(row => html`<div>${row}</div>`)}</div>`
          : html`<div class="caption muted">${this.openingsDetail()}</div>`}
        <div class="fab static ${this.state.openings.openCount === 0 ? 'ok' : 'warn'}">
          <ha-icon icon=${this.state.openings.openCount === 0 ? 'mdi:car-door-lock' : 'mdi:car-door'}></ha-icon>
        </div>
      </button>
    </div>`
  }

  static override styles = [sharedStyles, css`
    .tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: var(--lm-gap); }
    /*
     * button.plain (theme.ts) faz all: unset, que a (0,1,1) reinicia TODAS
     * as propriedades — fundo, cantos, padding, min-height e position
     * incluídos. Uma regra .tile a (0,1,0) perde-as todas. Por isso a caixa
     * do tile vive aqui, no seletor composto a (0,2,1), e não numa regra .tile
     * separada. Sem o position: relative, o .fab absoluto lá dentro
     * posiciona-se contra o card e vai para o fundo dele; sem o box-sizing,
     * all: unset repõe content-box e width: 100% mais padding transborda
     * a célula da grelha.
     */
    button.plain.tile {
      display: block; width: 100%; text-align: start; box-sizing: border-box;
      position: relative; background: var(--lm-chip);
      border-radius: var(--lm-radius); padding: 14px; min-height: 116px;
    }
    /*
     * The fan on/off control must stay a real <button> (see the
     * button.plain.fab rule below, needed for the same specificity reason),
     * but a <button> cannot contain another <button>: the HTML parser closes
     * the outer one as soon as it meets the inner start tag, which would
     * silently pull the fan out of the tile and break its absolute
     * positioning. .tile-shell keeps them as positioned siblings instead —
     * same visual result, valid DOM.
     */
    .tile-shell { position: relative; }
    .value { display: flex; align-items: baseline; gap: 4px; }
    /* Pedido por confirmar, como no painel de clima e nos níveis de assento. */
    .pending { opacity: 0.6; }
    .big { font-size: 2rem; font-weight: 300; line-height: 1; }
    .mid { font-size: 1.1rem; font-weight: 600; line-height: 1.2; }
    .unit { font-size: 0.85rem; }
    .caption { font-size: 0.75rem; margin-top: 4px; }
    .detail-list { margin-top: 8px; display: flex; flex-direction: column; gap: 4px; font-size: 0.78rem; }
    .fab {
      position: absolute; inset-inline-end: 10px; inset-block-end: 10px;
      display: grid; place-items: center; width: 40px; height: 40px;
      border-radius: 50%; background: var(--card-background-color);
    }
    /*
     * button.plain (theme.ts) faz all: unset a (0,1,1), que reinicia TODAS as
     * propriedades da .fab acima — não só display/place-items, mas também
     * position, os insets, width, height, border-radius e background. Sem
     * este seletor composto a repor tudo isso, o botão da ventoinha ficava
     * sem círculo nem posição (achado do audit desta sessão).
     */
    button.plain.fab {
      display: grid; place-items: center; box-sizing: border-box;
      position: absolute; inset-inline-end: 10px; inset-block-end: 10px;
      width: 40px; height: 40px; border-radius: 50%;
      background: var(--card-background-color);
    }
    .fab.on { color: var(--primary-color); }
    .fab.warn { color: var(--leapmotor-battery-mid, #f5a623); }
    .fab.static { pointer-events: none; }
    @media (max-width: 400px) { .tiles { grid-template-columns: 1fr; } }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-tiles': LeapmotorTiles }
}
