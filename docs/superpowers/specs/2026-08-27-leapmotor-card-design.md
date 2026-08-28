# Leapmotor Card — design

Data: 2026-08-27
Estado: aprovado

## 1. Objetivo

Um custom card de Lovelace que replica o ecrã principal da app Leapmotor
para um veículo B10, sobre a integração `custom_components/leapmotor`
(kerniger/leapmotor-ha). Distribuível por HACS, utilizável por qualquer
dono de um Leapmotor sem editar entity_ids à mão.

Referência visual: captura da app (B10 Demo) — autonomia com barra,
estado das trancas, imagem do veículo, estado de condução, linha de
quatro ações, painel de carregamento, dois tiles inferiores.

## 2. Contexto verificado

Levantado por SSH no Home Assistant do utilizador (só leituras):

- Home Assistant **2026.8.3** (HA OS, qemux86-64).
- Integração `leapmotor` **0.6.35**, **121 entidades**, todas no mesmo
  device `0123456789abcdef0123456789abcdef`
  (`name_by_user`: `Leapmotor B10 000000 (Demo)`, modelo `B10`,
  identificador `['leapmotor', 'LFZA0000000000000']`).
- **Todas as 121 entidades têm `translation_key`**, o que dá uma chave
  de mapeamento estável e imune a renomeações de `entity_id`.
- O WebSocket `config/entity_registry/list_for_display` devolve os campos
  `ei` (entity_id), `di` (device_id), `pl` (platform) e `tk`
  (translation_key). É esta a fonte de `hass.entities` no frontend, logo
  **o resolver não precisa de fazer chamadas WebSocket** no caminho normal.
- `hass.devices[id]` fornece `name`, `name_by_user`, `model`,
  `manufacturer` — suficiente para o título do card.

Observações sobre os dados reais que condicionam o design:

- `sensor/vehicle_state` está `unknown`. O estado de atividade tem de ser
  derivado de outros sensores.
- `sensor/lock_state_source` = `cloud_stale` com
  `lock_state_age_seconds` = 11930. O card não pode apresentar o estado
  das trancas como se fosse fresco.
- `sensor/remaining_charge_minutes` e `sensor/charging_finish_time` estão
  `unavailable` quando o carro não está a carregar.
- Os dois sensores de autonomia `live_remaining_range_km` e
  `wltp_max_range_km` têm `entity_id` com prefixo diferente
  (`..._main_...`), o que exclui qualquer abordagem por concatenação de
  prefixo.

## 3. Decisões de âmbito

| Decisão | Escolha |
|---|---|
| Formato | Custom card em JS (web component), não YAML |
| Âmbito | O que está na captura, mais secções extra opcionais (off por defeito) |
| Descoberta de entidades | Automática por device, com overrides no YAML |
| Idioma | PT + EN, segue `hass.locale.language`, com override na config |
| Toolchain | TypeScript + Rollup + Lit |
| Arquitetura interna | View-model normalizado com sub-elementos por secção |

Rejeitado explicitamente (YAGNI): motor genérico de secções por schema;
suporte a VIN na config (`DeviceRegistryDisplayEntry` não expõe
`identifiers`, obrigaria a uma chamada WebSocket só para isso); tile
"Chave por Bluetooth" da app (sem equivalente em Home Assistant).

## 4. Arquitetura

Três camadas com fronteiras explícitas. As camadas 1 e 2 não tocam no
DOM; a camada 3 não toca no `hass`.

```
hass ──► resolver.ts ──► EntityMap ──► vehicle-state.ts ──► VehicleState ──► sections/*
         (camada 1)                    (camada 2, puro)                      (camada 3)
                                                                                 │
                          hass.callService ◄── actions.ts ◄── leapmotor-action ◄─┘
```

O elemento principal `leapmotor-card.ts` é o único que conhece `hass`:
resolve, constrói o view-model, distribui-o pelas secções e executa as
ações que elas pedem.

### 4.1 `keys.ts` — catálogo

