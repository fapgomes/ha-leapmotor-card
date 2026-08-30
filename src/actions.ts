import { isWindowOpen } from './format'
import type { TranslateFn } from './localize'
import { DEFAULT_CONFIRM_ACTIONS, type ActionId, type EntityMap, type VehicleState } from './types'
import type { LogicalKey, SeatLevelKey } from './keys'

export interface ServiceCall {
  domain: string
  service: string
  entityId: string
  /**
   * Os serviços de domínio `leapmotor` recebem o veículo como CAMPO
   * (`data.entity_id`), não como target de serviço. Ver spec v2 §2.5. Todo o
   * resto do card usa target, que é a forma normal do Home Assistant.
   */
  entityIdAsField?: boolean
  data?: Record<string, unknown>
}

function press(map: EntityMap, key: LogicalKey): ServiceCall | undefined {
  const entityId = map[key]
  return entityId ? { domain: 'button', service: 'press', entityId } : undefined
}

function toggleSwitch(map: EntityMap, key: LogicalKey, on: boolean | undefined): ServiceCall | undefined {
  const entityId = map[key]
  return entityId ? { domain: 'switch', service: on === true ? 'turn_off' : 'turn_on', entityId } : undefined
}

function anyWindowOpen(state: VehicleState): boolean {
  return Object.values(state.openings.windows).some(isWindowOpen)
}

type ClimateMode = 'cold' | 'hot' | 'wind' | 'nohotcold'

/**
 * `mode` é obrigatório no `leapmotor.set_climate` e o utilizador não o deve ter
 * de escolher. Usa o modo que o carro reporta quando é um dos aceites; senão
 * arrefece se o interior está acima do alvo, aquece se está abaixo.
 */
function climateMode(state: VehicleState, target: number): ClimateMode {
  const reported = state.climate.mode?.toLowerCase()
  if (reported === 'cold' || reported === 'hot' || reported === 'wind' || reported === 'nohotcold') {
    return reported
  }
  const interior = state.climate.interiorC
  if (interior === undefined) return 'nohotcold'
  if (interior > target) return 'cold'
  if (interior < target) return 'hot'
  return 'nohotcold'
}

/** Qualquer entidade do carro serve para identificar o veículo num serviço `leapmotor.*`. */
function vehicleAnchor(map: EntityMap): string | undefined {
  return map.battery ?? map.lock ?? map.range
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Math.round(n)))
}

/** Um comando de climatização completo. A integração repõe o que não for enviado. */
export interface ClimateCommand {
  temperature: number
  fanSpeed: number
  recirculate: boolean
}

/**
 * O que um controlo do painel de clima acabou de mudar. Não é um comando: é uma
 * intenção parcial, e viaja no evento `leapmotor-climate-change` — nunca no
 * `ActionPayload` — precisamente para que não haja forma de a entregar ao
 * `resolveAction`, que só sabe trabalhar com comandos completos. A ventoinha
 * não está aqui porque também tem evento próprio (`leapmotor-fan-speed`) e o
 * seu valor vive no card.
 */
export interface ClimateChange {
  temperature?: number
  recirculate?: boolean
}

/**
 * Um pedido do utilizador que o carro ainda não confirmou, com a leitura que o
 * carro dava no momento em que foi feito.
 */
export interface PendingRequest<T> {
  wanted: T
  reading?: T
}

/**
 * O valor de um pedido enquanto ele ainda importa, ou `undefined` quando já não
 * importa. A regra é a de sempre — o pedido deixa de ser relevante quando o
 * carro confirma o valor pedido ou reporta outro qualquer (a app, o próprio
 * carro) — mas escrita contra a leitura guardada com o pedido, e não contra a
 * leitura do render anterior. É o que a deixa ser uma função pura, avaliável em
 * qualquer sítio e a qualquer altura, e é isso que permite ao pedido viver no
 * card e sobreviver à destruição do painel.
 */
