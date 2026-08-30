import { LitElement, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { CAR_TOPVIEW } from '../car-topview'
import { formatNumber } from '../format'
import type { TranslateFn } from '../localize'
import { sharedStyles } from '../theme'
import { DEFAULT_TIRE_RANGE, type VehicleState } from '../types'

const CORNERS = [
  { key: 'fl', tk: 'tires.corner_fl', area: 'fl' },
  { key: 'fr', tk: 'tires.corner_fr', area: 'fr' },
  { key: 'rl', tk: 'tires.corner_rl', area: 'rl' },
  { key: 'rr', tk: 'tires.corner_rr', area: 'rr' },
] as const

@customElement('leapmotor-tires')
export class LeapmotorTires extends LitElement {
  @property({ attribute: false }) state!: VehicleState
  @property({ attribute: false }) t!: TranslateFn
  /**
   * A faixa considerada normal, já validada pelo card (`clampTireRange`). Era
   * uma constante fixa neste ficheiro, e era estreita: um carro a 2,8 bar
   * acusava aviso. Chama-se `limits` e não `range` para não se confundir com a
   * autonomia, que em `VehicleState` também é `range`.
   */
  @property({ attribute: false }) limits: readonly [number, number] = DEFAULT_TIRE_RANGE

  private outOfRange(v: number | undefined): boolean {
    const [min, max] = this.limits
    return v !== undefined && (v < min || v > max)
  }

  override render() {
    const tires = this.state.tires
    const anyWarning = CORNERS.some(c => this.outOfRange(tires[c.key]))
    return html`<div class="panel">
      <div class="title">${this.t('tires.title')}</div>
      <div class="diagram">
        <div class="car">${CAR_TOPVIEW}</div>
        ${CORNERS.map(c => html`
          <div class="corner ${c.area} ${this.outOfRange(tires[c.key]) ? 'warn' : ''}">
            <div class="pressure">
              ${formatNumber(tires[c.key], 1)}
              <span class="unit muted">${this.t('tires.unit')}</span>
            </div>
            <div class="corner-label muted">${this.t(c.tk)}</div>
          </div>
        `)}
      </div>
      <div class="footer ${anyWarning ? 'warn' : 'muted'}">
        ${anyWarning ? this.t('tires.warning') : this.t('tires.no_warning')}
      </div>
    </div>`
  }

  static override styles = [sharedStyles, css`
    .title { font-size: 1.05rem; font-weight: 600; margin-bottom: 12px; }
    /*
     * Cinco células: o carro ao centro, um valor em cada canto. A grelha
     * resolve contra a caixa do CAR_TOPVIEW, que é 200 x 320 — daí a coluna
     * do meio ser a mais larga e as linhas do meio serem as que sobram.
     */
    .diagram {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      grid-template-rows: auto 1fr auto;
      grid-template-areas:
        "fl car fr"
        ".  car ."
        "rl car rr";
      align-items: center; justify-items: center;
      gap: 4px 8px;
    }
    .car { grid-area: car; display: flex; }
    .car svg { width: 100%; max-width: 110px; height: auto; max-height: 220px; }
    .corner.fl { grid-area: fl; }
    .corner.fr { grid-area: fr; }
    .corner.rl { grid-area: rl; }
    .corner.rr { grid-area: rr; }
    .corner { text-align: center; }
    .corner.warn .pressure { color: var(--lm-warn); }
    .pressure { font-size: 1.35rem; font-weight: 500; white-space: nowrap; }
    .pressure .unit { font-size: 0.75rem; font-weight: 400; }
    .corner-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; }
    .footer { margin-top: 12px; font-size: 0.78rem; text-align: center; }
    .footer.warn { color: var(--lm-warn); }
    @media (max-width: 340px) {
      .pressure { font-size: 1.1rem; }
      .car svg { max-width: 84px; }
    }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-tires': LeapmotorTires }
}
