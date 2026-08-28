# Leapmotor Card v3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** O painel de clima passa a ter a vista de topo do carro com os controlos de conforto sobrepostos, como o ecrã da app; a recirculação passa a ser controlável; a velocidade da ventoinha deixa de ser reposta em silêncio; e a secção Trip ganha a média de consumo de sempre.

**Architecture:** Sem alterações estruturais. Muda uma assinatura: o quarto parâmetro do `resolveAction` deixa de ser um número solto e passa a um objecto com campos nomeados por ação.

**Spec:** `docs/superpowers/specs/2026-08-27-leapmotor-card-v2-design.md` continua a valer. Os factos novos estão na secção seguinte deste plano.

## Factos verificados no sistema real

Lidos por SSH e pela API do HA a 2026-08-27. Não contradizer sem voltar a ler.

| Entidade | Valor real |
|---|---|
| `number/driver_seat_heating` e as outras três | `min=0 max=3 step=1` |
| `switch/rearview_mirror_heat` | **um só interruptor para os dois espelhos** |
| `switch/steering_wheel_heat` | interruptor |
| `binary_sensor/air_recirculation` | existe, **só leitura**, hoje fora do catálogo |
| `sensor/total_energy_kwh` | 131.0, vem de `data["history"]` — é acumulado |
| `sensor/total_mileage_km` | 659 |

`leapmotor.set_climate` aceita `mode` (obrigatório), `temperature` 18–32, `fan_speed` **1–7 com defeito 3**, `recirculate` booleano com defeito falso, e `windshield_defrost` booleano.

### Os dois problemas que estes factos revelam

**1. Cada `set_climate` repõe a ventoinha no nível 3.** O card só envia `mode` e `temperature`, pelo que a integração aplica o defeito ao `fan_speed`. **Isto já acontece no card instalado** e é invisível. A integração não expõe a velocidade atual em nenhuma entidade, logo não há como a preservar: a única saída honesta é o utilizador escolher, e o card mostrar o que enviou.

**2. Mexer na recirculação exige reenviar o comando inteiro.** Não há serviço próprio. Com o A/C ligado isso é inócuo — a climatização continua e a recirculação muda. Com o A/C **desligado**, ligaria o A/C, o que seria uma surpresa. O controlo fica desactivado nesse caso e mostra só o estado do sensor.

Consequência conjunta: **todo o `set_climate` tem de levar sempre temperatura, ventoinha e recirculação**, senão mudar um repõe os outros.

## Decisões

| Decisão | Escolha | Porquê |
|---|---|---|
| Espelhos | **Um** controlo | A app mostra dois; o HA tem um interruptor. Dois que mexem no mesmo seriam mentira. |
| Recirculação sem A/C | Desactivada, só indicador | Ligar o A/C ao tocar na recirculação é uma surpresa que o utilizador não pediu. |
| Ventoinha | Controlo 1–7, rotulado como o que o card enviou | Não é legível do carro. Melhor um valor visível e escolhido do que um 3 silencioso. |
| Vista de topo | SVG **original** | Não embutir a imagem da app — material com direitos, como na silhueta lateral da v1. |
| Níveis dos assentos | Toque cicla 0→1→2→3 | Compacto, e é o que a app faz. As linhas de botões continuam na secção `comfort`. |
| Média de sempre | **Derivada**, `total_energy_kwh / total_mileage_km × 100` | Não existe como sensor. 131.0/659×100 = 19.9, coerente com os 20.6 de 6 semanas. |
| Assinatura do `resolveAction` | Passa de `value?: number` a `payload?: ActionPayload` | Um número solto já significava coisas diferentes conforme a ação. Nomear os campos remove a ambiguidade que produziu os piores defeitos deste projeto. |

## Constraints

Herdadas e ainda vinculativas:

- **Camada 3 não recebe `hass`.** Secções emitem `CustomEvent` com `bubbles`/`composed`.
- **Só `leapmotor-card.ts` chama `hass.callService`.**
- **Nenhuma string literal visível no render**, salvo símbolos de unidade e `DASH`.
- **`noImplicitOverride: true`.**
- **`button.plain` faz `all: unset` a (0,1,1).** Qualquer regra sobre um elemento `class="plain x"` precisa de `button.plain.x` e tem de **repor toda a caixa** — fundo, padding, cantos, dimensões, `position`, `box-sizing`. Isto produziu **seis** defeitos neste projeto, dois deles no dashboard do utilizador. O aviso está no topo da regra em `src/theme.ts`.
- Catálogos com conjuntos de chaves idênticos. Estão em 107.
- Única dependência de runtime: `lit`.
- Sem `[skip ci]`. **Caminhos explícitos no `git add`, nunca `-A`.**