export function pendingValue<T>(request: PendingRequest<T> | undefined, reported: T | undefined): T | undefined {
  if (request === undefined) return undefined
  // Sem leitura nenhuma não há como saber se o carro reagiu: o pedido mantém-se.
  if (reported === undefined) return request.wanted
  // O carro reporta o valor pedido: pedido cumprido. Tem de vir antes da
  // comparação com a leitura de origem, senão um pedido que nasce igual à
  // leitura — tocar duas vezes na recirculação dentro da janela, subir e voltar
  // a descer a temperatura, ciclar um banco até ao ponto de partida — nunca se
  // resolvia e ficava marcado como pendente para sempre.
  if (reported === request.wanted) return undefined
  // O carro continua a reportar o que reportava quando o pedido foi feito, logo
  // ainda não reagiu. Qualquer outra leitura resolve o pedido; uma leitura nova
  // depois de um pedido feito às escuras (`reading` indefinida) também, por ser
  // a melhor informação que existe.
  return reported === request.reading ? request.wanted : undefined
}

/**
 * Os pedidos de nível de assento por confirmar (o que o card guarda) e os níveis
 * já resolvidos que as secções mostram. São dois tipos e dois nomes de propósito:
 * o mesmo nome para as duas formas já produziu, neste projeto, seis defeitos da
 * mesma família — e aqui a ligação entre o card e as secções é uma property
 * binding da Lit, que o TypeScript não verifica.
 */
export type SeatRequests = Partial<Record<SeatLevelKey, PendingRequest<number>>>
export type SeatLevels = Partial<Record<SeatLevelKey, number>>

/**
 * Tudo o que o card sabe sobre a climatização e que o carro não reporta: os
 * pedidos ainda por confirmar e a velocidade da ventoinha, que a integração não
 * expõe de todo. Vive no card e não no painel, que é destruído a cada colapso.
 */
export interface ClimateIntent {
  /** O que o card escolheu por último. Não há leitura nenhuma que a confirme. */
  fanSpeed: number
  temperature?: PendingRequest<number>
  recirculate?: PendingRequest<boolean>
}

/** O que a integração usa quando ninguém escolhe — e o que o card mostra ao abrir. */
export const DEFAULT_FAN_SPEED = 3

/** Alvo de recurso quando o carro não reporta temperatura nenhuma. */
const FALLBACK_TARGET_C = 24

export const TEMP_MIN = 18
export const TEMP_MAX = 32

/**
 * Casas decimais do alvo de temperatura, onde quer que ele apareça. É zero
 * porque o comando é inteiro — o `resolveAction` arredonda — e porque o stepper
 * anda de grau em grau: mostrar 23,5 num sítio e 24 noutro, e depois saltar
 * para 25 num toque, era o que o tile e o painel faziam um contra o outro.
 */
export const TARGET_TEMP_DECIMALS = 0

/**
 * O alvo a pedir quando o utilizador toca no «+» ou no «−». Parte do valor que
 * ele **vê** — o mostrado, já arredondado às `TARGET_TEMP_DECIMALS` — e não do
 * valor cru, para um toque valer exactamente um grau a partir do ecrã.
 */
export function nextStepTemperature(shown: number | undefined, delta: number): number {
  const base = Math.round(shown ?? FALLBACK_TARGET_C)
  return Math.min(TEMP_MAX, Math.max(TEMP_MIN, base + delta))
}

/**
 * Compõe o comando completo de climatização. É sempre completo porque o
 * `leapmotor.set_climate` repõe pelos defeitos tudo o que não for enviado:
 * mandar só a temperatura punha a ventoinha em 3 e desligava a recirculação —
 * o defeito silencioso que este plano inteiro existe para acabar.
 *
 * Cada campo vem, por esta ordem: do pedido do utilizador que o carro ainda não
 * confirmou, da leitura do carro, e só depois de falharem os dois é que vem um
 * defeito. A ventoinha não tem leitura nenhuma, por isso vem sempre da intenção.
 */
export function composeClimateCommand(intent: ClimateIntent, state: VehicleState): ClimateCommand {
  return {
    temperature: pendingValue(intent.temperature, state.climate.targetC)
      ?? state.climate.targetC ?? FALLBACK_TARGET_C,
    fanSpeed: intent.fanSpeed,
    recirculate: pendingValue(intent.recirculate, state.climate.recirculating)
      ?? state.climate.recirculating ?? false,
  }
}