Mapa de nome lógico para `{ domain, tk }`. É a única lista de
`translation_key` no projeto e a fonte do tipo `LogicalKey`.

Hero e identidade: `battery` (`sensor/battery_percent`), `batteryPrecise`
(`sensor/battery_percent_precise`), `range` (`sensor/remaining_range_km`),
`rangeLive` (`sensor/live_remaining_range_km`), `rangeMax`
(`sensor/wltp_max_range_km`), `rangeMode` (`sensor/range_mode`),
`lastVehicleUpdate` (`sensor/last_vehicle_update`), `lastCloudRefresh`
(`sensor/last_successful_refresh`), `vehiclePicture`
(`image/vehicle_picture`).

Trancas: `lock` (`lock/vehicle_lock`), `lockStateSource`
(`sensor/lock_state_source`), `lockStateAge`
(`sensor/lock_state_age_seconds`).

Atividade: `vehicleState` (`sensor/vehicle_state`), `gear`
(`sensor/gear`), `speed` (`sensor/speed_kmh`), `isDriving`
(`binary_sensor/is_driving`), `parkingBrake`
(`binary_sensor/parking_brake_active`), `vehicleReady`
(`binary_sensor/vehicle_ready`).

Carregamento: `chargeLimit` (`sensor/charge_limit_percent`),
`chargeLimitSet` (`number/charge_limit_setting`), `isCharging`
(`binary_sensor/is_charging`), `isPluggedIn`
(`binary_sensor/is_plugged_in`), `dcCableConnected`
(`binary_sensor/dc_cable_connected`), `fullyCharged`
(`binary_sensor/fully_charged`), `chargingConnection`
(`sensor/charging_connection_state`), `chargingPower`
(`sensor/charging_power_kw`), `chargingVoltage`
(`sensor/charging_voltage_v`), `chargingCurrent`
(`sensor/charging_current_a`), `remainingChargeMinutes`
(`sensor/remaining_charge_minutes`), `chargingFinishTime`
(`sensor/charging_finish_time`), `schedulePlanned`
(`binary_sensor/charging_planned_enabled`), `unlockCharger`
(`button/unlock_charger`).

Aberturas: `doorDriver` (`binary_sensor/driver_door_open`),
`doorPassenger` (`binary_sensor/passenger_door_open`), `doorRearLeft`
(`binary_sensor/rear_left_door_open`), `doorRearRight`
(`binary_sensor/rear_right_door_open`), `windowFL`/`windowFR`/`windowRL`/
`windowRR` (`binary_sensor/{front_left,front_right,rear_left,rear_right}_window_open`),
`windowPosFL`/`windowPosFR`/`windowPosRL`/`windowPosRR`
(`sensor/{...}_window_position_percent`), `trunk`
(`binary_sensor/trunk_open`), `roof` (`binary_sensor/skylight_open`).

Clima: `climateSwitch` (`switch/climate_control`), `climateOn`
(`binary_sensor/climate_on`), `interiorTemp` (`sensor/interior_temp_c`),
`targetTemp` (`sensor/climate_set_temp_left_c`), `climateMode`
(`sensor/climate_mode`).

Botões: `openTrunk`/`closeTrunk`, `openWindows`/`closeWindows`,
`openSunshade`/`closeSunshade`, `quickCool`, `quickHeat`,
`windshieldDefrost`, `findVehicle`, `refreshData` — todos em `button/`
com o `translation_key` homónimo.

Pneus: `tireFL`/`tireFR`/`tireRL`/`tireRR`
(`sensor/tire_pressure_{front_left,front_right,rear_left,rear_right}_bar`).

Viagem: `odometer` (`sensor/odometer_km`), `totalMileage`
(`sensor/total_mileage_km`), `last7DaysKm`
(`sensor/last_7_days_mileage_km`), `last7DaysKwh`
(`sensor/last_7_days_energy_kwh`), `avgConsumption6w`
(`sensor/average_consumption_6w_kwh_100km`), `totalEnergy`
(`sensor/total_energy_kwh`).