---

### Task 1: Estado — recirculação, média de sempre, e as chaves

**Files:** `src/keys.ts`, `src/types.ts`, `src/vehicle-state.ts`, `src/translations/{pt,en}.json`, `test/fixtures/real-states.ts`, `test/vehicle-state.test.ts`

- [ ] **Step 1: catálogo**

Em `src/keys.ts`, no grupo de clima:
```ts
  recirculation: { domain: 'binary_sensor', tk: 'air_recirculation' },
```
O catálogo passa de 85 para **86** entradas.

- [ ] **Step 2: tipos**

Em `src/types.ts`, `VehicleState['climate']` ganha:
```ts
    recirculating?: boolean
```
e `VehicleState['trip']` ganha:
```ts
    lifetimeConsumption?: number
```

- [ ] **Step 3: fixture**

Em `test/fixtures/real-states.ts`, no grupo de clima:
```ts
  { key: 'binary_sensor/air_recirculation', entity_id: `binary_sensor.${P}_air_recirculation`, state: 'off' },
```

- [ ] **Step 4: testes**

Acrescentar a `test/vehicle-state.test.ts`:
```ts
describe('buildVehicleState — recirculação e consumo de sempre', () => {
  it('lê a recirculação', () => {
    expect(build().climate.recirculating).toBe(false)
    expect(build({ 'binary_sensor/air_recirculation': 'on' }).climate.recirculating).toBe(true)
  })

  it('deixa a recirculação undefined quando a entidade falta', () => {
    expect(build({ 'binary_sensor/air_recirculation': 'unavailable' }).climate.recirculating).toBeUndefined()
  })

  it('deriva o consumo de sempre da energia total e da quilometragem total', () => {
    // 131.0 kWh / 661 km * 100 = 19.82 kWh/100 km
    expect(build().trip.lifetimeConsumption).toBeCloseTo(19.82, 2)
  })

  it('não deriva o consumo de sempre sem energia total', () => {
    expect(build({ 'sensor/total_energy_kwh': 'unavailable' }).trip.lifetimeConsumption).toBeUndefined()
  })

  it('não divide por zero', () => {
    expect(build({ 'sensor/total_mileage_km': '0' }).trip.lifetimeConsumption).toBeUndefined()
  })
})
```

- [ ] **Step 5: correr e confirmar que falham**

Run: `npm test -- test/vehicle-state.test.ts`

- [ ] **Step 6: implementar**

Em `buildClimate`, acrescentar ao objecto devolvido:
```ts
    recirculating: bool(hass, map, 'recirculation'),
```

Em `buildVehicleState`, no bloco `trip`, acrescentar:
```ts
      // Não existe como sensor: deriva-se da energia acumulada a dividir pela
      // quilometragem acumulada. Só quando ambas existem e a distância não é
      // zero — um carro acabado de entregar dividiria por zero.
      lifetimeConsumption: (() => {
        const energy = num(hass, map, 'totalEnergy')
        const distance = num(hass, map, 'totalMileage') ?? num(hass, map, 'odometer')
        if (energy === undefined || distance === undefined || distance <= 0) return undefined
        return (energy / distance) * 100
      })(),
```

- [ ] **Step 7: traduções**

Acrescentar aos dois catálogos, junto do grupo respectivo. Catálogos passam a **113**.

`pt.json`:
```
"trip.lifetime": "Média desde sempre",
"trip.lifetime_note": "calculada",
"climate.recirculation": "Recirculação",
"climate.recirculation_off_hint": "Liga a climatização para poder mudar",
"climate.fan": "Ventoinha",
"climate.fan_note": "último valor enviado",
```
`en.json`:
```
"trip.lifetime": "All-time average",
"trip.lifetime_note": "calculated",
"climate.recirculation": "Recirculation",
"climate.recirculation_off_hint": "Turn the climate on to change it",
"climate.fan": "Fan",
"climate.fan_note": "last value sent",
```

- [ ] **Step 8: verificar e commitar**

Run: `npm run typecheck && npm test`. Testes sobem de 130 para **135**. A verificação de catálogos deve dizer **113**.

```bash
git add src/keys.ts src/types.ts src/vehicle-state.ts src/translations/pt.json src/translations/en.json test/fixtures/real-states.ts test/vehicle-state.test.ts
git commit -m "feat: derive recirculation state and all-time consumption"
```

