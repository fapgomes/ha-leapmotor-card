import { describe, expect, it } from 'vitest'
import {
  BLOCKED_WHILE_DRIVING, PAYLOAD_ACTIONS, TARGET_TEMP_DECIMALS, TEMP_MAX, TEMP_MIN, actionIcon, actionLabel,
  composeClimateCommand, decideAction, forgetRequest, isActionAvailable, nextStepTemperature, pendingValue,
  pruneRequests, resolveAction, shownLevel,
  type ClimateIntent,
} from '../src/actions'
import { formatNumber } from '../src/format'
import { resolveEntities } from '../src/resolver'
import { buildVehicleState } from '../src/vehicle-state'
import { createTranslator } from '../src/localize'
import type { ActionId } from '../src/types'
import { REAL_NOW, realHass } from './fixtures/real-states'

/**
 * `Record<ActionId, true>`, não um array literal: um array `ActionId[]` não
 * obriga a incluir todos os membros da união, por isso uma ação nova no tipo
 * podia ficar de fora sem que nada avisasse. Um objeto tipado como
 * `Record<ActionId, true>` tem de ter todas as chaves — falta uma e o
 * `npm run typecheck` (que corre antes desta suite) já não passa, o que força
 * a dar-lhe uma etiqueta antes de a ação poder ser adicionada em segurança.
 */
const ALL_ACTIONS: Record<ActionId, true> = {
  unlock: true, lock: true, trunk: true, windows: true, sunshade: true,
  quickCool: true, quickHeat: true, defrost: true,
  findVehicle: true, unlockCharger: true, refresh: true,
  climate: true, steeringWheelHeat: true, mirrorHeat: true, batteryPreheat: true,
  setChargeLimit: true, setClimate: true,
}

const t = createTranslator('pt')

function ctx(overrides: Record<string, string> = {}) {
  const hass = realHass(overrides)
  const { map } = resolveEntities(hass, { type: 'custom:leapmotor-card' })
  return { map, state: buildVehicleState(hass, map, REAL_NOW) }
}

describe('resolveAction', () => {
  it('destranca pelo domínio lock', () => {
    const { map, state } = ctx()
    expect(resolveAction('unlock', state, map)).toEqual({
      domain: 'lock', service: 'unlock', entityId: 'lock.leapmotor_b10_000000_demo_lock',
    })
  })

  it('tranca pelo domínio lock', () => {
    const { map, state } = ctx()
    expect(resolveAction('lock', state, map)?.service).toBe('lock')
  })

  it('abre a bagageira quando está fechada', () => {
    const { map, state } = ctx()
    expect(resolveAction('trunk', state, map)?.entityId).toBe('button.leapmotor_b10_000000_demo_open_trunk')
  })

  it('fecha a bagageira quando está aberta', () => {
    const { map, state } = ctx({ 'binary_sensor/trunk_open': 'on' })
    expect(resolveAction('trunk', state, map)?.entityId).toBe('button.leapmotor_b10_000000_demo_close_trunk')
  })

  it('abre os vidros quando estão todos fechados', () => {
    const { map, state } = ctx()
    expect(resolveAction('windows', state, map)?.entityId).toBe('button.leapmotor_b10_000000_demo_open_windows')
  })

  it('fecha os vidros quando algum está aberto por posição', () => {
    const { map, state } = ctx({ 'sensor/rear_right_window_position_percent': '40' })
    expect(resolveAction('windows', state, map)?.entityId).toBe('button.leapmotor_b10_000000_demo_close_windows')
  })

  it('alterna o switch de climatização de acordo com o estado', () => {
    expect(resolveAction('climate', ctx().state, ctx().map)?.service).toBe('turn_on')
    const on = ctx({ 'switch/climate_control': 'on' })
    expect(resolveAction('climate', on.state, on.map)?.service).toBe('turn_off')
  })

  it('devolve undefined quando a entidade não está no mapa', () => {
    const { state } = ctx()
    expect(resolveAction('trunk', state, {})).toBeUndefined()
  })

  it('cobre todos os botões simples', () => {
    const { map, state } = ctx()
    for (const a of ['quickCool', 'quickHeat', 'defrost', 'findVehicle', 'unlockCharger', 'refresh'] as const) {
      const call = resolveAction(a, state, map)
      expect(call, a).toBeDefined()
      expect(call!.domain, a).toBe('button')
      expect(call!.service, a).toBe('press')
    }
  })

  it('alterna os switches de conforto', () => {
    const { map, state } = ctx()
    for (const a of ['steeringWheelHeat', 'mirrorHeat', 'batteryPreheat'] as const) {
      expect(resolveAction(a, state, map)?.service, a).toBe('turn_on')
    }
  })
})