/**
 * O que fazer com um toque numa ação, decidido sem tocar no DOM nem no `hass`.
 *
 * O `confirm` não traz a chamada: traz uma função que **exige** a resposta do
 * utilizador para a devolver. É de propósito — assim não há forma de saltar a
 * confirmação sem partir a compilação, e o mesmo vale para os dois primeiros
 * casos, que não têm `call` nenhum para ler.
 */
export type CommandDecision =
  | { kind: 'blocked' }
  | { kind: 'unavailable' }
  | { kind: 'ready'; call: ServiceCall }
  | { kind: 'confirm'; answer: (confirmed: boolean) => ServiceCall | undefined }

export function decideAction(
  action: ActionId,
  state: VehicleState,
  map: EntityMap,
  confirmActions: ActionId[] | undefined,
  payload?: ActionPayload,
): CommandDecision {
  // O bloqueio em andamento tem de ser decidido aqui, e não só no botão: um
  // painel já aberto, ou um render obsoleto, contornariam uma verificação que
  // apenas desactivasse controlos.
  if (state.activity === 'driving' && BLOCKED_WHILE_DRIVING.includes(action)) return { kind: 'blocked' }
  const call = resolveAction(action, state, map, payload)
  if (!call) return { kind: 'unavailable' }
  if (!(confirmActions ?? DEFAULT_CONFIRM_ACTIONS).includes(action)) return { kind: 'ready', call }
  return { kind: 'confirm', answer: confirmed => (confirmed ? call : undefined) }
}

/**
 * Aplica o `pendingValue` a um conjunto de pedidos com a mesma forma: devolve os
 * que ainda valem e **apaga** do próprio registo os que já não valem. O apagar
 * não é arrumação: um pedido resolvido que ficasse guardado voltava a valer
 * assim que a leitura regressasse ao valor que tinha quando ele foi feito — num
 * nível de assento, «voltar a 0» é o que o carro faz sozinho ao fim de algum
 * tempo, e o pino ficava a mostrar um nível que o banco já não tinha.
 */
export function pruneRequests<K extends string, T>(
  requests: Partial<Record<K, PendingRequest<T>>>,
  keys: readonly K[],
  reported: (key: K) => T | undefined,
): Partial<Record<K, T>> {
  const live: Partial<Record<K, T>> = {}
  for (const key of keys) {
    const value = pendingValue(requests[key], reported(key))
    if (value === undefined) delete requests[key]
    else live[key] = value
  }
  return live
}

/**
 * Desiste de um pedido cuja chamada de serviço falhou. Sem isto o pedido ficava
 * para sempre: a leitura do carro nunca chega a mexer-se, portanto o
 * `pendingValue` continuava a devolvê-lo — o controlo mostrava um valor que o
 * carro nunca teve, e o toque seguinte partia desse valor fantasma.
 *
 * Só apaga se ainda for o MESMO pedido: entre a chamada e a rejeição o
 * utilizador pode ter tocado outra vez, e esse pedido novo é válido e ainda não
 * falhou. Devolve se apagou alguma coisa, para quem chama saber se precisa de
 * pedir um render.
 */
export function forgetRequest<K extends string, T>(
  requests: Partial<Record<K, PendingRequest<T>>>,
  key: K,
  request: PendingRequest<T>,
): boolean {
  if (requests[key] !== request) return false
  delete requests[key]
  return true
}

/**
 * O que uma secção mostra para um nível de assento: o pedido por confirmar ganha
 * à leitura do carro, e fica marcado como pendente. As duas secções que mostram
 * níveis — o pino do painel de clima e a linha da secção de conforto — passam
 * por aqui, para não poderem discordar sobre o mesmo banco no mesmo ecrã.
 *
 * `pending === undefined` e não um valor falsy: um pedido de nível **0** é um
 * pedido como os outros, e um `||` aqui fazia-o passar por «sem pedido».
 */
export function shownLevel(
  pending: number | undefined,
  reported: number | undefined,
): { level: number | undefined; pending: boolean } {
  return pending === undefined ? { level: reported, pending: false } : { level: pending, pending: true }
}

/**
 * O que uma ação precisa além do estado do veículo, com um campo por ação em
 * vez de um número solto. O `value: number` anterior significava coisas
 * diferentes conforme a ação, e essa ambiguidade produziu os piores defeitos
 * deste projeto.
 */
