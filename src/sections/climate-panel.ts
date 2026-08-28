import { LitElement, css, html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import {
  TARGET_TEMP_DECIMALS, nextStepTemperature, shownLevel,
  type ActionEventDetail, type ActionPayload, type ClimateChange, type SeatLevels,
} from '../actions'
import { CAR_TOPVIEW } from '../car-topview'
import { formatNumber } from '../format'
import type { LogicalKey, SeatLevelKey } from '../keys'
import type { TranslateFn } from '../localize'
import { sharedStyles } from '../theme'
import type { ActionId, EntityMap, VehicleState } from '../types'

const FAN_MIN = 1
const FAN_MAX = 7

/**
 * Um controlo sobreposto à vista de topo. `left`/`top` são percentagens da
 * caixa da vista, não pixéis: a vista escala com a largura do card e os
 * controlos têm de a acompanhar.
 */
interface Pin { left: string; top: string }

@customElement('leapmotor-climate-panel')
export class LeapmotorClimatePanel extends LitElement {
  @property({ attribute: false }) state!: VehicleState
  @property({ attribute: false }) t!: TranslateFn
  @property({ attribute: false }) map!: EntityMap
  /** Nível máximo dos assentos, lido do atributo `max` das entidades number. */
  @property({ type: Number }) maxLevel = 3
  /**
   * A integração não expõe a velocidade da ventoinha, por isso este valor vive
   * no card (que sobrevive ao colapso do painel) e não aqui: um `@internalState`
   * local voltaria a 3 sempre que o utilizador fechasse e reabrisse o painel, e
   * o toque seguinte no stepper mandaria essa 3 para o carro sem o avisar.
   */
  @property({ attribute: false }) fanSpeed = 3

  /**
   * Temperatura e recirculação pedidas e ainda não confirmadas pelo carro.
   * Chegam do card, que sobrevive ao colapso do painel: guardá-las aqui fazia
   * com que fechar e reabrir o tile as apagasse, e o comando seguinte caía na
   * leitura antiga e desfazia o pedido do utilizador — a lição do `fanSpeed`,
   * aplicada agora também aqui.
   */
  @property({ attribute: false }) pendingTemp?: number
  @property({ attribute: false }) pendingRecirc?: boolean

  /**
   * Os níveis que o painel mostra: já reconciliados pelo card, que é quem guarda
   * os pedidos (`SeatRequests`). São números, não pedidos — daí o nome próprio.
   */
  @property({ attribute: false }) shownLevels: SeatLevels = {}

  private get shownTemp(): number | undefined {
    return this.pendingTemp ?? this.state.climate.targetC
  }

  /** `undefined` é «não sei», e é mostrado como tal — não como «desligada». */
  private get shownRecirc(): boolean | undefined {
    return this.pendingRecirc ?? this.state.climate.recirculating
  }

  private fire(action: ActionId, payload?: ActionPayload) {
    this.dispatchEvent(new CustomEvent<ActionEventDetail>('leapmotor-action', {
      detail: { action, payload }, bubbles: true, composed: true,
    }))
  }

  private setNumber(key: LogicalKey, value: number) {
    this.dispatchEvent(new CustomEvent<{ key: LogicalKey; value: number }>('leapmotor-set-number', {
      detail: { key, value }, bubbles: true, composed: true,
    }))
  }

  /**
   * Só os campos que este controlo mudou, e num evento próprio: uma mudança
   * parcial não é um comando, e não tem por isso como chegar ao `resolveAction`
   * — que só sabe trabalhar com comandos completos. É o mesmo padrão do
   * `leapmotor-fan-speed` e do `leapmotor-set-number`. Quem acumula as mudanças
   * e compõe o comando é o card.
   */
  private sendClimate(change: ClimateChange) {
    this.dispatchEvent(new CustomEvent<ClimateChange>('leapmotor-climate-change', {
      detail: change, bubbles: true, composed: true,
    }))
  }

  private step(delta: number) {
    const next = nextStepTemperature(this.shownTemp, delta)
    // O agrupamento por atraso não vive aqui: o card destrói este painel ao
    // colapsar o tile, o que cancelaria um envio ainda pendente sem qualquer
    // aviso (spec v2, achado 3). `leapmotor-card.ts`, que sobrevive ao painel,
    // é quem agrupa os toques e envia só um comando.
    this.sendClimate({ temperature: next })
  }

  /**
   * Sem leitura não há oposto: com o estado desconhecido, o toque pede a
   * recirculação LIGADA — uma escolha explícita do utilizador — em vez de fingir
   * que estava desligada e «inverter» a partir daí.
   */
  private toggleRecirc() {
    const shown = this.shownRecirc
    const next = shown === undefined ? true : !shown
    this.sendClimate({ recirculate: next })
  }

  /** A velocidade escolhida só chega ao carro no próximo `set_climate`. */
  private onFan(e: Event) {
    const value = Number((e.target as HTMLInputElement).value)
    this.dispatchEvent(new CustomEvent<{ value: number }>('leapmotor-fan-speed', {
      detail: { value }, bubbles: true, composed: true,
    }))
  }

  /** Um interruptor sobreposto à vista: espelhos, volante. */
  private pinToggle(action: ActionId, key: LogicalKey, icon: string, label: string, on: boolean | undefined, at: Pin) {
    if (!this.map[key]) return nothing
    return html`<button
      class="plain pin ${on ? 'on' : ''}"
      style="left:${at.left};top:${at.top}"
      @click=${() => this.fire(action)}
      title=${label}
      aria-label=${label}
      aria-pressed=${on === undefined ? nothing : (on ? 'true' : 'false')}
    ><ha-icon icon=${icon}></ha-icon></button>`
  }

  /** Um nível de assento sobreposto à vista: cada toque cicla 0 → max → 0. */
  private pinLevel(key: SeatLevelKey, icon: string, label: string, at: Pin) {
    if (!this.map[key]) return nothing
    // O alvo do ciclo vem do valor mostrado, que já inclui o pedido por
    // confirmar: dois toques seguidos avançam dois níveis em vez de mandarem
    // duas vezes o mesmo, enquanto o Home Assistant não escreve o estado novo.
    // `shownLevel` é partilhado com a secção de conforto, que mostra os mesmos
    // quatro níveis e não pode responder outra coisa no mesmo ecrã.
    const { level, pending } = shownLevel(this.shownLevels[key], this.state.comfort[key])
    // `formatNumber` já devolve DASH para `undefined`.
    const shown = formatNumber(level, 0)
    const next = ((level ?? 0) + 1) % (this.maxLevel + 1)
    // O nível vai no rótulo porque o `aria-label` tapa o conteúdo do botão: sem
    // ele, um leitor de ecrã anunciava o assento sem dizer em que nível está.
    // Sem `aria-pressed`: isto cicla por vários níveis, não é um interruptor.
    const spoken = `${label} · ${shown}`
    return html`<button
      class="plain pin ${level ? 'on' : ''} ${pending ? 'pending' : ''}"
      style="left:${at.left};top:${at.top}"
      @click=${() => this.setNumber(key, next)}
      title=${spoken}
      aria-label=${spoken}
    >
      <ha-icon icon=${icon}></ha-icon>
      <span class="level">${shown}</span>
    </button>`
  }

  private button(action: ActionId, key: LogicalKey, icon: string, label: string, on = false) {
    if (!this.map[key]) return nothing
    return html`<button class="plain tile-btn ${on ? 'on' : ''}" @click=${() => this.fire(action)} title=${label}>
      <span class="circle"><ha-icon icon=${icon}></ha-icon></span>
      <span class="label">${label}</span>
    </button>`
  }

  private topview() {
    const c = this.state.comfort
    const driver = this.t('comfort.driver_seat')
    const passenger = this.t('comfort.passenger_seat')
    const heating = this.t('comfort.heating')
    const ventilation = this.t('comfort.ventilation')
    return html`<div class="topview">
      ${CAR_TOPVIEW}
      ${this.pinToggle('mirrorHeat', 'mirrorHeat', 'mdi:car-side', this.t('comfort.mirrors'), c.mirrorHeat, { left: '50%', top: '31.6%' })}
      ${this.pinToggle('steeringWheelHeat', 'steeringWheelHeat', 'mdi:steering', this.t('comfort.steering_wheel'), c.steeringWheelHeat, { left: '31%', top: '41.8%' })}
      ${this.pinLevel('driverSeatHeat', 'mdi:car-seat-heater', `${driver} · ${heating}`, { left: '26%', top: '63.3%' })}
      ${this.pinLevel('driverSeatVent', 'mdi:car-seat-cooler', `${driver} · ${ventilation}`, { left: '44%', top: '63.3%' })}
      ${this.pinLevel('passengerSeatHeat', 'mdi:car-seat-heater', `${passenger} · ${heating}`, { left: '59%', top: '63.3%' })}
      ${this.pinLevel('passengerSeatVent', 'mdi:car-seat-cooler', `${passenger} · ${ventilation}`, { left: '77%', top: '63.3%' })}
    </div>`
  }

  override render() {
    const temp = this.shownTemp
    const pending = this.pendingTemp !== undefined
    const recirc = this.shownRecirc
    const recircPending = this.pendingRecirc !== undefined
    // `set_climate` liga a climatização como efeito do comando; mexer na
    // recirculação com o A/C desligado ligá-lo-ia sem o utilizador o pedir.
    const climateOn = this.state.climate.on === true
    const recircLabel = this.t('climate.recirculation')
    const recircTitle = !climateOn
      ? this.t('climate.recirculation_off_hint')
      : recirc === undefined ? this.t('climate.recirculation_unknown') : recircLabel

    return html`<div class="panel">
      <div class="title">${this.t('climate.title')}</div>

      ${this.topview()}

      <div class="stepper">
        <button class="plain step-btn" @click=${() => this.step(-1)} title=${this.t('climate.cooler')} aria-label=${this.t('climate.cooler')}>
          <ha-icon icon="mdi:minus"></ha-icon>
        </button>
        <div class="value ${pending ? 'pending' : ''}">
          <span class="big">${formatNumber(temp, TARGET_TEMP_DECIMALS)}</span><span class="unit muted">°C</span>
        </div>
        <button class="plain step-btn" @click=${() => this.step(1)} title=${this.t('climate.warmer')} aria-label=${this.t('climate.warmer')}>
          <ha-icon icon="mdi:plus"></ha-icon>
        </button>
      </div>
      <div class="hint muted">${this.t('climate.hint')}</div>

      <div class="line">
        <span class="muted"><ha-icon icon="mdi:fan"></ha-icon> ${this.t('climate.fan')}</span>
        <span class="reading">${formatNumber(this.fanSpeed, 0)}</span>
      </div>
      <input
        class="slider" type="range" min=${FAN_MIN} max=${FAN_MAX} step="1"
        aria-label=${this.t('climate.fan')}
        .value=${String(this.fanSpeed)}
        @input=${this.onFan}
      />
      <div class="hint muted">${this.t('climate.fan_note')}</div>

      <div class="line">
        <span class="muted"><ha-icon icon="mdi:air-filter"></ha-icon> ${recircLabel}</span>
        <button
          class="plain toggle ${recirc ? 'on' : ''} ${recircPending ? 'pending' : ''}"
          ?disabled=${!climateOn}
          title=${recircTitle}
          aria-label=${recircTitle}
          aria-pressed=${recirc === undefined ? nothing : (recirc ? 'true' : 'false')}
          @click=${this.toggleRecirc}
        >
          <ha-icon icon=${recirc === undefined
            ? 'mdi:help-circle-outline'
            : recirc ? 'mdi:toggle-switch' : 'mdi:toggle-switch-off-outline'}></ha-icon>
        </button>
      </div>

      <div class="grid">
        ${this.button('climate', 'climateSwitch', 'mdi:air-conditioner', this.t('climate.ac'), climateOn)}
        ${this.button('quickCool', 'quickCool', 'mdi:snowflake', this.t('action.quickCool'))}
        ${this.button('quickHeat', 'quickHeat', 'mdi:fire', this.t('action.quickHeat'))}
        ${this.button('defrost', 'windshieldDefrost', 'mdi:car-defrost-front', this.t('action.defrost'))}
      </div>
    </div>`
  }

  static override styles = [sharedStyles, css`
    .title { font-size: 1.05rem; font-weight: 600; }
    /*
     * A largura da vista não é decoração, é geometria. O SVG tem viewBox
     * 200x196 e nenhuma dimensão própria, logo a caixa mede W x 0,98W e as
     * percentagens dos pinos resolvem contra ela. Com pinos de lado L = 12,5%
     * de W, as folgas são todas proporcionais e nenhuma chega a zero:
     *   - corredor entre os assentos (44% -> 59%): 0,15W - L = 0,025W;
     *   - pino dos espelhos ao topo (top: 31,6%): 0,316 x 0,98W - L/2 = 0,247W;
     *   - espelhos ao volante: separados 19% em x, ou seja 0,19W - L = 0,065W.
     * A 320px o pino dá exactamente os 40px de alvo de toque. O min() é isso:
     * 40px enquanto a vista tem 320px, proporcional (e portanto sem
     * sobreposição) se o card for mais estreito do que isso.
     *
     * O container-type serve o cqw do conteúdo do pino, abaixo: 1cqw é 1% de W,
     * portanto ícone e dígito escalam com a caixa em vez de ficarem em píxeis
     * fixos, que transbordavam o círculo em cards estreitos.
     */
    .topview {
      position: relative; width: 100%; max-width: 320px; margin: 12px auto 4px;
      container-type: inline-size;
    }
    .topview svg { display: block; width: 100%; height: auto; }
    /*
     * button.plain (theme.ts) faz all: unset a (0,1,1) — perde-se position,
     * box-sizing, largura, altura, padding, fundo e cantos, ou seja, a caixa
     * inteira. Um pin sem position: absolute cairia em fluxo por baixo da vista
     * de topo e nenhum destes controlos ficaria sobre o carro. Por isso a caixa
     * vive no seletor composto, tal como .step-btn abaixo e button.plain.tile
     * em tiles.ts. A altura vem do aspect-ratio e não de uma percentagem: uma
     * percentagem de altura resolveria contra a ALTURA da vista (0,98W), o que
     * daria um pino oval.
     */
    button.plain.pin {
      position: absolute; box-sizing: border-box;
      transform: translate(-50%, -50%);
      display: grid; place-items: center; gap: 0;
      width: min(40px, 12.5%); aspect-ratio: 1; padding: 0;
      border-radius: 50%; background: var(--card-background-color);
      color: var(--lm-muted);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }
    button.plain.pin.on { color: var(--primary-color); }
    button.plain.pin.pending { opacity: 0.6; }
    /*
     * Em píxeis fixos o conteúdo do pino saía do círculo abaixo de uma vista de
     * ~223px. 5,6cqw e 3,1cqw são exactamente os 18px e os 9,9px de uma vista a
     * 320px, mas expressos na mesma unidade que a caixa (12,5cqw): 8,7cqw de
     * conteúdo em 12,5cqw de caixa, relação que não depende da largura.
     *
     * O recuo tem de ser um @supports e não uma segunda declaração: o valor de
     * uma propriedade PERSONALIZADA é qualquer sequência de tokens, portanto
     * nenhum browser descarta um --mdc-icon-size: 5.6cqw no parse, saiba ele o
     * que é cqw ou não — e quem não souber acaba com a width: var(...) do
     * ha-icon inválido no tempo de valor computado, ou seja com auto, e não
     * com os 18px. Dentro do @supports, quem não tem container queries fica
     * com as declarações em píxeis, que é o que se pretende.
     */
    button.plain.pin ha-icon { --mdc-icon-size: 18px; }
    .level { font-size: 0.62rem; line-height: 1; font-variant-numeric: tabular-nums; }
    @supports (container-type: inline-size) {
      button.plain.pin ha-icon { --mdc-icon-size: 5.6cqw; }
      .level { font-size: 3.1cqw; }
    }
    .stepper { display: flex; align-items: center; justify-content: center; gap: 20px; margin: 14px 0; }
    /*
     * button.plain (theme.ts) faz all: unset a (0,1,1); uma regra .step-btn
     * isolada a (0,1,0) perdia display, place-items, width, height,
     * border-radius e background. A caixa do botão vive por isso no seletor
     * composto, tal como button.plain.tile em tiles.ts.
     */
    button.plain.step-btn {
      display: grid; place-items: center; width: 44px; height: 44px;
      border-radius: 50%; background: var(--lm-chip);
    }
    .value { display: flex; align-items: baseline; gap: 4px; }
    .value.pending { opacity: 0.6; }
    .big { font-size: 2.2rem; font-weight: 300; line-height: 1; }
    .unit { font-size: 0.9rem; }
    .hint { font-size: 0.75rem; text-align: center; margin-bottom: 14px; }
    .line { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 0.88rem; }
    .line ha-icon { --mdc-icon-size: 18px; vertical-align: -3px; }
    .reading { font-variant-numeric: tabular-nums; }
    .slider { width: 100%; margin: 6px 0 2px; accent-color: var(--primary-color); }
    /*
     * Também aqui a caixa inteira, e não só a cor: o botão da recirculação está
     * ao lado de controlos de 40-44px e, sem caixa própria, só o ícone de 18px
     * era área de toque. As propriedades cursor e opacity ficam de fora de
     * propósito — button.plain[disabled] está na mesma especificidade (0,2,1)
     * e é ele que as deve declarar.
     */
    button.plain.toggle {
      box-sizing: border-box; display: grid; place-items: center;
      width: 40px; height: 40px; padding: 0;
      border-radius: 50%; background: transparent;
    }
    button.plain.toggle.on { color: var(--primary-color); }
    /*
     * :not([disabled]) porque (0,3,1) ganharia ao button.plain[disabled] (0,2,1)
     * e um botão pendente e desactivado ao mesmo tempo — tocar na recirculação e
     * o A/C desligar-se logo a seguir — aparecia a 0,6 em vez dos 0,4 de
     * desactivado.
     */
    button.plain.toggle.pending:not([disabled]) { opacity: 0.6; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(64px, 1fr)); gap: 8px; margin-top: 14px; }
    button.plain.tile-btn { flex-direction: column; }
    /* button.plain (theme.ts) sits at specificity (0,1,1); a bare .on class
       (0,1,0) cannot override it, so the on/off colour needs the same
       compound-selector treatment as the tile's .fab.on (tiles.ts). */
    button.plain.tile-btn.on { color: var(--primary-color); }
    .circle { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 50%; background: var(--lm-chip); }
    .label { font-size: 0.72rem; text-align: center; line-height: 1.15; }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-climate-panel': LeapmotorClimatePanel }
}
