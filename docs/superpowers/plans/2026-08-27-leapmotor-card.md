# Leapmotor Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um custom card de Lovelace que replica o ecrã principal da app Leapmotor sobre a integração `leapmotor` do Home Assistant.

**Architecture:** Três camadas com fronteiras estritas. `resolver.ts` traduz um device Leapmotor num `EntityMap` lendo `hass.entities` (que já traz `translation_key`); `vehicle-state.ts` é uma função pura que transforma `EntityMap` + `hass.states` num `VehicleState` tipado com toda a semântica derivada; as secções em `src/sections/` são `LitElement` que só consomem `VehicleState` e emitem eventos. Só `leapmotor-card.ts` conhece o objeto `hass` e só ele chama serviços.

**Tech Stack:** TypeScript 5, Lit 3, Rollup 4, Vitest 2. Única dependência de runtime: `lit`.

**Spec:** `docs/superpowers/specs/2026-08-27-leapmotor-card-design.md`

## Global Constraints

Estes requisitos aplicam-se a todas as tasks.

- Desenvolvido contra **Home Assistant 2026.8.3**. O card depende de `hass.entities` e `hass.devices`; quando `hass.entities` não tiver entradas `leapmotor`, cai para o WebSocket `config/entity_registry/list`.
- **Única dependência de runtime: `lit` (^3.2.0).** Não usar `custom-card-helpers` nem qualquer outro pacote em runtime.
- Saída: **um só ficheiro** `dist/leapmotor-card.js`, formato ES module, minificado.
- **`translation_key` é a chave de mapeamento de entidades.** Nunca construir `entity_id` por concatenação de prefixos.
- **Toda a chave do catálogo (`keys.ts`) tem de ser consumida** por um campo de `VehicleState` ou por uma ação. Chave sem consumidor é erro.
- **Camadas 1 e 2 não tocam no DOM. Camada 3 não recebe `hass`.** Só `leapmotor-card.ts` chama `hass.callService`.
- **Nenhuma string literal visível no render.** Todo o texto passa por `t()`.
- **Valores ausentes renderizam `—`.** Nunca aparece `NaN`, `unknown` ou `unavailable` no ecrã.
- **Sem conversão de unidades.** A unidade vem de `attributes.unit_of_measurement` do estado.
- O README do repositório é em **inglês**. A spec, este plano e os comentários de processo em **português**, com diacríticos corretos.
- **Não incluir imagens ou renders da Leapmotor no repositório** — material com direitos. A silhueta é um SVG original embutido.
- **`noImplicitOverride: true`**: em qualquer `LitElement`, `render()` leva `override` e `static styles` leva `static override styles`. Sem isso o `npm run typecheck` falha. Membros que não existem em `LitElement` (`setConfig`, `getCardSize`, o setter `hass`) não levam `override`.
- Um commit por task, no mínimo. O repositório **não tem `.gitlab-ci.yml`**, logo **não usar `[skip ci]`** nas mensagens.

## File Structure

| Ficheiro | Responsabilidade |
|---|---|
| `package.json`, `tsconfig.json`, `rollup.config.mjs`, `vitest.config.ts` | Toolchain |
| `hacs.json`, `README.md`, `LICENSE`, `.gitignore` | Distribuição |
| `src/ha-types.ts` | Subset tipado do objeto `hass` que consumimos |
| `src/types.ts` | `LeapmotorCardConfig`, `VehicleState`, `ActionId`, `EntityMap` |
| `src/keys.ts` | Catálogo `LogicalKey → { domain, tk }` |
| `src/resolver.ts` | Camada 1: device → `EntityMap` |
| `src/vehicle-state.ts` | Camada 2: `EntityMap` + estados → `VehicleState` (puro) |
| `src/localize.ts`, `src/translations/{pt,en}.json` | i18n |
| `src/actions.ts` | `ActionId` → chamada de serviço |
| `src/theme.ts` | Tokens CSS partilhados |
| `src/car-silhouette.ts` | SVG de recurso para a imagem do veículo |
| `src/sections/hero.ts` | Cabeçalho, autonomia, trancas, imagem, atividade |
| `src/sections/actions-row.ts` | Linha de quatro botões |
| `src/sections/charging.ts` | Painel de carregamento |
| `src/sections/tiles.ts` | Tiles de temperatura interior e aberturas |
| `src/sections/tires.ts` | Pressão dos pneus (opcional) |
| `src/sections/trip.ts` | Odómetro e consumos (opcional) |
| `src/sections/comfort.ts` | Assentos, volante, espelhos, bateria (opcional) |
| `src/sections/schedule.ts` | Agendamento de carregamento (opcional) |
| `src/leapmotor-card.ts` | Elemento principal; único a falar com `hass` |
| `src/leapmotor-card-editor.ts` | Editor visual |
| `test/fixtures/real-states.ts` | Despejo real dos 121 estados do veículo do utilizador |
| `test/{vehicle-state,resolver,localize,keys}.test.ts` | Testes dos módulos puros |

---

### Task 1: Scaffolding, build e harness de testes

**Files:**
- Create: `package.json`, `tsconfig.json`, `rollup.config.mjs`, `vitest.config.ts`, `.gitignore`, `LICENSE`, `hacs.json`
- Create: `src/leapmotor-card.ts` (esqueleto mínimo, substituído na Task 12)
- Test: `test/smoke.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `npm run build` → `dist/leapmotor-card.js`; `npm test` → Vitest; `npm run typecheck` → `tsc --noEmit`.

- [ ] **Step 1: Escrever o teste de fumo**

`test/smoke.test.ts`:
```ts
import { describe, expect, it } from 'vitest'