export interface ActionPayload {
  /** Posição alvo da cortina, 0–10. */
  position?: number
  /**
   * Comando de climatização, sempre completo — é o que o `resolveAction` exige
   * e o que o serviço recebe. Quem o compõe é o card, a partir da intenção que
   * vai acumulando; nenhum controlo escreve aqui.
   */
  climate?: ClimateCommand
}

/**
 * O `detail` do evento `leapmotor-action`. As secções não chamam serviços: o
 * que emitem é este objeto, e `leapmotor-card.ts` é quem o resolve. Existe como
 * tipo — e não como literal repetido em cada emissor — porque um `value:` ou um
 * `payload:` trocado num deles compilava, passava os testes, e só se via no
 * dashboard de um utilizador com um controlo que deixou de comandar o carro.
 */
export interface ActionEventDetail {
  action: ActionId
  payload?: ActionPayload
}

export function resolveAction(
  action: ActionId,
  state: VehicleState,
  map: EntityMap,
  payload?: ActionPayload,
): ServiceCall | undefined {
  switch (action) {
    case 'unlock':
    case 'lock': {
      const entityId = map.lock
      return entityId ? { domain: 'lock', service: action, entityId } : undefined
    }
    case 'trunk':
      return press(map, state.openings.trunk === true ? 'closeTrunk' : 'openTrunk')
    case 'windows':
      return press(map, anyWindowOpen(state) ? 'closeWindows' : 'openWindows')
    case 'sunshade': {
      // A posição da cortina não é exposta como entidade (spec v2 §2.4), logo
      // não há estado para alternar: o utilizador escolhe a posição alvo.
      const entityId = vehicleAnchor(map)
      const position = payload?.position
      if (!entityId || position === undefined) return undefined
      const v = clamp(position, 0, 10)
      return {
        domain: 'leapmotor',
        service: v === 0 ? 'sunshade_close' : 'sunshade_open',
        entityId,
        entityIdAsField: true,
        data: { value: v },
      }
    }
    case 'setClimate': {
      const entityId = vehicleAnchor(map)
      const cmd = payload?.climate
      if (!entityId || !cmd) return undefined
      const temperature = clamp(cmd.temperature, 18, 32)
      return {
        domain: 'leapmotor',
        service: 'set_climate',
        entityId,
        entityIdAsField: true,
        // Sempre os três: o `set_climate` repõe pelos defeitos o que não for
        // enviado, pelo que mandar só a temperatura poria a ventoinha em 3 e
        // desligaria a recirculação.
        data: {
          mode: climateMode(state, temperature),
          temperature,
          fan_speed: clamp(cmd.fanSpeed, 1, 7),
          recirculate: cmd.recirculate,
        },
      }
    }
    case 'quickCool': return press(map, 'quickCool')
    case 'quickHeat': return press(map, 'quickHeat')
    case 'defrost': return press(map, 'windshieldDefrost')
    case 'findVehicle': return press(map, 'findVehicle')
    case 'unlockCharger': return press(map, 'unlockCharger')
    case 'refresh': return press(map, 'refreshData')
    case 'climate': return toggleSwitch(map, 'climateSwitch', state.climate.on)
    case 'steeringWheelHeat': return toggleSwitch(map, 'steeringWheelHeat', state.comfort.steeringWheelHeat)
    case 'mirrorHeat': return toggleSwitch(map, 'mirrorHeat', state.comfort.mirrorHeat)
    case 'batteryPreheat': return toggleSwitch(map, 'batteryPreheat', state.comfort.batteryPreheat)
    case 'setChargeLimit': {
      // Devolve a chamada sem `data` de propósito: o valor vem do slider do painel
      // de carregamento, que o `onLimit` passa como `extra` ao `doCall`. Está em
      // PAYLOAD_ACTIONS para não ser utilizável como botão da linha, onde não
      // teria por onde receber esse valor.
      const entityId = map.chargeLimitSet
      return entityId ? { domain: 'number', service: 'set_value', entityId } : undefined
    }
  }
}

