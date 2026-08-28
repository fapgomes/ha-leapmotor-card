# Leapmotor Card v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Acrescentar ao card v1 o mapa da posição, o painel de clima expansível, o tile de aberturas expansível, a buzina, e a cortina do teto num só botão com posição.

**Architecture:** Sem alterações estruturais. As três camadas da v1 mantêm-se: `resolver.ts`, `vehicle-state.ts` puro, secções sem `hass`, e `leapmotor-card.ts` como único chamador de serviços. As novidades encaixam nos padrões existentes; a única extensão do contrato é o `entity_id` como campo em vez de target, exigido pelos serviços `leapmotor.*`.

**Tech Stack:** Igual à v1 — TypeScript 5, Lit 3, Rollup 4, Vitest 2, `lit` como única dependência de runtime.

**Spec:** `docs/superpowers/specs/2026-08-27-leapmotor-card-v2-design.md`, que assenta em `2026-08-27-leapmotor-card-design.md` (v1).

## Global Constraints

Herdadas da v1 e ainda vinculativas. Ler a secção homónima de
`docs/superpowers/plans/2026-08-27-leapmotor-card.md` para o resto; estas são as
que a v2 mais arrisca quebrar.

- **Camada 3 não recebe `hass`.** Nenhum ficheiro em `src/sections/` importa ou
  referencia `hass`, chama serviços, ou importa `src/resolver.ts` ou
  `src/vehicle-state.ts`. Emite `CustomEvent` com `bubbles: true, composed: true`.
- **Só `leapmotor-card.ts` chama `hass.callService`.**
- **Nenhuma string literal visível no render.** Exceções, e só estas: símbolos de
  unidade (`km`, `bar`, `kWh`, `°C`), os autónimos «Português»/«English» no
  editor, e o `—` que vem de `DASH`.
- **Valores ausentes renderizam `—`.** Nunca `NaN`, `unknown` ou `unavailable`.
- **`noImplicitOverride: true`** — `render()`, `willUpdate()` e `static styles`
  levam `override`; `setConfig`, `getCardSize` e o setter `hass` não.
- **Estado obsoleto apresenta-se como obsoleto.** A posição está
  `location_source: cloud_stale` com ~34 min: a secção mostra a idade, tal como
  a pill das trancas.
- **`button.plain` em `src/theme.ts` tem especificidade (0,1,1)**; uma regra
  local de uma classe não o vence. Usar seletor composto — `button.plain.x` —
  quando for preciso sobrepor. Este descuido causou dois defeitos visíveis na v1.
- **Os catálogos `pt.json` e `en.json` acabam com conjuntos de chaves idênticos.**
  Estão em 89; a v2 remove 2 e acrescenta 18, terminando em **105**.
- Única dependência de runtime: `lit`. A v2 não acrescenta nenhuma.
- Sem `[skip ci]` nas mensagens de commit. Sem `git add -A`: **caminhos
  explícitos sempre**.

## File Structure

| Ficheiro | Alteração |
|---|---|
| `src/types.ts` | `SectionId` ganha `location`; `DEFAULT_SECTIONS` ganha `location: false`; `ActionId` troca `openSunshade`/`closeSunshade` por `sunshade`; `VehicleState` ganha `location` |
| `src/keys.ts` | ganha `location` (`device_tracker/location`) |
| `src/vehicle-state.ts` | deriva `state.location` |
| `src/actions.ts` | `ServiceCall` ganha `entityIdAsField`; `resolveAction` ganha um parâmetro `value`; `sunshade` e `setClimate` novos; `findVehicle` reetiquetado |
| `src/localize.ts` | sem alterações |
| `src/translations/{pt,en}.json` | −2, +18 chaves |
| `src/sections/location.ts` | **novo** — mapa embutido e idade da posição |
| `src/sections/climate-panel.ts` | **novo** — stepper e botões de clima |
| `src/sections/sunshade-control.ts` | **novo** — controlo de posição 0–10 |
| `src/sections/tiles.ts` | tiles passam a botões que emitem `leapmotor-expand` |
| `src/sections/actions-row.ts` | passa o `value` opcional no evento |
| `src/leapmotor-card.ts` | estado de expansão, novas secções, `doCall` com campo-ou-target |
| `src/leapmotor-card-editor.ts` | `location` na lista de secções; `sunshade` na de ações |
| `test/vehicle-state.test.ts` | testes de `state.location` |
| `test/actions.test.ts` | testes de `sunshade`, `setClimate`, `entityIdAsField` |
| `README.md` | secção `location`, ações actualizadas, nota da buzina |

---

### Task 1: Tipos, catálogo e traduções

**Files:**
- Modify: `src/types.ts`, `src/keys.ts`, `src/translations/pt.json`, `src/translations/en.json`

**Interfaces:**
- Consumes: nada de novo.
- Produces: `SectionId` com `location`; `ActionId` com `sunshade` e sem `openSunshade`/`closeSunshade`; `VehicleState['location']`; `ENTITY_KEYS.location`; catálogos a 105 chaves.

- [ ] **Step 1: `src/types.ts`**

Em `SectionId`, acrescentar `location`:
```ts
export type SectionId = 'location' | 'charging' | 'tiles' | 'tires' | 'trip' | 'comfort' | 'schedule'
```

Em `ActionId`, substituir `'openSunshade' | 'closeSunshade'` por `'sunshade'` e acrescentar `'setClimate'`:
```ts
export type ActionId =
  | 'unlock' | 'lock' | 'trunk' | 'windows' | 'sunshade'
  | 'quickCool' | 'quickHeat' | 'defrost'
  | 'findVehicle' | 'unlockCharger' | 'refresh'
  | 'climate' | 'steeringWheelHeat' | 'mirrorHeat' | 'batteryPreheat'
  | 'setChargeLimit' | 'setClimate'
```