describe('harness', () => {
  it('corre TypeScript', () => {
    const n: number = 1 + 1
    expect(n).toBe(2)
  })
})
```

- [ ] **Step 2: Correr o teste para confirmar que falha**

Run: `npm test`
Expected: FAIL — `npm` não encontra `package.json` / `vitest` não instalado.

- [ ] **Step 3: Criar o toolchain**

`package.json`:
```json
{
  "name": "leapmotor-card",
  "version": "0.1.0",
  "description": "Lovelace card for Leapmotor vehicles in Home Assistant",
  "license": "GPL-3.0-or-later",
  "repository": { "type": "git", "url": "git+https://github.com/fapgomes/ha-leapmotor-card.git" },
  "type": "module",
  "main": "dist/leapmotor-card.js",
  "scripts": {
    "build": "rollup -c",
    "watch": "rollup -c --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "lit": "^3.2.0"
  },
  "devDependencies": {
    "@rollup/plugin-json": "^6.1.0",
    "@rollup/plugin-node-resolve": "^15.3.0",
    "@rollup/plugin-terser": "^0.4.4",
    "@rollup/plugin-typescript": "^12.1.0",
    "rollup": "^4.24.0",
    "tslib": "^2.8.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2021", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": false,
    "experimentalDecorators": true,
    "useDefineForClassFields": false,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["vitest/globals"]
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

`rollup.config.mjs`:
```js
import json from '@rollup/plugin-json'
import resolve from '@rollup/plugin-node-resolve'
import terser from '@rollup/plugin-terser'
import typescript from '@rollup/plugin-typescript'

export default {
  input: 'src/leapmotor-card.ts',
  output: {
    file: 'dist/leapmotor-card.js',
    format: 'es',
    inlineDynamicImports: true,
    sourcemap: false,
  },
  plugins: [
    resolve(),
    json(),
    typescript({ tsconfig: './tsconfig.json', include: ['src/**/*.ts'] }),
    terser({ format: { comments: false } }),
  ],
}
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
})
```

`.gitignore`:
```
node_modules/
dist/
*.log
.DS_Store
```

`hacs.json`:
```json
{
  "name": "Leapmotor Card",
  "render_readme": true,
  "filename": "leapmotor-card.js",
  "homeassistant": "2026.8.0"
}
```

`LICENSE`: texto integral da **GNU General Public License v3**. Não o
escrever à mão nem o ir buscar à rede — copiar o texto canónico que já
existe no sistema:

```bash
cp /usr/share/licenses/accountsservice/COPYING LICENSE
```

Confirmar que tem 674 linhas e que a primeira linha útil é
`GNU GENERAL PUBLIC LICENSE` seguida de `Version 3, 29 June 2007`. O
ficheiro da GPL não leva nome de titular — a atribuição de copyright vive
no `README.md` (Task 16) e no campo `license` do `package.json`.

`src/leapmotor-card.ts` (esqueleto, substituído na Task 12):
```ts
export const CARD_VERSION = '0.1.0'
console.info(`%c LEAPMOTOR-CARD %c ${CARD_VERSION} `, 'color:#fff;background:#1f6feb', 'color:#1f6feb;background:#fff')
```

- [ ] **Step 4: Instalar e correr**

Run: `npm install && npm test && npm run typecheck && npm run build`
Expected: teste PASS; `tsc` sem erros; `dist/leapmotor-card.js` criado.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tsconfig.json rollup.config.mjs vitest.config.ts .gitignore LICENSE hacs.json src/leapmotor-card.ts test/smoke.test.ts
git commit -m "chore: scaffold TypeScript/Rollup/Vitest toolchain"
```

---

### Task 2: Tipos e catálogo de chaves

**Files:**
- Create: `src/ha-types.ts`, `src/types.ts`, `src/keys.ts`
- Test: `test/keys.test.ts`

**Interfaces:**
- Consumes: toolchain da Task 1.
- Produces:
  - `HomeAssistant`, `HassEntity`, `HassEntityDisplayEntry`, `HassDeviceDisplayEntry` de `src/ha-types.ts`
  - `ENTITY_KEYS: Record<LogicalKey, { domain: string; tk: string }>`, `type LogicalKey`, `INTEGRATION_DOMAIN` de `src/keys.ts`
  - `LeapmotorCardConfig`, `EntityMap = Partial<Record<LogicalKey, string>>`, `VehicleState`, `ActionId`, `SectionId` de `src/types.ts`

- [ ] **Step 1: Escrever o teste de integridade do catálogo**

`test/keys.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { ENTITY_KEYS } from '../src/keys'

const VALID_DOMAINS = ['sensor', 'binary_sensor', 'lock', 'button', 'switch', 'number', 'image']

describe('ENTITY_KEYS', () => {
  it('tem domínio e translation_key em todas as entradas', () => {
    for (const [key, def] of Object.entries(ENTITY_KEYS)) {
      expect(def.domain, key).toBeTruthy()
      expect(def.tk, key).toBeTruthy()
    }
  })

  it('só usa domínios suportados', () => {
    for (const [key, def] of Object.entries(ENTITY_KEYS)) {
      expect(VALID_DOMAINS, key).toContain(def.domain)
    }
  })

  it('não tem pares domínio/translation_key duplicados', () => {
    const seen = new Map<string, string>()
    for (const [key, def] of Object.entries(ENTITY_KEYS)) {
      const id = `${def.domain}/${def.tk}`
      expect(seen.get(id), `${key} duplica ${seen.get(id)}`).toBeUndefined()
      seen.set(id, key)
    }
  })

  it('inclui as chaves que a app exige', () => {
    for (const k of ['battery', 'rangeLive', 'lock', 'isCharging', 'chargeLimit', 'interiorTemp', 'trunk']) {
      expect(Object.keys(ENTITY_KEYS)).toContain(k)
    }
  })
})
```

- [ ] **Step 2: Correr o teste para confirmar que falha**

Run: `npx vitest run test/keys.test.ts`
Expected: FAIL — `Cannot find module '../src/keys'`.

- [ ] **Step 3: Escrever `src/ha-types.ts`**

```ts
export interface HassEntity {
  entity_id: string
  state: string
  attributes: Record<string, unknown> & { unit_of_measurement?: string; entity_picture?: string; friendly_name?: string }
  last_changed: string
  last_updated: string
}

export interface HassEntityDisplayEntry {
  entity_id: string
  device_id?: string | null
  area_id?: string | null
  platform?: string
  translation_key?: string
  hidden?: boolean
  entity_category?: string | null
}

export interface HassDeviceDisplayEntry {
  id: string
  name?: string | null
  name_by_user?: string | null
  model?: string | null
  manufacturer?: string | null
}

export interface HomeAssistant {
  states: Record<string, HassEntity>
  entities: Record<string, HassEntityDisplayEntry>
  devices: Record<string, HassDeviceDisplayEntry>
  locale: { language: string }
  language?: string
  callService: (domain: string, service: string, data?: Record<string, unknown>, target?: Record<string, unknown>) => Promise<unknown>
  callWS: <T>(msg: Record<string, unknown>) => Promise<T>
}

/** Entrada de `config/entity_registry/list`, usada só no fallback do resolver. */
export interface EntityRegistryEntry {
  entity_id: string
  device_id: string | null
  platform: string
  translation_key: string | null
}
```

- [ ] **Step 4: Escrever `src/keys.ts`**

O catálogo completo. Cada entrada é consumida por um campo de `VehicleState` (Tasks 4–6) ou por uma ação (Task 9).

```ts
export const ENTITY_KEYS = {
  // identidade e autonomia
  battery: { domain: 'sensor', tk: 'battery_percent' },
  batteryPrecise: { domain: 'sensor', tk: 'battery_percent_precise' },
  range: { domain: 'sensor', tk: 'remaining_range_km' },
  rangeLive: { domain: 'sensor', tk: 'live_remaining_range_km' },
  rangeMax: { domain: 'sensor', tk: 'wltp_max_range_km' },
  rangeMode: { domain: 'sensor', tk: 'range_mode' },
  lastVehicleUpdate: { domain: 'sensor', tk: 'last_vehicle_update' },
  lastCloudRefresh: { domain: 'sensor', tk: 'last_successful_refresh' },
  vehiclePicture: { domain: 'image', tk: 'vehicle_picture' },

  // trancas
  lock: { domain: 'lock', tk: 'vehicle_lock' },
  lockStateSource: { domain: 'sensor', tk: 'lock_state_source' },
  lockStateAge: { domain: 'sensor', tk: 'lock_state_age_seconds' },

  // atividade
  vehicleState: { domain: 'sensor', tk: 'vehicle_state' },
  gear: { domain: 'sensor', tk: 'gear' },
  speed: { domain: 'sensor', tk: 'speed_kmh' },
  isDriving: { domain: 'binary_sensor', tk: 'is_driving' },
  parkingBrake: { domain: 'binary_sensor', tk: 'parking_brake_active' },
  vehicleReady: { domain: 'binary_sensor', tk: 'vehicle_ready' },

  // carregamento
  chargeLimit: { domain: 'sensor', tk: 'charge_limit_percent' },
  chargeLimitSet: { domain: 'number', tk: 'charge_limit_setting' },
  isCharging: { domain: 'binary_sensor', tk: 'is_charging' },
  isPluggedIn: { domain: 'binary_sensor', tk: 'is_plugged_in' },
  dcCableConnected: { domain: 'binary_sensor', tk: 'dc_cable_connected' },
  fullyCharged: { domain: 'binary_sensor', tk: 'fully_charged' },
  chargingConnection: { domain: 'sensor', tk: 'charging_connection_state' },
  chargingPower: { domain: 'sensor', tk: 'charging_power_kw' },
  chargingVoltage: { domain: 'sensor', tk: 'charging_voltage_v' },
  chargingCurrent: { domain: 'sensor', tk: 'charging_current_a' },
  remainingChargeMinutes: { domain: 'sensor', tk: 'remaining_charge_minutes' },
  chargingFinishTime: { domain: 'sensor', tk: 'charging_finish_time' },
  schedulePlanned: { domain: 'binary_sensor', tk: 'charging_planned_enabled' },
  unlockCharger: { domain: 'button', tk: 'unlock_charger' },

  // aberturas
  doorDriver: { domain: 'binary_sensor', tk: 'driver_door_open' },
  doorPassenger: { domain: 'binary_sensor', tk: 'passenger_door_open' },
  doorRearLeft: { domain: 'binary_sensor', tk: 'rear_left_door_open' },
  doorRearRight: { domain: 'binary_sensor', tk: 'rear_right_door_open' },
  windowFL: { domain: 'binary_sensor', tk: 'front_left_window_open' },
  windowFR: { domain: 'binary_sensor', tk: 'front_right_window_open' },
  windowRL: { domain: 'binary_sensor', tk: 'rear_left_window_open' },
  windowRR: { domain: 'binary_sensor', tk: 'rear_right_window_open' },
  windowPosFL: { domain: 'sensor', tk: 'front_left_window_position_percent' },
  windowPosFR: { domain: 'sensor', tk: 'front_right_window_position_percent' },
  windowPosRL: { domain: 'sensor', tk: 'rear_left_window_position_percent' },
  windowPosRR: { domain: 'sensor', tk: 'rear_right_window_position_percent' },
  trunk: { domain: 'binary_sensor', tk: 'trunk_open' },
  roof: { domain: 'binary_sensor', tk: 'skylight_open' },

  // clima
  climateSwitch: { domain: 'switch', tk: 'climate_control' },
  climateOn: { domain: 'binary_sensor', tk: 'climate_on' },
  interiorTemp: { domain: 'sensor', tk: 'interior_temp_c' },
  targetTemp: { domain: 'sensor', tk: 'climate_set_temp_left_c' },
  climateMode: { domain: 'sensor', tk: 'climate_mode' },

  // botões
  openTrunk: { domain: 'button', tk: 'open_trunk' },
  closeTrunk: { domain: 'button', tk: 'close_trunk' },
  openWindows: { domain: 'button', tk: 'open_windows' },
  closeWindows: { domain: 'button', tk: 'close_windows' },
  openSunshade: { domain: 'button', tk: 'open_sunshade' },
  closeSunshade: { domain: 'button', tk: 'close_sunshade' },
  quickCool: { domain: 'button', tk: 'quick_cool' },
  quickHeat: { domain: 'button', tk: 'quick_heat' },
  windshieldDefrost: { domain: 'button', tk: 'windshield_defrost' },
  findVehicle: { domain: 'button', tk: 'find_vehicle' },
  refreshData: { domain: 'button', tk: 'refresh_data' },

  // pneus
  tireFL: { domain: 'sensor', tk: 'tire_pressure_front_left_bar' },
  tireFR: { domain: 'sensor', tk: 'tire_pressure_front_right_bar' },
  tireRL: { domain: 'sensor', tk: 'tire_pressure_rear_left_bar' },
  tireRR: { domain: 'sensor', tk: 'tire_pressure_rear_right_bar' },

  // viagem
  odometer: { domain: 'sensor', tk: 'odometer_km' },
  totalMileage: { domain: 'sensor', tk: 'total_mileage_km' },
  last7DaysKm: { domain: 'sensor', tk: 'last_7_days_mileage_km' },
  last7DaysKwh: { domain: 'sensor', tk: 'last_7_days_energy_kwh' },
  avgConsumption6w: { domain: 'sensor', tk: 'average_consumption_6w_kwh_100km' },
  totalEnergy: { domain: 'sensor', tk: 'total_energy_kwh' },

  // conforto
  driverSeatHeat: { domain: 'number', tk: 'driver_seat_heating' },
  driverSeatVent: { domain: 'number', tk: 'driver_seat_ventilation' },
  passengerSeatHeat: { domain: 'number', tk: 'passenger_seat_heating' },
  passengerSeatVent: { domain: 'number', tk: 'passenger_seat_ventilation' },
  steeringWheelHeat: { domain: 'switch', tk: 'steering_wheel_heat' },
  steeringWheelHeatRemaining: { domain: 'sensor', tk: 'steering_wheel_heating_remaining_minutes' },
  mirrorHeat: { domain: 'switch', tk: 'rearview_mirror_heat' },
  batteryPreheat: { domain: 'switch', tk: 'battery_preheat' },

  // agendamento
  scheduleSwitch: { domain: 'switch', tk: 'charging_schedule' },
  scheduleStart: { domain: 'sensor', tk: 'charging_planned_start' },
  scheduleEnd: { domain: 'sensor', tk: 'charging_planned_end' },
  scheduleRecurrence: { domain: 'sensor', tk: 'charging_planned_circulation' },
  scheduleWeekly: { domain: 'binary_sensor', tk: 'charging_planned_weekly' },
  scheduleCancelledOnce: { domain: 'binary_sensor', tk: 'charging_schedule_cancelled_once' },
} as const

export type LogicalKey = keyof typeof ENTITY_KEYS

export const INTEGRATION_DOMAIN = 'leapmotor'
```

- [ ] **Step 5: Escrever `src/types.ts`**

```ts
import type { LogicalKey } from './keys'

export type EntityMap = Partial<Record<LogicalKey, string>>

export type SectionId = 'charging' | 'tiles' | 'tires' | 'trip' | 'comfort' | 'schedule'

export type ActionId =
  | 'unlock' | 'lock' | 'trunk' | 'windows'
  | 'openSunshade' | 'closeSunshade'
  | 'quickCool' | 'quickHeat' | 'defrost'
  | 'findVehicle' | 'unlockCharger' | 'refresh'
  | 'climate' | 'steeringWheelHeat' | 'mirrorHeat' | 'batteryPreheat'
  | 'setChargeLimit'

export interface LeapmotorCardConfig {
  type: string
  device?: string
  name?: string
  language?: string
  image?: 'auto' | 'entity' | 'none' | string
  actions?: ActionId[]
  confirm_actions?: ActionId[]
  sections?: Partial<Record<SectionId, boolean>>
  entities?: EntityMap
}

export type ChargingPhase = 'unplugged' | 'plugged' | 'charging' | 'complete' | 'scheduled'
export type Activity = 'parked' | 'driving' | 'ready' | 'unknown'

export interface VehicleState {
  online: boolean
  lastUpdate?: Date
  battery?: number
  range?: { km: number; unit: string; mode?: string }
  chargeLimit?: number
  charging: {
    phase: ChargingPhase
    speed?: 'slow' | 'fast'
    powerKw?: number
    voltageV?: number
    currentA?: number
    remainingMinutes?: number
    finishTime?: Date
  }
  lock: { locked?: boolean; stale: boolean; ageSeconds?: number; source?: string }
  activity: Activity
  openings: {
    doors: Record<'driver' | 'passenger' | 'rearLeft' | 'rearRight', boolean | undefined>
    windows: Record<'fl' | 'fr' | 'rl' | 'rr', { open?: boolean; position?: number }>
    trunk?: boolean
    roof?: boolean
    openCount: number
  }
  climate: { on?: boolean; interiorC?: number; targetC?: number; mode?: string }
  tires: Record<'fl' | 'fr' | 'rl' | 'rr', number | undefined>
  trip: { odometerKm?: number; last7DaysKm?: number; last7DaysKwh?: number; avgConsumption?: number; totalEnergyKwh?: number }
  comfort: {
    driverSeatHeat?: number; driverSeatVent?: number
    passengerSeatHeat?: number; passengerSeatVent?: number
    steeringWheelHeat?: boolean; steeringWheelHeatRemaining?: number
    mirrorHeat?: boolean; batteryPreheat?: boolean
  }
  schedule: { enabled?: boolean; start?: string; end?: string; recurrence?: string; weekly?: boolean; cancelledOnce?: boolean }
}

export const DEFAULT_ACTIONS: ActionId[] = ['unlock', 'lock', 'trunk', 'windows']
export const DEFAULT_CONFIRM_ACTIONS: ActionId[] = ['unlock']
export const DEFAULT_SECTIONS: Record<SectionId, boolean> = {
  charging: true, tiles: true, tires: false, trip: false, comfort: false, schedule: false,
}
```

- [ ] **Step 6: Correr os testes e o typecheck**

Run: `npx vitest run test/keys.test.ts && npm run typecheck`
Expected: 4 testes PASS; `tsc` sem erros.

- [ ] **Step 7: Commit**

```bash
git add src/ha-types.ts src/types.ts src/keys.ts test/keys.test.ts
git commit -m "feat: add hass types, card types and translation_key catalogue"
```

---

### Task 3: Camada 1 — resolver

**Files:**
- Create: `src/resolver.ts`, `test/helpers/fake-hass.ts`
- Test: `test/resolver.test.ts`

**Interfaces:**
- Consumes: `ENTITY_KEYS`, `LogicalKey`, `INTEGRATION_DOMAIN` (Task 2); `EntityMap`, `LeapmotorCardConfig` (Task 2); `HomeAssistant`, `HassEntityDisplayEntry`, `EntityRegistryEntry` (Task 2).
- Produces:
  - `resolveEntities(hass: HomeAssistant, config: LeapmotorCardConfig, extra?: HassEntityDisplayEntry[]): ResolveResult`
  - `loadRegistryFallback(hass: HomeAssistant): Promise<HassEntityDisplayEntry[]>`
  - `interface ResolveResult { deviceId?: string; deviceName?: string; map: EntityMap; missing: LogicalKey[]; error?: ResolveError; candidates: { id: string; name: string }[]; needsFallback: boolean }`
  - `type ResolveError = 'not_found' | 'ambiguous' | 'unknown_device'`

A assinatura mantém a camada 1 sincronizada e testável: `resolveEntities`
nunca faz I/O. Quando `hass.entities` não contém entradas `leapmotor`,
devolve `needsFallback: true` e é o elemento principal (Task 12) que
chama `loadRegistryFallback` uma vez e volta a resolver passando o
resultado em `extra`.

- [ ] **Step 1: Escrever o helper de testes**

`test/helpers/fake-hass.ts`:
```ts
import type { HassEntity, HassEntityDisplayEntry, HomeAssistant } from '../../src/ha-types'

export interface FakeEntitySpec {
  /** `dominio/translation_key`, ex. `sensor/battery_percent` */
  key: string
  entity_id: string
  device_id?: string
  state?: string
  unit?: string
  attributes?: Record<string, unknown>
}

export function fakeHass(
  specs: FakeEntitySpec[],
  devices: Record<string, { name?: string; name_by_user?: string }> = {},
  opts: { omitEntities?: boolean } = {},
): HomeAssistant {
  const entities: Record<string, HassEntityDisplayEntry> = {}
  const states: Record<string, HassEntity> = {}

  for (const spec of specs) {
    const [, tk] = spec.key.split('/')
    entities[spec.entity_id] = {
      entity_id: spec.entity_id,
      device_id: spec.device_id ?? 'dev1',
      platform: 'leapmotor',
      translation_key: tk,
    }
    states[spec.entity_id] = {
      entity_id: spec.entity_id,
      state: spec.state ?? 'off',
      attributes: { ...(spec.unit ? { unit_of_measurement: spec.unit } : {}), ...spec.attributes },
      last_changed: '2026-08-27T10:00:00+00:00',
      last_updated: '2026-08-27T10:00:00+00:00',
    }
  }

  return {
    states,
    entities: opts.omitEntities ? {} : entities,
    devices: Object.fromEntries(Object.entries(devices).map(([id, d]) => [id, { id, ...d }])),
    locale: { language: 'pt' },
    callService: async () => undefined,
    callWS: async () => [] as never,
  }
}

export function displayEntry(key: string, entity_id: string, device_id = 'dev1'): HassEntityDisplayEntry {
  const [, tk] = key.split('/')
  return { entity_id, device_id, platform: 'leapmotor', translation_key: tk }
}
```

- [ ] **Step 2: Escrever os testes do resolver**

`test/resolver.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest'
import { loadRegistryFallback, resolveEntities } from '../src/resolver'
import { displayEntry, fakeHass } from './helpers/fake-hass'

const CONFIG = { type: 'custom:leapmotor-card' }

const BASE = [
  { key: 'sensor/battery_percent', entity_id: 'sensor.b10_battery', state: '60', unit: '%' },
  { key: 'sensor/remaining_range_km', entity_id: 'sensor.b10_range', state: '217', unit: 'km' },
  { key: 'sensor/live_remaining_range_km', entity_id: 'sensor.b10_main_live_range', state: '261', unit: 'km' },
  { key: 'lock/vehicle_lock', entity_id: 'lock.b10_lock', state: 'locked' },
]

describe('resolveEntities', () => {
  it('descobre o único device Leapmotor quando config.device é omitido', () => {
    const hass = fakeHass(BASE, { dev1: { name_by_user: 'B10 Demo' } })
    const r = resolveEntities(hass, CONFIG)
    expect(r.error).toBeUndefined()
    expect(r.deviceId).toBe('dev1')
    expect(r.deviceName).toBe('B10 Demo')
    expect(r.map.battery).toBe('sensor.b10_battery')
  })

  it('resolve entidades com prefixo de entity_id diferente do device', () => {
    // `..._main_live_range` não partilha o prefixo das restantes; o mapeamento
    // é por translation_key, logo tem de ser encontrado.
    const hass = fakeHass(BASE, { dev1: {} })
    expect(resolveEntities(hass, CONFIG).map.rangeLive).toBe('sensor.b10_main_live_range')
  })

  it('devolve erro ambiguous quando há dois carros e nenhum device na config', () => {
    const hass = fakeHass(
      [...BASE, { key: 'sensor/battery_percent', entity_id: 'sensor.t03_battery', device_id: 'dev2', state: '40', unit: '%' }],
      { dev1: { name_by_user: 'B10 Demo' }, dev2: { name: 'T03' } },
    )
    const r = resolveEntities(hass, CONFIG)
    expect(r.error).toBe('ambiguous')
    expect(r.candidates.map(c => c.name).sort()).toEqual(['B10 Demo', 'T03'])
  })

  it('aceita um device_id explícito', () => {
    const hass = fakeHass(BASE, { dev1: {} })
    expect(resolveEntities(hass, { ...CONFIG, device: 'dev1' }).deviceId).toBe('dev1')
  })

  it('aceita um entity_id como device', () => {
    const hass = fakeHass(BASE, { dev1: {} })
    expect(resolveEntities(hass, { ...CONFIG, device: 'lock.b10_lock' }).deviceId).toBe('dev1')
  })

  it('devolve unknown_device para um device que não existe', () => {
    const hass = fakeHass(BASE, { dev1: {} })
    expect(resolveEntities(hass, { ...CONFIG, device: 'dev9' }).error).toBe('unknown_device')
  })

  it('devolve not_found depois de o fallback também não trazer nada', () => {
    // Com `extra` fornecido (mesmo vazio), o fallback já correu: o estado
    // terminal é not_found, não needsFallback.
    const hass = fakeHass([], {})
    expect(resolveEntities(hass, CONFIG, []).error).toBe('not_found')
  })

  it('deixa os overrides da config ganharem sobre a descoberta', () => {
    const hass = fakeHass(BASE, { dev1: {} })
    const r = resolveEntities(hass, { ...CONFIG, entities: { range: 'sensor.b10_main_live_range' } })
    expect(r.map.range).toBe('sensor.b10_main_live_range')
  })

  it('lista as chaves não resolvidas em missing', () => {
    const hass = fakeHass(BASE, { dev1: {} })
    const r = resolveEntities(hass, CONFIG)
    expect(r.missing).toContain('interiorTemp')
    expect(r.missing).not.toContain('battery')
  })

  it('sinaliza needsFallback quando hass.entities está vazio e resolve com extra', () => {
    const hass = fakeHass(BASE, { dev1: {} }, { omitEntities: true })
    expect(resolveEntities(hass, CONFIG).needsFallback).toBe(true)

    const extra = BASE.map(s => displayEntry(s.key, s.entity_id))
    const r = resolveEntities(hass, CONFIG, extra)
    expect(r.needsFallback).toBe(false)
    expect(r.map.battery).toBe('sensor.b10_battery')
  })

  it('prefere name_by_user ao name do device', () => {
    const hass = fakeHass(BASE, { dev1: { name: 'Leapmotor B10 2025', name_by_user: 'B10 Demo' } })
    expect(resolveEntities(hass, CONFIG).deviceName).toBe('B10 Demo')
  })
})

describe('loadRegistryFallback', () => {
  it('pede config/entity_registry/list e filtra pela integração', async () => {
    const callWS = vi.fn().mockResolvedValue([
      { entity_id: 'sensor.b10_battery', device_id: 'dev1', platform: 'leapmotor', translation_key: 'battery_percent' },
      { entity_id: 'sensor.other', device_id: 'dev5', platform: 'mqtt', translation_key: null },
    ])
    const hass = { ...fakeHass([], {}), callWS } as never
    const out = await loadRegistryFallback(hass)
    expect(callWS).toHaveBeenCalledWith({ type: 'config/entity_registry/list' })
    expect(out).toHaveLength(1)
    expect(out[0].translation_key).toBe('battery_percent')
  })
})
```

- [ ] **Step 3: Correr os testes para confirmar que falham**

Run: `npx vitest run test/resolver.test.ts`
Expected: FAIL — `Cannot find module '../src/resolver'`.

- [ ] **Step 4: Escrever `src/resolver.ts`**

```ts
import type { EntityRegistryEntry, HassEntityDisplayEntry, HomeAssistant } from './ha-types'
import { ENTITY_KEYS, INTEGRATION_DOMAIN, type LogicalKey } from './keys'
import type { EntityMap, LeapmotorCardConfig } from './types'

export type ResolveError = 'not_found' | 'ambiguous' | 'unknown_device'

export interface ResolveResult {
  deviceId?: string
  deviceName?: string
  map: EntityMap
  missing: LogicalKey[]
  error?: ResolveError
  candidates: { id: string; name: string }[]
  needsFallback: boolean
}

const DEVICE_ID_RE = /^[0-9a-f]{32}$/i

function domainOf(entityId: string): string {
  return entityId.split('.')[0] ?? ''
}

export async function loadRegistryFallback(hass: HomeAssistant): Promise<HassEntityDisplayEntry[]> {
  const all = await hass.callWS<EntityRegistryEntry[]>({ type: 'config/entity_registry/list' })
  return all
    .filter(e => e.platform === INTEGRATION_DOMAIN)
    .map(e => ({
      entity_id: e.entity_id,
      device_id: e.device_id,
      platform: e.platform,
      translation_key: e.translation_key ?? undefined,
    }))
}

export function resolveEntities(
  hass: HomeAssistant,
  config: LeapmotorCardConfig,
  extra?: HassEntityDisplayEntry[],
): ResolveResult {
  const fromHass = Object.values(hass.entities ?? {}).filter(e => e.platform === INTEGRATION_DOMAIN)
  const entries = fromHass.length > 0 ? fromHass : (extra ?? [])
  const needsFallback = fromHass.length === 0 && !extra

  const deviceIds = [...new Set(entries.map(e => e.device_id).filter((d): d is string => !!d))]
  const candidates = deviceIds.map(id => ({
    id,
    name: hass.devices?.[id]?.name_by_user || hass.devices?.[id]?.name || id,
  }))

  const empty = (error?: ResolveError): ResolveResult =>
    ({ map: {}, missing: Object.keys(ENTITY_KEYS) as LogicalKey[], error, candidates, needsFallback })

  if (entries.length === 0) return empty(needsFallback ? undefined : 'not_found')

  let deviceId: string | undefined
  const wanted = config.device
  if (wanted) {
    if (wanted.includes('.')) {
      deviceId = entries.find(e => e.entity_id === wanted)?.device_id ?? undefined
    } else if (DEVICE_ID_RE.test(wanted) || deviceIds.includes(wanted)) {
      deviceId = deviceIds.includes(wanted) ? wanted : undefined
    }
    if (!deviceId) return empty('unknown_device')
  } else if (deviceIds.length === 1) {
    deviceId = deviceIds[0]
  } else if (deviceIds.length === 0) {
    return empty('not_found')
  } else {
    return empty('ambiguous')
  }

  const byKey = new Map<string, string>()
  for (const e of entries) {
    if (e.device_id !== deviceId || !e.translation_key) continue
    byKey.set(`${domainOf(e.entity_id)}/${e.translation_key}`, e.entity_id)
  }

  const map: EntityMap = {}
  const missing: LogicalKey[] = []
  for (const [key, def] of Object.entries(ENTITY_KEYS) as [LogicalKey, { domain: string; tk: string }][]) {
    const found = byKey.get(`${def.domain}/${def.tk}`)
    if (found) map[key] = found
    else missing.push(key)
  }

  for (const [key, entityId] of Object.entries(config.entities ?? {}) as [LogicalKey, string][]) {
    if (!entityId) continue
    map[key] = entityId
    const i = missing.indexOf(key)
    if (i >= 0) missing.splice(i, 1)
  }

  const device = hass.devices?.[deviceId]
  return {
    deviceId,
    deviceName: device?.name_by_user || device?.name || undefined,
    map,
    missing,
    candidates,
    needsFallback: false,
  }
}
```

- [ ] **Step 5: Correr os testes e o typecheck**

Run: `npx vitest run test/resolver.test.ts && npm run typecheck`
Expected: 12 testes PASS; `tsc` sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/resolver.ts test/resolver.test.ts test/helpers/fake-hass.ts
git commit -m "feat: resolve leapmotor entities by device and translation_key"
```

---

### Task 4: Fixtures reais e camada 2 — identidade, autonomia, bateria, trancas, atividade

**Files:**
- Create: `test/fixtures/real-states.ts`, `src/vehicle-state.ts`
- Test: `test/vehicle-state.test.ts`

**Interfaces:**
- Consumes: `resolveEntities` (Task 3), `EntityMap`, `VehicleState` (Task 2).
- Produces:
  - `buildVehicleState(hass: HomeAssistant, map: EntityMap, now: Date): VehicleState`
  - `test/fixtures/real-states.ts`: `REAL_SPECS: FakeEntitySpec[]`, `realHass(overrides?: Record<string, string>): HomeAssistant`, `REAL_NOW: Date`

O `now` é sempre injetado. Nenhuma função em `vehicle-state.ts` chama
`Date.now()` nem `new Date()` sem argumento.

- [ ] **Step 1: Escrever a fixture com os estados reais**

`test/fixtures/real-states.ts`. Valores lidos do Home Assistant do
utilizador a 2026-08-27; não os alterar sem voltar a ler o sistema.

```ts
import { fakeHass, type FakeEntitySpec } from '../helpers/fake-hass'

/** Instante de referência das fixtures: 2026-08-27 13:36 UTC. */
export const REAL_NOW = new Date('2026-08-27T13:36:00+00:00')

const P = 'leapmotor_b10_000000_demo'
const M = 'leapmotor_b10_000000_main'

export const REAL_SPECS: FakeEntitySpec[] = [
  { key: 'sensor/battery_percent', entity_id: `sensor.${P}_battery`, state: '60', unit: '%' },
  { key: 'sensor/battery_percent_precise', entity_id: `sensor.${P}_precise_battery`, state: '60.3', unit: '%' },
  { key: 'sensor/remaining_range_km', entity_id: `sensor.${P}_range`, state: '217', unit: 'km' },
  { key: 'sensor/live_remaining_range_km', entity_id: `sensor.${M}_live_range`, state: '261', unit: 'km' },
  { key: 'sensor/wltp_max_range_km', entity_id: `sensor.${M}_cltc_remaining_range`, state: '261', unit: 'km' },
  { key: 'sensor/range_mode', entity_id: `sensor.${P}_range_mode`, state: 'CLTC' },
  { key: 'sensor/last_vehicle_update', entity_id: `sensor.${P}_last_vehicle_update`, state: '2026-08-27T10:16:33+00:00' },
  { key: 'sensor/last_successful_refresh', entity_id: `sensor.${P}_last_cloud_refresh`, state: '2026-08-27T13:35:24+00:00' },
  { key: 'image/vehicle_picture', entity_id: `image.${P}_vehicle_picture`, state: '2026-08-22T19:14:33.693886+00:00', attributes: { entity_picture: '/api/image_proxy/image.vehicle_picture' } },

  { key: 'lock/vehicle_lock', entity_id: `lock.${P}_lock`, state: 'locked' },
  { key: 'sensor/lock_state_source', entity_id: `sensor.${P}_lock_state_source`, state: 'cloud_stale' },
  { key: 'sensor/lock_state_age_seconds', entity_id: `sensor.${P}_lock_state_age`, state: '11930', unit: 's' },

  { key: 'sensor/vehicle_state', entity_id: `sensor.${P}_vehicle_state`, state: 'unknown' },
  { key: 'sensor/gear', entity_id: `sensor.${P}_gear`, state: 'P' },
  { key: 'sensor/speed_kmh', entity_id: `sensor.${P}_speed`, state: '0.0', unit: 'km/h' },
  { key: 'binary_sensor/is_driving', entity_id: `binary_sensor.${P}_driving`, state: 'off' },
  { key: 'binary_sensor/parking_brake_active', entity_id: `binary_sensor.${P}_parking_brake_active`, state: 'on' },
  { key: 'binary_sensor/vehicle_ready', entity_id: `binary_sensor.${P}_vehicle_ready`, state: 'off' },

  { key: 'sensor/charge_limit_percent', entity_id: `sensor.${P}_charge_limit`, state: '80', unit: '%' },
  { key: 'number/charge_limit_setting', entity_id: `number.${P}_set_charge_limit`, state: '80', attributes: { min: 50, max: 100, step: 5 } },
  { key: 'binary_sensor/is_charging', entity_id: `binary_sensor.${P}_charging`, state: 'off' },
  { key: 'binary_sensor/is_plugged_in', entity_id: `binary_sensor.${P}_charge_cable_plugged_in`, state: 'off' },
  { key: 'binary_sensor/dc_cable_connected', entity_id: `binary_sensor.${P}_dc_charge_cable_plugged_in`, state: 'off' },
  { key: 'binary_sensor/fully_charged', entity_id: `binary_sensor.${P}_fully_charged`, state: 'off' },
  { key: 'sensor/charging_connection_state', entity_id: `sensor.${P}_charging_connection`, state: 'unplugged' },
  { key: 'sensor/charging_power_kw', entity_id: `sensor.${P}_charging_power`, state: '0.0', unit: 'kW' },
  { key: 'sensor/charging_voltage_v', entity_id: `sensor.${P}_charging_voltage`, state: '426.6', unit: 'V' },
  { key: 'sensor/charging_current_a', entity_id: `sensor.${P}_battery_current`, state: '0.1', unit: 'A' },
  { key: 'sensor/remaining_charge_minutes', entity_id: `sensor.${P}_remaining_charge_time`, state: 'unavailable', unit: 'min' },
  { key: 'sensor/charging_finish_time', entity_id: `sensor.${P}_estimated_charging_finish_time`, state: 'unavailable' },
  { key: 'binary_sensor/charging_planned_enabled', entity_id: `binary_sensor.${P}_scheduled_charging`, state: 'off' },
  { key: 'button/unlock_charger', entity_id: `button.${P}_unlock_charger`, state: 'unknown' },

  { key: 'binary_sensor/driver_door_open', entity_id: `binary_sensor.${P}_driver_door`, state: 'off' },
  { key: 'binary_sensor/passenger_door_open', entity_id: `binary_sensor.${P}_passenger_door`, state: 'off' },
  { key: 'binary_sensor/rear_left_door_open', entity_id: `binary_sensor.${P}_rear_left_door`, state: 'off' },
  { key: 'binary_sensor/rear_right_door_open', entity_id: `binary_sensor.${P}_rear_right_door`, state: 'off' },
  { key: 'binary_sensor/front_left_window_open', entity_id: `binary_sensor.${P}_front_left_window`, state: 'off' },
  { key: 'binary_sensor/front_right_window_open', entity_id: `binary_sensor.${P}_front_right_window`, state: 'off' },
  { key: 'binary_sensor/rear_left_window_open', entity_id: `binary_sensor.${P}_rear_left_window`, state: 'off' },
  { key: 'binary_sensor/rear_right_window_open', entity_id: `binary_sensor.${P}_rear_right_window`, state: 'off' },
  { key: 'sensor/front_left_window_position_percent', entity_id: `sensor.${P}_front_left_window_position`, state: '0', unit: '%' },
  { key: 'sensor/front_right_window_position_percent', entity_id: `sensor.${P}_front_right_window_position`, state: '0', unit: '%' },
  { key: 'sensor/rear_left_window_position_percent', entity_id: `sensor.${P}_rear_left_window_position`, state: '0', unit: '%' },
  { key: 'sensor/rear_right_window_position_percent', entity_id: `sensor.${P}_rear_right_window_position`, state: '0', unit: '%' },
  { key: 'binary_sensor/trunk_open', entity_id: `binary_sensor.${P}_trunk`, state: 'off' },
  { key: 'binary_sensor/skylight_open', entity_id: `binary_sensor.${P}_panoramic_roof_open`, state: 'off' },

  { key: 'switch/climate_control', entity_id: `switch.${P}_climate`, state: 'off' },
  { key: 'binary_sensor/climate_on', entity_id: `binary_sensor.${P}_climate_control`, state: 'off' },
  { key: 'sensor/interior_temp_c', entity_id: `sensor.${P}_interior_temperature`, state: '24.0', unit: '°C' },
  { key: 'sensor/climate_set_temp_left_c', entity_id: `sensor.${P}_target_temperature_left`, state: '24.0', unit: '°C' },
  { key: 'sensor/climate_mode', entity_id: `sensor.${P}_climate_mode`, state: 'off' },

  { key: 'button/open_trunk', entity_id: `button.${P}_open_trunk`, state: '2026-08-20T15:10:21.352007+00:00' },
  { key: 'button/close_trunk', entity_id: `button.${P}_close_trunk`, state: '2026-08-20T15:10:36.879985+00:00' },
  { key: 'button/open_windows', entity_id: `button.${P}_open_windows`, state: '2026-08-20T15:09:33.389385+00:00' },
  { key: 'button/close_windows', entity_id: `button.${P}_close_windows`, state: '2026-08-20T15:10:52.583774+00:00' },
  { key: 'button/open_sunshade', entity_id: `button.${P}_open_sunshade`, state: 'unknown' },
  { key: 'button/close_sunshade', entity_id: `button.${P}_close_sunshade`, state: 'unknown' },
  { key: 'button/quick_cool', entity_id: `button.${P}_quick_cool`, state: 'unknown' },
  { key: 'button/quick_heat', entity_id: `button.${P}_quick_heat`, state: 'unknown' },
  { key: 'button/windshield_defrost', entity_id: `button.${P}_windshield_defrost`, state: 'unknown' },
  { key: 'button/find_vehicle', entity_id: `button.${P}_find_vehicle`, state: '2026-08-20T16:15:33.432408+00:00' },
  { key: 'button/refresh_data', entity_id: `button.${P}_refresh_data`, state: 'unknown' },

  { key: 'sensor/tire_pressure_front_left_bar', entity_id: `sensor.${P}_front_left_tire_pressure`, state: '2.11', unit: 'bar' },
  { key: 'sensor/tire_pressure_front_right_bar', entity_id: `sensor.${P}_front_right_tire_pressure`, state: '2.17', unit: 'bar' },
  { key: 'sensor/tire_pressure_rear_left_bar', entity_id: `sensor.${P}_rear_left_tire_pressure`, state: '2.17', unit: 'bar' },
  { key: 'sensor/tire_pressure_rear_right_bar', entity_id: `sensor.${P}_rear_right_tire_pressure`, state: '2.17', unit: 'bar' },

  { key: 'sensor/odometer_km', entity_id: `sensor.${P}_odometer`, state: '659', unit: 'km' },
  { key: 'sensor/total_mileage_km', entity_id: `sensor.${P}_total_mileage`, state: '659', unit: 'km' },
  { key: 'sensor/last_7_days_mileage_km', entity_id: `sensor.${P}_last_7_days_mileage`, state: '642', unit: 'km' },
  { key: 'sensor/last_7_days_energy_kwh', entity_id: `sensor.${P}_last_7_days_energy_consumption`, state: '118.0', unit: 'kWh' },
  { key: 'sensor/average_consumption_6w_kwh_100km', entity_id: `sensor.${P}_6_week_average_consumption_kwh_100_km`, state: '20.6', unit: 'kWh/100 km' },
  { key: 'sensor/total_energy_kwh', entity_id: `sensor.${P}_total_energy_consumption`, state: '131.0', unit: 'kWh' },

  { key: 'number/driver_seat_heating', entity_id: `number.${P}_driver_seat_heating`, state: '0', attributes: { min: 0, max: 3, step: 1 } },
  { key: 'number/driver_seat_ventilation', entity_id: `number.${P}_driver_seat_ventilation`, state: '0', attributes: { min: 0, max: 3, step: 1 } },
  { key: 'number/passenger_seat_heating', entity_id: `number.${P}_passenger_seat_heating`, state: '0', attributes: { min: 0, max: 3, step: 1 } },
  { key: 'number/passenger_seat_ventilation', entity_id: `number.${P}_passenger_seat_ventilation`, state: '0', attributes: { min: 0, max: 3, step: 1 } },
  { key: 'switch/steering_wheel_heat', entity_id: `switch.${P}_steering_wheel_heating`, state: 'off' },
  { key: 'sensor/steering_wheel_heating_remaining_minutes', entity_id: `sensor.${P}_steering_wheel_heating_remaining_time`, state: '15', unit: 'min' },
  { key: 'switch/rearview_mirror_heat', entity_id: `switch.${P}_mirror_heating`, state: 'off' },
  { key: 'switch/battery_preheat', entity_id: `switch.${P}_battery_preheat`, state: 'off' },

  { key: 'switch/charging_schedule', entity_id: `switch.${P}_charging_schedule`, state: 'off' },
  { key: 'sensor/charging_planned_start', entity_id: `sensor.${P}_charging_schedule_start`, state: '22:00' },
  { key: 'sensor/charging_planned_end', entity_id: `sensor.${P}_charging_schedule_end`, state: '08:00' },
  { key: 'sensor/charging_planned_circulation', entity_id: `sensor.${P}_charging_schedule_recurrence`, state: '1' },
  { key: 'binary_sensor/charging_planned_weekly', entity_id: `binary_sensor.${P}_weekly_charging_schedule`, state: 'on' },
  { key: 'binary_sensor/charging_schedule_cancelled_once', entity_id: `binary_sensor.${P}_charging_schedule_cancelled_once`, state: 'on' },
]

/**
 * `overrides` é indexado por `dominio/translation_key`, para os testes
 * mudarem um estado sem repetir a fixture inteira.
 */
export function realHass(overrides: Record<string, string> = {}) {
  const specs = REAL_SPECS.map(s => (overrides[s.key] !== undefined ? { ...s, state: overrides[s.key] } : s))
  return fakeHass(specs, { dev1: { name: 'Leapmotor B10 2025 Demo (Shared)', name_by_user: 'Leapmotor B10 000000 (Demo)' } })
}
```

- [ ] **Step 2: Escrever os testes de identidade, autonomia, bateria, trancas e atividade**

`test/vehicle-state.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { resolveEntities } from '../src/resolver'
import { buildVehicleState } from '../src/vehicle-state'
import { REAL_NOW, realHass } from './fixtures/real-states'

const CONFIG = { type: 'custom:leapmotor-card' }

function build(overrides: Record<string, string> = {}, now = REAL_NOW) {
  const hass = realHass(overrides)
  const { map } = resolveEntities(hass, CONFIG)
  return buildVehicleState(hass, map, now)
}

describe('buildVehicleState — bateria e autonomia', () => {
  it('prefere a bateria precisa', () => {
    expect(build().battery).toBe(60.3)
  })

  it('cai para a bateria inteira quando a precisa falta', () => {
    expect(build({ 'sensor/battery_percent_precise': 'unavailable' }).battery).toBe(60)
  })

  it('usa live_range, que é o número que a app mostra, e não remaining_range', () => {
    // App: 126 km a 29 % → razão ~434. live=261 a 60 % → 435. range=217 → 361.
    expect(build().range).toEqual({ km: 261, unit: 'km', mode: 'CLTC' })
  })

  it('cai para remaining_range e depois para wltp_max', () => {
    expect(build({ 'sensor/live_remaining_range_km': 'unavailable' }).range?.km).toBe(217)
    expect(build({ 'sensor/live_remaining_range_km': 'unavailable', 'sensor/remaining_range_km': 'unknown' }).range?.km).toBe(261)
  })

  it('deixa range undefined quando nenhum sensor de autonomia é válido', () => {
    expect(build({
      'sensor/live_remaining_range_km': 'unavailable',
      'sensor/remaining_range_km': 'unavailable',
      'sensor/wltp_max_range_km': 'unavailable',
    }).range).toBeUndefined()
  })

  it('lê o limite de carga', () => {
    expect(build().chargeLimit).toBe(80)
  })
})

describe('buildVehicleState — última atualização', () => {
  it('usa last_vehicle_update', () => {
    expect(build().lastUpdate?.toISOString()).toBe('2026-08-27T10:16:33.000Z')
  })

  it('cai para last_cloud_refresh', () => {
    expect(build({ 'sensor/last_vehicle_update': 'unavailable' }).lastUpdate?.toISOString())
      .toBe('2026-08-27T13:35:24.000Z')
  })
})

describe('buildVehicleState — trancas', () => {
  it('lê o estado trancado', () => {
    expect(build().lock.locked).toBe(true)
  })

  it('marca stale por causa do lock_state_source cloud_stale', () => {
    const s = build()
    expect(s.lock.stale).toBe(true)
    expect(s.lock.source).toBe('cloud_stale')
    expect(s.lock.ageSeconds).toBe(11930)
  })

  it('marca stale por idade acima de 900 s mesmo com fonte fresca', () => {
    expect(build({ 'sensor/lock_state_source': 'cloud', 'sensor/lock_state_age_seconds': '901' }).lock.stale).toBe(true)
  })

  it('não marca stale com fonte fresca e idade baixa', () => {
    expect(build({ 'sensor/lock_state_source': 'cloud', 'sensor/lock_state_age_seconds': '60' }).lock.stale).toBe(false)
  })

  it('deixa locked undefined quando a entidade está indisponível', () => {
    expect(build({ 'lock/vehicle_lock': 'unavailable' }).lock.locked).toBeUndefined()
  })
})

describe('buildVehicleState — atividade', () => {
  it('deriva parked apesar de vehicle_state estar unknown', () => {
    expect(build().activity).toBe('parked')
  })

  it('respeita vehicle_state quando tem um valor conhecido', () => {
    expect(build({ 'sensor/vehicle_state': 'driving' }).activity).toBe('driving')
  })

  it('deriva driving de is_driving', () => {
    expect(build({ 'binary_sensor/is_driving': 'on' }).activity).toBe('driving')
  })

  it('deriva driving de velocidade positiva', () => {
    expect(build({ 'sensor/speed_kmh': '43.5', 'sensor/gear': 'D' }).activity).toBe('driving')
  })

  it('deriva ready de vehicle_ready', () => {
    expect(build({ 'binary_sensor/vehicle_ready': 'on', 'sensor/gear': 'N', 'binary_sensor/parking_brake_active': 'off' }).activity).toBe('ready')
  })

  it('devolve unknown quando nada permite decidir', () => {
    expect(build({
      'sensor/gear': 'unavailable',
      'sensor/speed_kmh': 'unavailable',
      'binary_sensor/is_driving': 'unavailable',
      'binary_sensor/parking_brake_active': 'unavailable',
      'binary_sensor/vehicle_ready': 'unavailable',
    }).activity).toBe('unknown')
  })
})

describe('buildVehicleState — online', () => {
  it('está online com estados válidos', () => {
    expect(build().online).toBe(true)
  })

  it('está offline quando bateria, autonomia e tranca estão indisponíveis', () => {
    expect(build({
      'sensor/battery_percent': 'unavailable',
      'sensor/battery_percent_precise': 'unavailable',
      'sensor/live_remaining_range_km': 'unavailable',
      'sensor/remaining_range_km': 'unavailable',
      'sensor/wltp_max_range_km': 'unavailable',
      'lock/vehicle_lock': 'unavailable',
    }).online).toBe(false)
  })
})
```

- [ ] **Step 3: Correr os testes para confirmar que falham**

Run: `npx vitest run test/vehicle-state.test.ts`
Expected: FAIL — `Cannot find module '../src/vehicle-state'`.

- [ ] **Step 4: Escrever `src/vehicle-state.ts` com os helpers e estas secções**

Nesta task o objeto devolvido já tem a forma completa de `VehicleState`,
mas `charging`, `openings`, `climate`, `tires`, `trip`, `comfort` e
`schedule` ficam com valores neutros; são preenchidos nas Tasks 5 e 6.

```ts
import type { HassEntity, HomeAssistant } from './ha-types'
import type { LogicalKey } from './keys'
import type { Activity, EntityMap, VehicleState } from './types'

const INVALID = new Set(['unknown', 'unavailable', 'none', ''])
const STALE_AFTER_SECONDS = 900

function entity(hass: HomeAssistant, map: EntityMap, key: LogicalKey): HassEntity | undefined {
  const id = map[key]
  if (!id) return undefined
  const st = hass.states[id]
  if (!st || INVALID.has(st.state)) return undefined
  return st
}

export function str(hass: HomeAssistant, map: EntityMap, key: LogicalKey): string | undefined {
  return entity(hass, map, key)?.state
}

export function num(hass: HomeAssistant, map: EntityMap, key: LogicalKey): number | undefined {
  const raw = str(hass, map, key)
  if (raw === undefined) return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

export function bool(hass: HomeAssistant, map: EntityMap, key: LogicalKey): boolean | undefined {
  const raw = str(hass, map, key)
  if (raw === undefined) return undefined
  if (raw === 'on' || raw === 'locked' || raw === 'true') return true
  if (raw === 'off' || raw === 'unlocked' || raw === 'false') return false
  return undefined
}

export function unit(hass: HomeAssistant, map: EntityMap, key: LogicalKey): string | undefined {
  return entity(hass, map, key)?.attributes.unit_of_measurement
}

export function date(hass: HomeAssistant, map: EntityMap, key: LogicalKey): Date | undefined {
  const raw = str(hass, map, key)
  if (raw === undefined) return undefined
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? undefined : d
}

export function attr<T>(hass: HomeAssistant, map: EntityMap, key: LogicalKey, name: string): T | undefined {
  const id = map[key]
  const st = id ? hass.states[id] : undefined
  return st?.attributes[name] as T | undefined
}

function firstNum(hass: HomeAssistant, map: EntityMap, keys: LogicalKey[]): { key: LogicalKey; value: number } | undefined {
  for (const key of keys) {
    const value = num(hass, map, key)
    if (value !== undefined) return { key, value }
  }
  return undefined
}

const KNOWN_ACTIVITIES: Activity[] = ['parked', 'driving', 'ready']

function buildActivity(hass: HomeAssistant, map: EntityMap): Activity {
  const declared = str(hass, map, 'vehicleState')?.toLowerCase()
  if (declared && (KNOWN_ACTIVITIES as string[]).includes(declared)) return declared as Activity

  if (bool(hass, map, 'isDriving') === true) return 'driving'
  const speed = num(hass, map, 'speed')
  if (speed !== undefined && speed > 0) return 'driving'
  if (bool(hass, map, 'vehicleReady') === true) return 'ready'
  if (str(hass, map, 'gear') === 'P') return 'parked'
  if (bool(hass, map, 'parkingBrake') === true) return 'parked'
  return 'unknown'
}

export function buildVehicleState(hass: HomeAssistant, map: EntityMap, _now: Date): VehicleState {
  const battery = num(hass, map, 'batteryPrecise') ?? num(hass, map, 'battery')

  const rangePick = firstNum(hass, map, ['rangeLive', 'range', 'rangeMax'])
  const range = rangePick
    ? { km: rangePick.value, unit: unit(hass, map, rangePick.key) ?? 'km', mode: str(hass, map, 'rangeMode') }
    : undefined

  const locked = bool(hass, map, 'lock')
  const ageSeconds = num(hass, map, 'lockStateAge')
  const source = str(hass, map, 'lockStateSource')
  const stale = (source?.includes('stale') ?? false) || (ageSeconds !== undefined && ageSeconds > STALE_AFTER_SECONDS)

  return {
    online: battery !== undefined || range !== undefined || locked !== undefined,
    lastUpdate: date(hass, map, 'lastVehicleUpdate') ?? date(hass, map, 'lastCloudRefresh'),
    battery,
    range,
    chargeLimit: num(hass, map, 'chargeLimit') ?? num(hass, map, 'chargeLimitSet'),
    charging: { phase: 'unplugged' },
    lock: { locked, stale, ageSeconds, source },
    activity: buildActivity(hass, map),
    openings: {
      doors: { driver: undefined, passenger: undefined, rearLeft: undefined, rearRight: undefined },
      windows: { fl: {}, fr: {}, rl: {}, rr: {} },
      openCount: 0,
    },
    climate: {},
    tires: { fl: undefined, fr: undefined, rl: undefined, rr: undefined },
    trip: {},
    comfort: {},
    schedule: {},
  }
}
```

O terceiro parâmetro chama-se `_now` **nesta task**: ainda não é lido, e o
`tsconfig` tem `noUnusedParameters: true`, pelo que `now` faria o
`npm run typecheck` falhar com TS6133. A Task 5 renomeia-o para `now` ao
passar a usá-lo. Os chamadores passam o argumento por posição, logo o
nome não os afeta.

- [ ] **Step 5: Correr os testes e o typecheck**

Run: `npx vitest run test/vehicle-state.test.ts && npm run typecheck`
Expected: 21 testes PASS; `tsc` sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/vehicle-state.ts test/vehicle-state.test.ts test/fixtures/real-states.ts
git commit -m "feat: derive battery, range, lock staleness and activity from vehicle state"
```

---

### Task 5: Camada 2 — carregamento

**Files:**
- Modify: `src/vehicle-state.ts` (função `buildCharging`, substituir `charging: { phase: 'unplugged' }`)
- Test: `test/vehicle-state.test.ts` (acrescentar blocos)

**Interfaces:**
- Consumes: helpers `str`/`num`/`bool`/`date` e `buildVehicleState` (Task 4).
- Produces: `VehicleState['charging']` completamente preenchido, incluindo `finishTime` derivado de `now` quando o sensor de hora de fim não está disponível.

- [ ] **Step 1: Acrescentar os testes de carregamento**

Acrescentar a `test/vehicle-state.test.ts`:
```ts
describe('buildVehicleState — fase de carregamento', () => {
  it('unplugged com os estados reais', () => {
    expect(build().charging.phase).toBe('unplugged')
  })

  it('charging quando is_charging está on', () => {
    expect(build({ 'binary_sensor/is_charging': 'on', 'binary_sensor/is_plugged_in': 'on' }).charging.phase).toBe('charging')
  })

  it('complete tem prioridade sobre charging', () => {
    expect(build({ 'binary_sensor/fully_charged': 'on', 'binary_sensor/is_charging': 'on' }).charging.phase).toBe('complete')
  })

  it('plugged com cabo AC ligado mas sem carregar', () => {
    expect(build({ 'binary_sensor/is_plugged_in': 'on', 'sensor/charging_connection_state': 'plugged' }).charging.phase).toBe('plugged')
  })

  it('plugged com cabo DC ligado', () => {
    expect(build({ 'binary_sensor/dc_cable_connected': 'on' }).charging.phase).toBe('plugged')
  })

  it('plugged quando só o sensor de conexão indica cabo', () => {
    expect(build({ 'sensor/charging_connection_state': 'plugged' }).charging.phase).toBe('plugged')
  })

  it('não infere plugged de um sensor de conexão inválido', () => {
    expect(build({ 'sensor/charging_connection_state': 'unknown' }).charging.phase).toBe('unplugged')
    expect(build({ 'sensor/charging_connection_state': 'unavailable' }).charging.phase).toBe('unplugged')
  })

  it('scheduled quando há agendamento activo e nenhum cabo', () => {
    expect(build({ 'binary_sensor/charging_planned_enabled': 'on' }).charging.phase).toBe('scheduled')
    expect(build({ 'switch/charging_schedule': 'on' }).charging.phase).toBe('scheduled')
  })

  it('o cabo ganha ao agendamento', () => {
    expect(build({ 'binary_sensor/charging_planned_enabled': 'on', 'binary_sensor/is_plugged_in': 'on' }).charging.phase).toBe('plugged')
  })
})

describe('buildVehicleState — velocidade de carregamento', () => {
  it('lento em AC de baixa potência, como na app', () => {
    const s = build({ 'binary_sensor/is_charging': 'on', 'binary_sensor/is_plugged_in': 'on', 'sensor/charging_power_kw': '2.2' })
    expect(s.charging.speed).toBe('slow')
  })

  it('rápido acima de 7.4 kW', () => {
    const s = build({ 'binary_sensor/is_charging': 'on', 'binary_sensor/is_plugged_in': 'on', 'sensor/charging_power_kw': '11.0' })
    expect(s.charging.speed).toBe('fast')
  })

  it('rápido sempre que o cabo DC está ligado', () => {
    const s = build({ 'binary_sensor/is_charging': 'on', 'binary_sensor/dc_cable_connected': 'on', 'sensor/charging_power_kw': '3.0' })
    expect(s.charging.speed).toBe('fast')
  })

  it('sem velocidade quando não está a carregar', () => {
    expect(build().charging.speed).toBeUndefined()
  })
})

describe('buildVehicleState — tempo e métricas de carregamento', () => {
  it('não inventa tempo restante quando o sensor está indisponível', () => {
    const s = build()
    expect(s.charging.remainingMinutes).toBeUndefined()
    expect(s.charging.finishTime).toBeUndefined()
  })

  it('lê o tempo restante e deriva a hora de fim a partir de now', () => {
    const s = build({
      'binary_sensor/is_charging': 'on',
      'binary_sensor/is_plugged_in': 'on',
      'sensor/remaining_charge_minutes': '835',
    })
    expect(s.charging.remainingMinutes).toBe(835)
    // REAL_NOW 13:36 UTC + 835 min = 2026-08-28T03:31:00Z
    expect(s.charging.finishTime?.toISOString()).toBe('2026-08-28T03:31:00.000Z')
  })

  it('prefere o sensor de hora de fim ao valor derivado', () => {
    const s = build({
      'binary_sensor/is_charging': 'on',
      'binary_sensor/is_plugged_in': 'on',
      'sensor/remaining_charge_minutes': '835',
      'sensor/charging_finish_time': '2026-08-28T04:00:00+00:00',
    })
    expect(s.charging.finishTime?.toISOString()).toBe('2026-08-28T04:00:00.000Z')
  })

  it('expõe potência, tensão e corrente', () => {
    const s = build({ 'binary_sensor/is_charging': 'on', 'binary_sensor/is_plugged_in': 'on', 'sensor/charging_power_kw': '6.9' })
    expect(s.charging.powerKw).toBe(6.9)
    expect(s.charging.voltageV).toBe(426.6)
    expect(s.charging.currentA).toBe(0.1)
  })
})
```

- [ ] **Step 2: Correr os testes para confirmar que falham**

Run: `npx vitest run test/vehicle-state.test.ts`
Expected: FAIL — as fases devolvem sempre `unplugged` e `speed`/`remainingMinutes`/`powerKw` vêm `undefined`.

- [ ] **Step 3: Implementar `buildCharging` em `src/vehicle-state.ts`**

Acrescentar `ChargingPhase` ao import existente de `./types`:
```ts
import type { Activity, ChargingPhase, EntityMap, VehicleState } from './types'
```

E, antes de `buildVehicleState`:
```ts
const FAST_CHARGE_KW = 7.4

function buildCharging(hass: HomeAssistant, map: EntityMap, now: Date): VehicleState['charging'] {
  const dcCable = bool(hass, map, 'dcCableConnected') === true
  const acCable = bool(hass, map, 'isPluggedIn') === true
  const connection = str(hass, map, 'chargingConnection')
  const connectionSaysPlugged = connection !== undefined && connection !== 'unplugged'
  const cable = dcCable || acCable || connectionSaysPlugged
  const scheduled = bool(hass, map, 'schedulePlanned') === true || bool(hass, map, 'scheduleSwitch') === true

  let phase: ChargingPhase = 'unplugged'
  if (bool(hass, map, 'fullyCharged') === true) phase = 'complete'
  else if (bool(hass, map, 'isCharging') === true) phase = 'charging'
  else if (cable) phase = 'plugged'
  else if (scheduled) phase = 'scheduled'

  const powerKw = num(hass, map, 'chargingPower')
  const speed = phase === 'charging'
    ? (dcCable || (powerKw !== undefined && powerKw >= FAST_CHARGE_KW) ? 'fast' : 'slow')
    : undefined

  const remainingMinutes = num(hass, map, 'remainingChargeMinutes')
  const sensorFinish = date(hass, map, 'chargingFinishTime')
  const finishTime = sensorFinish
    ?? (remainingMinutes !== undefined ? new Date(now.getTime() + remainingMinutes * 60_000) : undefined)

  return {
    phase,
    speed,
    powerKw,
    voltageV: num(hass, map, 'chargingVoltage'),
    currentA: num(hass, map, 'chargingCurrent'),
    remainingMinutes,
    finishTime,
  }
}
```

E em `buildVehicleState` substituir `charging: { phase: 'unplugged' },` por:
```ts
    charging: buildCharging(hass, map, now),
```

- [ ] **Step 4: Correr os testes e o typecheck**

Run: `npx vitest run test/vehicle-state.test.ts && npm run typecheck`
Expected: todos PASS.

- [ ] **Step 5: Commit**

```bash
git add src/vehicle-state.ts test/vehicle-state.test.ts
git commit -m "feat: derive charging phase, speed and remaining time"
```

---

### Task 6: Camada 2 — aberturas, clima, pneus, viagem, conforto, agendamento

**Files:**
- Modify: `src/vehicle-state.ts`
- Test: `test/vehicle-state.test.ts`

**Interfaces:**
- Consumes: helpers e `buildVehicleState` (Tasks 4 e 5).
- Produces: `VehicleState` totalmente preenchido. Depois desta task, nenhum campo de `VehicleState` fica por implementar e todas as chaves de `ENTITY_KEYS` estão consumidas por `VehicleState` ou por `actions.ts` (Task 9).

- [ ] **Step 1: Acrescentar os testes**

```ts
describe('buildVehicleState — aberturas', () => {
  it('tudo fechado nos estados reais', () => {
    const s = build()
    expect(s.openings.openCount).toBe(0)
    expect(s.openings.doors.driver).toBe(false)
    expect(s.openings.trunk).toBe(false)
    expect(s.openings.roof).toBe(false)
  })

  it('conta uma porta aberta', () => {
    expect(build({ 'binary_sensor/rear_left_door_open': 'on' }).openings.openCount).toBe(1)
  })

  it('conta a mala e o teto', () => {
    expect(build({ 'binary_sensor/trunk_open': 'on', 'binary_sensor/skylight_open': 'on' }).openings.openCount).toBe(2)
  })

  it('conta um vidro aberto pelo binary_sensor', () => {
    const s = build({ 'binary_sensor/front_left_window_open': 'on' })
    expect(s.openings.windows.fl.open).toBe(true)
    expect(s.openings.openCount).toBe(1)
  })

  it('conta um vidro aberto por posição, mesmo com o binary_sensor a off', () => {
    const s = build({ 'sensor/rear_right_window_position_percent': '35' })
    expect(s.openings.windows.rr.position).toBe(35)
    expect(s.openings.openCount).toBe(1)
  })

  it('não conta duas vezes o mesmo vidro', () => {
    const s = build({ 'binary_sensor/front_right_window_open': 'on', 'sensor/front_right_window_position_percent': '80' })
    expect(s.openings.openCount).toBe(1)
  })

  it('ignora aberturas indisponíveis em vez de as contar', () => {
    const s = build({ 'binary_sensor/driver_door_open': 'unavailable' })
    expect(s.openings.doors.driver).toBeUndefined()
    expect(s.openings.openCount).toBe(0)
  })
})

describe('buildVehicleState — clima', () => {
  it('lê temperatura interior, alvo e estado', () => {
    const s = build()
    expect(s.climate.interiorC).toBe(24)
    expect(s.climate.targetC).toBe(24)
    expect(s.climate.on).toBe(false)
    expect(s.climate.mode).toBe('off')
  })

  it('considera ligado quando o switch ou o binary_sensor estão on', () => {
    expect(build({ 'switch/climate_control': 'on' }).climate.on).toBe(true)
    expect(build({ 'binary_sensor/climate_on': 'on' }).climate.on).toBe(true)
  })
})

describe('buildVehicleState — pneus, viagem, conforto, agendamento', () => {
  it('lê as quatro pressões', () => {
    expect(build().tires).toEqual({ fl: 2.11, fr: 2.17, rl: 2.17, rr: 2.17 })
  })

  it('lê a viagem', () => {
    expect(build().trip).toEqual({
      odometerKm: 659, last7DaysKm: 642, last7DaysKwh: 118, avgConsumption: 20.6, totalEnergyKwh: 131,
    })
  })

  it('usa total_mileage como recurso do odómetro', () => {
    expect(build({ 'sensor/odometer_km': 'unavailable' }).trip.odometerKm).toBe(659)
  })

  it('lê o conforto', () => {
    const s = build({ 'switch/steering_wheel_heat': 'on' })
    expect(s.comfort.driverSeatHeat).toBe(0)
    expect(s.comfort.steeringWheelHeat).toBe(true)
    expect(s.comfort.steeringWheelHeatRemaining).toBe(15)
    expect(s.comfort.mirrorHeat).toBe(false)
    expect(s.comfort.batteryPreheat).toBe(false)
  })

  it('lê o agendamento', () => {
    expect(build().schedule).toEqual({
      enabled: false, start: '22:00', end: '08:00', recurrence: '1', weekly: true, cancelledOnce: true,
    })
  })
})
```

- [ ] **Step 2: Correr os testes para confirmar que falham**

Run: `npx vitest run test/vehicle-state.test.ts`
Expected: FAIL — os blocos novos falham com valores `undefined` e `openCount` sempre 0.

- [ ] **Step 3: Implementar as secções restantes em `src/vehicle-state.ts`**

```ts
const WINDOW_KEYS = [
  { side: 'fl', open: 'windowFL', pos: 'windowPosFL' },
  { side: 'fr', open: 'windowFR', pos: 'windowPosFR' },
  { side: 'rl', open: 'windowRL', pos: 'windowPosRL' },
  { side: 'rr', open: 'windowRR', pos: 'windowPosRR' },
] as const

function buildOpenings(hass: HomeAssistant, map: EntityMap): VehicleState['openings'] {
  const doors = {
    driver: bool(hass, map, 'doorDriver'),
    passenger: bool(hass, map, 'doorPassenger'),
    rearLeft: bool(hass, map, 'doorRearLeft'),
    rearRight: bool(hass, map, 'doorRearRight'),
  }

  const windows = { fl: {}, fr: {}, rl: {}, rr: {} } as VehicleState['openings']['windows']
  for (const w of WINDOW_KEYS) {
    windows[w.side] = { open: bool(hass, map, w.open), position: num(hass, map, w.pos) }
  }

  const trunk = bool(hass, map, 'trunk')
  const roof = bool(hass, map, 'roof')

  let openCount = 0
  for (const v of Object.values(doors)) if (v === true) openCount++
  for (const w of Object.values(windows)) if (w.open === true || (w.position !== undefined && w.position > 0)) openCount++
  if (trunk === true) openCount++
  if (roof === true) openCount++

  return { doors, windows, trunk, roof, openCount }
}

function buildClimate(hass: HomeAssistant, map: EntityMap): VehicleState['climate'] {
  const sw = bool(hass, map, 'climateSwitch')
  const sensorOn = bool(hass, map, 'climateOn')
  const on = sw === true || sensorOn === true ? true : (sw ?? sensorOn)
  return {
    on,
    interiorC: num(hass, map, 'interiorTemp'),
    targetC: num(hass, map, 'targetTemp'),
    mode: str(hass, map, 'climateMode'),
  }
}
```

E em `buildVehicleState` substituir os blocos neutros:
```ts
    openings: buildOpenings(hass, map),
    climate: buildClimate(hass, map),
    tires: {
      fl: num(hass, map, 'tireFL'),
      fr: num(hass, map, 'tireFR'),
      rl: num(hass, map, 'tireRL'),
      rr: num(hass, map, 'tireRR'),
    },
    trip: {
      odometerKm: num(hass, map, 'odometer') ?? num(hass, map, 'totalMileage'),
      last7DaysKm: num(hass, map, 'last7DaysKm'),
      last7DaysKwh: num(hass, map, 'last7DaysKwh'),
      avgConsumption: num(hass, map, 'avgConsumption6w'),
      totalEnergyKwh: num(hass, map, 'totalEnergy'),
    },
    comfort: {
      driverSeatHeat: num(hass, map, 'driverSeatHeat'),
      driverSeatVent: num(hass, map, 'driverSeatVent'),
      passengerSeatHeat: num(hass, map, 'passengerSeatHeat'),
      passengerSeatVent: num(hass, map, 'passengerSeatVent'),
      steeringWheelHeat: bool(hass, map, 'steeringWheelHeat'),
      steeringWheelHeatRemaining: num(hass, map, 'steeringWheelHeatRemaining'),
      mirrorHeat: bool(hass, map, 'mirrorHeat'),
      batteryPreheat: bool(hass, map, 'batteryPreheat'),
    },
    schedule: {
      enabled: bool(hass, map, 'scheduleSwitch'),
      start: str(hass, map, 'scheduleStart'),
      end: str(hass, map, 'scheduleEnd'),
      recurrence: str(hass, map, 'scheduleRecurrence'),
      weekly: bool(hass, map, 'scheduleWeekly'),
      cancelledOnce: bool(hass, map, 'scheduleCancelledOnce'),
    },
```

- [ ] **Step 4: Correr toda a bateria de testes e o typecheck**

Run: `npm test && npm run typecheck`
Expected: todos PASS; `tsc` sem erros. `noUnusedLocals` garante que nenhum helper ficou sem uso.

- [ ] **Step 5: Commit**

```bash
git add src/vehicle-state.ts test/vehicle-state.test.ts
git commit -m "feat: derive openings, climate, tires, trip, comfort and schedule"
```

---

### Task 7: Internacionalização

**Files:**
- Create: `src/localize.ts`, `src/translations/pt.json`, `src/translations/en.json`
- Test: `test/localize.test.ts`

**Interfaces:**
- Consumes: nada das tasks anteriores.
- Produces:
  - `type TranslateFn = (key: string, vars?: Record<string, string | number>) => string`
  - `pickLanguage(configLanguage: string | undefined, hassLanguage: string | undefined): string`
  - `createTranslator(language: string): TranslateFn`
  - `formatDuration(minutes: number, t: TranslateFn): string`
  - `DASH = '—'`

- [ ] **Step 1: Escrever os testes**

`test/localize.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { createTranslator, formatDuration, pickLanguage } from '../src/localize'

describe('pickLanguage', () => {
  it('a config ganha ao idioma do hass', () => {
    expect(pickLanguage('pt', 'en')).toBe('pt')
  })
  it('usa o idioma do hass quando a config não define', () => {
    expect(pickLanguage(undefined, 'pt')).toBe('pt')
  })
  it('reduz uma etiqueta regional à língua base', () => {
    expect(pickLanguage(undefined, 'pt-PT')).toBe('pt')
  })
  it('cai para inglês num idioma sem catálogo', () => {
    expect(pickLanguage(undefined, 'de')).toBe('en')
  })
  it('cai para inglês sem informação nenhuma', () => {
    expect(pickLanguage(undefined, undefined)).toBe('en')
  })
})

describe('createTranslator', () => {
  it('traduz para português', () => {
    expect(createTranslator('pt')('tiles.all_closed')).toBe('Todos fechados')
  })
  it('traduz para inglês', () => {
    expect(createTranslator('en')('tiles.all_closed')).toBe('All closed')
  })
  it('interpola variáveis', () => {
    expect(createTranslator('pt')('charging.title', { percent: 60 })).toBe('Carregado a 60%')
  })
  it('deixa o marcador literal quando falta a variável', () => {
    expect(createTranslator('pt')('charging.title')).toBe('Carregado a {percent}%')
  })
  it('devolve a própria chave quando não existe tradução em nenhum catálogo', () => {
    expect(createTranslator('pt')('nao.existe')).toBe('nao.existe')
  })
})

describe('formatDuration', () => {
  const pt = createTranslator('pt')
  const en = createTranslator('en')

  it('formata horas e minutos como na app', () => {
    // 835 min = 13h 55min, o valor da captura
    expect(formatDuration(835, pt)).toBe('13h e 55min')
    expect(formatDuration(835, en)).toBe('13h 55min')
  })
  it('formata só horas quando os minutos são zero', () => {
    expect(formatDuration(120, pt)).toBe('2h')
  })
  it('formata só minutos abaixo de uma hora', () => {
    expect(formatDuration(45, pt)).toBe('45min')
  })
  it('formata zero como 0min', () => {
    expect(formatDuration(0, pt)).toBe('0min')
  })
})
```

- [ ] **Step 2: Correr os testes para confirmar que falham**

Run: `npx vitest run test/localize.test.ts`
Expected: FAIL — `Cannot find module '../src/localize'`.

- [ ] **Step 3: Escrever `src/translations/pt.json`**

```json
{
  "updated": "Atualização do estado {time}",
  "today": "Hoje",
  "yesterday": "Ontem",
  "doors_locked": "Portas trancadas",
  "doors_unlocked": "Portas destrancadas",
  "doors_unknown": "Portas",
  "stale_since": "há {ago}",
  "activity.parked": "Estacionado",
  "activity.driving": "Em andamento",
  "activity.ready": "Pronto",
  "action.unlock": "Destrancar",
  "action.lock": "Trancar",
  "action.trunk_open": "Bagageira",
  "action.trunk_close": "Fechar bagageira",
  "action.windows_open": "Vidros",
  "action.windows_close": "Fechar vidros",
  "action.openSunshade": "Abrir cortina",
  "action.closeSunshade": "Fechar cortina",
  "action.quickCool": "Arrefecer",
  "action.quickHeat": "Aquecer",
  "action.defrost": "Desembaciar",
  "action.findVehicle": "Localizar",
  "action.unlockCharger": "Soltar cabo",
  "action.refresh": "Atualizar",
  "action.climate": "Climatização",
  "action.steeringWheelHeat": "Volante",
  "action.mirrorHeat": "Espelhos",
  "action.batteryPreheat": "Pré-aquecer bateria",
  "action.setChargeLimit": "Limite de carga",
  "confirm": "Confirmar: {action}?",
  "confirm_yes": "Confirmar",
  "confirm_no": "Cancelar",
  "charging.title": "Carregado a {percent}%",
  "charging.limit": "Limite {percent}%",
  "charging.slow": "Carregamento lento",
  "charging.fast": "Carregamento rápido",
  "charging.remaining": "Restam {duration}",
  "charging.finish": "Termina às {time}",
  "charging.unplugged": "Sem cabo",
  "charging.plugged": "Ligado, sem carregar",
  "charging.complete": "Carregamento completo",
  "charging.scheduled": "Agendado {start}–{end}",
  "charging.metrics": "{voltage} V · {current} A · {power} kW",
  "loading": "A carregar…",
  "tiles.interior": "Temperatura interior",
  "tiles.doors": "Portas",
  "tiles.target": "Alvo {temp}",
  "tiles.openings": "Aberturas",
  "tiles.all_closed": "Todos fechados",
  "tiles.open_count": "{count} abertos",
  "tiles.open_one": "1 aberto",
  "tires.title": "Pressão dos pneus",
  "tires.warning": "Pressão fora do intervalo recomendado",
  "trip.title": "Viagem",
  "trip.odometer": "Odómetro",
  "trip.last7days": "Últimos 7 dias",
  "trip.consumption": "Média 6 semanas",
  "trip.total_energy": "Energia total",
  "comfort.title": "Conforto",
  "comfort.driver_seat": "Assento do condutor",
  "comfort.passenger_seat": "Assento do passageiro",
  "comfort.heating": "Aquecimento",
  "comfort.ventilation": "Ventilação",
  "comfort.steering_wheel": "Volante",
  "comfort.mirrors": "Espelhos",
  "comfort.battery_preheat": "Pré-aquecimento da bateria",
  "comfort.remaining": "{minutes} min restantes",
  "schedule.title": "Agendamento de carregamento",
  "schedule.window": "{start} às {end}",
  "schedule.weekly": "Repete semanalmente",
  "schedule.cancelled_once": "Cancelado desta vez",
  "schedule.disabled": "Desativado",
  "error.not_found": "Não foi encontrada nenhuma entidade da integração Leapmotor.",
  "error.unknown_device": "O device indicado em «device» não existe. Devices disponíveis: {candidates}.",
  "error.ambiguous": "Há mais do que um veículo Leapmotor. Indica qual em «device»: {candidates}.",
  "missing_entity": "Entidade em falta: {keys}",
  "duration.hm": "{h}h e {m}min",
  "duration.h": "{h}h",
  "duration.m": "{m}min"
}
```

- [ ] **Step 4: Escrever `src/translations/en.json`**

O mesmo conjunto de chaves, exatamente. Diferenças a notar:
`"updated": "Status update {time}"`, `"today": "Today"`,
`"yesterday": "Yesterday"`, `"doors_locked": "Doors locked"`,
`"doors_unlocked": "Doors unlocked"`, `"doors_unknown": "Doors"`,
`"stale_since": "{ago} ago"`, `"activity.parked": "Parked"`,
`"activity.driving": "Driving"`, `"activity.ready": "Ready"`,
`"action.unlock": "Unlock"`, `"action.lock": "Lock"`,
`"action.trunk_open": "Trunk"`, `"action.trunk_close": "Close trunk"`,
`"action.windows_open": "Windows"`, `"action.windows_close": "Close windows"`,
`"action.openSunshade": "Open sunshade"`, `"action.closeSunshade": "Close sunshade"`,
`"action.quickCool": "Cool"`, `"action.quickHeat": "Heat"`,
`"action.defrost": "Defrost"`, `"action.findVehicle": "Find"`,
`"action.unlockCharger": "Release cable"`, `"action.refresh": "Refresh"`,
`"action.climate": "Climate"`, `"action.steeringWheelHeat": "Steering wheel"`,
`"action.mirrorHeat": "Mirrors"`, `"action.batteryPreheat": "Preheat battery"`,
`"action.setChargeLimit": "Charge limit"`, `"confirm": "Confirm: {action}?"`,
`"confirm_yes": "Confirm"`, `"confirm_no": "Cancel"`,
`"charging.title": "Charged to {percent}%"`, `"charging.limit": "Limit {percent}%"`,
`"charging.slow": "Slow charging"`, `"charging.fast": "Fast charging"`,
`"charging.remaining": "{duration} left"`, `"charging.finish": "Ends at {time}"`,
`"charging.unplugged": "Not plugged in"`, `"charging.plugged": "Plugged in, not charging"`,
`"charging.complete": "Fully charged"`, `"charging.scheduled": "Scheduled {start}–{end}"`,
`"charging.metrics": "{voltage} V · {current} A · {power} kW"`,
`"loading": "Loading…"`, `"tiles.interior": "Interior temperature"`,
`"tiles.doors": "Doors"`, `"tiles.target": "Target {temp}"`,
`"tiles.openings": "Openings"`, `"tiles.all_closed": "All closed"`,
`"tiles.open_count": "{count} open"`, `"tiles.open_one": "1 open"`,
`"tires.title": "Tire pressure"`, `"tires.warning": "Pressure outside the recommended range"`,
`"trip.title": "Trip"`, `"trip.odometer": "Odometer"`,
`"trip.last7days": "Last 7 days"`, `"trip.consumption": "6 week average"`,
`"trip.total_energy": "Total energy"`, `"comfort.title": "Comfort"`,
`"comfort.driver_seat": "Driver seat"`, `"comfort.passenger_seat": "Passenger seat"`,
`"comfort.heating": "Heating"`, `"comfort.ventilation": "Ventilation"`,
`"comfort.steering_wheel": "Steering wheel"`, `"comfort.mirrors": "Mirrors"`,
`"comfort.battery_preheat": "Battery preheat"`, `"comfort.remaining": "{minutes} min left"`,
`"schedule.title": "Charging schedule"`, `"schedule.window": "{start} to {end}"`,
`"schedule.weekly": "Repeats weekly"`, `"schedule.cancelled_once": "Cancelled this time"`,
`"schedule.disabled": "Disabled"`,
`"error.not_found": "No entities from the Leapmotor integration were found."`,
`"error.unknown_device": "The device set in \"device\" does not exist. Available devices: {candidates}."`,
`"error.ambiguous": "More than one Leapmotor vehicle found. Set which one in \"device\": {candidates}."`,
`"missing_entity": "Missing entity: {keys}"`,
`"duration.hm": "{h}h {m}min"`, `"duration.h": "{h}h"`, `"duration.m": "{m}min"`.

- [ ] **Step 5: Escrever `src/localize.ts`**

```ts
import en from './translations/en.json'
import pt from './translations/pt.json'

export const DASH = '—'

const CATALOGUES: Record<string, Record<string, string>> = { en, pt }
const FALLBACK = 'en'

export type TranslateFn = (key: string, vars?: Record<string, string | number>) => string

export function pickLanguage(configLanguage?: string, hassLanguage?: string): string {
  for (const candidate of [configLanguage, hassLanguage]) {
    if (!candidate) continue
    const base = candidate.toLowerCase().split('-')[0]
    if (base && CATALOGUES[base]) return base
  }
  return FALLBACK
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole)
}

export function createTranslator(language: string): TranslateFn {
  const primary = CATALOGUES[language] ?? CATALOGUES[FALLBACK]
  const fallback = CATALOGUES[FALLBACK]
  return (key, vars) => {
    const template = primary[key] ?? fallback[key]
    return template === undefined ? key : interpolate(template, vars)
  }
}

export function formatDuration(minutes: number, t: TranslateFn): string {
  const total = Math.max(0, Math.round(minutes))
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h > 0 && m > 0) return t('duration.hm', { h, m })
  if (h > 0) return t('duration.h', { h })
  return t('duration.m', { m })
}
```

- [ ] **Step 6: Correr os testes e o typecheck**

Run: `npx vitest run test/localize.test.ts && npm run typecheck`
Expected: 14 testes PASS.

- [ ] **Step 7: Verificar que os dois catálogos têm as mesmas chaves**

Run:
```bash
node --input-type=commonjs -e "const fs=require('fs');const a=JSON.parse(fs.readFileSync('src/translations/pt.json','utf8')),b=JSON.parse(fs.readFileSync('src/translations/en.json','utf8'));const ka=Object.keys(a).sort(),kb=Object.keys(b).sort();const miss=ka.filter(k=>!(k in b)).concat(kb.filter(k=>!(k in a)));if(miss.length){console.error('chaves dessincronizadas:',miss);process.exit(1)}console.log('catálogos sincronizados:',ka.length,'chaves')"
```

`--input-type=commonjs` é obrigatório: o `package.json` tem
`"type": "module"`, e sem a flag o `require` não existe.
Expected: `catálogos sincronizados: <n> chaves`.

- [ ] **Step 8: Commit**

```bash
git add src/localize.ts src/translations test/localize.test.ts
git commit -m "feat: add pt/en translations with duration formatting"
```

---

### Task 8: Formatação, tema, silhueta e secção hero

**Files:**
- Create: `src/format.ts`, `src/theme.ts`, `src/car-silhouette.ts`, `src/sections/hero.ts`
- Test: `test/format.test.ts`

**Interfaces:**
- Consumes: `VehicleState`, `Activity` (Task 2); `TranslateFn`, `DASH`, `formatDuration` (Task 7).
- Produces:
  - `src/format.ts`: `formatTimeOfDay(d: Date, language: string): string`, `formatDayLabel(d: Date, now: Date, t: TranslateFn, language: string): string`, `formatUpdated(d: Date | undefined, now: Date, t: TranslateFn, language: string): string`, `formatAgo(seconds: number, t: TranslateFn): string`, `formatNumber(n: number | undefined, digits?: number): string`
  - `src/theme.ts`: `sharedStyles: CSSResult`, `batteryColor(percent: number | undefined): string`
  - `src/car-silhouette.ts`: `CAR_SILHOUETTE: TemplateResult` (SVG original, sem imagens de terceiros)
  - `src/sections/hero.ts`: elemento `<leapmotor-hero>` com propriedades `state: VehicleState`, `t: TranslateFn`, `now: Date`, `name: string`, `imageUrl?: string`

- [ ] **Step 1: Escrever os testes de formatação**

`test/format.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { formatAgo, formatNumber, formatUpdated } from '../src/format'
import { createTranslator } from '../src/localize'