describe('actionLabel e actionIcon', () => {
  it('a etiqueta da bagageira muda com o estado', () => {
    expect(actionLabel('trunk', ctx().state, t)).toBe('Bagageira')
    expect(actionLabel('trunk', ctx({ 'binary_sensor/trunk_open': 'on' }).state, t)).toBe('Fechar bagageira')
  })

  it('a etiqueta dos vidros muda com o estado', () => {
    expect(actionLabel('windows', ctx().state, t)).toBe('Vidros')
    expect(actionLabel('windows', ctx({ 'binary_sensor/front_left_window_open': 'on' }).state, t)).toBe('Fechar vidros')
  })

  it('a etiqueta da climatização diz o que o toque faz', () => {
    expect(actionLabel('climate', ctx().state, t)).toBe('Ligar climatização')
    expect(actionLabel('climate', ctx({ 'switch/climate_control': 'on' }).state, t)).toBe('Desligar climatização')
  })

  it('a etiqueta da climatização promete o serviço que vai mesmo ser chamado', () => {
    // O defeito que isto fecha é uma etiqueta a dizer «desligar» e o serviço a
    // ligar (ou o contrário): as duas decisões vivem em funções diferentes e
    // têm de partir da mesma comparação contra `true`. Um estado desconhecido
    // conta como desligado nas duas.
    for (const climate of [undefined, 'off', 'on', 'unavailable']) {
      const { map, state } = ctx(climate === undefined ? {} : { 'switch/climate_control': climate })
      const turningOn = resolveAction('climate', state, map)?.service === 'turn_on'
      expect(actionLabel('climate', state, t), String(climate))
        .toBe(turningOn ? 'Ligar climatização' : 'Desligar climatização')
    }
  })

  it('devolve um ícone mdi para todas as ações', () => {
    const { state } = ctx()
    for (const a of ['unlock', 'lock', 'trunk', 'windows', 'climate', 'refresh'] as const) {
      expect(actionIcon(a, state), a).toMatch(/^mdi:/)
    }
  })

  it('todas as ações têm etiqueta traduzida — nenhuma mostra a chave crua', () => {
    const { state } = ctx()
    for (const a of Object.keys(ALL_ACTIONS) as ActionId[]) {
      expect(actionLabel(a, state, t), a).not.toBe(`action.${a}`)
    }
  })
})

