import { LitElement, css, html, nothing } from 'lit'
import { customElement, state as internalState } from 'lit/decorators.js'
import {
  DEFAULT_FAN_SPEED, actionLabel, composeClimateCommand, decideAction, forgetRequest, pendingValue,
  pruneRequests, resolveAction,
  type ActionEventDetail, type ActionPayload, type ClimateChange, type ClimateIntent, type ExpandPanel,
  type SeatLevels, type SeatRequests, type ServiceCall,
} from './actions'
import type { HassEntityDisplayEntry, HomeAssistant } from './ha-types'
import { SEAT_LEVEL_KEYS, isSeatLevelKey, type LogicalKey } from './keys'
import { createTranslator, pickLanguage, type TranslateFn } from './localize'
import { loadRegistryFallback, resolveEntities, type ResolveResult } from './resolver'
import { sharedStyles } from './theme'
import {
  DEFAULT_ACTIONS, DEFAULT_SECTIONS, clampMapZoom, mapRequestChanged,
  type ActionId, type LeapmotorCardConfig, type MapRequest, type SectionId, type VehicleState,
} from './types'
import { attr, buildVehicleState } from './vehicle-state'

import './sections/hero'
import './sections/actions-row'
import './sections/charging'
import './sections/location'
import './sections/climate-panel'
import './sections/sunshade-control'
import './sections/tiles'
import './sections/tires'
import './sections/trip'
import './sections/comfort'
import './sections/schedule'

export const CARD_VERSION = '0.3.4'

/**
 * Tempo de espera antes de enviar a temperatura. `leapmotor.set_climate` não é
 * um setpoint: cada envio é um comando que liga a climatização. Sem este
 * agrupamento, três toques no «+» seriam três chamadas à cloud. Vive aqui, não
 * no painel de clima, porque o card sobrevive ao colapso do painel — o painel
 * é destruído no toque seguinte no tile e um `setTimeout` seu nunca chegaria a
 * disparar (spec v2, achado 3).
 */
const CLIMATE_SEND_DELAY_MS = 1200

console.info(
  `%c LEAPMOTOR-CARD %c ${CARD_VERSION} `,
  'color:#fff;background:#1f6feb;border-radius:3px 0 0 3px',
  'color:#1f6feb;background:#e8f0fe;border-radius:0 3px 3px 0',
)

;(window as unknown as { customCards?: unknown[] }).customCards ||= []
;(window as unknown as { customCards: unknown[] }).customCards.push({
  type: 'leapmotor-card',
  name: 'Leapmotor Card',
  description: 'Leapmotor vehicle card mirroring the official app layout',
  preview: true,
  documentationURL: 'https://github.com/fapgomes/ha-leapmotor-card',
})

const SECTION_KEYS: Record<SectionId | 'core', LogicalKey[]> = {
  core: ['battery', 'lock'],
  location: ['location'],
  charging: ['chargeLimit', 'isCharging', 'isPluggedIn'],
  tiles: ['interiorTemp', 'trunk'],
  tires: ['tireFL', 'tireFR', 'tireRL', 'tireRR'],
  trip: ['odometer', 'last7DaysKm'],
  comfort: ['driverSeatHeat', 'steeringWheelHeat'],
  schedule: ['scheduleStart', 'scheduleEnd'],
}

@customElement('leapmotor-card')
export class LeapmotorCard extends LitElement {
  @internalState() private _hass?: HomeAssistant
  @internalState() private _config?: LeapmotorCardConfig
  @internalState() private _pending?: ActionId
  @internalState() private _fallback?: HassEntityDisplayEntry[]
  @internalState() private _expanded?: ExpandPanel
  /**
   * Tudo o que o card sabe sobre a climatização e o carro não reporta: o que o
   * utilizador pediu e ainda não foi confirmado (com a leitura que o carro dava
   * em cada pedido, ver `pendingValue`) e a velocidade da ventoinha, que a
   * integração não expõe de todo. Vive aqui, e não no painel, porque o painel é
   * destruído sempre que o tile colapsa: um pedido guardado lá desaparecia com
   * ele, o comando seguinte caía na leitura antiga e desfazia em silêncio o que
   * o utilizador tinha acabado de pedir — e a ventoinha voltava a 3, que é o
   * defeito com que o `set_climate` repõe o que não for enviado. Não é limpo
   * depois de enviado: só o carro resolve um pedido, confirmando-o ou
   * reportando outra coisa.
   */
  private _climateIntent: ClimateIntent = { fanSpeed: DEFAULT_FAN_SPEED }
  /**
   * Os níveis de assento pedidos e ainda não confirmados, pela mesma razão e
   * com a mesma disciplina do `_climateIntent`: quem os guardava era o painel,
   * e nada os apagava depois de resolvidos — um aquecimento que se desligasse
   * sozinho fazia o pedido antigo voltar a valer, o pino ficava a mostrar um
   * nível que o banco já não tinha, e o toque seguinte saltava um nível. A
   * regra de vida de um pedido é uma só, e vive num sítio só.
   */
  private _seatRequests: SeatRequests = {}

