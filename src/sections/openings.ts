import { LitElement, css, html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import {
  BLOCKED_WHILE_DRIVING, actionIcon, actionLabel, isActionAvailable, type ActionEventDetail,
} from '../actions'
import { areDoorsUnknown, areWindowsUnknown, isWindowOpen } from '../format'
import { DASH, type TranslateFn } from '../localize'
import { sharedStyles } from '../theme'
import type { ActionId, EntityMap, VehicleState } from '../types'

interface Row {
  key: string
  icon: string
  label: string
  value: string
  /** Detalhe por baixo do valor, quando há mais de uma coisa a dizer. */
  detail?: string
  warn: boolean
  /** A ação que a linha comanda. Ausente numa linha só de leitura. */
  action?: ActionId
}

@customElement('leapmotor-openings')
export class LeapmotorOpenings extends LitElement {
  @property({ attribute: false }) state!: VehicleState
  @property({ attribute: false }) t!: TranslateFn
  @property({ attribute: false }) map!: EntityMap
  @property({ type: String }) pending?: ActionId

  private openWindowCount(): number {
    return Object.values(this.state.openings.windows).filter(isWindowOpen).length
  }

  /** As portas abertas, nomeadas uma a uma. */
  private openDoors(): string[] {
    const { doors } = this.state.openings
    const named: [boolean | undefined, string][] = [
      [doors.driver, 'openings.door_driver'],
      [doors.passenger, 'openings.door_passenger'],
      [doors.rearLeft, 'openings.door_rear_left'],
      [doors.rearRight, 'openings.door_rear_right'],
    ]
    return named.filter(([open]) => open === true).map(([, key]) => this.t(key))
  }

  private openWindowNames(): string[] {
    const { windows } = this.state.openings
    const named: [keyof typeof windows, string][] = [
      ['fl', 'openings.window_fl'], ['fr', 'openings.window_fr'],
      ['rl', 'openings.window_rl'], ['rr', 'openings.window_rr'],
    ]
    return named.filter(([side]) => isWindowOpen(windows[side])).map(([, key]) => this.t(key))
  }

  /**
   * O valor de uma linha de contagem. Zero aberturas com zero leituras não é
   * «tudo fechado» — é ignorância, e essa escreve-se DASH. Ver spec §9.
   */
  private closedOrUnknown(nothingKnown: boolean, count: number, oneKey: string, manyKey: string): string {
    if (count === 0) return nothingKnown ? DASH : this.t('openings.all_closed')
    return this.t(count === 1 ? oneKey : manyKey, { count })
  }

  /**
   * O valor de uma linha booleana. As chaves vêm de fora, e não por omissão, de
   * propósito: em português o adjectivo concorda com o substantivo da linha, e
   * este card tem os dois géneros — a bagageira é «Aberta», o teto é «Aberto».
   * Cada chamada declara o género que quer, para nenhuma linha nova o herdar
   * por acidente. Não juntar os dois pares num só: em inglês as quatro chaves
   * dizem a mesma palavra e a duplicação parece redundante, mas é o que separa
   * os dois géneros em português.
   */
  private boolValue(v: boolean | undefined, openKey: string, closedKey: string): string {
    if (v === undefined) return DASH
    return this.t(v ? openKey : closedKey)
  }

  private rows(): Row[] {
    const o = this.state.openings
    const { locked } = this.state.lock
    const openWindows = this.openWindowCount()
    const openDoors = this.openDoors()

    return [
      {
        key: 'locks',
        // O ícone reporta a leitura, como em todas as outras linhas desta secção
        // (o botão é que carrega a ação) — e para uma leitura desconhecida o
        // cadeado fechado é o que não afirma nada, ao contrário do aberto, que
        // afirmaria "destrancado". É também o que o hero mostra para o mesmo
        // estado desconhecido; não alterar para concordar com a ação.
        icon: locked === false ? 'mdi:lock-open-variant-outline' : 'mdi:lock-outline',
        label: this.t('openings.locks'),
        // DASH, e não `doors_unknown`: esta linha já tem coluna de etiqueta, e
        // «Trancas → Portas» não é um valor. No hero a mesma chave está certa,
        // porque lá o chip é a etiqueta e o valor ao mesmo tempo.
        value: locked === undefined ? DASH : this.t(locked ? 'doors_locked' : 'doors_unlocked'),
        warn: locked === false && !this.state.lock.stale,
        // A ação é a oposta do estado, e o desconhecido conta como destrancado:
        // trancar um carro já trancado não faz mal, destrancar um carro cujo
        // estado se ignora faz. Daí a comparação ser contra `true` e não contra
        // `false` — com `locked === false ? 'lock' : 'unlock'`, o estado
        // desconhecido caía em destrancar, que é exactamente o lado errado.
        action: locked === true ? 'unlock' : 'lock',
      },
      {
        key: 'windows',
        icon: actionIcon('windows', this.state),
        label: this.t('openings.windows'),
        value: this.closedOrUnknown(areWindowsUnknown(o.windows), openWindows, 'openings.open_one', 'openings.open_count'),
        detail: openWindows > 0 ? this.openWindowNames().join(' · ') : undefined,
        warn: openWindows > 0,
        action: 'windows',
      },
      {
        key: 'doors',
        icon: 'mdi:car-door',
        label: this.t('openings.doors'),
        // Porta é feminina e uma só porta não são «abertas»: as chaves `_fem`
        // existem só por isto, e o singular vem da mesma regra que os vidros já
        // aplicavam. Em inglês as quatro chaves dizem o mesmo.
        value: this.closedOrUnknown(areDoorsUnknown(o.doors), openDoors.length, 'openings.open_one_fem', 'openings.open_count_fem'),
        detail: openDoors.length > 0 ? openDoors.join(' · ') : undefined,
        warn: openDoors.length > 0,
        // Sem ação, e de propósito: a integração não expõe comando de porta.
        // Uma linha com um botão que não faz nada é pior do que uma linha sem
        // botão. Ver spec §4.1.
      },
      {
        key: 'trunk',
        icon: actionIcon('trunk', this.state),
        label: this.t('openings.trunk'),
        value: this.boolValue(o.trunk, 'openings.open_fem', 'openings.closed_fem'),
        warn: o.trunk === true,
        action: 'trunk',
      },
      {
        key: 'roof',
        icon: 'mdi:window-shutter',
        label: this.t('openings.roof'),
        value: this.boolValue(o.roof, 'openings.open', 'openings.closed'),
        warn: o.roof === true,
      },
    ]
  }

  private disabled(action: ActionId): boolean {
    if (!isActionAvailable(action, this.state, this.map)) return true
    if (this.state.activity === 'driving' && BLOCKED_WHILE_DRIVING.includes(action)) return true
    return this.pending !== undefined
  }

  private fire(action: ActionId) {
    this.dispatchEvent(new CustomEvent<ActionEventDetail>('leapmotor-action', {
      detail: { action }, bubbles: true, composed: true,
    }))
  }

  /**
   * O botão de uma linha só existe se a ação for de facto resolvível: sem
   * entidade por trás, `isActionAvailable` diz não e a linha fica só de
   * leitura, em vez de oferecer um comando que ia falhar em silêncio.
   */
  private button(action: ActionId | undefined) {
    if (!action || !isActionAvailable(action, this.state, this.map)) return nothing
    const label = actionLabel(action, this.state, this.t)
    return html`<button
      class="do plain ${this.pending === action ? 'busy' : ''}"
      ?disabled=${this.disabled(action)}
      aria-label=${label}
      title=${label}
      @click=${() => this.fire(action)}
    >${label}</button>`
  }

  override render() {
    return html`<div class="panel">
      <div class="title">${this.t('openings.title')}</div>
      ${this.rows().map(row => html`
        <div class="line ${row.warn ? 'warn' : ''}">
          <ha-icon icon=${row.icon}></ha-icon>
          <div class="text">
            <div class="label">${row.label}</div>
            ${row.detail ? html`<div class="detail muted">${row.detail}</div>` : nothing}
          </div>
          <div class="value">${row.value}</div>
          ${this.button(row.action)}
        </div>
      `)}
    </div>`
  }

  static override styles = [sharedStyles, css`
    .title { font-size: 1.05rem; font-weight: 600; margin-bottom: 8px; }
    .line {
      display: grid;
      grid-template-columns: 24px minmax(0, 1fr) auto auto;
      align-items: center; gap: 10px;
      padding: 8px 0; font-size: 0.9rem;
      border-bottom: 1px solid var(--divider-color, rgba(127, 127, 127, 0.18));
    }
    .line:last-child { border-bottom: none; }
    .line ha-icon { --mdc-icon-size: 20px; color: var(--lm-muted); }
    .line.warn ha-icon, .line.warn .value { color: var(--lm-warn); }
    .text { min-width: 0; }
    .detail { font-size: 0.72rem; margin-top: 1px; }
    .value { white-space: nowrap; }
    /*
     * Seletor composto: o button.plain do theme.ts faz all: unset a
     * (0,1,1) e apagaria fundo, padding, cantos e box-sizing deste botão.
     */
    button.do.plain {
      box-sizing: border-box; display: inline-flex; justify-content: center;
      padding: 5px 10px; border-radius: 999px;
      background: var(--lm-chip); color: var(--lm-text);
      font-size: 0.76rem; white-space: nowrap;
    }
    button.do.plain.busy { animation: pulse 900ms ease-in-out infinite; }
    @keyframes pulse { 50% { opacity: 0.45; } }
    @media (max-width: 360px) {
      .line { grid-template-columns: 20px minmax(0, 1fr) auto; row-gap: 4px; }
      button.do.plain { grid-column: 3; }
    }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-openings': LeapmotorOpenings }
}