describe('resolveAction — serviços leapmotor', () => {
  it('a cortina fecha com valor 0', () => {
    const { map, state } = ctx()
    const call = resolveAction('sunshade', state, map, { position: 0 })
    expect(call?.domain).toBe('leapmotor')
    expect(call?.service).toBe('sunshade_close')
    expect(call?.data).toEqual({ value: 0 })
    expect(call?.entityIdAsField).toBe(true)
  })

  it('a cortina abre para uma posição intermédia', () => {
    const { map, state } = ctx()
    const call = resolveAction('sunshade', state, map, { position: 5 })
    expect(call?.service).toBe('sunshade_open')
    expect(call?.data).toEqual({ value: 5 })
  })

  it('a posição da cortina é limitada a 0..10', () => {
    const { map, state } = ctx()
    expect(resolveAction('sunshade', state, map, { position: 99 })?.data).toEqual({ value: 10 })
    expect(resolveAction('sunshade', state, map, { position: -3 })?.data).toEqual({ value: 0 })
  })

  it('sem valor não há chamada de cortina', () => {
    const { map, state } = ctx()
    expect(resolveAction('sunshade', state, map)).toBeUndefined()
  })

  it('setClimate manda modo, temperatura, ventoinha e recirculação, com entity_id como campo', () => {
    const { map, state } = ctx()
    const call = resolveAction('setClimate', state, map, { climate: { temperature: 22, fanSpeed: 3, recirculate: false } })
    expect(call?.domain).toBe('leapmotor')
    expect(call?.service).toBe('set_climate')
    expect(call?.entityIdAsField).toBe(true)
    // interior 24.0 > alvo 22 -> arrefecer
    expect(call?.data).toEqual({ mode: 'cold', temperature: 22, fan_speed: 3, recirculate: false })
  })

  it('setClimate aquece quando o alvo está acima do interior', () => {
    const { map, state } = ctx()
    expect(resolveAction('setClimate', state, map, { climate: { temperature: 28, fanSpeed: 3, recirculate: false } })?.data)
      .toEqual({ mode: 'hot', temperature: 28, fan_speed: 3, recirculate: false })
  })

  it('setClimate respeita o modo reportado pelo carro', () => {
    const { map, state } = ctx({ 'sensor/climate_mode': 'wind' })
    expect(resolveAction('setClimate', state, map, { climate: { temperature: 22, fanSpeed: 3, recirculate: false } })?.data)
      .toEqual({ mode: 'wind', temperature: 22, fan_speed: 3, recirculate: false })
  })

  it('a temperatura é limitada a 18..32', () => {
    const { map, state } = ctx()
    expect(resolveAction('setClimate', state, map, { climate: { temperature: 5, fanSpeed: 3, recirculate: false } })?.data)
      .toMatchObject({ temperature: 18 })
    expect(resolveAction('setClimate', state, map, { climate: { temperature: 99, fanSpeed: 3, recirculate: false } })?.data)
      .toMatchObject({ temperature: 32 })
  })

  it('setClimate envia sempre ventoinha e recirculação, não só a temperatura', () => {
    const { map, state } = ctx()
    const call = resolveAction('setClimate', state, map, {
      climate: { temperature: 22, fanSpeed: 5, recirculate: true },
    })
    expect(call?.data).toEqual({ mode: 'cold', temperature: 22, fan_speed: 5, recirculate: true })
  })

  it('a ventoinha é limitada a 1..7', () => {
    const { map, state } = ctx()
    const lo = resolveAction('setClimate', state, map, { climate: { temperature: 22, fanSpeed: 0, recirculate: false } })
    const hi = resolveAction('setClimate', state, map, { climate: { temperature: 22, fanSpeed: 99, recirculate: false } })
    expect(lo?.data).toMatchObject({ fan_speed: 1 })
    expect(hi?.data).toMatchObject({ fan_speed: 7 })
  })

  it('setClimate sem comando não resolve', () => {
    const { map, state } = ctx()
    expect(resolveAction('setClimate', state, map, { position: 5 })).toBeUndefined()
  })

  it('localizar usa o ícone de marcador de localização', () => {
    expect(actionIcon('findVehicle', ctx().state)).toBe('mdi:map-marker-radius-outline')
  })

  it('a cortina unificada usa a etiqueta «Cortina»', () => {
    expect(actionLabel('sunshade', ctx().state, t)).toBe('Cortina')
  })
})