Em `DEFAULT_SECTIONS`, acrescentar `location: false` como primeira entrada.

Em `VehicleState`, acrescentar depois de `activity`:
```ts
  location?: {
    latitude: number
    longitude: number
    zone?: string
    ageSeconds?: number
    stale: boolean
  }
```

- [ ] **Step 2: `src/keys.ts`**

Acrescentar ao catálogo, no grupo de identidade:
```ts
  location: { domain: 'device_tracker', tk: 'location' },
```

E **remover** as duas chaves dos botões da cortina:
```ts
  openSunshade: { domain: 'button', tk: 'open_sunshade' },
  closeSunshade: { domain: 'button', tk: 'close_sunshade' },
```
Razão: a ação `sunshade` da v2 chama o serviço `leapmotor.sunshade_open`, que
aceita uma posição, e deixa de premir estes botões. Sem as remover, ficariam
duas chaves de catálogo sem consumidor, o que a v1 define como erro. O catálogo
passa de 86 a **85** entradas: +1 `location`, −2 cortina.

O teste `test/keys.test.ts` valida os domínios contra uma lista: acrescentar
`'device_tracker'` a `VALID_DOMAINS` nesse ficheiro, senão o teste falha. O
teste `'inclui as chaves que a app exige'` não referencia a cortina, logo não
precisa de alteração — confirmar antes de assumir.

- [ ] **Step 3: as 18 chaves novas nos dois catálogos**

`src/translations/pt.json` — acrescentar, cada uma junto do seu grupo:
```
"action.sunshade": "Cortina",
"sunshade.title": "Posição da cortina",
"sunshade.hint": "0 fecha, 10 abre por completo",
"location.title": "Localização",
"location.unknown": "Posição desconhecida",
"location.map_unavailable": "Mapa indisponível",
"climate.title": "Controlo da temperatura interior",
"climate.ac": "Interruptor do A/C",
"openings.door_driver": "Porta do condutor",
"openings.door_passenger": "Porta do passageiro",
"openings.door_rear_left": "Porta traseira esquerda",
"openings.door_rear_right": "Porta traseira direita",
"openings.window_fl": "Vidro frente esquerda",
"openings.window_fr": "Vidro frente direita",
"openings.window_rl": "Vidro trás esquerda",
"openings.window_rr": "Vidro trás direita",
"expand": "Expandir",
"collapse": "Recolher",
```

`src/translations/en.json` — as mesmas chaves:
```
"action.sunshade": "Sunshade",
"sunshade.title": "Sunshade position",
"sunshade.hint": "0 closes, 10 opens fully",
"location.title": "Location",
"location.unknown": "Position unknown",
"location.map_unavailable": "Map unavailable",
"climate.title": "Interior temperature control",
"climate.ac": "A/C switch",
"openings.door_driver": "Driver door",
"openings.door_passenger": "Passenger door",
"openings.door_rear_left": "Rear left door",
"openings.door_rear_right": "Rear right door",
"openings.window_fl": "Front left window",
"openings.window_fr": "Front right window",
"openings.window_rl": "Rear left window",
"openings.window_rr": "Rear right window",
"expand": "Expand",
"collapse": "Collapse",
```

- [ ] **Step 4: a chave alterada e as duas removidas**

Alterar o valor de `action.findVehicle`: `"Buzinar"` em pt, `"Honk"` em en. É a
buzina — a integração descreve o `find_car` como *"Trigger the horn/find-vehicle
action"* — e «Localizar» escondia isso.

Remover de ambos os catálogos: `action.openSunshade` e `action.closeSunshade`.

- [ ] **Step 5: verificar**

Run: `npm run typecheck` — **vai falhar, e é esperado.** `openSunshade` e
`closeSunshade` deixam de existir em `ActionId` e em `ENTITY_KEYS` mas continuam
referenciados em **três** sítios, todos reparados nas tasks seguintes:
`src/actions.ts` (5 referências, Task 2), `test/actions.test.ts` (2, Task 2) e
`src/leapmotor-card-editor.ts` (1, Task 5). Listar no relatório os erros que
aparecem e confirmar que são **só** nesses três ficheiros — qualquer outro é um
sítio que este plano não previu e deve ser reportado.

Run: o comando de sincronização de catálogos, que deve dizer **105**:
```bash
node --input-type=commonjs -e "const fs=require('fs');const a=JSON.parse(fs.readFileSync('src/translations/pt.json','utf8')),b=JSON.parse(fs.readFileSync('src/translations/en.json','utf8'));const ka=Object.keys(a).sort(),kb=Object.keys(b).sort();const miss=ka.filter(k=>!(k in b)).concat(kb.filter(k=>!(k in a)));if(miss.length){console.error('dessincronizadas:',miss);process.exit(1)}console.log('sincronizados:',ka.length)"
```

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/keys.ts src/translations/pt.json src/translations/en.json test/keys.test.ts
git commit -m "feat: add location section, sunshade action and v2 translation keys"
```

---

### Task 2: Derivação da posição e camada de ações

**Files:**
- Modify: `src/vehicle-state.ts`, `src/actions.ts`, `test/fixtures/real-states.ts`
- Test: `test/vehicle-state.test.ts`, `test/actions.test.ts`

**Interfaces:**
- Consumes: `SectionId`, `ActionId`, `VehicleState['location']`, `ENTITY_KEYS.location` (Task 1).
- Produces:
  - `VehicleState['location']` preenchido
  - `ServiceCall` com `entityIdAsField?: boolean`
  - `resolveAction(action, state, map, value?)` — quarto parâmetro opcional
  - `sunshade` e `setClimate` resolvidos para serviços `leapmotor.*`

- [ ] **Step 1: acrescentar o device_tracker à fixture**

Em `test/fixtures/real-states.ts`, no grupo de identidade, com os valores reais
lidos do sistema do utilizador:
```ts
  { key: 'device_tracker/location', entity_id: `device_tracker.${P}_location`, state: 'home', attributes: {
    latitude: 38.691584, longitude: -9.215939, gps_accuracy: 0, source_type: 'gps',
    location_age_seconds: 2017, location_is_stale: true, location_source: 'cloud_stale',
  } },