Conforto: `driverSeatHeat`/`driverSeatVent`/`passengerSeatHeat`/
`passengerSeatVent` (`number/...`), `steeringWheelHeat`
(`switch/steering_wheel_heat`), `steeringWheelHeatRemaining`
(`sensor/steering_wheel_heating_remaining_minutes`), `mirrorHeat`
(`switch/rearview_mirror_heat`), `batteryPreheat`
(`switch/battery_preheat`).

Agendamento: `scheduleSwitch` (`switch/charging_schedule`),
`scheduleStart` (`sensor/charging_planned_start`), `scheduleEnd`
(`sensor/charging_planned_end`), `scheduleRecurrence`
(`sensor/charging_planned_circulation`), `scheduleWeekly`
(`binary_sensor/charging_planned_weekly`), `scheduleCancelledOnce`
(`binary_sensor/charging_schedule_cancelled_once`).

Toda a chave do catálogo é consumida por um campo de `VehicleState` ou
por uma ação. Chaves sem consumidor não entram no catálogo.

### 4.2 Camada 1 — `resolver.ts`

```ts
resolveEntities(hass, config): ResolveResult
// { deviceId?, deviceName?, map: Partial<Record<LogicalKey, string>>, error?, missing: LogicalKey[] }
```

Determinação do device, por ordem:

1. `config.device` com 32 caracteres hexadecimais → device_id direto.
2. `config.device` a conter `.` → entity_id; device via
   `hass.entities[id].device_id`.
3. Sem `config.device` → recolhe os `device_id` distintos de todas as
   entradas de `hass.entities` com `platform === 'leapmotor'`. Exatamente
   um → usa-o. Zero → erro "integração não encontrada". Mais do que um →
   erro que lista os devices e pede que se escolha.

Resolução: percorre `hass.entities` uma vez, filtra por platform e
device, indexa por `` `${domain}/${translation_key}` ``, e traduz o
catálogo do `keys.ts` para `entity_id`. Depois aplica `config.entities`,
que ganha sempre.

`missing` contém as chaves não resolvidas. O card só reporta as que
pertencem a secções ativas.

Fallback: se `hass.entities` for `undefined` ou não contiver nenhuma
entrada `leapmotor`, faz uma vez `config/entity_registry/list` por
WebSocket e guarda o resultado em cache no elemento.

Memoização: o resultado é recalculado apenas quando muda `config` ou
quando a identidade do objeto `hass.entities` muda.

### 4.3 Camada 2 — `vehicle-state.ts`

Função pura `buildVehicleState(hass, map, now: Date): VehicleState`. Sem
DOM, sem `callService` e sem relógio implícito — a hora atual entra por
parâmetro, para os testes serem determinísticos.

```ts
interface VehicleState {
  online: boolean
  lastUpdate?: Date
  battery?: number
  range?: { km: number; unit: string; mode?: string }
  chargeLimit?: number
  charging: {
    phase: 'unplugged' | 'plugged' | 'charging' | 'complete' | 'scheduled'
    speed?: 'slow' | 'fast'
    powerKw?: number
    voltageV?: number
    currentA?: number
    remainingMinutes?: number
    finishTime?: Date
  }
  lock: { locked?: boolean; stale: boolean; ageSeconds?: number; source?: string }
  activity: 'parked' | 'driving' | 'ready' | 'unknown'
  openings: {
    doors: Record<'driver'|'passenger'|'rearLeft'|'rearRight', boolean|undefined>
    windows: Record<'fl'|'fr'|'rl'|'rr', { open?: boolean; position?: number }>
    trunk?: boolean
    roof?: boolean
    openCount: number
  }
  climate: { on?: boolean; interiorC?: number; targetC?: number; mode?: string }
  tires: Record<'fl'|'fr'|'rl'|'rr', number|undefined>
  trip: { odometerKm?: number; last7DaysKm?: number; last7DaysKwh?: number; avgConsumption?: number; totalEnergyKwh?: number }
  comfort: { driverSeatHeat?: number; driverSeatVent?: number; passengerSeatHeat?: number; passengerSeatVent?: number; steeringWheelHeat?: boolean; mirrorHeat?: boolean; batteryPreheat?: boolean }
  schedule: { enabled?: boolean; start?: string; end?: string; recurrence?: string; weekly?: boolean; cancelledOnce?: boolean }
}
```