describe('pendingValue', () => {
  // O pedido guarda a leitura que o carro dava quando foi feito, e é essa
  // comparação — e não a diferença entre dois renders — que diz se ele já foi
  // resolvido. É o que permite ao pedido viver no card e sobreviver ao colapso
  // do painel de clima, que é onde este defeito nasceu duas vezes.
  it('sem pedido nenhum não há valor pendente', () => {
    expect(pendingValue(undefined, 24)).toBeUndefined()
  })

  it('mantém-se enquanto o carro reportar a leitura que dava no momento do pedido', () => {
    expect(pendingValue({ wanted: 23, reading: 24 }, 24)).toBe(23)
  })

  it('desaparece quando o carro confirma o valor pedido', () => {
    expect(pendingValue({ wanted: 23, reading: 24 }, 23)).toBeUndefined()
  })

  it('desaparece quando o carro reporta um terceiro valor (a app, o próprio carro)', () => {
    expect(pendingValue({ wanted: 23, reading: 24 }, 26)).toBeUndefined()
  })

  it('mantém-se sem leitura nenhuma, que é o caso da entidade indisponível', () => {
    expect(pendingValue({ wanted: 23, reading: 24 }, undefined)).toBe(23)
  })

  it('trata um pedido de false como pedido, e não como campo ausente', () => {
    // Um `||` algures neste caminho fazia a recirculação desligada passar por
    // «sem pedido» e o comando seguinte repunha a ligada.
    expect(pendingValue({ wanted: false, reading: true }, true)).toBe(false)
    expect(pendingValue({ wanted: false, reading: true }, false)).toBeUndefined()
  })

  it('um pedido que nasce igual à leitura resolve-se na mesma', () => {
    // Tocar duas vezes na recirculação dentro da janela de agrupamento, ou subir
    // e voltar a descer a temperatura, grava um pedido com `wanted === reading`.
    // Sem a verificação da confirmação, ele nunca se resolvia e o controlo
    // ficava esbatido como «pendente» para sempre.
    expect(pendingValue({ wanted: false, reading: false }, false)).toBeUndefined()
    expect(pendingValue({ wanted: 23, reading: 23 }, 23)).toBeUndefined()
  })

  it('um pedido feito às escuras cede a uma leitura nova', () => {
    // `reading: undefined` é um pedido feito sem o carro reportar nada; quando
    // uma leitura aparece, é ela a melhor informação que existe.
    expect(pendingValue({ wanted: 23, reading: undefined }, 26)).toBeUndefined()
  })
})

describe('pruneRequests', () => {
  const KEYS = ['driverSeatHeat', 'driverSeatVent'] as const

  it('apaga do registo o pedido que o carro já resolveu', () => {
    // Apagar não é arrumação: um pedido resolvido que ficasse guardado voltava a
    // valer assim que a leitura regressasse ao valor de origem — e num nível de
    // assento «voltar a 0» é o que o carro faz sozinho.
    const requests = { driverSeatHeat: { wanted: 1, reading: 0 } }
    const live = pruneRequests(requests, KEYS, () => 1)
    expect(live).toEqual({})
    expect(requests.driverSeatHeat).toBeUndefined()
    // E é por isto que tem de ser apagado: guardado, ressuscitava aqui.
    expect(pendingValue({ wanted: 1, reading: 0 }, 0)).toBe(1)
  })

  it('mantém o pedido que o carro ainda não resolveu, e devolve o seu valor', () => {
    const requests = { driverSeatHeat: { wanted: 2, reading: 0 } }
    const live = pruneRequests(requests, KEYS, () => 0)
    expect(live).toEqual({ driverSeatHeat: 2 })
    expect(requests.driverSeatHeat).toEqual({ wanted: 2, reading: 0 })
  })

  it('uma chave sem pedido nenhum não aparece no resultado', () => {
    // `toEqual({})` não servia: no Vitest não distingue `{}` de
    // `{ chave: undefined }`, e uma implementação que deixasse escapar um
    // `undefined` para o resultado passava à mesma. As chaves é que contam.
    const requests: Partial<Record<typeof KEYS[number], { wanted: number; reading?: number }>> = {}
    const live = pruneRequests(requests, KEYS, () => 3)
    expect(Object.keys(live)).toEqual([])
    expect('driverSeatHeat' in live).toBe(false)
  })
})

