import { LitElement, css, html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import {
  TARGET_TEMP_DECIMALS, actionLabel, nextStepTemperature, shownLevel,
  type ActionEventDetail, type ActionPayload, type ClimateChange, type SeatLevels,
} from '../actions'
import { CABIN_TOPVIEW } from '../cabin-topview'
import { formatNumber } from '../format'
import type { LogicalKey, SeatLevelKey } from '../keys'
import type { TranslateFn } from '../localize'
import { sharedStyles } from '../theme'
import type { ActionId, EntityMap, VehicleState } from '../types'

const FAN_MIN = 1
const FAN_MAX = 7

/**
 * O sítio de um controlo sobreposto à vista da cabina. `left`/`top` são
 * percentagens da caixa da vista, não pixéis: a vista escala com a largura do
 * card e os controlos têm de a acompanhar.
 */
interface Spot { left: string; top: string }

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

  /** Um interruptor sobreposto à vista, num chip só seu: espelhos, volante. */
  private chipToggle(action: ActionId, key: LogicalKey, icon: string, label: string, on: boolean | undefined, at: Spot) {
    if (!this.map[key]) return nothing
    return html`<button
      class="plain chip-btn ${on ? 'on' : ''}"
      style="left:${at.left};top:${at.top}"
      @click=${() => this.fire(action)}
      title=${label}
      aria-label=${label}
      aria-pressed=${on === undefined ? nothing : (on ? 'true' : 'false')}
    ><ha-icon icon=${icon}></ha-icon></button>`
  }

  /**
   * A pastilha de um banco: aquecer e ventilar lado a lado, como na app. A
   * pastilha agrupa-os e nada mais — cada metade é um botão seu, comanda a sua
   * entidade e mostra o seu nível; tocar numa não mexe na outra.
   *
   * Uma metade cuja entidade não está no mapa não é desenhada, e a pastilha
   * estreita para o tamanho de um só controlo em vez de ficar com um buraco.
   * Sem nenhuma das duas não há pastilha nenhuma.
   */
  private seatPill(seat: string, heatKey: SeatLevelKey, ventKey: SeatLevelKey, at: Spot) {
    const halves = [
      { key: heatKey, icon: 'mdi:car-seat-heater', label: `${seat} · ${this.t('comfort.heating')}` },
      { key: ventKey, icon: 'mdi:car-seat-cooler', label: `${seat} · ${this.t('comfort.ventilation')}` },
    ].filter(half => this.map[half.key])
    if (halves.length === 0) return nothing
    return html`<div
      class="seat-pill ${halves.length === 2 ? 'two' : 'one'}"
      style="left:${at.left};top:${at.top}"
    >${halves.map(half => this.seatLevel(half.key, half.icon, half.label))}</div>`
  }

  /** Metade de uma pastilha: cada toque cicla o nível 0 → max → 0. */
  private seatLevel(key: SeatLevelKey, icon: string, label: string) {
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
      class="plain seat-btn ${level ? 'on' : ''} ${pending ? 'pending' : ''}"
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

  /**
   * Onde há controlo não há desenho: nem o volante nem os espelhos estão
   * desenhados (ver `cabin-topview.ts`). O chip É a peça, e é por isso que a
   * sua posição não é «sobre a peça que comanda» mas «no lugar da peça que
   * comanda», nas coordenadas do desenho (viewBox 200 x 240 — as `left`
   * resolvem contra 200, as `top` contra 240):
   *   - espelhos: DOIS chips, um em cada canto da frente, 7,5% e 92,5% / 9,5%
   *     (centros em 15; 22,8 e 185; 22,8). É onde estão as orelhas de um
   *     retrovisor exterior — fora da cabina, à frente das portas — e é onde a
   *     app põe os seus dois chips, encostados às margens. Ficam ACIMA da
   *     linha do tablier, sem lhe tocar: o ponto mais alto do traço debaixo de
   *     um chip é y = 39,6 (na aresta interior, x = 27,5 e x = 172,5) e o chip
   *     acaba em y = 35,3, portanto 4,3 unidades de folga. Para a margem da
   *     caixa sobram 2,5 unidades (4 px), que é o «mais de lado» pedido;
   *   - volante: à frente do banco do condutor, 28,5% / 22,29% (centro em
   *     57; 53,5 — o mesmo x da pastilha do condutor, portanto a prumo com
   *     ela). Este chip já não tem o traço do tablier a passar-lhe por trás:
   *     o traço mais baixo sobre a largura do chip está em y = 35,05 (aresta
   *     esquerda, x = 44,5) e o chip começa em y = 41,0, ou seja 5,9 unidades
   *     abaixo dele; e acaba em y = 66,0, a 6,0 do encosto de cabeça do
   *     condutor (y = 72). Está entre os dois, encostado ao condutor e não ao
   *     tablier, que é onde um volante está. Foi para caber aqui que a caixa
   *     do desenho cresceu de 228 para 240;
   *   - pastilhas: sobre o espaldar de cada banco, 28,5% e 71,5% / 47,5%
   *     (centros 57 e 143 em x, 114 em y; espaldar de y = 90 a y = 138).
   *     Estas continuam sobre o desenho porque o espaldar é MAIOR do que a
   *     pastilha e não é da mesma forma: vê-se o banco à volta dela, e lê-se
   *     como um banco com um controlo em cima. Era isso que a roda de 38 x 28
   *     debaixo de um chip de 25 não conseguia — duas formas redondas quase do
   *     mesmo tamanho, uma por cima da outra, lêem-se como uma nódoa.
   *
   * DOIS CHIPS, UM INTERRUPTOR. A integração expõe um único
   * `switch/rearview_mirror_heat` para o par de espelhos — os dois aquecem
   * sempre juntos, não há como aquecer só um. Os dois chips desta vista dizem
   * exactamente isso: lêem ambos o MESMO `c.mirrorHeat` (logo acendem e
   * apagam juntos, e o `aria-pressed` de um é sempre o do outro) e disparam
   * ambos a MESMA `mirrorHeat`, que é um só pedido de serviço venha ele de
   * que lado vier. Não há aqui estado por chip nem meia entidade: o que era
   * mentira seria dois chips com ar de comandarem um espelho cada.
   *
   * O que o desenho não consegue dizer, dizem-no os nomes acessíveis: cada
   * chip anuncia-se «Espelhos · os dois · botão da esquerda/direita». O «os
   * dois» vem primeiro e é o que interessa — quem chegar de teclado ao chip da
   * esquerda fica a saber que está a comandar o par; o «botão da esquerda»
   * serve só para distinguir um chip do outro, e fala do BOTÃO, nunca do
   * espelho.
   *
   * O ícone dos espelhos é `mdi:mirror`: um oval com dois brilhos, que é o
   * vidro de um espelho retrovisor. O `mdi:mirror-rectangle` que aqui esteve
   * é um rectângulo com outro rectângulo dentro e lia-se como um telemóvel ou
   * uma porta. A app usa um ícone de vidro aquecido, e o equivalente em MDI
   * seria o `mdi:car-defrost-rear` — mas esse é, traço por traço, o
   * `mdi:car-defrost-front` do botão Descongelar que está mais abaixo NESTE
   * MESMO painel (um vidro com três ondas de calor), só que com o vidro
   * rectangular em vez de trapezoidal. A 18px são o mesmo ícone. O calor fica
   * dito pelo rótulo e pelo painel onde isto vive; a forma diz «espelho».
   */
  private topview() {
    const c = this.state.comfort
    return html`<div class="topview">
      ${CABIN_TOPVIEW}
      ${this.chipToggle('mirrorHeat', 'mirrorHeat', 'mdi:mirror', this.t('comfort.mirrors_both_left'), c.mirrorHeat, { left: '7.5%', top: '9.5%' })}
      ${this.chipToggle('mirrorHeat', 'mirrorHeat', 'mdi:mirror', this.t('comfort.mirrors_both_right'), c.mirrorHeat, { left: '92.5%', top: '9.5%' })}
      ${this.chipToggle('steeringWheelHeat', 'steeringWheelHeat', 'mdi:steering', this.t('comfort.steering_wheel'), c.steeringWheelHeat, { left: '28.5%', top: '22.29%' })}
      ${this.seatPill(this.t('comfort.driver_seat'), 'driverSeatHeat', 'driverSeatVent', { left: '28.5%', top: '47.5%' })}
      ${this.seatPill(this.t('comfort.passenger_seat'), 'passengerSeatHeat', 'passengerSeatVent', { left: '71.5%', top: '47.5%' })}
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
    // Dos quatro botões da fila de baixo só este é alternante, e a etiqueta
    // fixa que tinha («Interruptor do A/C») não dizia para que lado ele ia: o
    // estado só se lia no realce, e quem quisesse desligar a climatização não
    // tinha como saber que era ali. Vem por isso do `actionLabel`, que é quem
    // decide isso para a bagageira e os vidros — e assim a etiqueta e o
    // serviço chamado não podem discordar.
    const acLabel = actionLabel('climate', this.state, this.t)
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
        ${this.button('climate', 'climateSwitch', 'mdi:air-conditioner', acLabel, climateOn)}
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
     * 200x240 e nenhuma dimensão própria, logo a caixa mede W x 1,2W e as
     * percentagens dos controlos resolvem contra ela — as «left» contra W, as
     * «top» contra a ALTURA. Como max-width é 320px, min(40px, 12,5%) é sempre
     * a percentagem: a geometria abaixo, em unidades do viewBox, é a mesma em
     * qualquer largura. À largura de projeto (W = 320px, portanto H = 384px,
     * 1,6px por unidade), com origem no canto superior esquerdo:
     *   - chip: 40 x 40px = 25 x 25 unidades. Pastilha de um banco: 88 x 44px
     *     = 55 x 27,5 unidades, dois alvos de 44 x 44px.
     *   - chip do espelho esquerdo: 7,5% / 9,5% -> centro (15; 22,8), caixa
     *     x 2,5..27,5, y 10,3..35,3. O direito é o espelho deste, 92,5% / 9,5%
     *     -> centro (185; 22,8), caixa x 172,5..197,5, y 10,3..35,3.
     *   - chip do volante: 28,5% / 22,29% -> centro (57; 53,5), caixa
     *     x 44,5..69,5, y 41,0..66,0.
     *   - pastilhas: 28,5% e 71,5% / 47,5% -> centros (57; 114) e (143; 114),
     *     caixas x 29,5..84,5 e x 115,5..170,5, y 100,25..127,75.
     *
     * Folgas entre controlos (nenhuma negativa, portanto nenhuma sobreposição;
     * basta uma separação num dos eixos para duas caixas não se tocarem):
     *   - espelho esquerdo -> volante: 44,5 - 27,5 = 17 unidades (27,2px) em x.
     *   - espelho esquerdo -> pastilha do condutor: 29,5 - 27,5 = 2 unidades
     *     (3,2px) em x, e 100,25 - 35,3 = 64,95 unidades (103,9px) em y.
     *   - espelho direito -> pastilha do passageiro: 172,5 - 170,5 = 2 unidades
     *     em x, e as mesmas 64,95 em y. (Simétrico do de cima.)
     *   - espelho esquerdo -> espelho direito: 172,5 - 27,5 = 145 unidades.
     *   - volante -> pastilha do condutor: 100,25 - 66,0 = 34,25 unidades
     *     (54,8px) em y, com o mesmo centro em x (57), portanto a prumo.
     *   - pastilha -> pastilha: 115,5 - 84,5 = 31 unidades (49,6px).
     *
     * Folgas às margens da caixa (tudo dentro, em unidades / px):
     *   - esquerda: 2,5 / 4,0 (chip do espelho esquerdo, o mais encostado).
     *   - direita: 200 - 197,5 = 2,5 / 4,0 (o do espelho direito, simétrico).
     *   - cima: 10,3 / 16,5 (os dois chips de espelho).
     *   - baixo: 240 - 127,75 = 112,25 / 179,6 (as pastilhas).
     *
     * Folgas ao desenho, que é o que os dois chips de cima ganharam:
     *   - espelhos -> traço do tablier: o traço está mais alto na aresta
     *     interior de cada chip (x = 27,5 e x = 172,5), a y = 39,6; o chip
     *     acaba a y = 35,3, logo 4,3 unidades (6,9px).
     *   - espelhos -> topo dos painéis das portas (y = 46): 10,7 (17,1px).
     *   - volante -> traço do tablier: o traço está mais baixo na aresta
     *     esquerda do chip (x = 44,5), a y = 35,05; o chip começa a y = 41,0,
     *     logo 5,95 unidades (9,5px) — e o traço sobe para a direita, portanto
     *     esta é a folga mínima. O traço já não passa por trás de chip nenhum.
     *   - volante -> encosto de cabeça do condutor (y = 72): 6,0 (9,6px).
     * Nenhum alvo desce abaixo dos 40px, nenhum toca noutro e nenhum sai da
     * caixa.
     *
     * O container-type serve o cqw do conteúdo, abaixo: 1cqw é 1% de W,
     * portanto ícone e dígito escalam com a caixa em vez de ficarem em píxeis
     * fixos, que transbordavam o controlo em cards estreitos.
     */
    .topview {
      position: relative; width: 100%; max-width: 320px; margin: 12px auto 4px;
      container-type: inline-size;
    }
    .topview svg { display: block; width: 100%; height: auto; }
    /*
     * A pastilha é uma <div> e não um <button>: agrupa dois controlos, não os
     * funde num só. Por isso escapa ao all: unset e um seletor de uma classe
     * chega-lhe.
     *
     * A altura vem do aspect-ratio e não de uma percentagem: uma percentagem
     * de altura resolveria contra a ALTURA da vista (1,14W) e dava uma caixa
     * deformada. Com aspect-ratio: 2 e 88px de largura saem exactamente os
     * 44px de altura, e as duas metades esticam-se a essa altura pelo
     * align-items: stretch que o flex já traz.
     *
     * O border-radius em percentagem resolve contra a PRÓPRIA caixa: 15% de
     * 88px e 30% de 44px são os mesmos 13,2px, logo o canto é redondo e
     * acompanha o tamanho da pastilha sem depender da largura do card.
     */
    .seat-pill {
      position: absolute; box-sizing: border-box;
      transform: translate(-50%, -50%);
      display: flex; overflow: hidden;
      background: var(--card-background-color);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }
    .seat-pill.two { width: min(88px, 27.5%); aspect-ratio: 2; border-radius: 15% / 30%; }
    .seat-pill.one { width: min(44px, 13.75%); aspect-ratio: 1; border-radius: 30%; }
    /*
     * button.plain (theme.ts) faz all: unset a (0,1,1) — perde-se box-sizing,
     * largura, altura, padding, fundo, cantos, position E as propriedades de
     * flex, que voltam ao inicial 0 1 auto. Sem flex: 1 1 0 as duas metades
     * encolhiam para o tamanho do conteúdo e deixavam de ser alvos de 44px.
     * Por isso a caixa vive no seletor composto, tal como button.plain.chip-btn
     * e button.plain.step-btn abaixo, ou button.tile.plain em group-grid.ts.
     */
    button.plain.seat-btn {
      box-sizing: border-box; flex: 1 1 0; min-width: 0;
      display: grid; place-items: center; gap: 0; padding: 0;
      background: transparent; color: var(--lm-muted);
      transition: background 120ms ease, transform 120ms ease;
    }
    button.plain.seat-btn.on { color: var(--primary-color); }
    button.plain.seat-btn.pending { opacity: 0.6; }
    /*
     * O anel de foco global (theme.ts) usa outline-offset: 2px, que aqui era
     * cortado pelo overflow: hidden da pastilha e transbordava para a outra
     * metade. Por dentro, o anel cabe na metade que vai disparar e é isso que
     * o utilizador precisa de ver. (0,3,1) ganha ao (0,2,1) de lá.
     */
    button.plain.seat-btn:focus-visible { outline-offset: -3px; }
    /*
     * O mesmo para os chips de um ícone só (espelhos, volante), com um aviso
     * extra: sem position: absolute caíam em fluxo por baixo da vista e nenhum
     * deles ficava sobre a peça que comanda.
     */
    button.plain.chip-btn {
      position: absolute; box-sizing: border-box;
      transform: translate(-50%, -50%);
      display: grid; place-items: center; gap: 0;
      width: min(40px, 12.5%); aspect-ratio: 1; padding: 0;
      border-radius: 30%; background: var(--card-background-color);
      color: var(--lm-muted);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
      transition: box-shadow 120ms ease, transform 120ms ease;
    }
    button.plain.chip-btn.on { color: var(--primary-color); }
    /*
     * Resposta ao ponteiro e ao toque, na linha do que actions-row.ts já fazia
     * com o seu .circle. Sem ela, o utilizador toca no aquecimento do banco,
     * não vê nada mexer enquanto o Home Assistant não devolve o nível novo, e
     * toca outra vez — o shownLevel absorve o segundo toque e não perde
     * comando nenhum, mas o nível a mais é escusado.
     *
     * O :hover está atrás de um @media (hover: hover) para o estado não ficar
     * colado num ecrã tátil, onde o browser o mantém depois do toque. O
     * :active do chip repete o translate(-50%, -50%) porque a transform é UMA
     * propriedade: escrever só o scale apagava o centramento e o chip saltava
     * para baixo e para a direita ao ser tocado. Ambas as regras estão a
     * (0,3,1), acima do button.plain (0,1,1) e das próprias caixas (0,2,1).
     */
    @media (hover: hover) {
      button.plain.seat-btn:hover { background: var(--lm-chip); }
      button.plain.chip-btn:hover { box-shadow: 0 2px 7px rgba(0, 0, 0, 0.32); }
    }
    button.plain.seat-btn:active { transform: scale(0.9); }
    button.plain.chip-btn:active { transform: translate(-50%, -50%) scale(0.9); }
    /*
     * Em píxeis fixos o conteúdo saía da caixa abaixo de uma vista de ~223px.
     * 5,6cqw e 3,1cqw são exactamente os 18px e os 9,9px de uma vista a 320px,
     * mas expressos na mesma unidade que as caixas (12,5cqw o chip, 13,75cqw
     * cada metade da pastilha): a relação entre conteúdo e caixa deixa de
     * depender da largura.
     *
     * O recuo tem de ser um @supports e não uma segunda declaração: o valor de
     * uma propriedade PERSONALIZADA é qualquer sequência de tokens, portanto
     * nenhum browser descarta um --mdc-icon-size: 5.6cqw no parse, saiba ele o
     * que é cqw ou não — e quem não souber acaba com a width: var(...) do
     * ha-icon inválido no tempo de valor computado, ou seja com auto, e não
     * com os 18px. Dentro do @supports, quem não tem container queries fica
     * com as declarações em píxeis, que é o que se pretende.
     */
    button.plain.seat-btn ha-icon,
    button.plain.chip-btn ha-icon { --mdc-icon-size: 18px; }
    .level { font-size: 0.62rem; line-height: 1; font-variant-numeric: tabular-nums; }
    @supports (container-type: inline-size) {
      button.plain.seat-btn ha-icon,
      button.plain.chip-btn ha-icon { --mdc-icon-size: 5.6cqw; }
      .level { font-size: 3.1cqw; }
    }
    .stepper { display: flex; align-items: center; justify-content: center; gap: 20px; margin: 14px 0; }
    /*
     * button.plain (theme.ts) faz all: unset a (0,1,1); uma regra .step-btn
     * isolada a (0,1,0) perdia display, place-items, width, height,
     * border-radius e background. A caixa do botão vive por isso no seletor
     * composto, tal como button.tile.plain em group-grid.ts.
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
       compound-selector treatment as the grid tile's button.tile.plain.warn
       (group-grid.ts). */
    button.plain.tile-btn.on { color: var(--primary-color); }
    .circle { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 50%; background: var(--lm-chip); }
    .label { font-size: 0.72rem; text-align: center; line-height: 1.15; }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-climate-panel': LeapmotorClimatePanel }
}