const pt = createTranslator('pt')
const NOW = new Date('2026-08-27T19:50:00+00:00')

describe('formatUpdated', () => {
  it('mostra hora e "Hoje" para o mesmo dia', () => {
    expect(formatUpdated(new Date('2026-08-27T19:49:00+00:00'), NOW, pt, 'pt'))
      .toBe('Atualização do estado 19:49 Hoje')
  })
  it('mostra "Ontem" para o dia anterior', () => {
    expect(formatUpdated(new Date('2026-08-26T08:05:00+00:00'), NOW, pt, 'pt'))
      .toBe('Atualização do estado 08:05 Ontem')
  })
  it('mostra a data para dias mais antigos', () => {
    expect(formatUpdated(new Date('2026-08-20T08:05:00+00:00'), NOW, pt, 'pt'))
      .toContain('08:05')
  })
  it('devolve travessão sem data', () => {
    expect(formatUpdated(undefined, NOW, pt, 'pt')).toBe('—')
  })
})

describe('formatAgo', () => {
  it('formata segundos em horas e minutos', () => {
    // 11930 s = 198.83 min, que formatDuration arredonda para 199 = 3h 19min
    expect(formatAgo(11930, pt)).toBe('há 3h e 19min')
  })
  it('formata menos de uma hora', () => {
    expect(formatAgo(300, pt)).toBe('há 5min')
  })
})