describe('forgetRequest', () => {
  it('apaga o pedido cuja chamada falhou', () => {
    // Sem isto, uma chamada rejeitada deixava o pedido para sempre: a leitura do
    // carro nunca se mexe, portanto nada o resolvia, e o controlo mostrava um
    // valor que o carro nunca chegou a ter.
    const request = { wanted: 1, reading: 0 }
    const requests: Partial<Record<'driverSeatHeat', typeof request>> = { driverSeatHeat: request }
    expect(forgetRequest(requests, 'driverSeatHeat', request)).toBe(true)
    expect('driverSeatHeat' in requests).toBe(false)
  })

  it('não apaga um pedido novo que entretanto substituiu o que falhou', () => {
    // Entre a chamada e a rejeição o utilizador pode ter tocado outra vez; esse
    // pedido é válido e ainda não falhou.
    const failed = { wanted: 1, reading: 0 }
    const newer = { wanted: 2, reading: 0 }
    const requests = { driverSeatHeat: newer }
    expect(forgetRequest(requests, 'driverSeatHeat', failed)).toBe(false)
    expect(requests.driverSeatHeat).toBe(newer)
  })
})

describe('shownLevel', () => {
  // As duas secções que mostram níveis de assento — o pino do painel de clima e
  // a linha da secção de conforto — passam por aqui. Podem estar visíveis ao
  // mesmo tempo e não podem responder coisas diferentes sobre o mesmo banco.
  it('o pedido por confirmar ganha à leitura, e fica marcado', () => {
    expect(shownLevel(2, 0)).toEqual({ level: 2, pending: true })
  })

  it('sem pedido mostra a leitura, sem marca', () => {
    expect(shownLevel(undefined, 3)).toEqual({ level: 3, pending: false })
  })

  it('um pedido de nível 0 é um pedido como os outros', () => {
    // Com um `||` em vez da verificação de `undefined`, o zero passava por «sem
    // pedido» e a secção mostrava o nível antigo enquanto a outra mostrava 0.
    expect(shownLevel(0, 3)).toEqual({ level: 0, pending: true })
  })

  it('sem pedido e sem leitura não há nível nenhum', () => {
    expect(shownLevel(undefined, undefined)).toEqual({ level: undefined, pending: false })
  })
})

describe('composeClimateCommand', () => {
  // O `leapmotor.set_climate` repõe pelos defeitos tudo o que não for enviado,
  // por isso o que este comando leva é o que o carro fica a ter. Era a única
  // decisão do card sem teste nenhum, e uma das que este plano existe para
  // corrigir: `fanSpeed: 3` em vez da escolha do utilizador é exactamente o
  // reset silencioso que motivou tirar a ventoinha do painel.
  it('leva a ventoinha que o utilizador escolheu, não um defeito', () => {
    const { state } = ctx()
    expect(composeClimateCommand({ fanSpeed: 6 }, state).fanSpeed).toBe(6)
    expect(composeClimateCommand({ fanSpeed: 1 }, state).fanSpeed).toBe(1)
  })

  it('leva a recirculação que o carro reporta quando ninguém lhe tocou', () => {
    const { state } = ctx({ 'binary_sensor/air_recirculation': 'on' })
    expect(composeClimateCommand({ fanSpeed: 3 }, state).recirculate).toBe(true)
  })

  it('leva o pedido por confirmar à frente da leitura, nos dois campos', () => {
    const { state } = ctx({ 'binary_sensor/air_recirculation': 'on' })
    const intent: ClimateIntent = {
      fanSpeed: 4,
      temperature: { wanted: 21, reading: 24 },
      recirculate: { wanted: false, reading: true },
    }
    expect(composeClimateCommand(intent, state)).toEqual({ temperature: 21, fanSpeed: 4, recirculate: false })
  })

  it('leva a leitura do carro quando não há pedido nenhum', () => {
    // 20 e não os 24 da fixture: com a leitura igual ao defeito do serviço,
    // apagar o `?? state.climate.targetC` não mudava o resultado e o teste
    // passava contra as duas versões do código.
    const { state } = ctx({ 'sensor/climate_set_temp_left_c': '20.0' })
    expect(composeClimateCommand({ fanSpeed: 3 }, state))
      .toEqual({ temperature: 20, fanSpeed: 3, recirculate: false })
  })

  it('mexer só na recirculação não mexe na temperatura que o carro tem', () => {
    // O `set_climate` repõe pelos defeitos o que não for enviado: um carro a
    // 20 °C em que o utilizador só alterna a recirculação tem de receber 20,
    // não os 24 do defeito.
    const { state } = ctx({ 'sensor/climate_set_temp_left_c': '20.0' })
    const intent: ClimateIntent = { fanSpeed: 5, recirculate: { wanted: true, reading: false } }
    expect(composeClimateCommand(intent, state))
      .toEqual({ temperature: 20, fanSpeed: 5, recirculate: true })
  })

  it('sem leitura nenhuma cai nos defeitos do serviço, e só aí', () => {
    const { state } = ctx({
      'sensor/climate_set_temp_left_c': 'unavailable',
      'binary_sensor/air_recirculation': 'unavailable',
    })
    expect(composeClimateCommand({ fanSpeed: 2 }, state))
      .toEqual({ temperature: 24, fanSpeed: 2, recirculate: false })
  })
})