---

### Task 2: `resolveAction` passa a receber um payload nomeado

**Files:** `src/actions.ts`, `src/sections/sunshade-control.ts`, `src/sections/climate-panel.ts`, `src/leapmotor-card.ts`, `test/actions.test.ts`

**Porquê.** O quarto parâmetro é hoje um `number` que significa «posição da cortina» para uma ação e «temperatura» para outra. Essa ambiguidade é a mesma família de defeito que já tornou a cortina inalcançável e quase pôs um botão «Temperatura» a mover o teto. E agora o `set_climate` precisa de **três** valores, não de um.

- [ ] **Step 1: os tipos novos em `src/actions.ts`**

```ts
/** Um comando de climatização completo. A integração repõe o que não for enviado. */
export interface ClimateCommand {
  temperature: number
  fanSpeed: number
  recirculate: boolean
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
  /** Comando de climatização. Tem de ser sempre completo — ver a nota do plano. */
  climate?: ClimateCommand
}
```

- [ ] **Step 2: a assinatura e os dois casos**

`resolveAction(action, state, map, payload?: ActionPayload)`.

`sunshade` lê `payload?.position` — se for `undefined`, devolve `undefined`, como antes.

`setClimate` passa a:
```ts
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
```

- [ ] **Step 3: as sondagens de disponibilidade**

```ts
/** Payload mínimo para responder «esta ação está disponível?» sem a executar. */
const AVAILABILITY_PROBE: Partial<Record<ActionId, ActionPayload>> = {
  sunshade: { position: 0 },
  setClimate: { climate: { temperature: 24, fanSpeed: 3, recirculate: false } },
}
```
e `isActionAvailable` usa `AVAILABILITY_PROBE[action]` em vez do `0` literal.

- [ ] **Step 4: quem emite e quem consome**

- `sunshade-control.ts`: `detail: { action: 'sunshade', payload: { position: this.value } }`.
- `climate-panel.ts`: `detail: { action: 'setClimate', payload: { climate: { temperature, fanSpeed, recirculate } } }`.
  **O `fanSpeed` ainda não existe nesta task**, e o payload exige-o. Introduzir
  já aqui o estado interno, sem interface:
  ```ts
    /** A integração não expõe a velocidade actual. Isto é o que o card enviou. */
    @internalState() private fanSpeed = 3
  ```
  e usar `recirculate: this.state.climate.recirculating ?? false`, que a Task 1
  já derivou. A Task 3 acrescenta o controlo visível para os dois; sem este
  passo, a Task 2 não compila.
- `leapmotor-card.ts`: o tipo do `onAction` passa a `{ action: ActionId; payload?: ActionPayload }`; `callAction` recebe `payload` e passa-o ao `resolveAction`; o `_climateTimer` fecha sobre o payload do último toque.

- [ ] **Step 5: testes**

Actualizar os testes existentes de `sunshade` e `setClimate` para a forma nova, e acrescentar:
```ts
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
```

- [ ] **Step 6: verificar e commitar**

Run: `npm run typecheck && npm test && npm run build`. Testes sobem para **138**.

```bash
git add src/actions.ts src/sections/sunshade-control.ts src/sections/climate-panel.ts src/leapmotor-card.ts test/actions.test.ts
git commit -m "refactor: name the action payload fields instead of a bare value"
```

---

### Task 3: Vista de topo, painel de clima novo, e a média de sempre

**Files:** `src/car-topview.ts` (novo), `src/sections/climate-panel.ts`, `src/sections/trip.ts`

- [ ] **Step 1: `src/car-topview.ts`**

Desenho original, como a silhueta lateral da v1. **Não** embutir imagens da Leapmotor.

```ts
import { html, type TemplateResult } from 'lit'

/**
 * Vista de topo genérica do habitáculo, para servir de base aos controlos de
 * conforto. Desenho original; o repositório não distribui imagens da Leapmotor.
 */
export const CAR_TOPVIEW: TemplateResult = html`
  <svg viewBox="0 0 200 280" role="img" aria-hidden="true" part="topview">
    <g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" opacity="0.3">
      <rect x="18" y="10" width="164" height="260" rx="46" />
      <path d="M40 66 C70 52 130 52 160 66" />
      <path d="M40 232 C70 246 130 246 160 232" />
      <circle cx="62" cy="94" r="13" />
      <rect x="40" y="114" width="52" height="62" rx="14" />
      <rect x="108" y="114" width="52" height="62" rx="14" />
      <rect x="40" y="192" width="120" height="46" rx="12" />
      <path d="M100 192 L100 238" />
    </g>
  </svg>