Derivações, normativas:

- **`activity`** — se `vehicleState` tiver um valor reconhecido
  (`parked`, `driving`, `ready`), usa-o. Senão: `isDriving === 'on'` ou
  `speed > 0` → `driving`; `vehicleReady === 'on'` → `ready`;
  `gear === 'P'` ou `parkingBrake === 'on'` → `parked`; senão `unknown`.
- **`charging.phase`**, avaliada nesta ordem: `fullyCharged === 'on'` →
  `complete`; `isCharging === 'on'` → `charging`; `isPluggedIn === 'on'`
  ou `dcCableConnected === 'on'` → `plugged`; `chargingConnection` com
  valor válido e diferente de `unplugged` → `plugged`;
  `schedulePlanned === 'on'` ou `scheduleSwitch === 'on'`, sem cabo →
  `scheduled`; senão `unplugged`. Um `chargingConnection` a `unknown` ou
  `unavailable` nunca produz `plugged` — só valores válidos contam.
- **`charging.speed`** — `dcCableConnected === 'on'` ou
  `powerKw >= 7.4` → `fast`; senão `slow`.
- **`lock.stale`** — verdadeiro se `lockStateSource` contiver `stale` ou
  `ageSeconds > 900`.
- **`battery`** — `batteryPrecise` quando disponível, senão `battery`.
- **`range`** — precedência `rangeLive`, depois `range`, depois
  `rangeMax`. Motivo: a captura da app mostra 126 km a 29 % de bateria,
  uma razão de cerca de 434 km de autonomia total; nos estados reais a
  60 %, `rangeLive` dá 261 km (razão 435) e `range` dá 217 km (razão
  361). É o `rangeLive` que corresponde ao número da app. `mode` vem de
  `rangeMode`.
- **`trip.odometerKm`** — `odometer`, com `totalMileage` como recurso.
- **`openings.openCount`** — soma das portas, vidros, mala e teto com
  valor `true`. Vidros contam como abertos se `open === 'on'` ou
  `position > 0`.
- **Unidades** — lidas de `unit_of_measurement` no atributo do estado.
  Nenhuma conversão é feita.
- **Ausência** — todo o valor cujo estado seja inexistente, `unknown` ou
  `unavailable` fica `undefined`. `online` é falso quando nenhuma das
  entidades centrais (`battery`, `range`, `lock`) tem estado válido.

### 4.4 Camada 3 — secções

Cada secção é um `LitElement` com propriedades `state: VehicleState`,
`t: TranslateFn` e `config`, e emite `CustomEvent('leapmotor-action', {
detail: { action: ActionId } })`. Nenhuma secção recebe `hass`.

Valores em falta renderizam `—`. Nenhuma secção mostra `NaN`, `unknown`
ou `unavailable`.

- **`hero`** — nome do veículo, "Atualização HH:MM Hoje" a partir de
  `lastUpdate` (relativo, com `lastCloudRefresh` como recurso),
  autonomia em número grande com barra de dois segmentos, como na app: o
  segmento saturado vai até `battery` e um segmento mais claro estende-se
  até `chargeLimit`, com a cor do primeiro a ir de verde a vermelho
  conforme a carga. À direita, pill de trancas, esbatida e com "há Xh"
  quando `lock.stale`. Sob a barra, chip de carregamento apenas quando a
  fase não é `unplugged`. Depois a imagem do veículo e a etiqueta de
  `activity`, que é omitida quando `activity === 'unknown'` em vez de
  mostrar um valor vazio.