describe('nextStepTemperature', () => {
  it('um toque move um grau a partir do valor que o utilizador vê', () => {
    // O tile e o stepper mostram o alvo com as mesmas casas decimais; se o
    // stepper partisse do valor cru, um alvo de 23,5 mostrava 24 e um toque
    // saltava para 25 — grau e meio num toque.
    for (const reported of [18, 20.4, 23.5, 24, 27.6, 32]) {
      const shown = Number(formatNumber(reported, TARGET_TEMP_DECIMALS))
      expect(nextStepTemperature(reported, 1), String(reported)).toBe(Math.min(TEMP_MAX, shown + 1))
      expect(nextStepTemperature(reported, -1), String(reported)).toBe(Math.max(TEMP_MIN, shown - 1))
    }
  })

  it('não sai do intervalo que o serviço aceita', () => {
    expect(nextStepTemperature(TEMP_MAX, 1)).toBe(TEMP_MAX)
    expect(nextStepTemperature(TEMP_MIN, -1)).toBe(TEMP_MIN)
  })

  it('sem alvo nenhum parte do defeito do serviço', () => {
    expect(nextStepTemperature(undefined, 1)).toBe(25)
    expect(nextStepTemperature(undefined, -1)).toBe(23)
  })
})

describe('decideAction', () => {
  it('bloqueia uma ação de aberturas com o carro em andamento', () => {
    // A verificação não pode viver só no botão: um painel já aberto, ou um
    // render obsoleto, contornam um controlo apenas desactivado.
    const { map, state } = ctx({ 'binary_sensor/is_driving': 'on' })
    expect(decideAction('unlock', state, map, undefined).kind).toBe('blocked')
    expect(decideAction('sunshade', state, map, undefined, { position: 5 }).kind).toBe('blocked')
  })

  it('bloqueia em andamento exactamente as ações da lista, e mais nenhuma', () => {
    const { map, state } = ctx({ 'binary_sensor/is_driving': 'on' })
    for (const action of Object.keys(ALL_ACTIONS) as ActionId[]) {
      // Sem payload de propósito: o bloqueio é decidido antes de a ação ser
      // resolvida, portanto uma ação de payload dá 'blocked' ou 'unavailable',
      // nunca 'ready', e é o 'blocked' que aqui se mede.
      const blocked = decideAction(action, state, map, []).kind === 'blocked'
      expect(blocked, action).toBe(BLOCKED_WHILE_DRIVING.includes(action))
    }
  })

  it('pede confirmação para as ações da lista, e a chamada só sai com um sim', () => {
    const { map, state } = ctx()
    const decision = decideAction('unlock', state, map, undefined)
    expect(decision.kind).toBe('confirm')
    if (decision.kind !== 'confirm') return
    expect(decision.answer(false)).toBeUndefined()
    expect(decision.answer(true)).toEqual({
      domain: 'lock', service: 'unlock', entityId: 'lock.leapmotor_b10_000000_demo_lock',
    })
  })

  it('respeita a lista de confirmação da configuração', () => {
    const { map, state } = ctx()
    expect(decideAction('unlock', state, map, ['trunk']).kind).toBe('ready')
    expect(decideAction('trunk', state, map, ['trunk']).kind).toBe('confirm')
    expect(decideAction('trunk', state, map, []).kind).toBe('ready')
  })

  it('uma ação sem entidade não é executável', () => {
    const { state } = ctx()
    expect(decideAction('trunk', state, {}, undefined).kind).toBe('unavailable')
  })
})