export function actionLabel(action: ActionId, state: VehicleState, t: TranslateFn): string {
  if (action === 'trunk') return t(state.openings.trunk === true ? 'action.trunk_close' : 'action.trunk_open')
  if (action === 'windows') return t(anyWindowOpen(state) ? 'action.windows_close' : 'action.windows_open')
  return t(`action.${action}`)
}

export function actionIcon(action: ActionId, state: VehicleState): string {
  switch (action) {
    case 'unlock': return 'mdi:lock-open-variant-outline'
    case 'lock': return 'mdi:lock-outline'
    case 'trunk': return state.openings.trunk === true ? 'mdi:car-back' : 'mdi:car-estate'
    case 'windows': return anyWindowOpen(state) ? 'mdi:car-door' : 'mdi:car-door-lock'
    case 'sunshade': return 'mdi:window-shutter'
    case 'quickCool': return 'mdi:snowflake'
    case 'quickHeat': return 'mdi:fire'
    case 'defrost': return 'mdi:car-defrost-front'
    case 'findVehicle': return 'mdi:map-marker-radius-outline'
    case 'unlockCharger': return 'mdi:ev-plug-type2'
    case 'refresh': return 'mdi:refresh'
    case 'climate': return 'mdi:fan'
    case 'steeringWheelHeat': return 'mdi:steering'
    case 'mirrorHeat': return 'mdi:car-side'
    case 'batteryPreheat': return 'mdi:battery-heart-variant'
    case 'setChargeLimit': return 'mdi:battery-charging-80'
    case 'setClimate': return 'mdi:thermometer'
  }
}

/** Ações que não devem ser possíveis com o carro em andamento. */
export const BLOCKED_WHILE_DRIVING: ActionId[] = ['unlock', 'lock', 'trunk', 'windows', 'sunshade']

/**
 * O painel que a expansão do card pode mostrar. Um só, desde que a grelha de
 * grupos substituiu os tiles: o painel de clima passou a ser o conteúdo de uma
 * sub-vista e deixou de se expandir. Manter aqui membros que o `CONTROL_PANEL`
 * — único produtor — não produz deixava compilar para sempre uma comparação
 * que nunca é verdadeira.
 */
export type ExpandPanel = 'sunshade'

/**
 * Ações cujo `resolveAction` exige um `ActionPayload` que só um controlo
 * fornece. Testar a disponibilidade destas sem payload devolveria sempre
 * `undefined`, e não porque a ação estivesse indisponível.
 */
export const PAYLOAD_ACTIONS: ActionId[] = ['sunshade', 'setClimate', 'setChargeLimit']

/**
 * Que painel cada ação abre, quando abre algum. Uma ação de valor **sem**
 * painel não pode ser um botão da linha de ações: não tem por onde receber o
 * valor, e encaminhá-la para o painel de outra ação faria um botão comandar
 * uma coisa diferente da que anuncia.
 */
export const CONTROL_PANEL: Partial<Record<ActionId, ExpandPanel>> = { sunshade: 'sunshade' }

/**
 * Payload mínimo para responder «esta ação está disponível?» sem a executar. Só
 * as ações de payload precisam de entrada aqui; para as outras, `resolveAction`
 * ignora o payload e a resposta é a mesma com ou sem ele.
 */
const AVAILABILITY_PROBE: Partial<Record<ActionId, ActionPayload>> = {
  sunshade: { position: 0 },
  setClimate: { climate: { temperature: 24, fanSpeed: 3, recirculate: false } },
}

/**
 * Pode esta ação ser um botão aqui? Para as ações de payload usa um payload de
 * sondagem, porque o que interessa saber é se o veículo é endereçável, não o
 * que o utilizador vai escolher — mas só quando a ação também tem painel: sem
 * ele, o botão não teria como receber esse payload.
 */
export function isActionAvailable(action: ActionId, state: VehicleState, map: EntityMap): boolean {
  const needsPayload = PAYLOAD_ACTIONS.includes(action)
  // Uma ação de payload sem painel não é utilizável como botão, mesmo que o
  // veículo seja endereçável.
  if (needsPayload && !CONTROL_PANEL[action]) return false
  return resolveAction(action, state, map, AVAILABILITY_PROBE[action]) !== undefined
}