- **`actions-row`** — quatro botões circulares. Por defeito
  `[unlock, lock, trunk, windows]`. `trunk` e `windows` são alternantes:
  chamam `closeTrunk`/`closeWindows` quando o respetivo estado está
  aberto, e `openTrunk`/`openWindows` caso contrário. Um botão fica
  desativado se a entidade subjacente não existir, e todos os quatro
  ficam desativados quando `activity === 'driving'`. Estado pendente
  visível durante a chamada de serviço.
- **`charging`** — "Carregado a X%" e "Limite Y%", com o limite editável
  por `number.set_value` sobre `chargeLimitSet`; chip lento/rápido; tempo
  restante formatado a partir de `remainingMinutes` ("Restam 13h e
  55min"); hora estimada de fim quando conhecida; e tensão e corrente em
  linha secundária apenas enquanto `phase === 'charging'`.
- **`tiles`** — duas colunas. À esquerda, temperatura interior com a
  temperatura alvo em subtítulo; o toque alterna `climateSwitch`. À
  direita, tile de aberturas: "Todos fechados" ou "N abertos" com a
  lista do que está aberto.
- **`tires`** (opcional) — as quatro pressões dispostas em planta do
  veículo; valor em âmbar fora do intervalo 2.0–2.6 bar.
- **`trip`** (opcional) — odómetro, últimos 7 dias em km e kWh, média de
  consumo de 6 semanas, energia total consumida.
- **`comfort`** (opcional) — aquecimento e ventilação dos dois assentos
  por `number.set_value`, e aquecimento do volante, dos espelhos e
  pré-aquecimento da bateria por `switch`.
- **`schedule`** (opcional) — janela início–fim, recorrência, indicação
  de agendamento semanal, aviso quando está cancelado só desta vez, e o
  switch de agendamento.

### 4.5 `actions.ts`

Traduz `ActionId` em chamada de serviço, sobre o `EntityMap`:

| ActionId | Serviço |
|---|---|
| `unlock` / `lock` | `lock.unlock` / `lock.lock` em `lock` |
| `trunk` | `button.press` em `openTrunk` ou `closeTrunk` |
| `windows` | `button.press` em `openWindows` ou `closeWindows` |
| `openSunshade` / `closeSunshade` | `button.press` |
| `quickCool` / `quickHeat` | `button.press` |
| `defrost` | `button.press` em `windshieldDefrost` |
| `findVehicle` | `button.press` em `findVehicle` |
| `unlockCharger` | `button.press` em `unlockCharger` |
| `refresh` | `button.press` em `refreshData` |
| `climate` | `switch.turn_on` / `switch.turn_off` em `climateSwitch` |
| `steeringWheelHeat` / `mirrorHeat` / `batteryPreheat` | `switch.toggle` |
| `setChargeLimit` | `number.set_value` em `chargeLimitSet` |

Só `trunk` e `windows` são alternantes, porque só eles têm um sensor de
estado correspondente (`trunk`, `windowFL`…`windowRR`). A cortina do
teto de vidro não tem sensor próprio — `skylight_open` refere-se ao teto
panorâmico, não à cortina — pelo que abrir e fechar são duas ações
distintas.

`confirm_actions` na config define quais pedem confirmação; por defeito
apenas `unlock`. Erros de serviço são apresentados por `hass`
normalmente; o botão volta ao estado anterior.

## 5. Configuração

```yaml
type: custom:leapmotor-card
device: 0123456789abcdef0123456789abcdef   # device_id ou entity_id; omitir se só houver um carro
name: B10 Demo                             # defeito: name_by_user do device
language: pt                                # defeito: hass.locale.language
image: auto                                 # auto | entity | none | <url>
actions: [unlock, lock, trunk, windows]     # ActionId; a grelha adapta-se ao número indicado
confirm_actions: [unlock]                   # lista de ActionId que pedem confirmação
sections:
  charging: true
  tiles: true
  tires: false
  trip: false
  comfort: false
  schedule: false
entities:                                   # overrides opcionais por nome lógico
  range: sensor.leapmotor_b10_000000_main_live_range
```

Editor visual `leapmotor-card-editor` sobre `ha-form`: seletor de device
limitado à integração `leapmotor`, nome, idioma, imagem, interruptores
por secção e escolha das ações. `getStubConfig` preenche o device quando
existe apenas um.

## 6. Apresentação

Cores e tipografia por variáveis do tema do Home Assistant
(`--card-background-color`, `--primary-text-color`,
`--secondary-text-color`, `--divider-color`, `--primary-color`), com
overrides `--leapmotor-*` para quem quiser afinar. Funciona em tema claro
e escuro. Layout responsivo por `grid`, com a linha de ações a manter
quatro colunas até aos 320 px de largura.

Imagem do veículo, valores de `image`: `auto` usa o `entity_picture` de
`image/vehicle_picture` e, se não houver, cai para um SVG de silhueta
embutido; `entity` usa apenas a entidade e deixa o espaço vazio se ela
faltar; `none` não mostra imagem nenhuma e recolhe o espaço; qualquer
outro valor é tratado como URL ou caminho literal. O repositório não
inclui renders da Leapmotor, por serem material com direitos.

## 7. Internacionalização

`translations/pt.json` e `translations/en.json` embutidos no bundle. A
função `t(key, vars?)` procura no idioma escolhido, cai para inglês e,
em último recurso, devolve a própria chave. A interpolação usa
marcadores `{nome}` substituídos pelas entradas de `vars`; um marcador
sem valor correspondente fica literal, para o erro ser visível. O idioma vem de
`config.language` quando definido, senão de `hass.locale.language`, com
`en` por defeito.

O README do repositório é escrito em inglês, por ser um projeto
distribuído por HACS, em `https://github.com/fapgomes/ha-leapmotor-card`,
sob **GNU GPL v3 or later**. Esta spec e os comentários de processo ficam em
português.

## 8. Erros

- Device desconhecido, ausente ou ambíguo → `ha-alert` dentro do card,
  com o texto do que falta configurar.
- Entidade em falta numa secção ativa → a secção renderiza com `—` e um
  ícone de aviso discreto com tooltip a nomear a chave lógica que falta.
  O card nunca deixa de renderizar por causa disto.
- Estado de trancas obsoleto → apresentado como obsoleto, nunca como
  fresco.

## 9. Testes

Vitest sobre os módulos puros, escritos antes do código de render.

- `test/vehicle-state.test.ts` — fixtures a partir do despejo real dos
  121 estados do utilizador, mais casos sintéticos: a carregar em AC, a
  carregar em DC, com cabo mas parado, carregamento completo,
  agendamento ativo sem cabo, em andamento, tudo indisponível, trancas
  obsoletas, vidros abertos por `position` sem `open`. Uma asserção por
  cada derivação da secção 4.3.
- `test/resolver.test.ts` — um device; dois devices sem `config.device`
  (erro); `config.device` como device_id; como entity_id; overrides a
  ganhar sobre a descoberta; `hass.entities` vazio a acionar o fallback
  WebSocket; chave do catálogo sem entidade correspondente a aparecer em
  `missing`.
- `test/localize.test.ts` — pt, en, chave inexistente, interpolação.

Verificação manual no fim, com autorização prévia do utilizador:
`npm run build`, copiar `dist/leapmotor-card.js` para
`/config/www/leapmotor-card/`, registar o recurso em Lovelace e
confirmar o card no dashboard.

## 10. Fora de âmbito

Controlo de climatização com alvo de temperatura (a integração expõe o
alvo só como sensor); mapa de localização (o `device_tracker` existe, mas
mapas dentro de cards são outro problema); histórico e gráficos
(`apexcharts-card` já resolve isso ao lado); tile de chave Bluetooth.