describe('isActionAvailable', () => {
  it('a cortina está disponível quando há veículo endereçável, mesmo sem valor escolhido', () => {
    const { map, state } = ctx()
    expect(isActionAvailable('sunshade', state, map)).toBe(true)
  })

  it('a cortina não está disponível sem nenhuma entidade do veículo', () => {
    const { state } = ctx()
    expect(isActionAvailable('sunshade', state, {})).toBe(false)
  })

  it('uma ação normal (trunk) continua disponível com a sua própria entidade', () => {
    const { map, state } = ctx()
    expect(isActionAvailable('trunk', state, map)).toBe(true)
  })

  it('uma ação normal (trunk) fica indisponível sem a sua entidade', () => {
    const { state } = ctx()
    expect(isActionAvailable('trunk', state, {})).toBe(false)
  })

  it('setClimate não está disponível como botão, mesmo com o veículo totalmente endereçável', () => {
    // setClimate exige um valor, mas não tem painel próprio em CONTROL_PANEL:
    // encaminhá-lo para o painel de outra ação (a cortina) faria um botão
    // rotulado «Temperatura» comandar a cortina em vez da climatização.
    const { map, state } = ctx()
    expect(isActionAvailable('setClimate', state, map)).toBe(false)
  })

  /**
   * A paridade que a AVAILABILITY_PROBE promete: uma ação só é «disponível» se
   * o veículo for endereçável, e o payload de sondagem existe para as ações de
   * payload não responderem «não» só por lhes faltar um valor que o utilizador
   * ainda não escolheu. Este teste fixa a resposta esperada de TODAS as ações,
   * uma a uma, e não apenas que a função devolve um booleano: mexer na tabela
   * de sondagem — tirar de lá uma ação, ou pôr lá uma que não é de payload —
   * muda uma destas respostas e falha aqui. O terceiro `expect` é o detetor de
   * fuga: uma ação que não é de payload tem de dar a MESMA resposta sem
   * sondagem nenhuma, porque `resolveAction` ignora o payload nesse caso.
   */
  it('responde por todas as ações e a sondagem não altera a resposta de nenhuma que não seja de payload', () => {
    const { map, state } = ctx()
    const expected: Record<ActionId, boolean> = {
      unlock: true, lock: true, trunk: true, windows: true, sunshade: true,
      quickCool: true, quickHeat: true, defrost: true,
      findVehicle: true, unlockCharger: true, refresh: true,
      climate: true, steeringWheelHeat: true, mirrorHeat: true, batteryPreheat: true,
      // Ações de payload sem painel próprio: nunca botões da linha de ações.
      setChargeLimit: false, setClimate: false,
    }
    for (const action of Object.keys(ALL_ACTIONS) as ActionId[]) {
      expect(isActionAvailable(action, state, map), action).toBe(expected[action])
      expect(isActionAvailable(action, state, {}), action).toBe(false)
      if (!PAYLOAD_ACTIONS.includes(action)) {
        expect(resolveAction(action, state, map) !== undefined, action).toBe(expected[action])
      }
    }
  })

  it('setChargeLimit não está disponível como botão, mesmo com a entidade de limite presente', () => {
    // setChargeLimit também exige um valor (o `number.set_value` vem sem
    // `data`, ver comentário em resolveAction) e também não tem painel próprio
    // em CONTROL_PANEL: o valor vem do slider do painel de carregamento, não
    // da linha de ações.
    const { map, state } = ctx()
    expect(isActionAvailable('setChargeLimit', state, map)).toBe(false)
  })
})