```

- [ ] **Step 2: escrever os testes da posição**

Acrescentar a `test/vehicle-state.test.ts`:
```ts
describe('buildVehicleState — posição', () => {
  it('lê as coordenadas reais', () => {
    const s = build()
    expect(s.location?.latitude).toBe(38.691584)
    expect(s.location?.longitude).toBe(-9.215939)
  })

  it('marca a posição como obsoleta e expõe a idade', () => {
    const s = build()
    expect(s.location?.stale).toBe(true)
    expect(s.location?.ageSeconds).toBe(2017)
  })

  it('usa o estado do device_tracker como zona', () => {
    expect(build().location?.zone).toBe('home')
  })

  it('não devolve posição quando a entidade falta', () => {
    const hass = realHass()
    const { map } = resolveEntities(hass, CONFIG)
    delete map.location
    expect(buildVehicleState(hass, map, REAL_NOW).location).toBeUndefined()
  })
})
```

- [ ] **Step 3: correr e confirmar que falham**

Run: `npm test -- test/vehicle-state.test.ts`
Expected: os quatro novos falham; `location` vem `undefined`.

- [ ] **Step 4: implementar `buildLocation` em `src/vehicle-state.ts`**

Antes de `buildVehicleState`:
```ts
function buildLocation(hass: HomeAssistant, map: EntityMap): VehicleState['location'] {
  const id = map.location
  const st = id ? hass.states[id] : undefined
  if (!st) return undefined

  // As coordenadas vivem nos atributos, e o `state` de um device_tracker é o
  // nome da zona (`home`, `not_home`), que não passa pelo filtro INVALID. Por
  // isso esta derivação lê os atributos diretamente em vez de usar `entity()`.
  const latitude = Number(st.attributes.latitude)
  const longitude = Number(st.attributes.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined

  const rawAge = Number(st.attributes.location_age_seconds)
  const ageSeconds = Number.isFinite(rawAge) ? rawAge : undefined
  const source = typeof st.attributes.location_source === 'string' ? st.attributes.location_source : undefined

  return {
    latitude,
    longitude,
    zone: INVALID.has(st.state) ? undefined : st.state,
    ageSeconds,
    stale: st.attributes.location_is_stale === true
      || (source?.includes('stale') ?? false)
      || (ageSeconds !== undefined && ageSeconds > STALE_AFTER_SECONDS),
  }
}
```

E em `buildVehicleState`, depois de `activity`:
```ts
    location: buildLocation(hass, map),
```

- [ ] **Step 5: escrever os testes das ações**

Primeiro **remover** o teste que a v1 tinha e que a v2 torna obsoleto, em
`test/actions.test.ts` por volta da linha 49:
```ts
  it('a cortina do teto não é alternante: são duas ações distintas', () => {
    const { map, state } = ctx()
    expect(resolveAction('openSunshade', state, map)?.entityId).toBe('button.leapmotor_b10_000000_demo_open_sunshade')
    expect(resolveAction('closeSunshade', state, map)?.entityId).toBe('button.leapmotor_b10_000000_demo_close_sunshade')
  })
```
Afirmava exatamente o que a v2 deixa de ser verdade. O teste novo do último
bloco abaixo cobre o comportamento que a substitui.

Depois acrescentar a `test/actions.test.ts`:
```ts
describe('resolveAction — serviços leapmotor', () => {
  it('a cortina fecha com valor 0', () => {
    const { map, state } = ctx()
    const call = resolveAction('sunshade', state, map, 0)
    expect(call?.domain).toBe('leapmotor')
    expect(call?.service).toBe('sunshade_close')
    expect(call?.data).toEqual({ value: 0 })
    expect(call?.entityIdAsField).toBe(true)
  })

  it('a cortina abre para uma posição intermédia', () => {
    const { map, state } = ctx()
    const call = resolveAction('sunshade', state, map, 5)
    expect(call?.service).toBe('sunshade_open')
    expect(call?.data).toEqual({ value: 5 })
  })

  it('a posição da cortina é limitada a 0..10', () => {
    const { map, state } = ctx()
    expect(resolveAction('sunshade', state, map, 99)?.data).toEqual({ value: 10 })
    expect(resolveAction('sunshade', state, map, -3)?.data).toEqual({ value: 0 })
  })

  it('sem valor não há chamada de cortina', () => {
    const { map, state } = ctx()
    expect(resolveAction('sunshade', state, map)).toBeUndefined()
  })

  it('setClimate manda modo e temperatura, com entity_id como campo', () => {
    const { map, state } = ctx()
    const call = resolveAction('setClimate', state, map, 22)
    expect(call?.domain).toBe('leapmotor')
    expect(call?.service).toBe('set_climate')
    expect(call?.entityIdAsField).toBe(true)
    // interior 24.0 > alvo 22 -> arrefecer
    expect(call?.data).toEqual({ mode: 'cold', temperature: 22 })
  })

  it('setClimate aquece quando o alvo está acima do interior', () => {
    const { map, state } = ctx()
    expect(resolveAction('setClimate', state, map, 28)?.data).toEqual({ mode: 'hot', temperature: 28 })
  })

  it('setClimate respeita o modo reportado pelo carro', () => {
    const { map, state } = ctx({ 'sensor/climate_mode': 'wind' })
    expect(resolveAction('setClimate', state, map, 22)?.data).toEqual({ mode: 'wind', temperature: 22 })
  })

  it('a temperatura é limitada a 18..32', () => {
    const { map, state } = ctx()
    expect(resolveAction('setClimate', state, map, 5)?.data).toMatchObject({ temperature: 18 })
    expect(resolveAction('setClimate', state, map, 99)?.data).toMatchObject({ temperature: 32 })
  })

  it('buzinar usa o ícone de buzina', () => {
    expect(actionIcon('findVehicle', ctx().state)).toBe('mdi:bullhorn')
  })

  it('as ações de abrir e fechar cortina já não existem separadas', () => {
    // Só o `sunshade` unificado; o par antigo saiu do ActionId na Task 1.
    expect(actionLabel('sunshade', ctx().state, t)).toBe('Cortina')
  })
})
```

- [ ] **Step 6: correr e confirmar que falham**

Run: `npm test -- test/actions.test.ts`
Expected: falham a compilar ou a correr, porque `sunshade`/`setClimate` ainda não
existem em `resolveAction`.

- [ ] **Step 7: implementar em `src/actions.ts`**

Estender `ServiceCall`:
```ts
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
```

Acrescentar o derivador de modo:
```ts
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
```

Alterar a assinatura e acrescentar os dois casos, removendo `openSunshade` e
`closeSunshade`:
```ts
export function resolveAction(
  action: ActionId,
  state: VehicleState,
  map: EntityMap,
  value?: number,
): ServiceCall | undefined {
```
```ts
    case 'sunshade': {
      // A posição da cortina não é exposta como entidade (spec v2 §2.4), logo
      // não há estado para alternar: o utilizador escolhe a posição alvo.
      const entityId = vehicleAnchor(map)
      if (!entityId || value === undefined) return undefined
      const v = clamp(value, 0, 10)
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
      if (!entityId || value === undefined) return undefined
      const temperature = clamp(value, 18, 32)
      return {
        domain: 'leapmotor',
        service: 'set_climate',
        entityId,
        entityIdAsField: true,
        data: { mode: climateMode(state, temperature), temperature },
      }
    }
```

Em `actionIcon`, trocar os dois casos da cortina por `case 'sunshade': return 'mdi:window-shutter'`,
acrescentar `case 'setClimate': return 'mdi:thermometer'`, e mudar
`findVehicle` para `'mdi:bullhorn'`.

Em `BLOCKED_WHILE_DRIVING`, trocar `'openSunshade', 'closeSunshade'` por `'sunshade'`.

- [ ] **Step 8: reparar os dois últimos sítios que a Task 1 quebrou**

A Task 1 removeu `openSunshade`/`closeSunshade` e acrescentou `location` ao
`SectionId`, o que quebra dois sítios fora do âmbito natural desta task. São
duas linhas mecânicas, e ficam aqui para o typecheck voltar a estar limpo **no
fim da Task 2** — sem isso, as Tasks 3 e 4 ficariam sem forma de se verificarem.

Em `src/leapmotor-card.ts`, no mapa `SECTION_KEYS`, acrescentar como primeira
entrada de secção:
```ts
  location: ['location'],
```
`SECTION_KEYS` é um `Record<SectionId | 'core', LogicalKey[]>`, logo o
TypeScript exige a entrada nova. Não tocar em mais nada nesse ficheiro — a
ligação da secção é da Task 5.

Em `src/leapmotor-card-editor.ts`, em `ALL_ACTIONS`, substituir
`'openSunshade', 'closeSunshade'` por `'sunshade'`. Não tocar em mais nada nesse
ficheiro — `SECTION_IDS` é da Task 5.

- [ ] **Step 9: verificar**

Run: `npm test && npm run typecheck && npm run build`
Expected: **todos passam.** Os testes sobem de 109 para 122. Se o typecheck
ainda acusar algo, é um sítio que este plano não previu: parar e reportar.

- [ ] **Step 10: Commit**

```bash
git add src/vehicle-state.ts src/actions.ts src/leapmotor-card.ts src/leapmotor-card-editor.ts test/fixtures/real-states.ts test/vehicle-state.test.ts test/actions.test.ts
git commit -m "feat: derive vehicle location and resolve leapmotor service actions"
```

---

### Task 3: Secção de localização com mapa embutido

**Files:**
- Create: `src/sections/location.ts`

**Interfaces:**
- Consumes: `VehicleState['location']` (Task 2), `formatAgo` (v1 `src/format.ts`), `sharedStyles`, `TranslateFn`, `DASH`.
- Produces: elemento `<leapmotor-location>` com `state`, `t`, e `mapElement?: HTMLElement`.

**O problema de arquitetura desta task, e como se resolve.** O card `map` do
Home Assistant é um card do HA como qualquer outro: precisa que lhe seja
atribuído `hass`. Mas a spec proíbe que uma secção veja `hass`, e essa regra
existe para que nenhuma secção possa chamar serviços.

A solução **não** é abrir uma exceção. É o elemento principal — que já tem
`hass` e é o único autorizado a tê-lo — criar o elemento do mapa, alimentá-lo, e
passá-lo para esta secção **já construído**, como uma propriedade. A secção
limita-se a colocá-lo no seu layout. Lit renderiza um `HTMLElement` diretamente
num template, pelo que isto funciona sem truques.

A criação do elemento fica na Task 5. Esta task assume-o recebido.

- [ ] **Step 1: escrever `src/sections/location.ts`**

```ts
import { LitElement, css, html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { formatAgo } from '../format'
import { DASH, type TranslateFn } from '../localize'
import { sharedStyles } from '../theme'
import type { VehicleState } from '../types'

@customElement('leapmotor-location')
export class LeapmotorLocation extends LitElement {
  @property({ attribute: false }) state!: VehicleState
  @property({ attribute: false }) t!: TranslateFn
  /**
   * O card `map` do Home Assistant, já criado e alimentado com `hass` pelo
   * elemento principal. Esta secção nunca vê `hass` — ver a nota da Task 3.
   */
  @property({ attribute: false }) mapElement?: HTMLElement

  override render() {
    const loc = this.state.location
    return html`<div class="panel">
      <div class="row head">
        <div class="title">${this.t('location.title')}</div>
        ${loc?.stale && loc.ageSeconds !== undefined
          ? html`<span class="chip stale">${formatAgo(loc.ageSeconds, this.t)}</span>`
          : nothing}
      </div>

      ${loc
        ? html`
            <div class="zone muted">${loc.zone ?? DASH}</div>
            ${this.mapElement
              ? html`<div class="map ${loc.stale ? 'stale' : ''}">${this.mapElement}</div>`
              : html`<div class="fallback muted">${this.t('location.map_unavailable')}</div>`}
          `
        : html`<div class="fallback muted">${this.t('location.unknown')}</div>`}
    </div>`
  }

  static override styles = [sharedStyles, css`
    .head { align-items: center; }
    .title { font-size: 1.05rem; font-weight: 600; }
    .chip.stale { opacity: 0.7; }
    .zone { font-size: 0.85rem; margin-top: 4px; }
    .map { margin-top: 10px; border-radius: 12px; overflow: hidden; }
    /* Posição obsoleta desenha-se esbatida, pela mesma razão que a pill das
       trancas: o card não apresenta como atual o que sabe estar velho. */
    .map.stale { opacity: 0.72; }
    .fallback { margin-top: 10px; font-size: 0.85rem; }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-location': LeapmotorLocation }
}
```

- [ ] **Step 2: verificar**

Run: `npm run typecheck && npm test && npm run build`
Expected: sem erros; 122 testes mantidos. **O bundle NÃO cresce**, e isso é
correto: nada importa `location.ts` até à Task 5, pelo que o rollup remove-o por
tree-shaking. Um bundle maior nesta task significaria que alguém ligou a secção
fora de âmbito.

- [ ] **Step 3: Commit**

```bash
git add src/sections/location.ts
git commit -m "feat: add location section hosting the Home Assistant map"
```

---

### Task 4: Painel de clima, controlo da cortina, e tiles expansíveis

**Files:**
- Create: `src/sections/climate-panel.ts`, `src/sections/sunshade-control.ts`
- Modify: `src/sections/tiles.ts`

**Interfaces:**
- Consumes: `VehicleState`, `EntityMap`, `ActionId`, `TranslateFn`, `DASH`, `formatNumber`, `sharedStyles`.
- Produces:
  - `<leapmotor-climate-panel>` com `state`, `t`, `map`. Emite `leapmotor-action` com `{ action: 'setClimate', value }` e com as ações simples de clima.
  - `<leapmotor-sunshade-control>` com `t`. Emite `leapmotor-action` com `{ action: 'sunshade', value }`.
  - `<leapmotor-tiles>` passa a emitir `leapmotor-expand` com `{ panel: 'climate' | 'openings' | null }`.

**Nota sobre o vocabulário de eventos.** A revisão final da v1 criticou o
alastramento de tipos de evento: quatro tipos para três operações. A v2 **não
acrescenta** um tipo por ação nova. O `leapmotor-action` passa a levar um `value`
opcional no detalhe, e é isso que a cortina e a temperatura usam. O único evento
novo é o `leapmotor-expand`, porque a expansão é uma decisão de layout do card e
não uma ação sobre o veículo.

- [ ] **Step 1: escrever `src/sections/climate-panel.ts`**

```ts
import { LitElement, css, html, nothing } from 'lit'
import { customElement, property, state as internalState } from 'lit/decorators.js'
import { formatNumber } from '../format'
import type { TranslateFn } from '../localize'
import { sharedStyles } from '../theme'
import type { ActionId, EntityMap, VehicleState } from '../types'

/**
 * Tempo de espera antes de enviar a temperatura. `leapmotor.set_climate` não é
 * um setpoint: cada envio é um comando que liga a climatização. Sem este
 * agrupamento, três toques no «+» seriam três chamadas à cloud.
 */
const SEND_DELAY_MS = 1200
const TEMP_MIN = 18
const TEMP_MAX = 32

@customElement('leapmotor-climate-panel')
export class LeapmotorClimatePanel extends LitElement {
  @property({ attribute: false }) state!: VehicleState
  @property({ attribute: false }) t!: TranslateFn
  @property({ attribute: false }) map!: EntityMap

  /** Temperatura mostrada enquanto o comando não é enviado nem confirmado. */
  @internalState() private pendingTemp?: number
  private timer?: number

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    if (this.timer !== undefined) window.clearTimeout(this.timer)
  }

  private get shownTemp(): number | undefined {
    return this.pendingTemp ?? this.state.climate.targetC
  }

  private fire(action: ActionId, value?: number) {
    this.dispatchEvent(new CustomEvent('leapmotor-action', {
      detail: { action, value }, bubbles: true, composed: true,
    }))
  }

  private step(delta: number) {
    const base = this.shownTemp ?? 24
    const next = Math.min(TEMP_MAX, Math.max(TEMP_MIN, Math.round(base) + delta))
    this.pendingTemp = next
    if (this.timer !== undefined) window.clearTimeout(this.timer)
    this.timer = window.setTimeout(() => {
      this.timer = undefined
      this.fire('setClimate', next)
      // Não limpamos `pendingTemp`: o valor mostrado continua a ser o pedido até
      // o sensor do carro reportar o novo alvo, o que leva um ciclo de polling.
    }, SEND_DELAY_MS)
  }

  private button(action: ActionId, key: LogicalKey, icon: string, label: string) {
    if (!this.map[key]) return nothing
    return html`<button class="plain tile-btn" @click=${() => this.fire(action)} title=${label}>
      <span class="circle"><ha-icon icon=${icon}></ha-icon></span>
      <span class="label">${label}</span>
    </button>`
  }

  override render() {
    const temp = this.shownTemp
    const pending = this.pendingTemp !== undefined
    return html`<div class="panel">
      <div class="title">${this.t('climate.title')}</div>

      <div class="stepper">
        <button class="plain step-btn" @click=${() => this.step(-1)} title="-">
          <ha-icon icon="mdi:minus"></ha-icon>
        </button>
        <div class="value ${pending ? 'pending' : ''}">
          <span class="big">${formatNumber(temp, 0)}</span><span class="unit muted">°C</span>
        </div>
        <button class="plain step-btn" @click=${() => this.step(1)} title="+">
          <ha-icon icon="mdi:plus"></ha-icon>
        </button>
      </div>

      <div class="grid">
        ${this.button('climate', 'climateSwitch', 'mdi:air-conditioner', this.t('climate.ac'))}
        ${this.button('quickCool', 'quickCool', 'mdi:snowflake', this.t('action.quickCool'))}
        ${this.button('quickHeat', 'quickHeat', 'mdi:fire', this.t('action.quickHeat'))}
        ${this.button('defrost', 'windshieldDefrost', 'mdi:car-defrost-front', this.t('action.defrost'))}
      </div>
    </div>`
  }

  static override styles = [sharedStyles, css`
    .title { font-size: 1.05rem; font-weight: 600; }
    .stepper { display: flex; align-items: center; justify-content: center; gap: 20px; margin: 14px 0; }
    .step-btn {
      display: grid; place-items: center; width: 44px; height: 44px;
      border-radius: 50%; background: var(--lm-chip);
    }
    button.plain.step-btn { display: grid; }
    .value { display: flex; align-items: baseline; gap: 4px; }
    .value.pending { opacity: 0.6; }
    .big { font-size: 2.2rem; font-weight: 300; line-height: 1; }
    .unit { font-size: 0.9rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(64px, 1fr)); gap: 8px; }
    button.plain.tile-btn { flex-direction: column; }
    .circle { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 50%; background: var(--lm-chip); }
    .label { font-size: 0.72rem; text-align: center; line-height: 1.15; }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-climate-panel': LeapmotorClimatePanel }
}
```

Acrescentar `import type { LogicalKey } from '../keys'` ao topo. A camada 3 pode
importar `keys.ts`: é só dados, sem `hass` e sem lógica, e `actions-row.ts` e
`comfort.ts` já o fazem.

- [ ] **Step 2: escrever `src/sections/sunshade-control.ts`**

```ts
import { LitElement, css, html } from 'lit'
import { customElement, property, state as internalState } from 'lit/decorators.js'
import type { TranslateFn } from '../localize'
import { sharedStyles } from '../theme'

@customElement('leapmotor-sunshade-control')
export class LeapmotorSunshadeControl extends LitElement {
  @property({ attribute: false }) t!: TranslateFn

  /**
   * A posição da cortina não é exposta como entidade (spec v2 §2.4), pelo que
   * não há valor atual para mostrar. O controlo começa a meio e o que conta é o
   * valor que o utilizador confirma.
   */
  @internalState() private value = 5

  private commit() {
    this.dispatchEvent(new CustomEvent('leapmotor-action', {
      detail: { action: 'sunshade', value: this.value }, bubbles: true, composed: true,
    }))
  }

  override render() {
    return html`<div class="panel">
      <div class="row head">
        <div class="title">${this.t('sunshade.title')}</div>
        <div class="reading">${this.value}/10</div>
      </div>
      <input
        class="slider" type="range" min="0" max="10" step="1"
        .value=${String(this.value)}
        @input=${(e: Event) => { this.value = Number((e.target as HTMLInputElement).value) }}
        @change=${this.commit}
      />
      <div class="hint muted">${this.t('sunshade.hint')}</div>
    </div>`
  }

  static override styles = [sharedStyles, css`
    .head { align-items: center; }
    .title { font-size: 1.05rem; font-weight: 600; }
    .reading { font-size: 1.1rem; font-variant-numeric: tabular-nums; }
    .slider { width: 100%; margin-top: 12px; accent-color: var(--primary-color); }
    .hint { font-size: 0.75rem; margin-top: 6px; }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-sunshade-control': LeapmotorSunshadeControl }
}
```

- [ ] **Step 3: tornar os tiles expansíveis em `src/sections/tiles.ts`**

Acrescentar a propriedade e o emissor:
```ts
  /** Qual painel está expandido, decidido pelo card. */
  @property({ type: String }) expanded?: 'climate' | 'openings' | null

  private toggle(panel: 'climate' | 'openings') {
    this.dispatchEvent(new CustomEvent('leapmotor-expand', {
      detail: { panel: this.expanded === panel ? null : panel },
      bubbles: true, composed: true,
    }))
  }
```

Envolver cada tile num `<button class="plain tile">` que chama `this.toggle(...)`,
com `aria-expanded` e um `title` de `t('expand')`/`t('collapse')`. **O botão da
ventoinha fica dentro do tile de clima e não deve propagar o clique para a
expansão**: no seu handler, chamar `e.stopPropagation()` antes de emitir
`leapmotor-action`. Sem isso, ligar a climatização também expande o painel.

Substituir a linha de detalhe das aberturas por uma lista itemizada, mostrada só
quando `expanded === 'openings'`:
```ts
  private openingsDetail() {
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
    return rows
  }
```
e renderizar `rows` como uma lista de linhas quando expandido, ou o resumo
existente quando recolhido. `isWindowOpen` vem de `../format`, onde a onda de
correções da v1 o colocou.

Acrescentar às `static override styles`:
```ts
    button.plain.tile { display: block; width: 100%; text-align: start; }
    .detail-list { margin-top: 8px; display: flex; flex-direction: column; gap: 4px; font-size: 0.78rem; }
```
O seletor composto `button.plain.tile` é obrigatório: `button.plain` tem
especificidade (0,1,1) e uma regra `.tile` não o venceria.

- [ ] **Step 4: verificar**

Run: `npm run typecheck && npm test && npm run build`
Expected: sem erros; 122 testes mantidos.

- [ ] **Step 5: Commit**

```bash
git add src/sections/climate-panel.ts src/sections/sunshade-control.ts src/sections/tiles.ts
git commit -m "feat: add climate panel, sunshade position control and expandable tiles"
```

---

### Task 5: Ligação no elemento principal, editor e README

**Files:**
- Modify: `src/leapmotor-card.ts`, `src/leapmotor-card-editor.ts`, `README.md`

**Interfaces:**
- Consumes: tudo das Tasks V1–V4.
- Produces: o card completo da v2. Nenhuma interface nova para tasks futuras.

- [ ] **Step 1: criar e alimentar o mapa em `src/leapmotor-card.ts`**

Acrescentar os campos e o criador. O elemento do mapa **não** é reativo: é um
`HTMLElement` guardado num campo simples, e pedimos o render à mão quando chega.

```ts
  private _mapElement?: HTMLElement
  private _mapRequested = false

  /**
   * Cria o card `map` do Home Assistant e guarda-o. Só o elemento principal
   * pode fazer isto, porque um card do HA precisa de `hass` e as secções não o
   * podem ver. A secção recebe o elemento já construído.
   *
   * `loadCardHelpers` é um global semi-público do frontend do HA. Se não
   * existir, ou se falhar, ficamos sem `_mapElement` e a secção mostra o seu
   * texto de recurso — o card não parte por causa disto.
   */
  private ensureMap(entityId: string): void {
    if (this._mapRequested) return
    this._mapRequested = true
    const loader = (window as unknown as {
      loadCardHelpers?: () => Promise<{ createCardElement: (c: Record<string, unknown>) => HTMLElement }>
    }).loadCardHelpers
    if (!loader) return
    loader()
      .then(helpers => {
        const el = helpers.createCardElement({
          type: 'map',
          entities: [entityId],
          aspect_ratio: '16:9',
          hours_to_show: 0,
        })
        if (this._hass) (el as unknown as { hass?: HomeAssistant }).hass = this._hass
        this._mapElement = el
        this.requestUpdate()
      })
      .catch(() => { /* a secção mostra location.map_unavailable */ })
  }
```

No setter de `hass`, alimentar o mapa a cada actualização — um card do HA espera
receber `hass` sempre que muda:
```ts
  public set hass(hass: HomeAssistant) {
    this._hass = hass
    if (this._mapElement) (this._mapElement as unknown as { hass?: HomeAssistant }).hass = hass
  }
```

- [ ] **Step 2: estado de expansão e da cortina**

```ts
  @internalState() private _expanded?: 'climate' | 'openings'
  @internalState() private _sunshadeOpen = false
```

- [ ] **Step 3: `doCall` passa a suportar campo ou target**

```ts
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
```

- [ ] **Step 4: `callAction` passa a receber o valor, e trata a cortina**

Alterar a assinatura para `callAction(action, state, map, t, value?: number)` e
acrescentar, como primeira instrução do corpo:
```ts
    // A cortina sem valor não é uma chamada de serviço: é o pedido de abrir o
    // controlo de posição. Não há estado de cortina para alternar (spec v2
    // §2.4), pelo que o utilizador escolhe a posição alvo.
    if (action === 'sunshade' && value === undefined) {
      this._sunshadeOpen = !this._sunshadeOpen
      return
    }
```
e passar `value` ao `resolveAction`:
```ts
    const call = resolveAction(action, state, map, value)
```

- [ ] **Step 5: handlers e render**

Em `render()`, antes do `return html`:
```ts
    if (sections.location && map.location) this.ensureMap(map.location)
```

Actualizar `onAction` e acrescentar `onExpand`:
```ts
    const onAction = (e: CustomEvent<{ action: ActionId; value?: number }>) => {
      void this.callAction(e.detail.action, state, map, t, e.detail.value)
    }
    const onExpand = (e: CustomEvent<{ panel: 'climate' | 'openings' | null }>) => {
      this._expanded = e.detail.panel ?? undefined
    }
```
Registar `@leapmotor-expand=${onExpand}` no `<ha-card>`, junto dos outros quatro.

Renderizar a secção de localização **depois** do bloco `sections.tiles`, no fim
do card. Um mapa colado ao nome do veículo empurra a autonomia e as ações para
fora do primeiro ecrã, que é o que a app mostra primeiro e o que o utilizador
consulta mais vezes:
```ts
        ${sections.location
          ? html`<leapmotor-location
              .state=${state} .t=${t} .mapElement=${this._mapElement}
            ></leapmotor-location>`
          : nothing}
```

Passar o estado de expansão aos tiles e renderizar os painéis expandidos logo
abaixo deles:
```ts
        ${sections.tiles
          ? html`<leapmotor-tiles
              .state=${state} .t=${t} .climateToggleable=${!!map.climateSwitch}
              .expanded=${this._expanded ?? null}
            ></leapmotor-tiles>`
          : nothing}

        ${sections.tiles && this._expanded === 'climate'
          ? html`<leapmotor-climate-panel .state=${state} .t=${t} .map=${map}></leapmotor-climate-panel>`
          : nothing}

        ${this._sunshadeOpen
          ? html`<leapmotor-sunshade-control .t=${t}></leapmotor-sunshade-control>`
          : nothing}
```

Acrescentar aos imports do topo:
```ts
import './sections/location'
import './sections/climate-panel'
import './sections/sunshade-control'
```

- [ ] **Step 6: `SECTION_KEYS` e `getCardSize`**

`SECTION_KEYS` já ganhou `location: ['location']` na Task 2, por necessidade de
typecheck — **confirmar que está lá** em vez de o acrescentar outra vez. É o que
faz o aviso de entidade em falta cobrir o caso de ligar a secção com o
`device_tracker` desactivado, que é precisamente quando o utilizador precisa
dele.

Em `getCardSize`, acrescentar `+ (s.location ? 4 : 0)`.

- [ ] **Step 7: editor visual**

Em `src/leapmotor-card-editor.ts`:
- `SECTION_IDS` passa a `['location', 'charging', 'tiles', 'tires', 'trip', 'comfort', 'schedule']`.
- `ALL_ACTIONS` já trocou `'openSunshade', 'closeSunshade'` por `'sunshade'` na
  Task 2 — confirmar em vez de repetir.

O interruptor do mapa no editor vem daí: a lista de secções é gerada a partir de
`SECTION_IDS`.

- [ ] **Step 8: README**

Quatro alterações, todas factuais:
1. Na tabela de `sections`, acrescentar `location` — mapa da posição do veículo,
   **off por defeito**, e dizer que mostra a idade da posição porque a
   integração a reporta como obsoleta.
2. Na lista de IDs válidos para `actions`/`confirm_actions`: são agora **15**.
   Sai o par `openSunshade`/`closeSunshade`, entra `sunshade`. `setChargeLimit`
   e `setClimate` continuam fora — não funcionam como botões da linha, porque a
   sua chamada precisa de um valor que só o respetivo controlo fornece.
3. Uma frase a dizer que `findVehicle` **toca a buzina**: a integração descreve o
   `find_car` como *"Trigger the horn/find-vehicle action"*. Quem procura
   «buzina» na documentação tem de o encontrar.
4. **A tabela do catálogo de nomes lógicos**, que a v1 gerou com 86 entradas:
   corrigir a contagem para **85**, remover as linhas `openSunshade` e
   `closeSunshade` — que deixaram de existir — e acrescentar `location`
   (`device_tracker` / `location`) no grupo de identidade. Confirmar a contagem
   contra `src/keys.ts` em vez de a ajustar de cabeça.
5. Uma frase sobre a cortina: um só botão que abre um controlo de posição 0–10,
   porque a integração não expõe a posição actual como entidade e um alternante
   mentiria. Mencionar que não há stop a meio do movimento, por ausência de
   serviço na integração — é uma limitação a montante e o leitor merece sabê-lo.

- [ ] **Step 9: verificar**

Run: `npm run typecheck && npm test && npm run build`
Expected: sem erros, 122 testes, um só `dist/leapmotor-card.js`.

Run: a verificação de que nenhuma secção vê `hass` — a Task 3 depende disto e é
o convite mais óbvio a quebrá-la:
```bash
for f in src/sections/*.ts; do
  n=$(grep -vE '^\s*(\*|//|/\*)' "$f" | grep -c hass)
  [ "$n" -gt 0 ] && echo "FALHA: $f usa hass em código ($n)"
done; echo "verificado"
```
O `grep -rln hass src/sections/` simples dá **falso positivo**: `location.ts` tem
um comentário que explica precisamente que a secção nunca vê `hass`. A versão
acima exclui linhas de comentário antes de contar.

- [ ] **Step 10: Commit**

```bash
git add src/leapmotor-card.ts src/leapmotor-card-editor.ts README.md
git commit -m "feat: wire location, climate panel and sunshade control into the card"
```

---

## Notas de execução

- A ordem 1 → V5 é obrigatória: a V1 quebra o typecheck de propósito
  (`openSunshade` deixa de existir mas ainda é referenciado) e a V2 repara-o.
  Não despachar a V2 antes de a V1 estar commitada.
- A V3 e a V4 são independentes entre si e podem ser revistas em paralelo, mas
  não implementadas em paralelo: ambas terminam com um `npm run build`.
- O ficheiro `src/sections/tiles.ts` é tocado pela V4 e lido pela V5. Se a V5
  encontrar os tiles sem a propriedade `expanded`, a V4 não está feita — parar e
  reportar em vez de a acrescentar.