`
```

- [ ] **Step 2: o painel de clima**

`src/sections/climate-panel.ts` passa a ter, por esta ordem: o título, a vista de topo com os controlos sobrepostos, o stepper, a ventoinha, a recirculação, e a fila de botões que já existe.

Estado local novo, porque nenhum destes é legível do carro:
```ts
  /** A integração não expõe a velocidade actual. Isto é o que o card enviou. */
  @internalState() private fanSpeed = 3
```
A recirculação **é** legível — usa `this.state.climate.recirculating` como valor mostrado, e envia o oposto ao alternar.

Os controlos sobrepostos, posicionados em percentagem sobre a vista:

| Controlo | Entidade | Posição | Interação |
|---|---|---|---|
| Espelhos | `switch/rearview_mirror_heat` | 50% / 5% | alterna |
| Volante | `switch/steering_wheel_heat` | 31% / 33% | alterna |
| Assento condutor, aquecer | `number/driver_seat_heating` | 26% / 52% | cicla 0→3 |
| Assento condutor, ventilar | `number/driver_seat_ventilation` | 44% / 52% | cicla 0→3 |
| Assento passageiro, aquecer | `number/passenger_seat_heating` | 59% / 52% | cicla 0→3 |
| Assento passageiro, ventilar | `number/passenger_seat_ventilation` | 77% / 52% | cicla 0→3 |

Cada controlo é um `<button class="plain pin">` com o ícone e, para os assentos, o nível actual visível. **A regra tem de ser `button.plain.pin` e repor a caixa toda** — fundo, padding, cantos, dimensões, `position: absolute`, `box-sizing`. Ver a constraint.

Ciclar um assento emite `leapmotor-set-number` com `{ key, value: (actual + 1) % (max + 1) }`, onde `max` vem de `this.maxLevel`. Alternar um interruptor emite `leapmotor-action` como já faz.

Um controlo cuja entidade não esteja no `map` **não é renderizado**.

A recirculação: um botão que emite `setClimate` com o payload completo e `recirculate` invertido. **Desactivado quando `state.climate.on !== true`**, mostrando `climate.recirculation_off_hint` como `title`.

A ventoinha: um `<input type="range">` de 1 a 7 que só actualiza `this.fanSpeed`; o valor só chega ao carro no próximo `setClimate`. Rotulada com `climate.fan` e a nota `climate.fan_note`, para o utilizador saber que não é uma leitura.

O stepper passa a emitir o payload completo: `{ climate: { temperature, fanSpeed: this.fanSpeed, recirculate: this.state.climate.recirculating ?? false } }`.

- [ ] **Step 3: a média de sempre em `src/sections/trip.ts`**

Acrescentar uma quinta linha, depois de `trip.consumption`:
```ts
      {
        label: `${this.t('trip.lifetime')} (${this.t('trip.lifetime_note')})`,
        value: trip.lifetimeConsumption !== undefined
          ? `${formatNumber(trip.lifetimeConsumption, 1)} kWh/100 km`
          : DASH,
      },
```
A nota entre parênteses é deliberada: o valor é calculado pelo card a partir de dois sensores, não reportado pelo carro, e o leitor deve saber a diferença.

- [ ] **Step 4: verificar e commitar**

Run: `npm run typecheck && npm test && npm run build`. Os 138 testes mantêm-se — estas três tasks não acrescentam testes de render, por desenho.

Correr também a auditoria de especificidade, que tem de vir a zero:
```bash
grep -rn "class=\"plain" src/sections/ | sed 's/:.*//' | sort -u
```
e, para cada classe encontrada, confirmar que existe uma regra `button.plain.<classe>` que repõe a caixa.

```bash
git add src/car-topview.ts src/sections/climate-panel.ts src/sections/trip.ts
git commit -m "feat: lay comfort controls over a car top view and show all-time consumption"
```

## Notas de execução

- A ordem 1 → 2 → 3 é obrigatória: a Task 2 muda a assinatura que a Task 3 usa, e a Task 1 cria o estado que ambas leem.
- A armadilha do `button.plain` já produziu seis defeitos. A Task 3 acrescenta uma classe nova sobre botões — `pin`. Se a caixa dela não for reposta no seletor composto, será a sétima.
