import { LitElement, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import type { AlertLevel, ResolvedGroup } from '../groups'
import { batteryColor, sharedStyles } from '../theme'
import type { GroupId, VehicleState } from '../types'

export interface GridTile {
  group: ResolvedGroup
  /** Já resolvido: a sobreposição do utilizador, ou a tradução. */
  title: string
  summary: string
  alert: AlertLevel
}

@customElement('leapmotor-group-grid')
export class LeapmotorGroupGrid extends LitElement {
  @property({ attribute: false }) tiles: GridTile[] = []
  @property({ attribute: false }) state!: VehicleState

  /**
   * Devolve o foco ao tile que abriu uma sub-vista. Chamado pelo card depois de
   * fechar: sem isto, o foco voltava ao topo do documento e navegar por teclado
   * dava-se por perdido.
   */
  public focusTile(id: GroupId): void {
    this.renderRoot.querySelector<HTMLButtonElement>(`button[data-group="${id}"]`)?.focus()
  }

  private open(id: GroupId) {
    this.dispatchEvent(new CustomEvent('leapmotor-open-group', {
      detail: { group: id }, bubbles: true, composed: true,
    }))
  }

  /**
   * A cor do ícone e do resumo. A carga é a excepção e não passa pelo nível de
   * alerta: usa a cor da bateria, que já dá verde, âmbar e vermelho por
   * percentagem, e que o hero já mostra na barra logo acima. Ver spec §4.2.
   */
  private accent(tile: GridTile): string {
    if (tile.group.id === 'charging') return batteryColor(this.state.battery)
    if (tile.alert === 'alert') return 'var(--lm-alert)'
    if (tile.alert === 'warn') return 'var(--lm-warn)'
    return 'var(--lm-text)'
  }

  override render() {
    return html`<div class="grid">
      ${this.tiles.map(tile => html`
        <button
          class="tile plain ${tile.alert}"
          data-group=${tile.group.id}
          aria-label="${tile.title}: ${tile.summary}"
          @click=${() => this.open(tile.group.id)}
        >
          <span class="icon" style="color:${this.accent(tile)}">
            <ha-icon icon=${tile.group.icon}></ha-icon>
          </span>
          <span class="text">
            <span class="tile-title">${tile.title}</span>
            <span class="tile-summary" style="color:${this.accent(tile)}">${tile.summary}</span>
          </span>
        </button>
      `)}
    </div>`
  }

  static override styles = [sharedStyles, css`
    .grid {
      display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px; margin-top: var(--lm-gap);
    }
    /*
     * Seletor composto, e não .tile: o button.plain do theme.ts faz
     * all: unset a (0,1,1) e apagaria fundo, padding, cantos, dimensões e
     * box-sizing. Ver o aviso no theme.ts — isto já produziu seis defeitos
     * neste projeto, dois deles visíveis no dashboard de um utilizador.
     */
    button.tile.plain {
      box-sizing: border-box; display: flex; align-items: center; gap: 12px;
      width: 100%; min-width: 0; padding: 12px;
      background: var(--lm-chip); border-radius: var(--lm-radius);
      text-align: start; color: var(--lm-text);
      transition: transform 120ms ease;
    }
    button.tile.plain:active { transform: scale(0.985); }
    button.tile.plain.warn { box-shadow: inset 0 0 0 1px var(--lm-warn); }
    button.tile.plain.alert { box-shadow: inset 0 0 0 1px var(--lm-alert); }
    .icon {
      display: grid; place-items: center; flex: 0 0 auto;
      width: 38px; height: 38px; border-radius: 50%;
      background: var(--card-background-color);
    }
    .text { display: flex; flex-direction: column; min-width: 0; }
    .tile-title { font-size: 0.9rem; font-weight: 600; }
    .tile-summary {
      font-size: 0.8rem; margin-top: 2px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    @media (max-width: 320px) { .grid { grid-template-columns: minmax(0, 1fr); } }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-group-grid': LeapmotorGroupGrid }
}