  private _fallbackRequested = false
  private _resolveCache?: { entities: unknown; config: unknown; fallback: unknown; result: ResolveResult }
  private _mapElement?: HTMLElement
  private _mapRequested = false
  private _mapRequest?: MapRequest
  private _climateTimer?: number

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    // O card só é destruído com a vista inteira do dashboard, ao contrário do
    // painel de clima (destruído a cada colapso do tile) — um envio pendente
    // aqui é muito menos provável de se perder. Mesmo assim, cancela-o.
    if (this._climateTimer !== undefined) {
      window.clearTimeout(this._climateTimer)
      this._climateTimer = undefined
    }
    this._climateIntent = { fanSpeed: DEFAULT_FAN_SPEED }
    this._seatRequests = {}
  }

  public static async getConfigElement() {
    await import('./leapmotor-card-editor')
    return document.createElement('leapmotor-card-editor')
  }

  public static getStubConfig(hass: HomeAssistant): LeapmotorCardConfig {
    const devices = [...new Set(
      Object.values(hass?.entities ?? {})
        .filter(e => e.platform === 'leapmotor')
        .map(e => e.device_id)
        .filter((d): d is string => !!d),
    )]
    return { type: 'custom:leapmotor-card', ...(devices.length === 1 ? { device: devices[0] } : {}) }
  }

  public setConfig(config: LeapmotorCardConfig): void {
    if (!config) throw new Error('Invalid configuration')
    this._config = { ...config }
    this._fallbackRequested = false
    this._fallback = undefined
    this._resolveCache = undefined
    // Tudo o que se segue pertencia ao carro anterior. Sem isto, mudar `device`
    // no editor deixava o mapa a marcar o carro de antes (o `ensureMap` sai
    // logo à entrada por causa do `_mapRequested`) e mostrava os pedidos por
    // confirmar de um carro como se fossem do outro.
    if (this._climateTimer !== undefined) {
      // Um «+» dado no carro A tinha 1200 ms para disparar contra o carro B.
      window.clearTimeout(this._climateTimer)
      this._climateTimer = undefined
    }
    this._mapRequested = false
    this._mapElement = undefined
    this._mapRequest = undefined
    this._climateIntent = { fanSpeed: DEFAULT_FAN_SPEED }
    this._seatRequests = {}
  }

  public set hass(hass: HomeAssistant) {
    this._hass = hass
    if (this._mapElement) (this._mapElement as unknown as { hass?: HomeAssistant }).hass = hass
  }

  public getCardSize(): number {
    const s = this.sections()
    return 6 + (s.location ? 4 : 0) + (s.charging ? 2 : 0) + (s.tiles ? 3 : 0) + (s.tires ? 3 : 0)
      + (s.trip ? 2 : 0) + (s.comfort ? 3 : 0) + (s.schedule ? 2 : 0)
  }

  /**
   * Cria o card `map` do Home Assistant e guarda-o. Só o elemento principal
   * pode fazer isto, porque um card do HA precisa de `hass` e as secções não o
   * podem ver. A secção recebe o elemento já construído.
   *
   * `loadCardHelpers` é um global semi-público do frontend do HA. Se não
   * existir, ou se falhar, ficamos sem `_mapElement` e a secção mostra o seu
   * texto de recurso — o card não parte por causa disto.
   *
   * Chamado a cada `render()`, por isso o `_mapRequested` só pode cair quando
   * o pedido realmente muda — entidade ou zoom — nunca a cada actualização de
   * estado, ou o mapa seria destruído e reconstruído sem necessidade nenhuma
   * (ver `mapRequestChanged`, testada sem DOM em `types.ts`).
   */
  private ensureMap(entityId: string): void {
    const request: MapRequest = { entityId, zoom: clampMapZoom(this._config?.map_zoom) }
    if (this._mapRequested && mapRequestChanged(this._mapRequest, request)) {
      this._mapRequested = false
      this._mapElement = undefined
    }
    if (this._mapRequested) return
    this._mapRequested = true
    this._mapRequest = request
    const loader = (window as unknown as {
      loadCardHelpers?: () => Promise<{ createCardElement: (c: Record<string, unknown>) => HTMLElement }>
    }).loadCardHelpers
    if (!loader) return
    loader()
      .then(helpers => {
        // Um pedido mais recente pode ter chegado enquanto este estava no ar
        // (ex.: o zoom mudou outra vez antes deste `then` correr). Sem este
        // guarda, a resposta atrasada do pedido antigo substituía o mapa
        // correcto pelo mapa com o zoom de há um momento.
        if (this._mapRequest !== request) return
        const el = helpers.createCardElement({
          type: 'map',
          entities: [entityId],
          aspect_ratio: '16:9',
          hours_to_show: 0,
          default_zoom: request.zoom,
        })
        if (this._hass) (el as unknown as { hass?: HomeAssistant }).hass = this._hass
        this._mapElement = el
        this.requestUpdate()
      })
      .catch(() => { /* a secção mostra location.map_unavailable */ })
  }

  private sections(): Record<SectionId, boolean> {
    return { ...DEFAULT_SECTIONS, ...(this._config?.sections ?? {}) }
  }

  private missingForActiveSections(result: ResolveResult): LogicalKey[] {
    const sections = this.sections()
    const wanted = [
      ...SECTION_KEYS.core,
      ...(Object.keys(sections) as SectionId[]).filter(s => sections[s]).flatMap(s => SECTION_KEYS[s]),
    ]
    return result.missing.filter(k => wanted.includes(k))
  }

  private resolved(): ResolveResult | undefined {
    const hass = this._hass
    const config = this._config
    if (!hass || !config) return undefined

    const cache = this._resolveCache
    if (cache && cache.entities === hass.entities && cache.config === config && cache.fallback === this._fallback) {
      return cache.result
    }

    const result = resolveEntities(hass, config, this._fallback)
    this._resolveCache = { entities: hass.entities, config, fallback: this._fallback, result }

    if (result.needsFallback && !this._fallbackRequested) {
      this._fallbackRequested = true
      loadRegistryFallback(hass)
        .then(entries => { this._fallback = entries })
        .catch(() => { this._fallback = [] })
    }

    return result
  }

  private async callAction(
    action: ActionId,
    state: VehicleState,
    map: ResolveResult['map'],
    t: TranslateFn,
    payload?: ActionPayload,
  ) {
    // Quem decide é o `decideAction`, que é puro e testado: o bloqueio em
    // andamento, a disponibilidade e a necessidade de confirmação não podem
    // viver aqui, onde nenhum teste os alcança. O que fica é a ligação ao DOM.
    const decision = decideAction(action, state, map, this._config?.confirm_actions, payload)
    if (decision.kind === 'blocked' || decision.kind === 'unavailable') return

    // `answer` exige a resposta do utilizador como argumento, e é a única forma
    // de obter a chamada num caso que pede confirmação: saltar o `confirm` não
    // compila. `actionLabel` e não `t(\`action.${action}\`)` porque `trunk` e
    // `windows` são alternantes e as suas chaves são `action.trunk_open` /
    // `action.trunk_close` e `action.windows_open` / `action.windows_close`.
    const call = decision.kind === 'confirm'
      ? decision.answer(window.confirm(t('confirm', { action: actionLabel(action, state, t) })))
      : decision.call
    if (!call || !this._hass) return

    this._pending = action
    try {
      await this.doCall(call).catch(err => this.notifyError(err))
    } finally {
      this._pending = undefined
    }
  }

  /**
   * Guarda a mudança na intenção e arma o temporizador. Agrupa uma rajada de
   * toques e manda um comando só, depois de `CLIMATE_SEND_DELAY_MS` — ver o
   * comentário dessa constante. O que se acumula é a intenção, campo a campo,
   * e não o último payload: os controlos do painel mudam campos diferentes do
   * mesmo comando e substituir perdia o que o toque anterior tinha mudado.
   */
  private queueClimate(change: ClimateChange, state: VehicleState) {
    // A leitura guardada com o pedido é a do momento do toque — é ela que diz,
    // mais tarde, se o carro já reagiu (ver `pendingValue`).
    const intent = this._climateIntent
    if (change.temperature !== undefined) {
      intent.temperature = { wanted: change.temperature, reading: state.climate.targetC }
    }
    if (change.recirculate !== undefined) {
      intent.recirculate = { wanted: change.recirculate, reading: state.climate.recirculating }
    }
    // A intenção não é `@internalState` de propósito: o `render` também a limpa,
    // e um campo reactivo escrito no `render` agendaria uma actualização em
    // cadeia. Quem precisa de pedir o re-render é este caminho, o do toque.
    this.requestUpdate()
    if (this._climateTimer !== undefined) window.clearTimeout(this._climateTimer)
    this._climateTimer = window.setTimeout(() => {
      this._climateTimer = undefined
      this.sendClimate()
    }, CLIMATE_SEND_DELAY_MS)
  }

  /**
   * O `set_climate` repõe pelos defeitos o que não for enviado, por isso o
   * comando sai sempre completo: cada campo vem do pedido por confirmar, ou da
   * leitura do carro, ou — só quando não há nem uma coisa nem outra — do
   * defeito do próprio serviço. O 24 e o `false` finais não são leituras.
   */
  private sendClimate() {
    // Estado lido agora, e não no toque: entre o toque e o envio passam-se
    // 1200 ms em que o carro (ou a app) pode ter mudado alguma coisa, e o que
    // ninguém pediu deve sair com o valor actual, não com o de há um segundo.
    const result = this.resolved()
    if (!result || result.error || !this._hass) return
    const map = result.map
    const state = buildVehicleState(this._hass, map, new Date())
    const intent = this._climateIntent
    const call = resolveAction('setClimate', state, map, { climate: composeClimateCommand(intent, state) })
    if (!call || !this._hass) return
    // Os mesmos pedidos que este comando levava, guardados por identidade: se a
    // chamada falhar, desistimos deles — mas só se entretanto não tiverem sido
    // substituídos por um toque novo, que ainda é válido.
    const sent = { temperature: intent.temperature, recirculate: intent.recirculate }
    void this.doCall(call).catch(err => {
      let dropped = false
      if (this._climateIntent.temperature === sent.temperature && sent.temperature !== undefined) {
        this._climateIntent.temperature = undefined
        dropped = true
      }
      if (this._climateIntent.recirculate === sent.recirculate && sent.recirculate !== undefined) {
        this._climateIntent.recirculate = undefined
        dropped = true
      }
      if (dropped) this.requestUpdate()
      this.notifyError(err)
    })
  }

  private async doCall(call: ServiceCall, extra?: Record<string, unknown>) {
    const data = { ...call.data, ...extra }
    if (call.entityIdAsField) {
      // Os serviços `leapmotor.*` recebem o veículo como campo, não como
      // target. Ver spec v2 §2.5.
      await this._hass!.callService(call.domain, call.service, { ...data, entity_id: call.entityId })
    } else {
      await this._hass!.callService(call.domain, call.service, data, { entity_id: call.entityId })
    }
  }

  // `hass.callService` rejeita silenciosamente numa custom card — o HA não
  // mostra nada por si. `hass-notification` é o evento que a frontend do HA
  // escuta para apresentar uma toast, por isso é o único sítio onde um erro
  // de serviço (ex.: um unlock falhado) fica visível ao utilizador.
  private notifyError(err: unknown): void {
    this.dispatchEvent(new CustomEvent('hass-notification', {
      detail: { message: String((err as Error)?.message ?? err) },
      bubbles: true,
      composed: true,
    }))
  }

  private imageUrl(map: ResolveResult['map']): string | undefined {
    const mode = this._config?.image ?? 'auto'
    if (mode === 'none') return undefined
    if (mode !== 'auto' && mode !== 'entity') return mode
    const hass = this._hass
    if (!hass) return undefined
    return attr<string>(hass, map, 'vehiclePicture', 'entity_picture')
  }

  override render() {
    const hass = this._hass
    const config = this._config
    if (!hass || !config) return nothing

    const language = pickLanguage(config.language, hass.locale?.language ?? hass.language)
    const t = createTranslator(language)
    const result = this.resolved()

    if (!result || result.needsFallback) {
      return html`<ha-card><div class="body loading">${t('loading')}</div></ha-card>`
    }

    if (result.error) {
      const candidates = result.candidates.map(c => `${c.name} (${c.id})`).join(', ') || '—'
      return html`<ha-card><div class="body">
        <ha-alert alert-type="error">${t(`error.${result.error}`, { candidates })}</ha-alert>
      </div></ha-card>`
    }

    const { map } = result
    const now = new Date()
    const state = buildVehicleState(hass, map, now)
    const sections = this.sections()
    const actions = config.actions ?? DEFAULT_ACTIONS
    const name = config.name ?? result.deviceName ?? ''
    const imageMode = config.image ?? 'auto'
    const imageUrl = this.imageUrl(map)
    // Spec §6: no modo `entity` não há recurso à silhueta — o espaço fica vazio
    // quer por falta de URL (showImage=false), quer por a URL falhar depois de
    // montada (allowSilhouette=false, ver leapmotor-hero).
    const showImage = imageMode !== 'none' && !(imageMode === 'entity' && !imageUrl)
    const allowSilhouette = imageMode !== 'entity'

    const onAction = (e: CustomEvent<ActionEventDetail>) => {
      void this.callAction(e.detail.action, state, map, t, e.detail.payload)
    }
    const onExpand = (e: CustomEvent<{ panel: ExpandPanel | null }>) => {
      // `leapmotor-tiles` já envia o alvo pré-alternado (o próprio tile sabe
      // se está expandido). `leapmotor-actions-row` envia sempre 'sunshade' e
      // `leapmotor-sunshade-control` envia sempre null: para esses, alternar
      // aqui é o que dá a exclusão mútua entre os painéis e permite fechar o
      // painel de cortina a partir do botão que o abriu.
      const panel = e.detail.panel
      this._expanded = panel === this._expanded ? undefined : (panel ?? undefined)
    }
    const onLimit = (e: CustomEvent<{ value: number }>) => {
      const call = resolveAction('setChargeLimit', state, map)
      if (call) void this.doCall(call, { value: e.detail.value }).catch(err => this.notifyError(err))
    }
    const onSetNumber = (e: CustomEvent<{ key: LogicalKey; value: number }>) => {
      const { key, value } = e.detail
      const entityId = map[key]
      if (!entityId || !this._hass) return
      // Registado aqui e não na secção que o emitiu: qualquer das duas (o painel
      // de clima, a secção de conforto) pode desaparecer entre o pedido e a
      // confirmação, e o pedido não deve desaparecer com ela.
      const seatKey = isSeatLevelKey(key) ? key : undefined
      const request = seatKey ? { wanted: value, reading: state.comfort[seatKey] } : undefined
      if (seatKey && request) {
        this._seatRequests[seatKey] = request
        this.requestUpdate()
      }
      void this._hass.callService('number', 'set_value', { value }, { entity_id: entityId })
        .catch(err => {
          // A chamada falhou: nenhuma leitura vai resolver este pedido, porque o
          // carro nunca chegou a saber dele. Deixá-lo era mostrar um nível que o
          // banco não tem, e fazer o toque seguinte partir dele.
          if (seatKey && request && forgetRequest(this._seatRequests, seatKey, request)) this.requestUpdate()
          this.notifyError(err)
        })
    }
    const onClimateChange = (e: CustomEvent<ClimateChange>) => {
      this.queueClimate(e.detail, state)
    }
    const onFanSpeed = (e: CustomEvent<{ value: number }>) => {
      // Guardada, não enviada: a velocidade só chega ao carro no próximo
      // `set_climate`, junto com a temperatura e a recirculação.
      this._climateIntent.fanSpeed = e.detail.value
      this.requestUpdate()
    }
    const onSetSwitch = (e: CustomEvent<{ key: LogicalKey; on: boolean }>) => {
      const entityId = map[e.detail.key]
      if (entityId && this._hass) {
        void this._hass.callService('switch', e.detail.on ? 'turn_on' : 'turn_off', {}, { entity_id: entityId })
          .catch(err => this.notifyError(err))
      }
    }

    // O pedido que o carro já resolveu — confirmando-o ou contrariando-o —
    // deixa de existir aqui, e não só de ser mostrado: se ficasse guardado,
    // ressuscitava assim que a leitura voltasse a ser a que era no momento do
    // pedido, e num booleano como a recirculação «voltar ao que era» é o caso
    // normal. É uma limpeza de cache, não estado reactivo: o que ela apaga já
    // está fora deste render.
    const pendingTemp = pendingValue(this._climateIntent.temperature, state.climate.targetC)
    const pendingRecirc = pendingValue(this._climateIntent.recirculate, state.climate.recirculating)
    if (pendingTemp === undefined) this._climateIntent.temperature = undefined
    if (pendingRecirc === undefined) this._climateIntent.recirculate = undefined

    // A mesma limpeza para os níveis de assento, e no mesmo sítio. Aqui cabe
    // num helper porque os quatro pedidos têm a mesma forma; os dois campos da
    // intenção de clima têm tipos diferentes e ficam nas duas linhas acima.
    const shownLevels: SeatLevels = pruneRequests(this._seatRequests, SEAT_LEVEL_KEYS, key => state.comfort[key])

    if (sections.location && map.location) this.ensureMap(map.location)

    return html`<ha-card
      @leapmotor-action=${onAction}
      @leapmotor-set-charge-limit=${onLimit}
      @leapmotor-set-number=${onSetNumber}
      @leapmotor-set-switch=${onSetSwitch}
      @leapmotor-fan-speed=${onFanSpeed}
      @leapmotor-climate-change=${onClimateChange}
      @leapmotor-expand=${onExpand}
    >
      <div class="body">
        <leapmotor-hero
          .state=${state} .t=${t} .now=${now} .name=${name}
          .language=${language} .imageUrl=${imageUrl}
          .showImage=${showImage} .allowSilhouette=${allowSilhouette}
        ></leapmotor-hero>

        <leapmotor-actions-row
          .state=${state} .t=${t} .map=${map} .actions=${actions} .pending=${this._pending}
        ></leapmotor-actions-row>

        ${this._expanded === 'sunshade'
          ? html`<leapmotor-sunshade-control .t=${t}></leapmotor-sunshade-control>`
          : nothing}

        ${sections.charging
          ? html`<leapmotor-charging
              .state=${state} .t=${t} .language=${language}
              .limitEditable=${!!map.chargeLimitSet}
              .limitMin=${attr<number>(hass, map, 'chargeLimitSet', 'min') ?? 50}
              .limitMax=${attr<number>(hass, map, 'chargeLimitSet', 'max') ?? 100}
              .limitStep=${attr<number>(hass, map, 'chargeLimitSet', 'step') ?? 5}
            ></leapmotor-charging>`
          : nothing}

        ${sections.tiles
          ? html`<leapmotor-tiles
              .state=${state} .t=${t} .climateToggleable=${!!map.climateSwitch}
              .expanded=${this._expanded ?? null} .pendingTemp=${pendingTemp}
            ></leapmotor-tiles>`
          : nothing}

        ${sections.tiles && this._expanded === 'climate'
          ? html`<leapmotor-climate-panel
              .state=${state} .t=${t} .map=${map} .fanSpeed=${this._climateIntent.fanSpeed}
              .pendingTemp=${pendingTemp} .pendingRecirc=${pendingRecirc}
              .shownLevels=${shownLevels}
              .maxLevel=${attr<number>(hass, map, 'driverSeatHeat', 'max') ?? 3}
            ></leapmotor-climate-panel>`
          : nothing}

        ${sections.tires ? html`<leapmotor-tires .state=${state} .t=${t}></leapmotor-tires>` : nothing}
        ${sections.trip ? html`<leapmotor-trip .state=${state} .t=${t}></leapmotor-trip>` : nothing}

        ${sections.comfort
          ? html`<leapmotor-comfort
              .state=${state} .t=${t} .map=${map} .shownLevels=${shownLevels}
              .maxLevel=${attr<number>(hass, map, 'driverSeatHeat', 'max') ?? 3}
            ></leapmotor-comfort>`
          : nothing}
        ${sections.schedule ? html`<leapmotor-schedule .state=${state} .t=${t} .map=${map}></leapmotor-schedule>` : nothing}

        ${sections.location
          ? html`<leapmotor-location
              .state=${state} .t=${t} .mapElement=${this._mapElement}
            ></leapmotor-location>`
          : nothing}

        ${(() => {
          const missing = this.missingForActiveSections(result)
          return missing.length === 0
            ? nothing
            : html`<div class="missing muted" title=${t('missing_entity', { keys: missing.join(', ') })}>
                <ha-icon icon="mdi:alert-outline"></ha-icon>
                ${t('missing_entity_count', { count: missing.length })}
              </div>`
        })()}
      </div>
    </ha-card>`
  }

  static override styles = [sharedStyles, css`
    ha-card { overflow: hidden; }
    .body { padding: var(--lm-gap); }
    .loading { color: var(--lm-muted); }
    .missing { display: flex; align-items: center; gap: 6px; margin-top: 12px; font-size: 0.75rem; }
    .missing ha-icon { --mdc-icon-size: 16px; }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-card': LeapmotorCard }
}