describe('formatNumber', () => {
  it('devolve travessão para undefined', () => {
    expect(formatNumber(undefined)).toBe('—')
  })
  it('arredonda para inteiro por defeito', () => {
    expect(formatNumber(60.3)).toBe('60')
  })
  it('respeita as casas decimais pedidas', () => {
    expect(formatNumber(2.174, 2)).toBe('2.17')
  })
})
```

Nota sobre fuso: os testes usam datas em UTC e comparam contra horas em
UTC. Para o resultado ser estável independentemente da máquina, o script
de teste corre com `TZ=UTC` — ver Step 5.

- [ ] **Step 2: Correr os testes para confirmar que falham**

Run: `TZ=UTC npx vitest run test/format.test.ts`
Expected: FAIL — `Cannot find module '../src/format'`.

- [ ] **Step 3: Escrever `src/format.ts`**

```ts
import { DASH, formatDuration, type TranslateFn } from './localize'

export function formatTimeOfDay(d: Date, language: string): string {
  return new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function formatDayLabel(d: Date, now: Date, t: TranslateFn, language: string): string {
  if (sameDay(d, now)) return t('today')
  const yesterday = new Date(now.getTime() - 86_400_000)
  if (sameDay(d, yesterday)) return t('yesterday')
  return new Intl.DateTimeFormat(language, { day: '2-digit', month: 'short' }).format(d)
}

export function formatUpdated(d: Date | undefined, now: Date, t: TranslateFn, language: string): string {
  if (!d) return DASH
  return t('updated', { time: `${formatTimeOfDay(d, language)} ${formatDayLabel(d, now, t, language)}` })
}

export function formatAgo(seconds: number, t: TranslateFn): string {
  return t('stale_since', { ago: formatDuration(seconds / 60, t) })
}

export function formatNumber(n: number | undefined, digits = 0): string {
  if (n === undefined || !Number.isFinite(n)) return DASH
  return n.toFixed(digits)
}
```

- [ ] **Step 4: Escrever `src/theme.ts` e `src/car-silhouette.ts`**

`src/theme.ts`:
```ts
import { css, type CSSResult } from 'lit'

export function batteryColor(percent: number | undefined): string {
  if (percent === undefined) return 'var(--leapmotor-battery-unknown, var(--disabled-text-color, #9e9e9e))'
  if (percent >= 50) return 'var(--leapmotor-battery-high, #2fbf5c)'
  if (percent >= 20) return 'var(--leapmotor-battery-mid, #f5a623)'
  return 'var(--leapmotor-battery-low, #e5484d)'
}

export const sharedStyles: CSSResult = css`
  :host {
    --lm-gap: 16px;
    --lm-radius: 18px;
    --lm-text: var(--primary-text-color);
    --lm-muted: var(--secondary-text-color);
    --lm-surface: var(--leapmotor-surface, var(--card-background-color));
    --lm-chip: var(--leapmotor-chip, rgba(127, 127, 127, 0.12));
    color: var(--lm-text);
    font-family: var(--paper-font-body1_-_font-family, inherit);
  }
  .muted { color: var(--lm-muted); }
  .chip {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 10px; border-radius: 999px;
    background: var(--lm-chip); font-size: 0.8rem; white-space: nowrap;
  }
  .panel {
    background: var(--lm-chip); border-radius: var(--lm-radius);
    padding: var(--lm-gap); margin-top: var(--lm-gap);
  }
  .row { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--lm-gap); }
  button.plain {
    all: unset; cursor: pointer; display: flex; flex-direction: column;
    align-items: center; gap: 8px; -webkit-tap-highlight-color: transparent;
  }
  button.plain[disabled] { cursor: not-allowed; opacity: 0.4; }
`
```

`src/car-silhouette.ts` — SVG original, desenhado para este projeto:
```ts
import { html, type TemplateResult } from 'lit'

/**
 * Silhueta genérica de SUV, usada quando não há imagem do veículo.
 * Desenho original; o repositório não distribui renders da Leapmotor.
 */
export const CAR_SILHOUETTE: TemplateResult = html`
  <svg viewBox="0 0 320 120" role="img" aria-hidden="true" part="silhouette">
    <g fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" opacity="0.45">
      <path d="M22 84 C22 70 30 64 44 62 L74 44 C84 38 96 35 108 35 L196 35 C214 35 230 41 243 52 L266 62 C282 65 296 70 296 84" />
      <path d="M22 84 L296 84" />
      <path d="M96 40 L110 62 L206 62 L196 40" />
      <path d="M152 40 L152 62" />
      <circle cx="82" cy="86" r="17" />
      <circle cx="238" cy="86" r="17" />
    </g>
  </svg>
`
```

- [ ] **Step 5: Fixar o fuso nos testes**

Em `package.json`, alterar os scripts de teste para fixar `TZ`:
```json
    "test": "TZ=UTC vitest run",
    "test:watch": "TZ=UTC vitest",
```

- [ ] **Step 6: Escrever `src/sections/hero.ts`**

```ts
import { LitElement, css, html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { formatAgo, formatNumber, formatTimeOfDay, formatUpdated } from '../format'
import { DASH, formatDuration, type TranslateFn } from '../localize'
import { batteryColor, sharedStyles } from '../theme'
import type { VehicleState } from '../types'
import { CAR_SILHOUETTE } from '../car-silhouette'

@customElement('leapmotor-hero')
export class LeapmotorHero extends LitElement {
  @property({ attribute: false }) state!: VehicleState
  @property({ attribute: false }) t!: TranslateFn
  @property({ attribute: false }) now!: Date
  @property({ type: String }) name = ''
  @property({ type: String }) language = 'en'
  @property({ type: String }) imageUrl?: string
  @property({ type: Boolean }) showImage = true

  private lockLabel(): string {
    const { locked } = this.state.lock
    if (locked === undefined) return this.t('doors_unknown')
    return this.t(locked ? 'doors_locked' : 'doors_unlocked')
  }

  private chargingChip() {
    const c = this.state.charging
    if (c.phase === 'unplugged') return nothing

    const parts: string[] = []
    if (c.phase === 'complete') parts.push(this.t('charging.complete'))
    else if (c.phase === 'scheduled') {
      parts.push(this.t('charging.scheduled', {
        start: this.state.schedule.start ?? DASH,
        end: this.state.schedule.end ?? DASH,
      }))
    } else if (c.phase === 'plugged') parts.push(this.t('charging.plugged'))
    else parts.push(this.t(c.speed === 'fast' ? 'charging.fast' : 'charging.slow'))

    if (c.remainingMinutes !== undefined) {
      parts.push(this.t('charging.remaining', { duration: formatDuration(c.remainingMinutes, this.t) }))
    } else if (c.finishTime) {
      parts.push(this.t('charging.finish', { time: formatTimeOfDay(c.finishTime, this.language) }))
    }

    return html`<div class="chip charge">
      <ha-icon icon="mdi:lightning-bolt"></ha-icon>${parts.join(', ')}
    </div>`
  }

  private bar() {
    const battery = this.state.battery
    const limit = this.state.chargeLimit
    return html`<div class="bar" role="img" aria-label="${formatNumber(battery)}%">
      ${limit !== undefined
        ? html`<div class="limit" style="width:${Math.min(100, Math.max(0, limit))}%"></div>`
        : nothing}
      <div class="fill" style="width:${Math.min(100, Math.max(0, battery ?? 0))}%;background:${batteryColor(battery)}"></div>
    </div>`
  }

  override render() {
    const { range, lock, activity } = this.state
    return html`
      <div class="head">
        <div class="title">${this.name || DASH}</div>
        <div class="sub muted">${formatUpdated(this.state.lastUpdate, this.now, this.t, this.language)}</div>
      </div>

      <div class="row main">
        <div class="range">
          <div class="value">
            <span class="big">${range ? formatNumber(range.km) : DASH}</span>
            <span class="unit muted">${range?.unit ?? ''}</span>
          </div>
          ${this.bar()}
          ${this.chargingChip()}
        </div>

        <div class="lock ${lock.stale ? 'stale' : ''}">
          <ha-icon icon=${lock.locked === false ? 'mdi:lock-open-variant-outline' : 'mdi:lock-outline'}></ha-icon>
          <div class="lock-text">
            <div>${this.lockLabel()}</div>
            ${lock.stale && lock.ageSeconds !== undefined
              ? html`<div class="ago muted">${formatAgo(lock.ageSeconds, this.t)}</div>`
              : nothing}
          </div>
        </div>
      </div>

      ${this.showImage
        ? html`<div class="image">
            ${this.imageUrl
              ? html`<img src=${this.imageUrl} alt=${this.name} />`
              : CAR_SILHOUETTE}
          </div>`
        : nothing}

      ${activity === 'unknown'
        ? nothing
        : html`<div class="activity muted">${this.t(`activity.${activity}`)}</div>`}
    `
  }

  static override styles = [sharedStyles, css`
    .title { font-size: 1.4rem; font-weight: 600; }
    .sub { font-size: 0.8rem; margin-top: 2px; }
    .main { margin-top: var(--lm-gap); align-items: flex-start; }
    .range { min-width: 0; flex: 1 1 auto; }
    .value { display: flex; align-items: baseline; gap: 6px; }
    .big { font-size: 2.6rem; font-weight: 300; line-height: 1; }
    .unit { font-size: 1rem; }
    .bar {
      position: relative; height: 6px; border-radius: 999px;
      background: var(--lm-chip); margin: 10px 0; max-width: 220px; overflow: hidden;
    }
    .bar .limit, .bar .fill { position: absolute; inset-block: 0; inset-inline-start: 0; border-radius: 999px; }
    .bar .limit { background: var(--leapmotor-battery-high, #2fbf5c); opacity: 0.28; }
    .chip.charge { margin-top: 4px; }
    .lock { display: flex; align-items: flex-start; gap: 8px; text-align: start; flex: 0 0 auto; }
    .lock.stale { opacity: 0.55; }
    .lock-text { font-size: 1.05rem; line-height: 1.2; }
    .ago { font-size: 0.75rem; }
    .image { display: flex; justify-content: center; margin: var(--lm-gap) 0 4px; }
    .image img, .image svg { max-width: 100%; height: auto; max-height: 160px; }
    .activity { text-align: center; font-size: 0.95rem; }
    @media (max-width: 360px) {
      .big { font-size: 2.1rem; }
      .lock-text { font-size: 0.9rem; }
    }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-hero': LeapmotorHero }
}
```

- [ ] **Step 7: Correr os testes, o typecheck e o build**

Run: `npm test && npm run typecheck && npm run build`
Expected: todos os testes PASS; `tsc` sem erros; `dist/leapmotor-card.js` gerado.

- [ ] **Step 8: Commit**

```bash
git add src/format.ts src/theme.ts src/car-silhouette.ts src/sections/hero.ts test/format.test.ts package.json
git commit -m "feat: add hero section with range bar, lock pill and vehicle image"
```

---

### Task 9: Ações e linha de botões

**Files:**
- Create: `src/actions.ts`, `src/sections/actions-row.ts`
- Test: `test/actions.test.ts`

**Interfaces:**
- Consumes: `EntityMap`, `ActionId`, `VehicleState`, `DEFAULT_ACTIONS` (Task 2); `HomeAssistant` (Task 2); `TranslateFn` (Task 7).
A grelha usa `grid-template-columns: repeat(var(--lm-cols), 1fr)` com
`--lm-cols` igual ao número de ações configuradas, pelo que funciona com
qualquer contagem; o defeito são as quatro da app.

- Produces:
  - `resolveAction(action: ActionId, state: VehicleState, map: EntityMap): ServiceCall | undefined`
  - `interface ServiceCall { domain: string; service: string; entityId: string; data?: Record<string, unknown> }`
  - `actionLabel(action: ActionId, state: VehicleState, t: TranslateFn): string`
  - `actionIcon(action: ActionId, state: VehicleState): string`
  - elemento `<leapmotor-actions-row>` com `state`, `t`, `map`, `actions: ActionId[]`, `pending?: ActionId`

- [ ] **Step 1: Escrever os testes**

`test/actions.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { actionIcon, actionLabel, resolveAction } from '../src/actions'
import { resolveEntities } from '../src/resolver'
import { buildVehicleState } from '../src/vehicle-state'
import { createTranslator } from '../src/localize'
import { REAL_NOW, realHass } from './fixtures/real-states'

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

  it('a cortina do teto não é alternante: são duas ações distintas', () => {
    const { map, state } = ctx()
    expect(resolveAction('openSunshade', state, map)?.entityId).toBe('button.leapmotor_b10_000000_demo_open_sunshade')
    expect(resolveAction('closeSunshade', state, map)?.entityId).toBe('button.leapmotor_b10_000000_demo_close_sunshade')
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

  it('devolve um ícone mdi para todas as ações', () => {
    const { state } = ctx()
    for (const a of ['unlock', 'lock', 'trunk', 'windows', 'climate', 'refresh'] as const) {
      expect(actionIcon(a, state), a).toMatch(/^mdi:/)
    }
  })
})
```

- [ ] **Step 2: Correr os testes para confirmar que falham**

Run: `npm test -- test/actions.test.ts`
Expected: FAIL — `Cannot find module '../src/actions'`.

- [ ] **Step 3: Escrever `src/actions.ts`**

```ts
import type { TranslateFn } from './localize'
import type { ActionId, EntityMap, VehicleState } from './types'
import type { LogicalKey } from './keys'

export interface ServiceCall {
  domain: string
  service: string
  entityId: string
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
  return Object.values(state.openings.windows)
    .some(w => w.open === true || (w.position !== undefined && w.position > 0))
}

export function resolveAction(action: ActionId, state: VehicleState, map: EntityMap): ServiceCall | undefined {
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
    case 'openSunshade': return press(map, 'openSunshade')
    case 'closeSunshade': return press(map, 'closeSunshade')
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
    case 'openSunshade': return 'mdi:window-shutter-open'
    case 'closeSunshade': return 'mdi:window-shutter'
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
  }
}

/** Ações que não devem ser possíveis com o carro em andamento. */
export const BLOCKED_WHILE_DRIVING: ActionId[] = ['unlock', 'lock', 'trunk', 'windows', 'openSunshade', 'closeSunshade']
```

- [ ] **Step 4: Escrever `src/sections/actions-row.ts`**

```ts
import { LitElement, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { BLOCKED_WHILE_DRIVING, actionIcon, actionLabel, resolveAction } from '../actions'
import type { TranslateFn } from '../localize'
import { sharedStyles } from '../theme'
import type { ActionId, EntityMap, VehicleState } from '../types'

@customElement('leapmotor-actions-row')
export class LeapmotorActionsRow extends LitElement {
  @property({ attribute: false }) state!: VehicleState
  @property({ attribute: false }) t!: TranslateFn
  @property({ attribute: false }) map!: EntityMap
  @property({ attribute: false }) actions: ActionId[] = []
  @property({ attribute: false }) pending?: ActionId

  private disabled(action: ActionId): boolean {
    if (!resolveAction(action, this.state, this.map)) return true
    if (this.state.activity === 'driving' && BLOCKED_WHILE_DRIVING.includes(action)) return true
    return this.pending !== undefined
  }

  private fire(action: ActionId) {
    this.dispatchEvent(new CustomEvent('leapmotor-action', {
      detail: { action }, bubbles: true, composed: true,
    }))
  }

  override render() {
    return html`<div class="grid" style="--lm-cols:${this.actions.length}">
      ${this.actions.map(action => html`
        <button
          class="plain"
          ?disabled=${this.disabled(action)}
          title=${actionLabel(action, this.state, this.t)}
          @click=${() => this.fire(action)}
        >
          <span class="circle ${this.pending === action ? 'busy' : ''}">
            <ha-icon icon=${actionIcon(action, this.state)}></ha-icon>
          </span>
          <span class="label">${actionLabel(action, this.state, this.t)}</span>
        </button>
      `)}
    </div>`
  }

  static override styles = [sharedStyles, css`
    .grid {
      display: grid;
      grid-template-columns: repeat(var(--lm-cols, 4), 1fr);
      gap: 8px; margin-top: var(--lm-gap);
    }
    .circle {
      display: grid; place-items: center;
      width: 56px; height: 56px; border-radius: 50%;
      background: var(--lm-chip);
      transition: background 120ms ease, transform 120ms ease;
    }
    button.plain:not([disabled]):active .circle { transform: scale(0.94); }
    .circle.busy { animation: pulse 900ms ease-in-out infinite; }
    @keyframes pulse { 50% { opacity: 0.45; } }
    .label { font-size: 0.78rem; text-align: center; line-height: 1.15; }
    @media (max-width: 360px) {
      .circle { width: 46px; height: 46px; }
      .label { font-size: 0.7rem; }
    }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-actions-row': LeapmotorActionsRow }
}
```

- [ ] **Step 5: Correr os testes, o typecheck e o build**

Run: `npm test && npm run typecheck && npm run build`
Expected: todos PASS.

- [ ] **Step 6: Commit**

```bash
git add src/actions.ts src/sections/actions-row.ts test/actions.test.ts
git commit -m "feat: map action ids to service calls and render the action row"
```

---

### Task 10: Secção de carregamento

**Files:**
- Create: `src/sections/charging.ts`

**Interfaces:**
- Consumes: `VehicleState` (Task 2); `TranslateFn`, `formatDuration`, `DASH` (Task 7); `formatNumber`, `formatTimeOfDay` (Task 8); `sharedStyles` (Task 8).
- Produces: elemento `<leapmotor-charging>` com `state`, `t`, `language`, `limitEditable: boolean`, `limitMin`, `limitMax`, `limitStep`. Emite `CustomEvent('leapmotor-set-charge-limit', { detail: { value: number } })`.

Sem testes unitários próprios: é render puro sobre um `VehicleState` já
testado nas Tasks 4–6. A verificação é o build e a Task 16.

- [ ] **Step 1: Escrever `src/sections/charging.ts`**

```ts
import { LitElement, css, html, nothing } from 'lit'
import { customElement, property, state as internalState } from 'lit/decorators.js'
import { formatNumber, formatTimeOfDay } from '../format'
import { DASH, formatDuration, type TranslateFn } from '../localize'
import { sharedStyles } from '../theme'
import type { VehicleState } from '../types'

@customElement('leapmotor-charging')
export class LeapmotorCharging extends LitElement {
  @property({ attribute: false }) state!: VehicleState
  @property({ attribute: false }) t!: TranslateFn
  @property({ type: String }) language = 'en'
  @property({ type: Boolean }) limitEditable = false
  @property({ type: Number }) limitMin = 50
  @property({ type: Number }) limitMax = 100
  @property({ type: Number }) limitStep = 5

  @internalState() private editing = false

  private phaseChip() {
    const c = this.state.charging
    if (c.phase === 'charging') return this.t(c.speed === 'fast' ? 'charging.fast' : 'charging.slow')
    if (c.phase === 'complete') return this.t('charging.complete')
    if (c.phase === 'plugged') return this.t('charging.plugged')
    if (c.phase === 'scheduled') {
      return this.t('charging.scheduled', {
        start: this.state.schedule.start ?? DASH,
        end: this.state.schedule.end ?? DASH,
      })
    }
    return this.t('charging.unplugged')
  }

  private timing() {
    const c = this.state.charging
    if (c.remainingMinutes !== undefined) {
      return this.t('charging.remaining', { duration: formatDuration(c.remainingMinutes, this.t) })
    }
    if (c.finishTime) return this.t('charging.finish', { time: formatTimeOfDay(c.finishTime, this.language) })
    return undefined
  }

  private metrics() {
    const c = this.state.charging
    if (c.phase !== 'charging') return nothing
    return html`<div class="metrics muted">${this.t('charging.metrics', {
      voltage: formatNumber(c.voltageV, 1),
      current: formatNumber(c.currentA, 1),
      power: formatNumber(c.powerKw, 1),
    })}</div>`
  }

  private onSlider(e: Event) {
    const value = Number((e.target as HTMLInputElement).value)
    this.dispatchEvent(new CustomEvent('leapmotor-set-charge-limit', {
      detail: { value }, bubbles: true, composed: true,
    }))
    this.editing = false
  }

  override render() {
    const { battery, chargeLimit } = this.state
    const timing = this.timing()
    return html`<div class="panel">
      <div class="row head">
        <div class="title">${this.t('charging.title', { percent: formatNumber(battery, battery !== undefined && !Number.isInteger(battery) ? 1 : 0) })}</div>
        ${this.limitEditable
          ? html`<button class="plain limit" @click=${() => { this.editing = !this.editing }}>
              <span>${this.t('charging.limit', { percent: formatNumber(chargeLimit) })}</span>
              <ha-icon icon=${this.editing ? 'mdi:chevron-up' : 'mdi:chevron-down'}></ha-icon>
            </button>`
          : html`<div class="limit muted">${this.t('charging.limit', { percent: formatNumber(chargeLimit) })}</div>`}
      </div>

      ${this.editing
        ? html`<input
            class="slider"
            type="range"
            min=${this.limitMin}
            max=${this.limitMax}
            step=${this.limitStep}
            .value=${String(chargeLimit ?? this.limitMax)}
            @change=${this.onSlider}
          />`
        : nothing}

      <div class="row status">
        <span class="chip"><ha-icon icon="mdi:lightning-bolt"></ha-icon>${this.phaseChip()}</span>
        ${timing ? html`<span class="timing muted">${timing}</span>` : nothing}
      </div>

      ${this.metrics()}
    </div>`
  }

  static override styles = [sharedStyles, css`
    .head { align-items: center; }
    .title { font-size: 1.05rem; font-weight: 600; }
    .limit { font-size: 0.95rem; display: flex; align-items: center; gap: 2px; }
    .status { align-items: center; margin-top: 10px; gap: 10px; flex-wrap: wrap; justify-content: flex-start; }
    .timing { font-size: 0.85rem; }
    .metrics { font-size: 0.78rem; margin-top: 8px; }
    .slider { width: 100%; margin-top: 12px; accent-color: var(--primary-color); }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-charging': LeapmotorCharging }
}
```

- [ ] **Step 2: Typecheck e build**

Run: `npm run typecheck && npm run build`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/sections/charging.ts
git commit -m "feat: add charging panel with editable charge limit"
```

---

### Task 11: Secção de tiles

**Files:**
- Create: `src/sections/tiles.ts`

**Interfaces:**
- Consumes: `VehicleState` (Task 2); `TranslateFn`, `DASH` (Task 7); `formatNumber` (Task 8).
- Produces: elemento `<leapmotor-tiles>` com `state`, `t`, `climateToggleable: boolean`. Emite `CustomEvent('leapmotor-action', { detail: { action: 'climate' } })`.

- [ ] **Step 1: Escrever `src/sections/tiles.ts`**

```ts
import { LitElement, css, html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { formatNumber } from '../format'
import { DASH, type TranslateFn } from '../localize'
import { sharedStyles } from '../theme'
import type { VehicleState } from '../types'

@customElement('leapmotor-tiles')
export class LeapmotorTiles extends LitElement {
  @property({ attribute: false }) state!: VehicleState
  @property({ attribute: false }) t!: TranslateFn
  @property({ type: Boolean }) climateToggleable = false

  private openingsSummary(): string {
    const { openCount } = this.state.openings
    if (openCount === 0) return this.t('tiles.all_closed')
    if (openCount === 1) return this.t('tiles.open_one')
    return this.t('tiles.open_count', { count: openCount })
  }

  private openingsDetail(): string {
    const o = this.state.openings
    const names: string[] = []
    if (Object.values(o.doors).some(d => d === true)) names.push(this.t('tiles.doors'))
    if (o.trunk) names.push(this.t('action.trunk_open'))
    if (o.roof) names.push(this.t('action.openSunshade'))
    const openWindows = Object.values(o.windows)
      .filter(w => w.open === true || (w.position !== undefined && w.position > 0)).length
    if (openWindows > 0) names.push(this.t('action.windows_open'))
    return names.join(' · ')
  }

  private toggleClimate() {
    if (!this.climateToggleable) return
    this.dispatchEvent(new CustomEvent('leapmotor-action', {
      detail: { action: 'climate' }, bubbles: true, composed: true,
    }))
  }

  override render() {
    const { climate } = this.state
    return html`<div class="tiles">
      <div class="tile">
        <div class="value">
          <span class="big">${formatNumber(climate.interiorC, 0)}</span>
          <span class="unit muted">°C</span>
        </div>
        <div class="caption muted">${this.t('tiles.interior')}</div>
        <div class="caption muted">
          ${climate.targetC !== undefined ? this.t('tiles.target', { temp: `${formatNumber(climate.targetC, 1)} °C` }) : DASH}
        </div>
        ${this.climateToggleable
          ? html`<button class="plain fab ${climate.on ? 'on' : ''}" @click=${this.toggleClimate} title=${this.t('action.climate')}>
              <ha-icon icon="mdi:fan"></ha-icon>
            </button>`
          : nothing}
      </div>

      <div class="tile">
        <div class="value"><span class="mid">${this.openingsSummary()}</span></div>
        <div class="caption muted">${this.t('tiles.openings')}</div>
        <div class="caption muted">${this.openingsDetail()}</div>
        <div class="fab static ${this.state.openings.openCount === 0 ? 'ok' : 'warn'}">
          <ha-icon icon=${this.state.openings.openCount === 0 ? 'mdi:car-door-lock' : 'mdi:car-door'}></ha-icon>
        </div>
      </div>
    </div>`
  }

  static override styles = [sharedStyles, css`
    .tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: var(--lm-gap); }
    .tile {
      position: relative; background: var(--lm-chip);
      border-radius: var(--lm-radius); padding: 14px; min-height: 116px;
    }
    .value { display: flex; align-items: baseline; gap: 4px; }
    .big { font-size: 2rem; font-weight: 300; line-height: 1; }
    .mid { font-size: 1.1rem; font-weight: 600; line-height: 1.2; }
    .unit { font-size: 0.85rem; }
    .caption { font-size: 0.75rem; margin-top: 4px; }
    .fab {
      position: absolute; inset-inline-end: 10px; inset-block-end: 10px;
      display: grid; place-items: center; width: 40px; height: 40px;
      border-radius: 50%; background: var(--card-background-color);
    }
    .fab.on { color: var(--primary-color); }
    .fab.warn { color: var(--leapmotor-battery-mid, #f5a623); }
    .fab.static { pointer-events: none; }
    @media (max-width: 400px) { .tiles { grid-template-columns: 1fr; } }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-tiles': LeapmotorTiles }
}
```

- [ ] **Step 2: Typecheck e build**

Run: `npm run typecheck && npm run build`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/sections/tiles.ts
git commit -m "feat: add interior temperature and openings tiles"
```

---

### Task 12: Elemento principal

**Files:**
- Modify: `src/leapmotor-card.ts` (substitui o esqueleto da Task 1)

**Interfaces:**
- Consumes: tudo das Tasks 2–11.
- Produces: elemento `<leapmotor-card>` registado em `customElements` e em `window.customCards`; `static getConfigElement()` e `static getStubConfig(hass)` para o editor da Task 15.

Primeiro entregável visível: depois desta task o card funciona no
dashboard com hero, linha de ações, carregamento e tiles.

- [ ] **Step 1: Escrever `src/leapmotor-card.ts`**

```ts
import { LitElement, css, html, nothing } from 'lit'
import { customElement, state as internalState } from 'lit/decorators.js'
import { actionLabel, resolveAction, type ServiceCall } from './actions'
import type { HassEntityDisplayEntry, HomeAssistant } from './ha-types'
import { createTranslator, pickLanguage, type TranslateFn } from './localize'
import { loadRegistryFallback, resolveEntities, type ResolveResult } from './resolver'
import { sharedStyles } from './theme'
import {
  DEFAULT_ACTIONS, DEFAULT_CONFIRM_ACTIONS, DEFAULT_SECTIONS,
  type ActionId, type LeapmotorCardConfig, type SectionId, type VehicleState,
} from './types'
import { attr, buildVehicleState } from './vehicle-state'

import './sections/hero'
import './sections/actions-row'
import './sections/charging'
import './sections/tiles'

export const CARD_VERSION = '0.1.0'

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

@customElement('leapmotor-card')
export class LeapmotorCard extends LitElement {
  @internalState() private _hass?: HomeAssistant
  @internalState() private _config?: LeapmotorCardConfig
  @internalState() private _pending?: ActionId
  @internalState() private _fallback?: HassEntityDisplayEntry[]

  private _fallbackRequested = false
  private _resolveCache?: { entities: unknown; config: unknown; fallback: unknown; result: ResolveResult }

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
  }

  public set hass(hass: HomeAssistant) {
    this._hass = hass
  }

  public getCardSize(): number {
    const s = this.sections()
    return 6 + (s.charging ? 2 : 0) + (s.tiles ? 3 : 0) + (s.tires ? 3 : 0)
      + (s.trip ? 2 : 0) + (s.comfort ? 3 : 0) + (s.schedule ? 2 : 0)
  }

  private sections(): Record<SectionId, boolean> {
    return { ...DEFAULT_SECTIONS, ...(this._config?.sections ?? {}) }
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

  private async callAction(action: ActionId, state: VehicleState, map: ResolveResult['map'], t: TranslateFn) {
    const call = resolveAction(action, state, map)
    if (!call || !this._hass) return

    const confirmList = this._config?.confirm_actions ?? DEFAULT_CONFIRM_ACTIONS
    if (confirmList.includes(action)) {
      // `actionLabel` e não `t(\`action.${action}\`)`: `trunk` e `windows` são
      // alternantes e as suas chaves são `action.trunk_open`/`action.trunk_close`
      // e `action.windows_open`/`action.windows_close`. A forma directa não tem
      // chave `action.trunk` nem `action.windows` e mostraria a chave crua.
      const label = actionLabel(action, state, t)
      if (!window.confirm(t('confirm', { action: label }))) return
    }

    this._pending = action
    try {
      await this.doCall(call)
    } finally {
      this._pending = undefined
    }
  }

  private async doCall(call: ServiceCall, extra?: Record<string, unknown>) {
    await this._hass!.callService(call.domain, call.service, { ...call.data, ...extra }, { entity_id: call.entityId })
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
    // Spec §6: no modo `entity` não há recurso à silhueta — o espaço fica vazio.
    const showImage = imageMode !== 'none' && !(imageMode === 'entity' && !imageUrl)

    const onAction = (e: CustomEvent<{ action: ActionId }>) => {
      void this.callAction(e.detail.action, state, map, t)
    }
    const onLimit = (e: CustomEvent<{ value: number }>) => {
      const call = resolveAction('setChargeLimit', state, map)
      if (call) void this.doCall(call, { value: e.detail.value })
    }

    return html`<ha-card @leapmotor-action=${onAction} @leapmotor-set-charge-limit=${onLimit}>
      <div class="body">
        <leapmotor-hero
          .state=${state} .t=${t} .now=${now} .name=${name}
          .language=${language} .imageUrl=${imageUrl}
          .showImage=${showImage}
        ></leapmotor-hero>

        <leapmotor-actions-row
          .state=${state} .t=${t} .map=${map} .actions=${actions} .pending=${this._pending}
        ></leapmotor-actions-row>

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
            ></leapmotor-tiles>`
          : nothing}
      </div>
    </ha-card>`
  }

  static override styles = [sharedStyles, css`
    ha-card { overflow: hidden; }
    .body { padding: var(--lm-gap); }
    .loading { color: var(--lm-muted); }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-card': LeapmotorCard }
}
```

- [ ] **Step 2: Typecheck, testes e build**

Run: `npm test && npm run typecheck && npm run build`
Expected: todos PASS; `dist/leapmotor-card.js` gerado.

- [ ] **Step 3: Confirmar que o bundle não puxou dependências inesperadas**

Run: `node --input-type=commonjs -e "const s=require('fs').readFileSync('dist/leapmotor-card.js','utf8');console.log('bytes',s.length);if(s.includes('custom-card-helpers'))throw new Error('bundle contém custom-card-helpers')"`
Expected: imprime o tamanho e não lança.

- [ ] **Step 4: Commit**

```bash
git add src/leapmotor-card.ts
git commit -m "feat: wire card element with resolver, view-model and sections"
```

---

### Task 13: Secções opcionais — pneus e viagem

**Files:**
- Create: `src/sections/tires.ts`, `src/sections/trip.ts`
- Modify: `src/leapmotor-card.ts` (importar e renderizar quando activas)

**Interfaces:**
- Consumes: `VehicleState` (Task 2); `TranslateFn`, `DASH` (Task 7); `formatNumber`, `sharedStyles` (Task 8).
- Produces: elementos `<leapmotor-tires>` e `<leapmotor-trip>`, ambos com `state` e `t`.

- [ ] **Step 1: Escrever `src/sections/tires.ts`**

```ts
import { LitElement, css, html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { formatNumber } from '../format'
import type { TranslateFn } from '../localize'
import { sharedStyles } from '../theme'
import type { VehicleState } from '../types'

const TIRE_MIN = 2.0
const TIRE_MAX = 2.6

/**
 * As abreviaturas dos cantos são traduzíveis, não glifos de unidade: em
 * português são FE/FD/TE/TD (frente/trás, esquerda/direita), não FL/FR/RL/RR.
 * A excepção de literais no render cobre só símbolos de unidade como `bar`.
 */
const CORNERS = [
  { key: 'fl', tk: 'tires.corner_fl' },
  { key: 'fr', tk: 'tires.corner_fr' },
  { key: 'rl', tk: 'tires.corner_rl' },
  { key: 'rr', tk: 'tires.corner_rr' },
] as const

@customElement('leapmotor-tires')
export class LeapmotorTires extends LitElement {
  @property({ attribute: false }) state!: VehicleState
  @property({ attribute: false }) t!: TranslateFn

  private outOfRange(v: number | undefined): boolean {
    return v !== undefined && (v < TIRE_MIN || v > TIRE_MAX)
  }

  override render() {
    const tires = this.state.tires
    const anyWarning = CORNERS.some(c => this.outOfRange(tires[c.key]))
    return html`<div class="panel">
      <div class="title">${this.t('tires.title')}</div>
      <div class="grid">
        ${CORNERS.map(c => html`
          <div class="corner ${this.outOfRange(tires[c.key]) ? 'warn' : ''}">
            <div class="pressure">${formatNumber(tires[c.key], 2)}</div>
            <div class="corner-label muted">${this.t(c.tk)} · bar</div>
          </div>
        `)}
      </div>
      ${anyWarning ? html`<div class="warning">${this.t('tires.warning')}</div>` : nothing}
    </div>`
  }

  static override styles = [sharedStyles, css`
    .title { font-size: 1.05rem; font-weight: 600; margin-bottom: 12px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .corner { background: var(--card-background-color); border-radius: 12px; padding: 10px 12px; }
    .corner.warn { color: var(--leapmotor-battery-mid, #f5a623); }
    .pressure { font-size: 1.3rem; font-weight: 500; }
    .corner-label { font-size: 0.72rem; }
    .warning { margin-top: 10px; font-size: 0.78rem; color: var(--leapmotor-battery-mid, #f5a623); }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-tires': LeapmotorTires }
}
```

- [ ] **Step 2: Escrever `src/sections/trip.ts`**

```ts
import { LitElement, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { formatNumber } from '../format'
import { DASH, type TranslateFn } from '../localize'
import { sharedStyles } from '../theme'
import type { VehicleState } from '../types'

@customElement('leapmotor-trip')
export class LeapmotorTrip extends LitElement {
  @property({ attribute: false }) state!: VehicleState
  @property({ attribute: false }) t!: TranslateFn

  override render() {
    const trip = this.state.trip
    const rows: { label: string; value: string }[] = [
      { label: this.t('trip.odometer'), value: trip.odometerKm !== undefined ? `${formatNumber(trip.odometerKm)} km` : DASH },
      {
        label: this.t('trip.last7days'),
        // Cada metade degrada por si. Gatilhar a linha toda só nos km fazia
        // desaparecer um kWh realmente disponível quando os km faltavam; o
        // `formatNumber` já devolve DASH por valor, logo só recaímos num único
        // travessão quando faltam ambos.
        value: trip.last7DaysKm === undefined && trip.last7DaysKwh === undefined
          ? DASH
          : `${formatNumber(trip.last7DaysKm)} km · ${formatNumber(trip.last7DaysKwh, 1)} kWh`,
      },
      { label: this.t('trip.consumption'), value: trip.avgConsumption !== undefined ? `${formatNumber(trip.avgConsumption, 1)} kWh/100 km` : DASH },
      { label: this.t('trip.total_energy'), value: trip.totalEnergyKwh !== undefined ? `${formatNumber(trip.totalEnergyKwh, 1)} kWh` : DASH },
    ]

    return html`<div class="panel">
      <div class="title">${this.t('trip.title')}</div>
      ${rows.map(r => html`<div class="line"><span class="muted">${r.label}</span><span>${r.value}</span></div>`)}
    </div>`
  }

  static override styles = [sharedStyles, css`
    .title { font-size: 1.05rem; font-weight: 600; margin-bottom: 8px; }
    .line { display: flex; justify-content: space-between; gap: 12px; padding: 5px 0; font-size: 0.9rem; }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-trip': LeapmotorTrip }
}
```

- [ ] **Step 3: Ligar as duas secções em `src/leapmotor-card.ts`**

Acrescentar aos imports:
```ts
import './sections/tires'
import './sections/trip'
```

E, dentro de `.body`, depois do bloco `sections.tiles`:
```ts
        ${sections.tires ? html`<leapmotor-tires .state=${state} .t=${t}></leapmotor-tires>` : nothing}
        ${sections.trip ? html`<leapmotor-trip .state=${state} .t=${t}></leapmotor-trip>` : nothing}
```

- [ ] **Step 4: Typecheck e build**

Run: `npm test && npm run typecheck && npm run build`
Expected: todos PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sections/tires.ts src/sections/trip.ts src/leapmotor-card.ts
git commit -m "feat: add optional tire pressure and trip sections"
```

---

### Task 14: Secções opcionais — conforto e agendamento, e aviso de entidades em falta

**Files:**
- Create: `src/sections/comfort.ts`, `src/sections/schedule.ts`
- Modify: `src/leapmotor-card.ts`

**Interfaces:**
- Consumes: tudo das tasks anteriores; `LogicalKey` (Task 2).
- Produces:
  - `<leapmotor-comfort>` com `state`, `t`, `map`. Emite `leapmotor-action` (switches) e `CustomEvent('leapmotor-set-number', { detail: { key: LogicalKey; value: number } })`.
  - `<leapmotor-schedule>` com `state`, `t`, `map`. Emite `CustomEvent('leapmotor-set-switch', { detail: { key: 'scheduleSwitch'; on: boolean } })`.
  - Em `leapmotor-card.ts`: handler de `leapmotor-set-number`, handler de `leapmotor-set-switch`, e o aviso de entidades em falta nas secções activas.

- [ ] **Step 1: Escrever `src/sections/comfort.ts`**

```ts
import { LitElement, css, html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import type { LogicalKey } from '../keys'
import type { TranslateFn } from '../localize'
import { sharedStyles } from '../theme'
import type { ActionId, EntityMap, VehicleState } from '../types'

interface LevelRow { key: LogicalKey; label: string; value: number | undefined; icon: string }

@customElement('leapmotor-comfort')
export class LeapmotorComfort extends LitElement {
  @property({ attribute: false }) state!: VehicleState
  @property({ attribute: false }) t!: TranslateFn
  @property({ attribute: false }) map!: EntityMap
  /** Nível máximo, lido do atributo `max` das entidades number. */
  @property({ type: Number }) maxLevel = 3

  private setNumber(key: LogicalKey, value: number) {
    this.dispatchEvent(new CustomEvent('leapmotor-set-number', {
      detail: { key, value }, bubbles: true, composed: true,
    }))
  }

  private fireAction(action: ActionId) {
    this.dispatchEvent(new CustomEvent('leapmotor-action', {
      detail: { action }, bubbles: true, composed: true,
    }))
  }

  private levelRow(row: LevelRow) {
    if (!this.map[row.key]) return nothing
    return html`<div class="line">
      <span class="muted"><ha-icon icon=${row.icon}></ha-icon> ${row.label}</span>
      <span class="steps">
        ${Array.from({ length: this.maxLevel + 1 }, (_, level) => level).map(level => html`
          <button
            class="plain step ${row.value === level ? 'active' : ''}"
            @click=${() => this.setNumber(row.key, level)}
            title="${row.label} ${level}"
          >${level === 0 ? '·' : level}</button>
        `)}
      </span>
    </div>`
  }

  private toggleRow(action: ActionId, key: LogicalKey, label: string, on: boolean | undefined, icon: string) {
    if (!this.map[key]) return nothing
    return html`<div class="line">
      <span class="muted"><ha-icon icon=${icon}></ha-icon> ${label}</span>
      <button class="plain toggle ${on ? 'on' : ''}" @click=${() => this.fireAction(action)}>
        <ha-icon icon=${on ? 'mdi:toggle-switch' : 'mdi:toggle-switch-off-outline'}></ha-icon>
      </button>
    </div>`
  }

  override render() {
    const c = this.state.comfort
    const wheelSuffix = c.steeringWheelHeat && c.steeringWheelHeatRemaining !== undefined
      ? ` · ${this.t('comfort.remaining', { minutes: c.steeringWheelHeatRemaining })}`
      : ''

    return html`<div class="panel">
      <div class="title">${this.t('comfort.title')}</div>
      ${this.levelRow({ key: 'driverSeatHeat', label: `${this.t('comfort.driver_seat')} · ${this.t('comfort.heating')}`, value: c.driverSeatHeat, icon: 'mdi:car-seat-heater' })}
      ${this.levelRow({ key: 'driverSeatVent', label: `${this.t('comfort.driver_seat')} · ${this.t('comfort.ventilation')}`, value: c.driverSeatVent, icon: 'mdi:car-seat-cooler' })}
      ${this.levelRow({ key: 'passengerSeatHeat', label: `${this.t('comfort.passenger_seat')} · ${this.t('comfort.heating')}`, value: c.passengerSeatHeat, icon: 'mdi:car-seat-heater' })}
      ${this.levelRow({ key: 'passengerSeatVent', label: `${this.t('comfort.passenger_seat')} · ${this.t('comfort.ventilation')}`, value: c.passengerSeatVent, icon: 'mdi:car-seat-cooler' })}
      ${this.toggleRow('steeringWheelHeat', 'steeringWheelHeat', `${this.t('comfort.steering_wheel')}${wheelSuffix}`, c.steeringWheelHeat, 'mdi:steering')}
      ${this.toggleRow('mirrorHeat', 'mirrorHeat', this.t('comfort.mirrors'), c.mirrorHeat, 'mdi:car-side')}
      ${this.toggleRow('batteryPreheat', 'batteryPreheat', this.t('comfort.battery_preheat'), c.batteryPreheat, 'mdi:battery-heart-variant')}
    </div>`
  }

  static override styles = [sharedStyles, css`
    .title { font-size: 1.05rem; font-weight: 600; margin-bottom: 8px; }
    .line { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 6px 0; font-size: 0.88rem; }
    .steps { display: flex; gap: 6px; }
    .step {
      width: 28px; height: 28px; border-radius: 50%;
      display: grid; place-items: center; background: var(--card-background-color); font-size: 0.8rem;
    }
    .step.active { background: var(--primary-color); color: var(--text-primary-color, #fff); }
    .toggle.on { color: var(--primary-color); }
    ha-icon { --mdc-icon-size: 18px; vertical-align: -3px; }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-comfort': LeapmotorComfort }
}
```

- [ ] **Step 2: Escrever `src/sections/schedule.ts`**

```ts
import { LitElement, css, html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { DASH, type TranslateFn } from '../localize'
import { sharedStyles } from '../theme'
import type { EntityMap, VehicleState } from '../types'

@customElement('leapmotor-schedule')
export class LeapmotorSchedule extends LitElement {
  @property({ attribute: false }) state!: VehicleState
  @property({ attribute: false }) t!: TranslateFn
  @property({ attribute: false }) map!: EntityMap

  private toggle() {
    this.dispatchEvent(new CustomEvent('leapmotor-set-switch', {
      detail: { key: 'scheduleSwitch', on: !this.state.schedule.enabled },
      bubbles: true, composed: true,
    }))
  }

  override render() {
    const s = this.state.schedule
    return html`<div class="panel">
      <div class="row head">
        <div class="title">${this.t('schedule.title')}</div>
        ${this.map.scheduleSwitch
          ? html`<button class="plain toggle ${s.enabled ? 'on' : ''}" @click=${this.toggle}>
              <ha-icon icon=${s.enabled ? 'mdi:toggle-switch' : 'mdi:toggle-switch-off-outline'}></ha-icon>
            </button>`
          : nothing}
      </div>
      <div class="window">
        ${s.start && s.end ? this.t('schedule.window', { start: s.start, end: s.end }) : DASH}
      </div>
      <div class="flags muted">
        ${s.enabled === false ? html`<span class="chip">${this.t('schedule.disabled')}</span>` : nothing}
        ${s.weekly ? html`<span class="chip">${this.t('schedule.weekly')}</span>` : nothing}
        ${s.cancelledOnce ? html`<span class="chip">${this.t('schedule.cancelled_once')}</span>` : nothing}
      </div>
    </div>`
  }

  static override styles = [sharedStyles, css`
    .head { align-items: center; }
    .title { font-size: 1.05rem; font-weight: 600; }
    .window { font-size: 1.2rem; margin: 8px 0; }
    .flags { display: flex; flex-wrap: wrap; gap: 6px; font-size: 0.75rem; }
    .toggle.on { color: var(--primary-color); }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-schedule': LeapmotorSchedule }
}
```

- [ ] **Step 3: Ligar as secções e os novos handlers em `src/leapmotor-card.ts`**

Acrescentar aos imports:
```ts
import './sections/comfort'
import './sections/schedule'
import type { LogicalKey } from './keys'
```

Acrescentar os handlers dentro de `render()`, junto de `onAction`:
```ts
    const onSetNumber = (e: CustomEvent<{ key: LogicalKey; value: number }>) => {
      const entityId = map[e.detail.key]
      if (entityId && this._hass) {
        void this._hass.callService('number', 'set_value', { value: e.detail.value }, { entity_id: entityId })
      }
    }
    const onSetSwitch = (e: CustomEvent<{ key: LogicalKey; on: boolean }>) => {
      const entityId = map[e.detail.key]
      if (entityId && this._hass) {
        void this._hass.callService('switch', e.detail.on ? 'turn_on' : 'turn_off', {}, { entity_id: entityId })
      }
    }
```

Registar os listeners no `<ha-card>`:
```ts
    return html`<ha-card
      @leapmotor-action=${onAction}
      @leapmotor-set-charge-limit=${onLimit}
      @leapmotor-set-number=${onSetNumber}
      @leapmotor-set-switch=${onSetSwitch}
    >
```

E renderizar as duas secções depois de `sections.trip`:
```ts
        ${sections.comfort
          ? html`<leapmotor-comfort
              .state=${state} .t=${t} .map=${map}
              .maxLevel=${attr<number>(hass, map, 'driverSeatHeat', 'max') ?? 3}
            ></leapmotor-comfort>`
          : nothing}
        ${sections.schedule ? html`<leapmotor-schedule .state=${state} .t=${t} .map=${map}></leapmotor-schedule>` : nothing}
```

- [ ] **Step 4: Implementar o aviso de entidades em falta**

Spec §8: uma secção activa com entidades em falta continua a renderizar,
com um aviso discreto. Acrescentar a `leapmotor-card.ts` o mapa de chaves
por secção e o aviso.

Antes da classe:
```ts
const SECTION_KEYS: Record<SectionId | 'core', LogicalKey[]> = {
  core: ['battery', 'lock'],
  charging: ['chargeLimit', 'isCharging', 'isPluggedIn'],
  tiles: ['interiorTemp', 'trunk'],
  tires: ['tireFL', 'tireFR', 'tireRL', 'tireRR'],
  trip: ['odometer', 'last7DaysKm'],
  comfort: ['driverSeatHeat', 'steeringWheelHeat'],
  schedule: ['scheduleStart', 'scheduleEnd'],
}
```

Método na classe:
```ts
  private missingForActiveSections(result: ResolveResult): LogicalKey[] {
    const sections = this.sections()
    const wanted = [
      ...SECTION_KEYS.core,
      ...(Object.keys(sections) as SectionId[]).filter(s => sections[s]).flatMap(s => SECTION_KEYS[s]),
    ]
    return result.missing.filter(k => wanted.includes(k))
  }
```

E no fim do `.body`, depois das secções:
```ts
        ${(() => {
          const missing = this.missingForActiveSections(result)
          return missing.length === 0
            ? nothing
            : html`<div class="missing muted" title=${t('missing_entity', { keys: missing.join(', ') })}>
                <ha-icon icon="mdi:alert-outline"></ha-icon>
                ${t('missing_entity', { keys: String(missing.length) })}
              </div>`
        })()}
```

Acrescentar ao `static styles`:
```ts
    .missing { display: flex; align-items: center; gap: 6px; margin-top: 12px; font-size: 0.75rem; }
    .missing ha-icon { --mdc-icon-size: 16px; }
```

- [ ] **Step 5: Typecheck, testes e build**

Run: `npm test && npm run typecheck && npm run build`
Expected: todos PASS.

- [ ] **Step 6: Commit**

```bash
git add src/sections/comfort.ts src/sections/schedule.ts src/leapmotor-card.ts
git commit -m "feat: add comfort and schedule sections plus missing entity warning"
```

---

### Task 15: Editor visual

**Files:**
- Create: `src/leapmotor-card-editor.ts`

**Interfaces:**
- Consumes: `LeapmotorCardConfig`, `SectionId`, `ActionId`, `DEFAULT_ACTIONS`, `DEFAULT_SECTIONS` (Task 2); `HomeAssistant` (Task 2); `createTranslator`, `pickLanguage` (Task 7).
- Produces: elemento `<leapmotor-card-editor>`, devolvido por `LeapmotorCard.getConfigElement()` (já implementado na Task 12).

- [ ] **Step 1: Escrever `src/leapmotor-card-editor.ts`**

```ts
import { LitElement, html, nothing } from 'lit'
import { customElement, property, state as internalState } from 'lit/decorators.js'
import type { HomeAssistant } from './ha-types'
import { createTranslator, pickLanguage } from './localize'
import { DEFAULT_ACTIONS, DEFAULT_SECTIONS, type ActionId, type LeapmotorCardConfig, type SectionId } from './types'

/**
 * As 13 ações que fazem sentido como botão na linha de acções. As outras 4 de
 * `ActionId` são deliberadamente omitidas porque vivem noutro sítio da UI:
 * `steeringWheelHeat`, `mirrorHeat` e `batteryPreheat` são interruptores da
 * secção de conforto, e `setChargeLimit` é o slider do painel de carregamento.
 */
const ALL_ACTIONS: ActionId[] = [
  'unlock', 'lock', 'trunk', 'windows', 'openSunshade', 'closeSunshade',
  'quickCool', 'quickHeat', 'defrost', 'findVehicle', 'unlockCharger', 'refresh', 'climate',
]

const SECTION_IDS: SectionId[] = ['charging', 'tiles', 'tires', 'trip', 'comfort', 'schedule']

/**
 * `trunk` e `windows` são alternantes e não têm chave `action.trunk` nem
 * `action.windows` — as chaves reais são `action.trunk_open`/`_close` e
 * `action.windows_open`/`_close`. No editor mostramos a forma de abrir, que é
 * o rótulo que a app usa. Sem este mapa, `t('action.trunk')` devolveria a
 * própria chave e o dropdown mostraria "action.trunk".
 */
const ACTION_LABEL_KEY: Partial<Record<ActionId, string>> = {
  trunk: 'action.trunk_open',
  windows: 'action.windows_open',
}

function actionOptionLabel(t: (k: string) => string, a: ActionId): string {
  return t(ACTION_LABEL_KEY[a] ?? `action.${a}`)
}

@customElement('leapmotor-card-editor')
export class LeapmotorCardEditor extends LitElement {
  @internalState() private _config?: LeapmotorCardConfig
  @property({ attribute: false }) public hass?: HomeAssistant

  public setConfig(config: LeapmotorCardConfig): void {
    this._config = { ...config }
  }

  private schema(t: (k: string) => string) {
    return [
      { name: 'device', selector: { device: { integration: 'leapmotor' } } },
      { name: 'name', selector: { text: {} } },
      {
        name: 'language',
        // Os nomes das línguas ficam no próprio idioma, por convenção de
        // selectores de idioma — «Português» não se traduz para inglês. Só a
        // opção automática passa por `t()`.
        selector: { select: { mode: 'dropdown', options: [
          { value: '', label: t('editor.language_auto') },
          { value: 'pt', label: 'Português' },
          { value: 'en', label: 'English' },
        ] } },
      },
      {
        name: 'image',
        selector: { select: { mode: 'dropdown', custom_value: true, options: [
          { value: 'auto', label: t('editor.image_auto') },
          { value: 'entity', label: t('editor.image_entity') },
          { value: 'none', label: t('editor.image_none') },
        ] } },
      },
      {
        name: 'actions',
        selector: { select: { multiple: true, mode: 'list', options: ALL_ACTIONS.map(a => ({ value: a, label: actionOptionLabel(t, a) })) } },
      },
      {
        name: 'confirm_actions',
        selector: { select: { multiple: true, mode: 'dropdown', options: ALL_ACTIONS.map(a => ({ value: a, label: actionOptionLabel(t, a) })) } },
      },
      {
        type: 'expandable',
        name: 'sections',
        schema: SECTION_IDS.map(id => ({ name: id, selector: { boolean: {} } })),
      },
    ]
  }

  private valueChanged(e: CustomEvent<{ value: Record<string, unknown> }>) {
    const raw = { ...e.detail.value }
    if (raw.language === '') delete raw.language
    // NÃO apagar um `actions` vazio. `leapmotor-card.ts` faz
    // `config.actions ?? DEFAULT_ACTIONS`, e `??` só recai em undefined, não em
    // `[]`. Apagar a chave faria reaparecer os quatro botões por defeito
    // exactamente quando o utilizador acabou de os limpar para esconder a linha.
    // O `confirm_actions` já preserva o array vazio, e a assimetria era um bug.
    const config = { type: 'custom:leapmotor-card', ...raw } as LeapmotorCardConfig
    this._config = config
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config }, bubbles: true, composed: true }))
  }

  override render() {
    if (!this._config || !this.hass) return nothing
    const language = pickLanguage(this._config.language, this.hass.locale?.language)
    const t = createTranslator(language)

    const data = {
      image: 'auto',
      actions: DEFAULT_ACTIONS,
      ...this._config,
      sections: { ...DEFAULT_SECTIONS, ...(this._config.sections ?? {}) },
    }

    return html`<ha-form
      .hass=${this.hass}
      .data=${data}
      .schema=${this.schema(t)}
      .computeLabel=${(s: { name: string }) => s.name}
      @value-changed=${this.valueChanged}
    ></ha-form>`
  }
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-card-editor': LeapmotorCardEditor }
}
```

- [ ] **Step 2: Confirmar que o editor entra no bundle**

O `getConfigElement` da Task 12 usa `await import('./leapmotor-card-editor')`,
e o `rollup.config.mjs` tem `inlineDynamicImports: true`, logo o editor vai
para o mesmo ficheiro.

Run: `npm run build && node --input-type=commonjs -e "const s=require('fs').readFileSync('dist/leapmotor-card.js','utf8');if(!s.includes('leapmotor-card-editor'))throw new Error('editor não está no bundle');console.log('editor no bundle, bytes',s.length)"`
Expected: imprime a confirmação.

- [ ] **Step 3: Typecheck e testes**

Run: `npm test && npm run typecheck`
Expected: todos PASS.

- [ ] **Step 4: Commit**

```bash
git add src/leapmotor-card-editor.ts
git commit -m "feat: add visual editor with device picker and section toggles"
```

---

### Task 16: Documentação, metadados de HACS e verificação no Home Assistant

**Files:**
- Create: `README.md`, `.github/workflows/build.yml`
- Modify: `hacs.json` (confirmar `filename`)

**Interfaces:**
- Consumes: o card completo das Tasks 1–15.
- Produces: repositório instalável por HACS e o card verificado a correr no Home Assistant do utilizador.

- [ ] **Step 1: Escrever `README.md` (em inglês)**

Secções obrigatórias, nesta ordem:

1. Título, uma frase de descrição e uma captura de ecrã do card. Não
   incluir a captura da app oficial da Leapmotor no repositório.
2. **Requirements**: Home Assistant 2026.8 ou superior, e a integração
   [kerniger/leapmotor-ha](https://github.com/kerniger/leapmotor-ha)
   já configurada.
3. **Installation — HACS**: adicionar como custom repository do tipo
   Lovelace, instalar, e o recurso é registado pelo HACS. Dizer
   explicitamente que a instalação por HACS exige uma **release com tag**,
   porque `dist/` não está versionado e o ficheiro chega como asset da
   release.
4. **Installation — manual**: copiar `dist/leapmotor-card.js` para
   `config/www/leapmotor-card/` e registar o recurso em
   *Settings → Dashboards → Resources* como
   `/local/leapmotor-card/leapmotor-card.js`, tipo *JavaScript module*.
5. **Configuration**: a tabela de opções e o YAML mínimo:

   ```yaml
   type: custom:leapmotor-card
   ```

   E o exemplo completo, com todas as opções da spec §5.
6. **Entity overrides**: explicar que o card mapeia por `translation_key`
   e listar os nomes lógicos disponíveis para `entities:`, gerados a
   partir de `src/keys.ts`.
7. **Development**: `npm install`, `npm run build`, `npm test`,
   `npm run watch`.
8. **License**: GNU GPL v3 or later. Incluir a linha de copyright
   `Copyright (C) 2026 Fernando A. P. Gomes` e a ligação para o `LICENSE`.

- [ ] **Step 2: Escrever `.github/workflows/build.yml`**

```yaml
name: build

on:
  push:
    # `tags` é obrigatório: sem ele o workflow não corre num push de tag, e o
    # job `release`, que depende de `refs/tags/v*`, nunca dispara — deixando o
    # repositório sem asset e portanto não instalável por HACS.
    branches: [main]
    tags: ['v*']
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run build

  release:
    # `dist/` está no .gitignore, logo o ficheiro não existe na árvore do repo.
    # O HACS resolve o `filename` do hacs.json primeiro a partir de um asset de
    # release e só depois da árvore: sem este job, nenhuma das duas vias tem o
    # ficheiro e o repositório não é instalável.
    if: startsWith(github.ref, 'refs/tags/v')
    needs: build
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: softprops/action-gh-release@v2
        with:
          files: dist/leapmotor-card.js
```

Nota: isto é um workflow do GitHub Actions, não GitLab CI. A regra de
`[skip ci]` das diretivas globais aplica-se a repositórios com
`.gitlab-ci.yml`, que não é o caso — as mensagens de commit continuam sem
`[skip ci]`.

- [ ] **Step 3: Commit da documentação**

```bash
git add README.md .github/workflows/build.yml hacs.json
git commit -m "docs: add README and CI build workflow"
```

- [ ] **Step 4: Pedir autorização antes de tocar no Home Assistant**

Perguntar ao utilizador antes de escrever em `/config`. Até aqui todas as
operações no HA foram leituras. Não avançar sem resposta afirmativa.

- [ ] **Step 5: Instalar o card no Home Assistant**

Depois da autorização:
```bash
npm run build
ssh ha 'mkdir -p /config/www/leapmotor-card'
scp dist/leapmotor-card.js ha:/config/www/leapmotor-card/leapmotor-card.js
```

Registar o recurso em *Settings → Dashboards → three-dot menu →
Resources*: URL `/local/leapmotor-card/leapmotor-card.js`, tipo
*JavaScript module*. Isto é feito pelo utilizador na interface.

- [ ] **Step 6: Verificar no dashboard**

Acrescentar o card a um dashboard com a configuração mínima:
```yaml
type: custom:leapmotor-card
```

Confirmar, contra o Home Assistant real:
- o nome aparece como `Leapmotor B10 000000 (Demo)`;
- a autonomia mostra o valor de `live_range`, não o de `range`;
- a barra tem os dois segmentos, com o segundo a terminar nos 80 %;
- o estado das trancas aparece esbatido, com a idade — o sistema está em
  `cloud_stale` com quase 3 h e 20 min;
- a etiqueta de atividade diz «Estacionado», apesar de
  `sensor.vehicle_state` estar `unknown`;
- o painel de carregamento diz «Sem cabo» e **não** mostra tempo
  restante, porque `remaining_charge_time` está `unavailable`;
- os tiles mostram 24 °C e «Todos fechados»;
- os quatro botões estão activos e a linha não transborda a 320 px;
- o editor visual abre e o seletor de device lista o veículo;
- **a cache de resolução não fica presa**: renomear o device no HA, ou
  reactivar uma entidade, e confirmar que o card reflecte a mudança sem
  recarregar a página. A memoização assenta na identidade dos objectos
  `hass.entities`/`hass.devices`, que é convenção do frontend do HA mas não
  se pode verificar a partir do código;
- o card renderiza corretamente em tema claro e escuro.

- [ ] **Step 7: Reportar os resultados**

Registar o que foi confirmado e o que falhou. Qualquer divergência é uma
correção nova, com o seu próprio ciclo de teste — não a esconder no
commit de documentação.

---

## Notas de execução

- Todos os `entity_id` da fixture pertencem ao Home Assistant do
  utilizador a 2026-08-27. Se a integração for atualizada e mudar
  `translation_key`, os testes de `resolver` e `vehicle-state` falham
  primeiro — é o comportamento pretendido.
- Os testes correm com `TZ=UTC`. Não remover essa variável dos scripts:
  os testes de formatação de hora dependem dela.
- As secções não têm testes unitários próprios. A rede de segurança é o
  `VehicleState` testado a fundo mais a verificação manual da Task 16.
  Se uma secção crescer em lógica, extrair essa lógica para um módulo
  puro e testá-la lá.
