# Leapmotor Card v4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O card deixa de ser uma coluna que cresce com cada secção ligada e passa a um hero compacto com uma grelha de grupos configurável que abre sub-vistas navegáveis, com linhas acionáveis, alerta no tile, altura estável e deslizar horizontal.

**Architecture:** Um grupo é um conjunto das secções que já existem. Um módulo puro (`groups.ts`) tem o catálogo e todas as decisões — que grupos aparecem, que resumo mostram, que nível de alerta têm. Dois componentes novos dão a moldura (`group-grid`, `group-detail`) e um dá conteúdo novo (`openings`). As secções existentes são instanciadas **pelo card** e passadas ao `group-detail` por `<slot>`, para a canalização de propriedades ficar onde os dados estão e não haver tags dinâmicas.

**Tech Stack:** TypeScript, Lit 3, Rollup, Vitest (ambiente `node`, sem DOM), Home Assistant 2026.8+.

**Spec:** `docs/superpowers/specs/2026-08-30-leapmotor-card-v4-design.md`

## Global Constraints

Valem em **todas** as tarefas. Os requisitos de cada tarefa incluem implicitamente esta secção.

- **Nenhuma cadeia literal visível no render.** Tudo por `t()`. Exceções, e só estas: símbolos de unidade (`%`, `km`, `bar`, `°C`, `kWh/100 km`), o `DASH` (`—`) e a pontuação entre números (`–`, `·`).
- **Valor ausente renderiza `DASH`.** Nunca `NaN`, `unknown` ou `unavailable`.
- **Nenhum ficheiro em `src/sections/` importa `src/vehicle-state.ts`.** É essa fronteira que garante que nenhuma secção alcança o `hass`. O `src/groups.ts` fica do lado puro e também não o importa.
- **`noImplicitOverride: true`** — `render()`, `willUpdate()`, `updated()`, `firstUpdated()`, `disconnectedCallback()` e `static styles` levam `override`.
- **Toda a chave de tradução nova entra nos DOIS catálogos**, `src/translations/en.json` e `src/translations/pt.json`. `test/localize.test.ts` tem um teste de paridade que falha, nomeando as chaves, se só um for atualizado.
- **`button.plain` em `theme.ts` faz `all: unset` e está a (0,1,1).** Qualquer botão novo precisa de um seletor composto (`button.tile.plain`, `button.nav.plain`) que reponha fundo, `padding`, cantos, dimensões e `box-sizing`. O comentário no `theme.ts` conta que isto já produziu seis defeitos neste projeto, dois deles visíveis no dashboard de um utilizador.
- **Testes:** `npm test` (que é `TZ=UTC vitest run`). Ambiente `node`, sem harness de DOM — **nenhum teste de render**. Componentes Lit verificam-se com `npm run typecheck && npm run build`.
- **Comentários, testes e mensagens de commit em português**, como o resto do repositório. Um comentário explica *porquê*, não *o quê*.
- **Sem `[skip ci]` nas mensagens de commit.** Este repositório usa GitHub Actions, não GitLab CI, e o `validate.yml` corre em todos os ramos.
- **Cada tarefa termina verde:** `npm run typecheck && npm test && npm run build` passa em cada commit.

## Sobre os testes de tradução

A §11 da especificação prevê estender `test/localize.test.ts`. **Não é
preciso:** esse ficheiro já tem um teste que compara as chaves dos dois
catálogos e falha nomeando as que faltam de cada lado, mais um que garante que
nenhum dos dois está vazio. Qualquer chave nova é coberta automaticamente. É
por isso que as Global Constraints exigem escrever nos dois catálogos: não é
zelo, é o teste que já existe.

## Desvio face à especificação

Um só, encontrado ao mapear o catálogo contra o código:

A §3.2 da especificação dá ao grupo `status` os resumos `lock`, `openings`, `parking`. **`parking` não é implementável:** `VehicleState` não tem campo de travão de estacionamento — a chave lógica `parkingBrake` existe em `keys.ts`, mas o `buildVehicleState` consome-a para derivar `activity`, e `activity` já é o resumo por omissão do grupo `location`. O terceiro resumo de `status` passa a ser **`trunk`**, que é apoiado por `state.openings.trunk`. Tudo o mais segue a especificação.

---

## Task 1: `tire_range` na configuração

Os limiares de pressão saem das constantes de `tires.ts` para a configuração, com validação na leitura. Sem isto, o alerta no tile (Task 8) põe um quadrado âmbar permanente na grelha de quem tenha o carro a 2,8 bar — ver spec §2.4.

**Files:**
- Modify: `src/types.ts` (acrescentar ao fim, antes do `MapRequest`)
- Test: `test/types.test.ts` (acrescentar ao fim)

**Interfaces:**
- Consumes: nada.
- Produces: `DEFAULT_TIRE_RANGE: readonly [number, number]`, `clampTireRange(value: unknown): [number, number]`, e o campo `tire_range?: [number, number]` em `LeapmotorCardConfig`.

- [ ] **Step 1: Escrever o teste que falha**

Acrescenta ao fim de `test/types.test.ts`, e junta `DEFAULT_TIRE_RANGE, clampTireRange` ao `import` do topo:

```ts
/**
 * `tire_range` vem de YAML escrito à mão, sem validação de esquema, e alimenta
 * um alerta visível na grelha: um par trocado ou um texto por engano pintava um
 * tile de vermelho para sempre. O corte é aqui, na leitura, pela mesma razão do
 * `clampMapZoom` — o editor não vê configurações escritas à mão.
 */
describe('clampTireRange', () => {
  it('deixa passar uma faixa válida sem alteração', () => {
    expect(clampTireRange([2.4, 3.0])).toEqual([2.4, 3.0])
  })

  it('usa a faixa por omissão quando não há configuração', () => {
    expect(clampTireRange(undefined)).toEqual([...DEFAULT_TIRE_RANGE])
  })

  it('usa a omissão quando o mínimo não é menor que o máximo', () => {
    expect(clampTireRange([2.6, 2.0])).toEqual([...DEFAULT_TIRE_RANGE])
    expect(clampTireRange([2.4, 2.4])).toEqual([...DEFAULT_TIRE_RANGE])
  })

  it('usa a omissão perante valores não numéricos vindos de YAML escrito à mão', () => {
    expect(clampTireRange(['2.0', '2.6'])).toEqual([...DEFAULT_TIRE_RANGE])
    expect(clampTireRange([Number.NaN, 2.6])).toEqual([...DEFAULT_TIRE_RANGE])
    expect(clampTireRange([2.0, Number.POSITIVE_INFINITY])).toEqual([...DEFAULT_TIRE_RANGE])
  })

  it('usa a omissão quando o comprimento não é dois', () => {
    expect(clampTireRange([2.0])).toEqual([...DEFAULT_TIRE_RANGE])
    expect(clampTireRange([2.0, 2.6, 3.0])).toEqual([...DEFAULT_TIRE_RANGE])
    expect(clampTireRange([])).toEqual([...DEFAULT_TIRE_RANGE])
  })

  it('usa a omissão quando não é sequer uma lista', () => {
    expect(clampTireRange(2.6)).toEqual([...DEFAULT_TIRE_RANGE])
    expect(clampTireRange(null)).toEqual([...DEFAULT_TIRE_RANGE])
    expect(clampTireRange({ min: 2, max: 3 })).toEqual([...DEFAULT_TIRE_RANGE])
  })

  it('devolve uma cópia, para ninguém escrever na constante por omissão', () => {
    const first = clampTireRange(undefined)
    first[0] = 99
    expect(clampTireRange(undefined)).toEqual([...DEFAULT_TIRE_RANGE])
  })
})
```

- [ ] **Step 2: Correr o teste para confirmar que falha**

Run: `npm test -- types`
Expected: FAIL — `clampTireRange is not a function` / erro de importação.

- [ ] **Step 3: Implementar**

Em `src/types.ts`, acrescenta o campo à interface de configuração:

```ts
export interface LeapmotorCardConfig {
  // … campos existentes, sem alteração …
  map_zoom?: number
  tire_range?: [number, number]
}
```

E, junto ao `clampMapZoom`:

```ts
/**
 * A faixa de pressão considerada normal, em bar. A omissão são os valores que
 * o `tires.ts` tinha fixos no código, para não mudar o comportamento de
 * ninguém sem que o peça — mas são estreitos: um carro a 2,8 bar cai fora
 * dela. Qual é a faixa certa depende da medida do pneu e da carga, não se
 * verifica a partir do código, e é por isso que passou a ser configurável.
 */
export const DEFAULT_TIRE_RANGE: readonly [number, number] = [2.0, 2.6]

export function clampTireRange(value: unknown): [number, number] {
  const fallback = (): [number, number] => [DEFAULT_TIRE_RANGE[0], DEFAULT_TIRE_RANGE[1]]
  if (!Array.isArray(value) || value.length !== 2) return fallback()
  const [min, max] = value as unknown[]
  if (typeof min !== 'number' || typeof max !== 'number') return fallback()
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) return fallback()
  return [min, max]
}
```

- [ ] **Step 4: Correr os testes**

Run: `npm run typecheck && npm test`
Expected: PASS, com sete testes novos.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts test/types.test.ts
git commit -m "feat: tornar configurável a faixa de pressão dos pneus

Os limiares 2,0-2,6 bar estavam fixos no tires.ts e são estreitos: a
captura de referência da spec mostra 2,6-2,8 como normais. Com o alerta
no tile, um limiar errado passa a ser um quadrado âmbar permanente na
grelha, e não um número dentro de uma secção desligada por omissão.

A omissão mantém os valores de hoje, para não mudar o comportamento de
ninguém sem que o peça. A validação é na leitura, como o clampMapZoom,
porque o editor não vê configurações escritas à mão."
```

---

## Task 2: catálogo de grupos e `resolveGrid`

O coração do desenho: que grupos existem, o que cada um instancia, e como a configuração vira uma lista de grupos resolvidos. Puro, sem DOM.

**Files:**
- Create: `src/groups.ts`
- Create: `test/groups.test.ts`
- Modify: `src/types.ts` (tipos `GroupId`, `GridEntry`, `PanelId`; campo `grid?`)

**Interfaces:**
- Consumes: `EntityMap`, `LogicalKey`, `LeapmotorCardConfig` (de Task 1).
- Produces:
  - `GroupId = 'charging' | 'status' | 'climate' | 'tires' | 'trip' | 'location'`
  - `PanelId = 'charging' | 'schedule' | 'climate' | 'comfort' | 'openings' | 'tires' | 'trip' | 'location'`
  - `GridEntry = GroupId | { group: GroupId; icon?: string; title?: string; summary?: string }`
  - `GroupDef { id, icon, titleKey, summaries, panels, keys }`
  - `GROUP_CATALOGUE: Record<GroupId, GroupDef>`, `GROUP_ORDER: readonly GroupId[]`
  - `ResolvedGroup { id, icon, titleKey, titleOverride?, summary, def }`
  - `GridResolution { groups: ResolvedGroup[]; unknown: string[]; explicit: boolean }`
  - `resolveGrid(config: LeapmotorCardConfig, map: EntityMap): GridResolution`
  - `missingForGroups(groups: ResolvedGroup[], missing: LogicalKey[]): LogicalKey[]`

**Nota sobre `PanelId`:** é um tipo novo e **não** substitui o `SectionId` existente. O `SectionId` e o `DEFAULT_SECTIONS` continuam a existir e a compilar até à Task 11, que é quem os apaga. Introduzir os dois nomes em paralelo é o que permite a cada tarefa terminar verde.

- [ ] **Step 1: Escrever o teste que falha**

Cria `test/groups.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { GROUP_CATALOGUE, GROUP_ORDER, missingForGroups, resolveGrid } from '../src/groups'
import { resolveEntities } from '../src/resolver'
import type { EntityMap, LeapmotorCardConfig } from '../src/types'
import { realHass } from './fixtures/real-states'

const CONFIG: LeapmotorCardConfig = { type: 'custom:leapmotor-card' }

/** O mapa de entidades do carro real das fixtures. */
function realMap(): EntityMap {
  return resolveEntities(realHass(), CONFIG).map
}

describe('resolveGrid — grelha por omissão', () => {
  it('devolve o catálogo inteiro pela ordem do catálogo', () => {
    const { groups, explicit } = resolveGrid(CONFIG, realMap())
    expect(groups.map(g => g.id)).toEqual([...GROUP_ORDER])
    expect(explicit).toBe(false)
  })

  it('deixa cair em silêncio um grupo sem nenhuma entidade resolvível', () => {
    // Sem nenhuma das quatro chaves de pneu, o grupo `tires` não tem o que
    // mostrar. Numa grelha por omissão desaparece: a configuração zero mostra
    // o que ESTE carro dá, e não uma lista de secções vazias.
    const map = realMap()
    delete map.tireFL; delete map.tireFR; delete map.tireRL; delete map.tireRR
    expect(resolveGrid(CONFIG, map).groups.map(g => g.id)).not.toContain('tires')
  })

  it('mantém um grupo a que falte só parte das entidades', () => {
    // Um carro que reporte dois pneus continua a ter pneus para mostrar.
    const map = realMap()
    delete map.tireRL; delete map.tireRR
    expect(resolveGrid(CONFIG, map).groups.map(g => g.id)).toContain('tires')
  })

  it('dá o primeiro resumo do grupo como resumo por omissão', () => {
    const { groups } = resolveGrid(CONFIG, realMap())
    for (const group of groups) {
      expect(group.summary).toBe(GROUP_CATALOGUE[group.id].summaries[0])
    }
  })
})

describe('resolveGrid — grelha escrita à mão', () => {
  it('respeita a ordem escrita, que não é a do catálogo', () => {
    const config: LeapmotorCardConfig = { ...CONFIG, grid: ['tires', 'charging'] }
    expect(resolveGrid(config, realMap()).groups.map(g => g.id)).toEqual(['tires', 'charging'])
  })

  it('marca-se como explícita, para o aviso de entidades em falta saber que foi pedida', () => {
    expect(resolveGrid({ ...CONFIG, grid: ['trip'] }, realMap()).explicit).toBe(true)
  })

  it('trata a forma curta e a forma longa como o mesmo grupo', () => {
    const short = resolveGrid({ ...CONFIG, grid: ['tires'] }, realMap())
    const long = resolveGrid({ ...CONFIG, grid: [{ group: 'tires' }] }, realMap())
    expect(long.groups.map(g => g.id)).toEqual(short.groups.map(g => g.id))
    expect(long.groups[0]?.icon).toBe(short.groups[0]?.icon)
  })

  it('sobrepõe o ícone e o título quando a forma longa os traz', () => {
    const config: LeapmotorCardConfig = {
      ...CONFIG,
      grid: [{ group: 'tires', icon: 'mdi:test-tube', title: 'Pressões' }],
    }
    const group = resolveGrid(config, realMap()).groups[0]
    expect(group?.icon).toBe('mdi:test-tube')
    expect(group?.titleOverride).toBe('Pressões')
  })

  it('deixa o titleOverride indefinido quando não é escrito, para o card usar a tradução', () => {
    const group = resolveGrid({ ...CONFIG, grid: ['tires'] }, realMap()).groups[0]
    expect(group?.titleOverride).toBeUndefined()
    expect(group?.titleKey).toBe(GROUP_CATALOGUE.tires.titleKey)
  })

  it('aceita um resumo alternativo do próprio grupo', () => {
    const config: LeapmotorCardConfig = { ...CONFIG, grid: [{ group: 'tires', summary: 'worst' }] }
    expect(resolveGrid(config, realMap()).groups[0]?.summary).toBe('worst')
  })

  it('cai na omissão do grupo perante um resumo que não é dele', () => {
    // `odometer` é um resumo do grupo `trip`, não do `tires`. Escrito no
    // grupo errado não é erro fatal: mostra-se o resumo por omissão.
    const config: LeapmotorCardConfig = { ...CONFIG, grid: [{ group: 'tires', summary: 'odometer' }] }
    expect(resolveGrid(config, realMap()).groups[0]?.summary).toBe(GROUP_CATALOGUE.tires.summaries[0])
  })

  it('nomeia um grupo desconhecido em vez de o ignorar em silêncio', () => {
    const config = { ...CONFIG, grid: ['tires', 'radio'] } as unknown as LeapmotorCardConfig
    const { groups, unknown } = resolveGrid(config, realMap())
    expect(groups.map(g => g.id)).toEqual(['tires'])
    expect(unknown).toEqual(['radio'])
  })

  it('mostra um grupo repetido uma só vez', () => {
    const config: LeapmotorCardConfig = { ...CONFIG, grid: ['tires', 'tires'] }
    expect(resolveGrid(config, realMap()).groups).toHaveLength(1)
  })

  it('mantém um grupo sem entidades quando foi escrito à mão', () => {
    // Ao contrário da grelha por omissão: quem o escreveu quer saber que está
    // vazio, e o aviso de entidades em falta é que lho diz. Sumir com ele era
    // esconder um erro de configuração.
    const map = realMap()
    delete map.tireFL; delete map.tireFR; delete map.tireRL; delete map.tireRR
    expect(resolveGrid({ ...CONFIG, grid: ['tires'] }, map).groups.map(g => g.id)).toEqual(['tires'])
  })

  it('aceita uma grelha vazia como forma de esconder a grelha', () => {
    const { groups, explicit } = resolveGrid({ ...CONFIG, grid: [] }, realMap())
    expect(groups).toEqual([])
    expect(explicit).toBe(true)
  })
})

describe('catálogo', () => {
  it('a ordem por omissão nomeia todos os grupos do catálogo, e só uma vez', () => {
    expect([...GROUP_ORDER].sort()).toEqual(Object.keys(GROUP_CATALOGUE).sort())
    expect(new Set(GROUP_ORDER).size).toBe(GROUP_ORDER.length)
  })

  it('cada grupo tem pelo menos um resumo, um painel e uma chave', () => {
    for (const def of Object.values(GROUP_CATALOGUE)) {
      expect(def.summaries.length, def.id).toBeGreaterThan(0)
      expect(def.panels.length, def.id).toBeGreaterThan(0)
      expect(def.keys.length, def.id).toBeGreaterThan(0)
    }
  })

  it('o id de cada entrada bate com a chave que a indexa', () => {
    for (const [id, def] of Object.entries(GROUP_CATALOGUE)) expect(def.id).toBe(id)
  })
})

describe('missingForGroups', () => {
  it('só reporta as chaves que algum grupo da grelha pede', () => {
    const { groups } = resolveGrid({ ...CONFIG, grid: ['tires'] }, realMap())
    expect(missingForGroups(groups, ['tireFL', 'odometer'])).toEqual(['tireFL'])
  })

  it('devolve vazio quando a grelha não pede nada do que falta', () => {
    const { groups } = resolveGrid({ ...CONFIG, grid: ['tires'] }, realMap())
    expect(missingForGroups(groups, ['odometer'])).toEqual([])
  })
})
```

- [ ] **Step 2: Correr o teste para confirmar que falha**

Run: `npm test -- groups`
Expected: FAIL — `Cannot find module '../src/groups'`.

- [ ] **Step 3: Acrescentar os tipos a `src/types.ts`**

```ts
/** Os grupos que a grelha pode mostrar. */
export type GroupId = 'charging' | 'status' | 'climate' | 'tires' | 'trip' | 'location'

/**
 * As secções que uma sub-vista pode instanciar. Não é o `SectionId`: aquele é o
 * campo `sections` da configuração antiga, que sai na 0.4.0. Este nomeia os
 * componentes, e um grupo pode instanciar mais do que um.
 */
export type PanelId =
  | 'charging' | 'schedule' | 'climate' | 'comfort'
  | 'openings' | 'tires' | 'trip' | 'location'

/**
 * Uma entrada da grelha. A forma curta é só o nome do grupo; a longa existe
 * para sobrepor o ícone, o título ou qual dos resumos do grupo se mostra.
 */
export type GridEntry = GroupId | {
  group: GroupId
  icon?: string
  title?: string
  summary?: string
}
```

E na interface de configuração, a par do `tire_range`:

```ts
  grid?: GridEntry[]
```

- [ ] **Step 4: Criar `src/groups.ts`**

```ts
import type { LogicalKey } from './keys'
import type { EntityMap, GridEntry, GroupId, LeapmotorCardConfig, PanelId } from './types'

/**
 * O que define um grupo da grelha. Vive em código, e não na configuração: um
 * grupo é um conjunto das secções que já existem, e o utilizador escolhe quais
 * e em que ordem — não inventa grupos novos. Ver spec §3.1.
 */
export interface GroupDef {
  id: GroupId
  icon: string
  titleKey: string
  /** Os resumos possíveis. **O primeiro é o da omissão.** */
  summaries: readonly string[]
  /** As secções que a sub-vista instancia, pela ordem em que aparecem. */
  panels: readonly PanelId[]
  /**
   * As chaves lógicas que o grupo consome. Servem duas perguntas: o grupo tem
   * alguma coisa para mostrar (pelo menos uma resolvida), e que chaves em falta
   * vale a pena reportar (`missingForGroups`).
   */
  keys: readonly LogicalKey[]
}

export const GROUP_CATALOGUE: Record<GroupId, GroupDef> = {
  charging: {
    id: 'charging',
    icon: 'mdi:ev-station',
    titleKey: 'group.charging',
    summaries: ['battery', 'limit', 'phase', 'eta'],
    panels: ['charging', 'schedule'],
    keys: ['chargeLimit', 'isCharging', 'isPluggedIn', 'scheduleStart', 'scheduleEnd'],
  },
  status: {
    id: 'status',
    icon: 'mdi:car-door',
    titleKey: 'group.status',
    summaries: ['lock', 'openings', 'trunk'],
    panels: ['openings'],
    keys: [
      'lock', 'trunk', 'roof',
      'doorDriver', 'doorPassenger', 'doorRearLeft', 'doorRearRight',
      'windowFL', 'windowFR', 'windowRL', 'windowRR',
    ],
  },
  climate: {
    id: 'climate',
    icon: 'mdi:thermometer',
    titleKey: 'group.climate',
    summaries: ['interior', 'target', 'state'],
    panels: ['climate', 'comfort'],
    keys: ['interiorTemp', 'targetTemp', 'climateSwitch', 'driverSeatHeat', 'steeringWheelHeat'],
  },
  tires: {
    id: 'tires',
    icon: 'mdi:car-tire-alert',
    titleKey: 'group.tires',
    summaries: ['range', 'min', 'worst'],
    panels: ['tires'],
    keys: ['tireFL', 'tireFR', 'tireRL', 'tireRR'],
  },
  trip: {
    id: 'trip',
    icon: 'mdi:road-variant',
    titleKey: 'group.trip',
    summaries: ['odometer', 'last7', 'consumption'],
    panels: ['trip'],
    keys: ['odometer', 'last7DaysKm', 'last7DaysKwh', 'avgConsumption6w', 'totalEnergy'],
  },
  location: {
    id: 'location',
    icon: 'mdi:map-marker',
    titleKey: 'group.location',
    summaries: ['activity', 'zone', 'age'],
    panels: ['location'],
    keys: ['location'],
  },
}

/** A ordem da grelha por omissão. */
export const GROUP_ORDER: readonly GroupId[] = [
  'charging', 'status', 'climate', 'tires', 'trip', 'location',
]

export interface ResolvedGroup {
  id: GroupId
  /** Já com a sobreposição do utilizador aplicada, se houver. */
  icon: string
  titleKey: string
  /** Um título literal escrito pelo utilizador. Não passa por `t()`. */
  titleOverride?: string
  /** O resumo a mostrar, já validado contra os do grupo. */
  summary: string
  def: GroupDef
}

export interface GridResolution {
  groups: ResolvedGroup[]
  /** Os nomes escritos no `grid:` que não são grupos. */
  unknown: string[]
  /** Verdadeiro quando o `grid:` foi escrito, falso quando é a omissão. */
  explicit: boolean
}

function longForm(entry: GridEntry): { group: string; icon?: string; title?: string; summary?: string } {
  return typeof entry === 'string' ? { group: entry } : entry
}

export function resolveGrid(config: LeapmotorCardConfig, map: EntityMap): GridResolution {
  const explicit = Array.isArray(config.grid)
  const entries: GridEntry[] = explicit ? config.grid! : [...GROUP_ORDER]
  const groups: ResolvedGroup[] = []
  const unknown: string[] = []
  const seen = new Set<GroupId>()

  for (const raw of entries) {
    const entry = longForm(raw)
    const def = GROUP_CATALOGUE[entry.group as GroupId] as GroupDef | undefined
    if (!def) { unknown.push(String(entry.group)); continue }
    if (seen.has(def.id)) continue
    seen.add(def.id)

    // Um grupo da grelha POR OMISSÃO sem nenhuma entidade resolvível não
    // aparece: configuração zero mostra o que este carro dá, e não uma lista
    // de sub-vistas vazias. Escrito à mão no `grid:`, fica — e o aviso de
    // entidades em falta encarrega-se de dizer que está vazio, porque sumir
    // com ele era esconder um erro de quem configurou. Ver spec §5.6.
    if (!explicit && !def.keys.some(key => map[key] !== undefined)) continue

    const summary = entry.summary !== undefined && def.summaries.includes(entry.summary)
      ? entry.summary
      : def.summaries[0]!

    groups.push({
      id: def.id,
      icon: entry.icon ?? def.icon,
      titleKey: def.titleKey,
      titleOverride: entry.title,
      summary,
      def,
    })
  }

  return { groups, unknown, explicit }
}

/**
 * Das chaves em falta que o resolvedor reportou, as que algum grupo da grelha
 * pede de facto. Sem este filtro, o aviso nomeava entidades de secções que o
 * utilizador não pôs na grelha.
 */
export function missingForGroups(groups: ResolvedGroup[], missing: LogicalKey[]): LogicalKey[] {
  const wanted = new Set<LogicalKey>(groups.flatMap(group => [...group.def.keys]))
  return missing.filter(key => wanted.has(key))
}
```

- [ ] **Step 5: Correr os testes**

Run: `npm run typecheck && npm test`
Expected: PASS, com 21 testes novos.

- [ ] **Step 6: Commit**

```bash
git add src/groups.ts src/types.ts test/groups.test.ts
git commit -m "feat: catálogo de grupos e resolução da grelha

Um grupo é um conjunto das secções que já existem, declarado em código;
o grid: da configuração escolhe quais, em que ordem, e com que ícone,
título e resumo. Puro e sem DOM, que é onde este projeto põe as
decisões.

A grelha por omissão é o catálogo inteiro, e um grupo sem entidades
resolvíveis desaparece dela em silêncio: configuração zero passa a
mostrar o que aquele carro dá. Escrito à mão no grid:, o grupo fica,
para o aviso de entidades em falta poder dizer que está vazio.

O PanelId é um tipo novo e não substitui ainda o SectionId, que só sai
na tarefa que reescreve o card."
```

---

## Task 3: `summaryFor`

O texto que cada tile mostra debaixo do título. Puro.

**Files:**
- Modify: `src/groups.ts`
- Modify: `test/groups.test.ts`
- Modify: `src/translations/en.json`, `src/translations/pt.json`

**Interfaces:**
- Consumes: `ResolvedGroup` (Task 2), `VehicleState`, `TranslateFn`.
- Produces: `summaryFor(group: ResolvedGroup, state: VehicleState, t: TranslateFn, language: string): string`

- [ ] **Step 1: Escrever o teste que falha**

Acrescenta a `test/groups.test.ts` (e junta `summaryFor` ao `import` de `../src/groups`, mais estes ao topo):

```ts
import { buildVehicleState } from '../src/vehicle-state'
import { createTranslator, DASH } from '../src/localize'
import { REAL_NOW } from './fixtures/real-states'

const t = createTranslator('en')

/** O estado do carro real das fixtures, com sobreposições por chave. */
function realState(overrides: Record<string, string> = {}) {
  const hass = realHass(overrides)
  return buildVehicleState(hass, resolveEntities(hass, CONFIG).map, REAL_NOW)
}

/** Um grupo resolvido com o resumo escolhido à mão. */
function group(id: GroupId, summary?: string) {
  const config = { ...CONFIG, grid: [{ group: id, summary }] } as LeapmotorCardConfig
  return resolveGrid(config, realMap()).groups[0]!
}
```

…e junta `GroupId` ao `import type` de `../src/types`. Depois:

```ts
describe('summaryFor — carga', () => {
  it('mostra a percentagem de bateria por omissão', () => {
    expect(summaryFor(group('charging'), realState(), t, 'en')).toBe('60.3 %')
  })

  it('mostra o limite de carga', () => {
    expect(summaryFor(group('charging', 'limit'), realState(), t, 'en')).toBe(t('charging.limit', { percent: 80 }))
  })

  it('mostra a fase, e distingue sem cabo de a carregar', () => {
    expect(summaryFor(group('charging', 'phase'), realState(), t, 'en')).toBe(t('charging.unplugged'))
  })

  it('dá DASH no tempo restante quando não há carregamento em curso', () => {
    expect(summaryFor(group('charging', 'eta'), realState(), t, 'en')).toBe(DASH)
  })

  it('dá DASH na bateria quando nenhum sensor de bateria é válido', () => {
    const state = realState({ 'sensor/battery_percent': 'unavailable', 'sensor/battery_percent_precise': 'unavailable' })
    expect(summaryFor(group('charging'), state, t, 'en')).toBe(DASH)
  })
})

describe('summaryFor — estado', () => {
  it('mostra o estado das trancas por omissão', () => {
    expect(summaryFor(group('status'), realState(), t, 'en')).toBe(t('doors_locked'))
  })

  it('mostra tudo fechado quando não há aberturas', () => {
    expect(summaryFor(group('status', 'openings'), realState(), t, 'en')).toBe(t('openings.all_closed'))
  })

  it('conta as aberturas no singular e no plural', () => {
    const one = realState({ 'binary_sensor/trunk_open': 'on' })
    expect(summaryFor(group('status', 'openings'), one, t, 'en')).toBe(t('openings.open_one'))
    const two = realState({ 'binary_sensor/trunk_open': 'on', 'binary_sensor/skylight_open': 'on' })
    expect(summaryFor(group('status', 'openings'), two, t, 'en')).toBe(t('openings.open_count', { count: 2 }))
  })

  it('mostra a bagageira', () => {
    expect(summaryFor(group('status', 'trunk'), realState(), t, 'en')).toBe(t('openings.closed'))
    const open = realState({ 'binary_sensor/trunk_open': 'on' })
    expect(summaryFor(group('status', 'trunk'), open, t, 'en')).toBe(t('openings.open'))
  })
})

describe('summaryFor — clima, pneus, viagem e localização', () => {
  it('mostra a temperatura interior por omissão', () => {
    expect(summaryFor(group('climate'), realState(), t, 'en')).toMatch(/°C$/)
  })

  it('mostra a faixa de pressão dos pneus por omissão, do mais baixo ao mais alto', () => {
    const summary = summaryFor(group('tires'), realState(), t, 'en')
    expect(summary).toMatch(/^\d+\.\d – \d+\.\d bar$/)
  })

  it('mostra o pneu mais baixo com o seu canto no resumo `worst`', () => {
    const summary = summaryFor(group('tires', 'worst'), realState(), t, 'en')
    expect(summary).toContain('bar')
    expect(summary).toMatch(/(FL|FR|RL|RR)$/)
  })

  it('dá DASH nos pneus quando nenhum é válido', () => {
    const state = realState({
      'sensor/tire_pressure_front_left_bar': 'unavailable',
      'sensor/tire_pressure_front_right_bar': 'unavailable',
      'sensor/tire_pressure_rear_left_bar': 'unavailable',
      'sensor/tire_pressure_rear_right_bar': 'unavailable',
    })
    expect(summaryFor(group('tires'), state, t, 'en')).toBe(DASH)
    expect(summaryFor(group('tires', 'worst'), state, t, 'en')).toBe(DASH)
  })

  it('mostra o odómetro por omissão na viagem', () => {
    expect(summaryFor(group('trip'), realState(), t, 'en')).toMatch(/ km$/)
  })

  it('mostra a atividade por omissão na localização', () => {
    const summary = summaryFor(group('location'), realState(), t, 'en')
    expect(summary === DASH || summary.length > 0).toBe(true)
  })

  it('mostra a idade da posição, que nas fixtures está obsoleta', () => {
    expect(summaryFor(group('location', 'age'), realState(), t, 'en')).not.toBe(DASH)
  })
})

describe('summaryFor — o resumo desconhecido nunca chega aqui', () => {
  it('um resumo fora do grupo já foi trocado pela omissão em resolveGrid', () => {
    // A validação é do resolveGrid; este teste fixa o contrato entre os dois,
    // para ninguém acrescentar mais tarde um `default:` que devolva a chave.
    const g = group('tires', 'odometer')
    expect(g.summary).toBe('range')
    expect(summaryFor(g, realState(), t, 'en')).not.toBe('odometer')
  })
})
```

- [ ] **Step 2: Correr o teste para confirmar que falha**

Run: `npm test -- groups`
Expected: FAIL — `summaryFor is not a function`.

- [ ] **Step 3: Acrescentar as chaves de tradução**

Em `src/translations/pt.json`:

```json
  "group": {
    "charging": "Carga",
    "status": "Estado",
    "climate": "Clima",
    "tires": "Pneus",
    "trip": "Viagem",
    "location": "Localização"
  },
  "openings": {
    "all_closed": "Tudo fechado",
    "open_one": "1 aberto",
    "open_count": "{count} abertos",
    "open": "Aberto",
    "closed": "Fechado"
  },
  "climate": {
    "state_on": "Ligada",
    "state_off": "Desligada"
  }
```

Atenção: `openings` e `climate` **já existem** nos catálogos. Acrescenta estas chaves aos objetos existentes em vez de criar objetos novos — um segundo `"openings"` no mesmo JSON perde as chaves do primeiro em silêncio.

Em `src/translations/en.json`, as mesmas chaves:

```json
  "group": {
    "charging": "Charging", "status": "Status", "climate": "Climate",
    "tires": "Tires", "trip": "Trip", "location": "Location"
  },
  "openings": {
    "all_closed": "All closed", "open_one": "1 open", "open_count": "{count} open",
    "open": "Open", "closed": "Closed"
  },
  "climate": { "state_on": "On", "state_off": "Off" }
```

- [ ] **Step 4: Implementar em `src/groups.ts`**

Junta ao topo:

```ts
import { formatNumber, formatTimeOfDay, formatAgo } from './format'
import { DASH, formatDuration, type TranslateFn } from './localize'
import type { VehicleState } from './types'
```

E ao fim do ficheiro:

```ts
const TIRE_CORNERS = [
  { key: 'fl', labelKey: 'tires.corner_fl' },
  { key: 'fr', labelKey: 'tires.corner_fr' },
  { key: 'rl', labelKey: 'tires.corner_rl' },
  { key: 'rr', labelKey: 'tires.corner_rr' },
] as const

/** Os pneus com leitura válida, do mais baixo para o mais alto. */
function sortedTires(state: VehicleState): { value: number; labelKey: string }[] {
  return TIRE_CORNERS
    .map(corner => ({ value: state.tires[corner.key], labelKey: corner.labelKey }))
    .filter((t): t is { value: number; labelKey: string } => t.value !== undefined)
    .sort((a, b) => a.value - b.value)
}

function chargingSummary(group: ResolvedGroup, state: VehicleState, t: TranslateFn, language: string): string {
  const { charging } = state
  switch (group.summary) {
    case 'limit':
      return state.chargeLimit === undefined ? DASH : t('charging.limit', { percent: state.chargeLimit })
    case 'phase':
      if (charging.phase === 'charging') return t(charging.speed === 'fast' ? 'charging.fast' : 'charging.slow')
      return t(`charging.${charging.phase}`)
    case 'eta':
      if (charging.remainingMinutes !== undefined) return formatDuration(charging.remainingMinutes, t)
      if (charging.finishTime) return formatTimeOfDay(charging.finishTime, language)
      return DASH
    default:
      return state.battery === undefined ? DASH : `${formatNumber(state.battery, 1)} %`
  }
}

function statusSummary(group: ResolvedGroup, state: VehicleState, t: TranslateFn): string {
  switch (group.summary) {
    case 'openings': {
      const { openCount } = state.openings
      if (openCount === 0) return t('openings.all_closed')
      if (openCount === 1) return t('openings.open_one')
      return t('openings.open_count', { count: openCount })
    }
    case 'trunk':
      if (state.openings.trunk === undefined) return DASH
      return t(state.openings.trunk ? 'openings.open' : 'openings.closed')
    default: {
      const { locked } = state.lock
      if (locked === undefined) return t('doors_unknown')
      return t(locked ? 'doors_locked' : 'doors_unlocked')
    }
  }
}

function climateSummary(group: ResolvedGroup, state: VehicleState, t: TranslateFn): string {
  const { climate } = state
  switch (group.summary) {
    case 'target':
      return climate.targetC === undefined ? DASH : `${formatNumber(climate.targetC, 1)} °C`
    case 'state':
      return climate.on === undefined ? DASH : t(climate.on ? 'climate.state_on' : 'climate.state_off')
    default:
      return climate.interiorC === undefined ? DASH : `${formatNumber(climate.interiorC)} °C`
  }
}

function tiresSummary(group: ResolvedGroup, state: VehicleState, t: TranslateFn): string {
  const sorted = sortedTires(state)
  if (sorted.length === 0) return DASH
  const lowest = sorted[0]!
  switch (group.summary) {
    case 'min':
      return `${formatNumber(lowest.value, 1)} bar`
    case 'worst':
      // O canto vai com o número: saber que está baixo sem saber qual é
      // obriga a abrir a sub-vista, que é precisamente o que o resumo
      // existe para evitar.
      return `${formatNumber(lowest.value, 1)} bar ${t(lowest.labelKey)}`
    default: {
      const highest = sorted[sorted.length - 1]!
      if (sorted.length === 1) return `${formatNumber(lowest.value, 1)} bar`
      return `${formatNumber(lowest.value, 1)} – ${formatNumber(highest.value, 1)} bar`
    }
  }
}

function tripSummary(group: ResolvedGroup, state: VehicleState): string {
  const { trip } = state
  switch (group.summary) {
    case 'last7':
      return trip.last7DaysKm === undefined ? DASH : `${formatNumber(trip.last7DaysKm)} km`
    case 'consumption':
      return trip.avgConsumption === undefined ? DASH : `${formatNumber(trip.avgConsumption, 1)} kWh/100 km`
    default:
      return trip.odometerKm === undefined ? DASH : `${formatNumber(trip.odometerKm)} km`
  }
}

function locationSummary(group: ResolvedGroup, state: VehicleState, t: TranslateFn): string {
  switch (group.summary) {
    case 'zone':
      return state.location?.zone ?? t('location.unknown')
    case 'age':
      return state.location?.ageSeconds === undefined ? DASH : formatAgo(state.location.ageSeconds, t)
    default:
      // `activity.unknown` não existe no catálogo, de propósito: não se anuncia
      // uma atividade que não se conhece.
      return state.activity === 'unknown' ? DASH : t(`activity.${state.activity}`)
  }
}

/**
 * O texto que o tile do grupo mostra debaixo do título. O `group.summary` já
 * vem validado pelo `resolveGrid` — nenhum destes `switch` precisa de tratar um
 * resumo que não seja do grupo, e o `default` de cada um é o resumo por
 * omissão, que é o primeiro da lista do catálogo.
 */
export function summaryFor(
  group: ResolvedGroup, state: VehicleState, t: TranslateFn, language: string,
): string {
  switch (group.id) {
    case 'charging': return chargingSummary(group, state, t, language)
    case 'status': return statusSummary(group, state, t)
    case 'climate': return climateSummary(group, state, t)
    case 'tires': return tiresSummary(group, state, t)
    case 'trip': return tripSummary(group, state)
    case 'location': return locationSummary(group, state, t)
  }
}
```

- [ ] **Step 5: Correr os testes**

Run: `npm run typecheck && npm test`
Expected: PASS. O teste de paridade de catálogos confirma que as chaves entraram nos dois.

- [ ] **Step 6: Commit**

```bash
git add src/groups.ts test/groups.test.ts src/translations/en.json src/translations/pt.json
git commit -m "feat: calcular o resumo de cada tile da grelha

O valor que aparece debaixo do título do tile, por grupo e por resumo
escolhido. É este texto que faz a grelha informar antes de se abrir
nada, que é a diferença entre uma grelha de botões e uma grelha útil.

O resumo `worst` dos pneus leva o canto com o número: saber que está
baixo sem saber qual é obrigava a abrir a sub-vista, que é o que o
resumo existe para evitar."
```

---

## Task 4: `alertFor`

O nível de alerta de cada tile. Puro.

**Files:**
- Modify: `src/groups.ts`
- Modify: `test/groups.test.ts`

**Interfaces:**
- Consumes: `ResolvedGroup` (Task 2), `DEFAULT_TIRE_RANGE` (Task 1), e **os auxiliares `group(id, summary?)` e `realState(overrides?)` que a Task 3 acrescentou ao topo de `test/groups.test.ts`** — os testes abaixo contam com eles e não os redefinem.
- Produces: `AlertLevel = 'none' | 'warn' | 'alert'`, `alertFor(group: ResolvedGroup, state: VehicleState, tireRange: readonly [number, number]): AlertLevel`

- [ ] **Step 1: Escrever o teste que falha**

Acrescenta a `test/groups.test.ts` (junta `alertFor` ao `import` de `../src/groups` e `DEFAULT_TIRE_RANGE` ao de `../src/types`):

```ts
const RANGE = DEFAULT_TIRE_RANGE

describe('alertFor — estado', () => {
  it('não alerta com o carro trancado e tudo fechado', () => {
    // Nas fixtures a leitura das trancas é `cloud_stale`, portanto obsoleta.
    expect(alertFor(group('status'), realState(), RANGE)).toBe('none')
  })

  it('avisa com uma abertura aberta', () => {
    expect(alertFor(group('status'), realState({ 'binary_sensor/trunk_open': 'on' }), RANGE)).toBe('warn')
  })

  it('avisa com o carro destrancado, quando a leitura é fresca', () => {
    const state = realState({ 'lock/vehicle_lock': 'unlocked', 'sensor/lock_state_source': 'cloud' })
    expect(alertFor(group('status'), state, RANGE)).toBe('warn')
  })

  it('não alerta com o carro destrancado numa leitura obsoleta', () => {
    // Uma leitura velha não é um alerta, é uma leitura velha. Ver spec §4.2.
    const state = realState({ 'lock/vehicle_lock': 'unlocked' })
    expect(state.lock.stale).toBe(true)
    expect(alertFor(group('status'), state, RANGE)).toBe('none')
  })

  it('avisa por abertura aberta mesmo com as trancas obsoletas', () => {
    // A obsolescência é da leitura das trancas, não da bagageira.
    const state = realState({ 'binary_sensor/trunk_open': 'on' })
    expect(state.lock.stale).toBe(true)
    expect(alertFor(group('status'), state, RANGE)).toBe('warn')
  })
})

describe('alertFor — pneus', () => {
  it('não alerta com todos dentro da faixa', () => {
    // `as const` não é decoração: sem ele o literal é inferido como `number[]`
    // e não é atribuível ao `readonly [number, number]` que a função pede.
    expect(alertFor(group('tires'), realState(), [0, 99] as const)).toBe('none')
  })

  it('avisa com um fora da faixa', () => {
    const state = realState({ 'sensor/tire_pressure_front_left_bar': '1.9' })
    expect(alertFor(group('tires'), state, RANGE)).toBe('warn')
  })

  it('escala para alerta com dois ou mais fora da faixa', () => {
    const state = realState({
      'sensor/tire_pressure_front_left_bar': '1.9',
      'sensor/tire_pressure_rear_right_bar': '1.8',
    })
    expect(alertFor(group('tires'), state, RANGE)).toBe('alert')
  })

  it('conta como fora tanto o abaixo do mínimo como o acima do máximo', () => {
    const low = realState({ 'sensor/tire_pressure_front_left_bar': '1.9' })
    const high = realState({ 'sensor/tire_pressure_front_left_bar': '3.1' })
    expect(alertFor(group('tires'), low, RANGE)).toBe('warn')
    expect(alertFor(group('tires'), high, RANGE)).toBe('warn')
  })

  it('respeita a faixa configurada em vez dos limiares antigos', () => {
    // 2,8 bar é aviso na faixa por omissão e normal numa faixa mais larga.
    const state = realState({ 'sensor/tire_pressure_front_left_bar': '2.8' })
    expect(alertFor(group('tires'), state, RANGE)).toBe('warn')
    expect(alertFor(group('tires'), state, [2.4, 3.0] as const)).toBe('none')
  })

  it('não conta um pneu sem leitura como fora da faixa', () => {
    const state = realState({ 'sensor/tire_pressure_front_left_bar': 'unavailable' })
    expect(alertFor(group('tires'), state, RANGE)).toBe('none')
  })
})

describe('alertFor — localização e os grupos sem alerta', () => {
  it('avisa com a posição obsoleta, que é o caso das fixtures', () => {
    expect(alertFor(group('location'), realState(), RANGE)).toBe('warn')
  })

  it('não alerta na carga, no clima nem na viagem', () => {
    // A carga usa a cor da bateria, que já tem a semântica certa; o clima e a
    // viagem não têm nada que se leia como problema.
    for (const id of ['charging', 'climate', 'trip'] as const) {
      expect(alertFor(group(id), realState(), RANGE), id).toBe('none')
    }
  })
})

describe('alertFor — carro offline', () => {
  it('não alerta em nada quando o carro está offline', () => {
    // Ausência de leitura não é alerta. Ver spec §4.2.
    const state = { ...realState(), online: false }
    for (const id of ['charging', 'status', 'climate', 'tires', 'trip', 'location'] as const) {
      expect(alertFor(group(id), state, RANGE), id).toBe('none')
    }
  })
})
```

- [ ] **Step 2: Correr o teste para confirmar que falha**

Run: `npm test -- groups`
Expected: FAIL — `alertFor is not a function`.

- [ ] **Step 3: Implementar em `src/groups.ts`**

```ts
export type AlertLevel = 'none' | 'warn' | 'alert'

/**
 * O nível de alerta do tile de um grupo. Três regras que valem a pena fixar
 * aqui, porque nenhuma delas é óbvia:
 *
 *  - **Offline não alerta.** Ausência de leitura não é problema; um card que
 *    ficasse todo âmbal ao perder a ligação à cloud ensinava a ignorá-lo.
 *  - **Trancas obsoletas não alertam.** O card já distingue `lock.stale`, e
 *    uma leitura velha é uma leitura velha, não um carro aberto. As aberturas
 *    são leituras independentes e continuam a avisar.
 *  - **A carga não tem alerta.** Usa `batteryColor()`, que já dá verde, âmbar
 *    e vermelho por percentagem — a semântica certa, já escrita.
 */
export function alertFor(
  group: ResolvedGroup, state: VehicleState, tireRange: readonly [number, number],
): AlertLevel {
  if (!state.online) return 'none'

  switch (group.id) {
    case 'status': {
      if (state.openings.openCount > 0) return 'warn'
      if (state.lock.locked === false && !state.lock.stale) return 'warn'
      return 'none'
    }
    case 'tires': {
      const [min, max] = tireRange
      const outside = Object.values(state.tires)
        .filter((value): value is number => value !== undefined)
        .filter(value => value < min || value > max)
        .length
      if (outside >= 2) return 'alert'
      if (outside === 1) return 'warn'
      return 'none'
    }
    case 'location':
      return state.location?.stale === true ? 'warn' : 'none'
    case 'charging':
    case 'climate':
    case 'trip':
      return 'none'
  }
}
```

- [ ] **Step 4: Correr os testes**

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/groups.ts test/groups.test.ts
git commit -m "feat: decidir o nível de alerta de cada tile

A grelha passa a poder dizer o que precisa de atenção sem se abrir
nada, que é onde o vehicle-info-card deixa margem: lá só a palavra
Unlocked muda de cor.

Três regras que não são óbvias e ficam fixadas em comentário: offline
não alerta, trancas obsoletas não alertam (mas aberturas sim, que são
leituras independentes), e a carga não tem alerta porque o
batteryColor já tem a semântica certa."
```

---

## Task 5: `decideSwipe`

A decisão do gesto, separada do DOM para poder ser testada.

**Files:**
- Create: `src/swipe.ts`
- Create: `test/swipe.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `SWIPE_THRESHOLD_PX: number`, `SwipeDecision = 'prev' | 'next' | 'none' | 'scroll'`, `decideSwipe(dx: number, dy: number, threshold?: number): SwipeDecision`

- [ ] **Step 1: Escrever o teste que falha**

Cria `test/swipe.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { SWIPE_THRESHOLD_PX, decideSwipe } from '../src/swipe'

/**
 * A decisão do gesto vive numa função pura pela mesma razão do `decideAction`
 * e do `mapRequestChanged`: é aqui que está o que pode estar errado. A cola no
 * DOM — três listeners de pointer que chamam esta função — fica sem teste, e
 * de propósito: este projeto corre os testes em `environment: 'node'` e um
 * jsdom que não faz scroll não afirmaria nada sobre o conflito com o scroll do
 * dashboard, que é o único risco real do gesto.
 */
describe('decideSwipe', () => {
  it('entrega o gesto ao dashboard quando o dedo vai mais para baixo que para o lado', () => {
    expect(decideSwipe(20, 60)).toBe('scroll')
    expect(decideSwipe(-20, -60)).toBe('scroll')
  })

  it('entrega ao dashboard um arrasto puramente vertical', () => {
    expect(decideSwipe(0, 120)).toBe('scroll')
  })

  it('ignora um movimento horizontal curto demais para ser intenção', () => {
    expect(decideSwipe(10, 0)).toBe('none')
    expect(decideSwipe(-10, 4)).toBe('none')
  })

  it('ignora um toque sem movimento', () => {
    expect(decideSwipe(0, 0)).toBe('none')
  })

  it('traz o anterior quando se arrasta para a direita', () => {
    expect(decideSwipe(80, 0)).toBe('prev')
    expect(decideSwipe(80, 20)).toBe('prev')
  })

  it('leva ao seguinte quando se arrasta para a esquerda', () => {
    expect(decideSwipe(-80, 0)).toBe('next')
    expect(decideSwipe(-80, -20)).toBe('next')
  })

  it('trata o limiar como inclusivo no valor exacto', () => {
    expect(decideSwipe(SWIPE_THRESHOLD_PX, 0)).toBe('prev')
    expect(decideSwipe(SWIPE_THRESHOLD_PX - 1, 0)).toBe('none')
  })

  it('aceita um limiar próprio, para quem teste com outros valores', () => {
    expect(decideSwipe(30, 0, 20)).toBe('prev')
    expect(decideSwipe(30, 0, 100)).toBe('none')
  })

  it('prefere o scroll ao gesto quando os dois eixos empatam', () => {
    // Empate não é intenção horizontal. Na dúvida, o scroll do dashboard ganha:
    // perder um deslize é um inconveniente, prender o scroll é uma avaria.
    expect(decideSwipe(80, 80)).toBe('scroll')
    expect(decideSwipe(-80, 80)).toBe('scroll')
  })
})
```

- [ ] **Step 2: Correr o teste para confirmar que falha**

Run: `npm test -- swipe`
Expected: FAIL — `Cannot find module '../src/swipe'`.

- [ ] **Step 3: Implementar**

Cria `src/swipe.ts`:

```ts
/**
 * Quanto tem de andar um dedo, na horizontal, para contar como intenção de
 * passar de sub-vista. Abaixo disto é o tremor de um toque.
 */
export const SWIPE_THRESHOLD_PX = 48

export type SwipeDecision = 'prev' | 'next' | 'none' | 'scroll'

/**
 * Decide o que fazer com um arrasto. Metade do conflito com o scroll vertical
 * do dashboard resolve-se em CSS, com `touch-action: pan-y` no contentor da
 * sub-vista; a outra metade é esta função.
 *
 * O empate entre eixos vai para `'scroll'` de propósito: perder um deslize é um
 * inconveniente, prender o scroll do dashboard é uma avaria.
 */
export function decideSwipe(dx: number, dy: number, threshold = SWIPE_THRESHOLD_PX): SwipeDecision {
  if (Math.abs(dy) >= Math.abs(dx) && dy !== 0) return 'scroll'
  if (Math.abs(dx) < threshold) return 'none'
  return dx > 0 ? 'prev' : 'next'
}
```

- [ ] **Step 4: Correr os testes**

Run: `npm run typecheck && npm test`
Expected: PASS, com dez testes novos.

Verifica em particular o caso `decideSwipe(0, 0)`: `Math.abs(0) >= Math.abs(0)` é verdade, mas `dy !== 0` é falso, logo cai no limiar e devolve `'none'`, que é o esperado.

- [ ] **Step 5: Commit**

```bash
git add src/swipe.ts test/swipe.test.ts
git commit -m "feat: decidir o eixo de um arrasto sem tocar no DOM

O deslize horizontal entre sub-vistas convive com o scroll vertical do
dashboard: metade resolve-se com touch-action: pan-y, a outra metade é
esta decisão. Fica pura, como o decideAction, porque é aqui que está o
que pode estar errado.

O empate entre eixos vai para scroll de propósito: perder um deslize é
um inconveniente, prender o scroll é uma avaria."
```

---

## Task 6: vista de topo do carro, pneus redesenhados e cores com nome próprio

**Files:**
- Create: `src/car-topview.ts`
- Modify: `src/theme.ts`
- Modify: `src/sections/tires.ts` (reescrita)
- Modify: `src/translations/en.json`, `src/translations/pt.json`

**Interfaces:**
- Consumes: `DEFAULT_TIRE_RANGE` (Task 1).
- Produces: `CAR_TOPVIEW: TemplateResult`; `--lm-warn` e `--lm-alert` em `sharedStyles`; a propriedade `limits: [number, number]` em `<leapmotor-tires>`.

**Sem teste unitário, e porquê:** não há decisão nova aqui — o predicado de fora-da-faixa passa a vir da configuração (já testado na Task 1) e o resto é SVG e CSS. Este projeto não tem harness de DOM (Global Constraints). A verificação é `npm run typecheck && npm run build` mais a inspeção visual no dashboard.

**Nota:** `src/sections/tiles.ts` também usa `--leapmotor-battery-mid` para um aviso, e **não se toca nele**: a Task 11 apaga-o.

- [ ] **Step 1: Criar `src/car-topview.ts`**

```ts
import { html, type TemplateResult } from 'lit'

/**
 * O carro visto de cima, POR FORA, para servir de base aos quatro valores de
 * pressão. Desenho original, feito de rectângulos e círculos; o repositório é
 * GPL v3 e não distribui — nem decalca — arte da Leapmotor.
 *
 * NÃO É o `cabin-topview.ts`, e não o substitui. Aquele é o habitáculo: não tem
 * carroçaria, nem nariz, nem rodas, e as posições em percentagem dos controlos
 * de conforto em `climate-panel.ts` resolvem contra a sua caixa de 200 x 240.
 * Este tem rodas, que é onde um valor de pressão se ancora, e vive numa caixa
 * própria — mexer num não mexe no outro.
 *
 * A caixa é 200 x 320 (1 : 1,6), a proporção de um SUV visto de cima. O que
 * está desenhado, de cima (frente) para baixo:
 *   - a carroçaria, um rectângulo de cantos muito redondos (x 34 a 166), com o
 *     nariz mais estreito que a traseira;
 *   - o para-brisas e o vidro traseiro, dois trapézios;
 *   - o tejadilho entre eles;
 *   - quatro rodas, rectângulos verticais de cantos redondos, dois no eixo da
 *     frente (y 58) e dois no de trás (y 232), a sair para fora da carroçaria.
 *
 * As rodas estão nos cantos porque é aí que os valores as encontram: o
 * `tires.ts` põe cada número ao lado da sua, com a grelha a resolver contra
 * esta mesma caixa. Mexer nas rodas obriga a revê-la.
 */
export const CAR_TOPVIEW: TemplateResult = html`
  <svg viewBox="0 0 200 320" aria-hidden="true" part="topview">
    <g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" opacity="0.32">
      <path d="M100 14 C132 14 158 30 162 62 L166 214 C166 274 150 300 100 300 C50 300 34 274 34 214 L38 62 C42 30 68 14 100 14 Z" />

      <path d="M62 96 L138 96 L146 130 L54 130 Z" />
      <path d="M56 226 L144 226 L138 260 L62 260 Z" />
      <path d="M54 130 L146 130 L144 226 L56 226 Z" />

      <rect x="22" y="58" width="14" height="44" rx="6" />
      <rect x="164" y="58" width="14" height="44" rx="6" />
      <rect x="22" y="232" width="14" height="44" rx="6" />
      <rect x="164" y="232" width="14" height="44" rx="6" />
    </g>
  </svg>
`
```

- [ ] **Step 2: Acrescentar os símbolos de cor a `src/theme.ts`**

Dentro do bloco `:host` de `sharedStyles`, depois do `--lm-chip`:

```css
    /*
     * Aviso e alerta com nome próprio. Antes disto, o aviso de pressão de pneu
     * em `tires.ts` usava `--leapmotor-battery-mid`: um aviso de pneu a pedir
     * emprestada a cor da bateria. Os valores por omissão são os mesmos que
     * eram, para nada mudar de aspeto — muda só de significado, e o significado
     * é o que um tema de utilizador precisa de poder redefinir.
     */
    --lm-warn: var(--leapmotor-warn, #f5a623);
    --lm-alert: var(--leapmotor-alert, #e5484d);
```

- [ ] **Step 3: Acrescentar as chaves de tradução**

Ao objeto `tires` existente nos dois catálogos.

`pt.json`: `"no_warning": "Sem perda de pressão detetada"`, `"unit": "bar"`
`en.json`: `"no_warning": "No pressure loss detected"`, `"unit": "bar"`

- [ ] **Step 4: Reescrever `src/sections/tires.ts`**

```ts
import { LitElement, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { CAR_TOPVIEW } from '../car-topview'
import { formatNumber } from '../format'
import type { TranslateFn } from '../localize'
import { sharedStyles } from '../theme'
import { DEFAULT_TIRE_RANGE, type VehicleState } from '../types'

const CORNERS = [
  { key: 'fl', tk: 'tires.corner_fl', area: 'fl' },
  { key: 'fr', tk: 'tires.corner_fr', area: 'fr' },
  { key: 'rl', tk: 'tires.corner_rl', area: 'rl' },
  { key: 'rr', tk: 'tires.corner_rr', area: 'rr' },
] as const

@customElement('leapmotor-tires')
export class LeapmotorTires extends LitElement {
  @property({ attribute: false }) state!: VehicleState
  @property({ attribute: false }) t!: TranslateFn
  /**
   * A faixa considerada normal, já validada pelo card (`clampTireRange`). Era
   * uma constante fixa neste ficheiro, e era estreita: um carro a 2,8 bar
   * acusava aviso. Chama-se `limits` e não `range` para não se confundir com a
   * autonomia, que em `VehicleState` também é `range`.
   */
  @property({ attribute: false }) limits: readonly [number, number] = DEFAULT_TIRE_RANGE

  private outOfRange(v: number | undefined): boolean {
    const [min, max] = this.limits
    return v !== undefined && (v < min || v > max)
  }

  override render() {
    const tires = this.state.tires
    const anyWarning = CORNERS.some(c => this.outOfRange(tires[c.key]))
    return html`<div class="panel">
      <div class="title">${this.t('tires.title')}</div>
      <div class="diagram">
        <div class="car">${CAR_TOPVIEW}</div>
        ${CORNERS.map(c => html`
          <div class="corner ${c.area} ${this.outOfRange(tires[c.key]) ? 'warn' : ''}">
            <div class="pressure">
              ${formatNumber(tires[c.key], 1)}
              <span class="unit muted">${this.t('tires.unit')}</span>
            </div>
            <div class="corner-label muted">${this.t(c.tk)}</div>
          </div>
        `)}
      </div>
      <div class="footer ${anyWarning ? 'warn' : 'muted'}">
        ${anyWarning ? this.t('tires.warning') : this.t('tires.no_warning')}
      </div>
    </div>`
  }

  static override styles = [sharedStyles, css`
    .title { font-size: 1.05rem; font-weight: 600; margin-bottom: 12px; }
    /*
     * Cinco células: o carro ao centro, um valor em cada canto. A grelha
     * resolve contra a caixa do CAR_TOPVIEW, que é 200 x 320 — daí a coluna
     * do meio ser a mais larga e as linhas do meio serem as que sobram.
     */
    .diagram {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      grid-template-rows: auto 1fr auto;
      grid-template-areas:
        "fl car fr"
        ".  car ."
        "rl car rr";
      align-items: center; justify-items: center;
      gap: 4px 8px;
    }
    .car { grid-area: car; display: flex; }
    .car svg { width: 100%; max-width: 110px; height: auto; max-height: 220px; }
    .corner.fl { grid-area: fl; }
    .corner.fr { grid-area: fr; }
    .corner.rl { grid-area: rl; }
    .corner.rr { grid-area: rr; }
    .corner { text-align: center; }
    .corner.warn .pressure { color: var(--lm-warn); }
    .pressure { font-size: 1.35rem; font-weight: 500; white-space: nowrap; }
    .pressure .unit { font-size: 0.75rem; font-weight: 400; }
    .corner-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; }
    .footer { margin-top: 12px; font-size: 0.78rem; text-align: center; }
    .footer.warn { color: var(--lm-warn); }
    @media (max-width: 340px) {
      .pressure { font-size: 1.1rem; }
      .car svg { max-width: 84px; }
    }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-tires': LeapmotorTires }
}
```

- [ ] **Step 5: Verificar**

Run: `npm run typecheck && npm test && npm run build`
Expected: tudo passa. Os 138 testes existentes não tocam em `tires.ts`, portanto nenhum quebra.

- [ ] **Step 6: Commit**

```bash
git add src/car-topview.ts src/theme.ts src/sections/tires.ts src/translations/en.json src/translations/pt.json
git commit -m "feat: pôr as pressões em volta de uma vista de topo do carro

Os quatro valores passam de uma grelha de caixas para os cantos de um
desenho do carro visto de cima, que é onde a pressão de um pneu se lê
sem tradução mental.

O desenho é novo e não reaproveita o cabin-topview.ts: aquele é o
habitáculo, não tem rodas, e as posições dos controlos de conforto
resolvem contra a sua caixa — mexer-lhe partia o painel de clima.

A faixa normal deixa de ser uma constante deste ficheiro e passa a vir
do card. E o aviso deixa de pedir emprestada a cor da bateria: o tema
ganha --lm-warn e --lm-alert, com os mesmos valores e o significado
certo."
```

---

## Task 7: `openings.ts` — o estado do veículo em linhas acionáveis

**Files:**
- Create: `src/sections/openings.ts`
- Modify: `src/translations/en.json`, `src/translations/pt.json`

**Interfaces:**
- Consumes: `isActionAvailable`, `actionLabel`, `actionIcon`, `BLOCKED_WHILE_DRIVING`, `ActionEventDetail` (todos já em `src/actions.ts`); as chaves `openings.*` da Task 3.
- Produces: `<leapmotor-openings>` com as propriedades `state`, `t`, `map`, `pending`. Emite `leapmotor-action` com `ActionEventDetail`, exatamente como a fila de ações.

**Sem teste unitário:** ver a nota da Task 6. Toda a lógica de ação é reaproveitada de `actions.ts`, que tem 531 linhas de testes.

- [ ] **Step 1: Acrescentar as chaves de tradução**

Ao objeto `openings` existente, nos dois catálogos.

`pt.json`:
```json
    "title": "Estado do veículo",
    "locks": "Trancas",
    "windows": "Vidros",
    "doors": "Portas",
    "trunk": "Bagageira",
    "roof": "Teto"
```

`en.json`:
```json
    "title": "Vehicle status",
    "locks": "Locks", "windows": "Windows", "doors": "Doors",
    "trunk": "Trunk", "roof": "Roof"
```

- [ ] **Step 2: Criar `src/sections/openings.ts`**

```ts
import { LitElement, css, html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import {
  BLOCKED_WHILE_DRIVING, actionIcon, actionLabel, isActionAvailable, type ActionEventDetail,
} from '../actions'
import { isWindowOpen } from '../format'
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

  private boolValue(v: boolean | undefined): string {
    if (v === undefined) return DASH
    return this.t(v ? 'openings.open' : 'openings.closed')
  }

  private rows(): Row[] {
    const o = this.state.openings
    const { locked } = this.state.lock
    const openWindows = this.openWindowCount()
    const openDoors = this.openDoors()

    return [
      {
        key: 'locks',
        icon: locked === false ? 'mdi:lock-open-variant-outline' : 'mdi:lock-outline',
        label: this.t('openings.locks'),
        value: locked === undefined ? this.t('doors_unknown') : this.t(locked ? 'doors_locked' : 'doors_unlocked'),
        warn: locked === false && !this.state.lock.stale,
        // A ação é a oposta do estado. Quando o estado é desconhecido oferece-se
        // trancar, que é o lado seguro.
        action: locked === false ? 'lock' : 'unlock',
      },
      {
        key: 'windows',
        icon: actionIcon('windows', this.state),
        label: this.t('openings.windows'),
        value: openWindows === 0
          ? this.t('openings.all_closed')
          : this.t(openWindows === 1 ? 'openings.open_one' : 'openings.open_count', { count: openWindows }),
        detail: openWindows > 0 ? this.openWindowNames().join(' · ') : undefined,
        warn: openWindows > 0,
        action: 'windows',
      },
      {
        key: 'doors',
        icon: 'mdi:car-door',
        label: this.t('openings.doors'),
        value: openDoors.length === 0 ? this.t('openings.all_closed') : this.t('openings.open_count', { count: openDoors.length }),
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
        value: this.boolValue(o.trunk),
        warn: o.trunk === true,
        action: 'trunk',
      },
      {
        key: 'roof',
        icon: 'mdi:window-shutter',
        label: this.t('openings.roof'),
        value: this.boolValue(o.roof),
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
     * Seletor composto: o `button.plain` do theme.ts faz `all: unset` a
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
```

- [ ] **Step 3: Verificar**

Run: `npm run typecheck && npm test && npm run build`
Expected: tudo passa. Confirma que `BLOCKED_WHILE_DRIVING` e `isActionAvailable` são de facto exportados de `src/actions.ts` — a fila de ações já os importa, portanto são.

- [ ] **Step 4: Commit**

```bash
git add src/sections/openings.ts src/translations/en.json src/translations/pt.json
git commit -m "feat: estado do veículo em linhas que também comandam

No vehicle-info-card as sub-vistas são só de leitura e os comandos
vivem noutra secção. Aqui a linha «Vidros · 2 abertos» é o botão que os
fecha: o actions.ts já sabia comandar o que estas linhas mostram, e o
confirm_actions aplica-se sem alterações.

As portas ficam só de leitura porque não há comando de porta na
integração. Uma linha com um botão que não faz nada é pior do que uma
linha sem botão."
```

---

## Task 8: `group-grid.ts` — a grelha

**Files:**
- Create: `src/sections/group-grid.ts`

**Interfaces:**
- Consumes: `AlertLevel`, `ResolvedGroup` (Tasks 2 e 4), `batteryColor` (`theme.ts`), `--lm-warn`/`--lm-alert` (Task 6).
- Produces: `GridTile { group, title, summary, alert }`; `<leapmotor-group-grid>` com `tiles`, `state`, `t`; o método público `focusTile(id: GroupId): void`; emite `leapmotor-open-group` com `{ group: GroupId }`.

**Sem teste unitário:** ver a nota da Task 6. As decisões que este componente mostra estão todas testadas nas Tasks 2, 3 e 4.

- [ ] **Step 1: Criar `src/sections/group-grid.ts`**

```ts
import { LitElement, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import type { AlertLevel, ResolvedGroup } from '../groups'
import { batteryColor, sharedStyles } from '../theme'
import type { GroupId, VehicleState } from '../types'

export interface GridTile {
  group: ResolvedGroup
  /** Já resolvido: a sobreposição do utilizador, ou a tradução. */
  title: string
  summary: string
  alert: AlertLevel
}

@customElement('leapmotor-group-grid')
export class LeapmotorGroupGrid extends LitElement {
  @property({ attribute: false }) tiles: GridTile[] = []
  @property({ attribute: false }) state!: VehicleState

  /**
   * Devolve o foco ao tile que abriu uma sub-vista. Chamado pelo card depois de
   * fechar: sem isto, o foco voltava ao topo do documento e navegar por teclado
   * dava-se por perdido.
   */
  public focusTile(id: GroupId): void {
    this.renderRoot.querySelector<HTMLButtonElement>(`button[data-group="${id}"]`)?.focus()
  }

  private open(id: GroupId) {
    this.dispatchEvent(new CustomEvent('leapmotor-open-group', {
      detail: { group: id }, bubbles: true, composed: true,
    }))
  }

  /**
   * A cor do ícone e do resumo. A carga é a excepção e não passa pelo nível de
   * alerta: usa a cor da bateria, que já dá verde, âmbar e vermelho por
   * percentagem, e que o hero já mostra na barra logo acima. Ver spec §4.2.
   */
  private accent(tile: GridTile): string {
    if (tile.group.id === 'charging') return batteryColor(this.state.battery)
    if (tile.alert === 'alert') return 'var(--lm-alert)'
    if (tile.alert === 'warn') return 'var(--lm-warn)'
    return 'var(--lm-text)'
  }

  override render() {
    return html`<div class="grid">
      ${this.tiles.map(tile => html`
        <button
          class="tile plain ${tile.alert}"
          data-group=${tile.group.id}
          aria-label="${tile.title}: ${tile.summary}"
          @click=${() => this.open(tile.group.id)}
        >
          <span class="icon" style="color:${this.accent(tile)}">
            <ha-icon icon=${tile.group.icon}></ha-icon>
          </span>
          <span class="text">
            <span class="tile-title">${tile.title}</span>
            <span class="tile-summary" style="color:${this.accent(tile)}">${tile.summary}</span>
          </span>
        </button>
      `)}
    </div>`
  }

  static override styles = [sharedStyles, css`
    .grid {
      display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px; margin-top: var(--lm-gap);
    }
    /*
     * Seletor composto, e não `.tile`: o `button.plain` do theme.ts faz
     * `all: unset` a (0,1,1) e apagaria fundo, padding, cantos, dimensões e
     * box-sizing. Ver o aviso no theme.ts — isto já produziu seis defeitos
     * neste projeto, dois deles visíveis no dashboard de um utilizador.
     */
    button.tile.plain {
      box-sizing: border-box; display: flex; align-items: center; gap: 12px;
      width: 100%; min-width: 0; padding: 12px;
      background: var(--lm-chip); border-radius: var(--lm-radius);
      text-align: start; color: var(--lm-text);
      transition: transform 120ms ease;
    }
    button.tile.plain:active { transform: scale(0.985); }
    button.tile.plain.warn { box-shadow: inset 0 0 0 1px var(--lm-warn); }
    button.tile.plain.alert { box-shadow: inset 0 0 0 1px var(--lm-alert); }
    .icon {
      display: grid; place-items: center; flex: 0 0 auto;
      width: 38px; height: 38px; border-radius: 50%;
      background: var(--card-background-color);
    }
    .text { display: flex; flex-direction: column; min-width: 0; }
    .tile-title { font-size: 0.9rem; font-weight: 600; }
    .tile-summary {
      font-size: 0.8rem; margin-top: 2px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    @media (max-width: 320px) { .grid { grid-template-columns: minmax(0, 1fr); } }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-group-grid': LeapmotorGroupGrid }
}
```

- [ ] **Step 2: Verificar**

Run: `npm run typecheck && npm test && npm run build`
Expected: tudo passa.

- [ ] **Step 3: Commit**

```bash
git add src/sections/group-grid.ts
git commit -m "feat: grelha de grupos, com resumo e alerta em cada tile

Um tile burro: recebe título, ícone, texto e nível, e pinta. Toda a
decisão fica no groups.ts, que é puro e testado.

A carga não passa pelo nível de alerta e usa a cor da bateria, que já
tem a semântica certa e que o hero mostra na barra logo acima.

O focusTile existe para o card devolver o foco ao tile que abriu uma
sub-vista: sem isso, fechar por teclado deixava o foco no topo do
documento."
```

---

## Task 9: `group-detail.ts` — a moldura da sub-vista

**Files:**
- Create: `src/sections/group-detail.ts`
- Modify: `src/translations/en.json`, `src/translations/pt.json`

**Interfaces:**
- Consumes: `decideSwipe` (Task 5).
- Produces: `<leapmotor-group-detail>` com `t`, `heading`, `navigable`, `reservedHeight`, `updatedLabel` e um `<slot>` para as secções. Emite `leapmotor-close`, `leapmotor-nav` com `{ delta: -1 | 1 }`, e `leapmotor-measured` com `{ height: number }`.

**Sem teste unitário:** ver a nota da Task 6. A decisão do gesto está testada na Task 5.

- [ ] **Step 1: Acrescentar as chaves de tradução**

Nos dois catálogos, um objeto `detail` novo.

`pt.json`: `{ "close": "Fechar", "previous": "Anterior", "next": "Seguinte" }`
`en.json`: `{ "close": "Close", "previous": "Previous", "next": "Next" }`

- [ ] **Step 2: Criar `src/sections/group-detail.ts`**

```ts
import { LitElement, css, html, nothing } from 'lit'
import { customElement, property, query } from 'lit/decorators.js'
import type { TranslateFn } from '../localize'
import { decideSwipe } from '../swipe'
import { sharedStyles } from '../theme'

@customElement('leapmotor-group-detail')
export class LeapmotorGroupDetail extends LitElement {
  @property({ attribute: false }) t!: TranslateFn
  @property({ type: String }) heading = ''
  /** Falso quando só há um grupo: navegar para si mesmo não é navegação. */
  @property({ type: Boolean }) navigable = false
  /** A maior altura já medida, imposta pelo card. Ver spec §4.3. */
  @property({ type: Number }) reservedHeight = 0
  /** O «Atualizado às…», já formatado pelo card. */
  @property({ type: String }) updatedLabel = ''

  @query('.wrap') private wrapEl?: HTMLElement
  @query('.content') private contentEl?: HTMLElement

  private observer?: ResizeObserver
  private pointerId?: number
  private startX = 0
  private startY = 0

  override firstUpdated() {
    // O foco vai para a moldura, e não para o primeiro botão: sem isto, as
    // setas do teclado e o Esc só funcionavam depois de alguém dar Tab.
    this.wrapEl?.focus()

    // Mede o CONTEÚDO, não o corpo. O corpo leva o `min-height` que o card
    // impõe: medi-lo era medir o próprio mínimo e o máximo nunca passava de
    // onde já estava.
    if (typeof ResizeObserver === 'undefined' || !this.contentEl) return
    this.observer = new ResizeObserver(entries => {
      const height = entries[0]?.contentRect.height
      if (height === undefined || height <= 0) return
      // Quem guarda o máximo é o card: sobrevive à troca de sub-vista, e este
      // elemento é destruído em cada troca.
      this.dispatchEvent(new CustomEvent('leapmotor-measured', {
        detail: { height }, bubbles: true, composed: true,
      }))
    })
    this.observer.observe(this.contentEl)
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this.observer?.disconnect()
    this.observer = undefined
  }

  private emit(name: string, detail?: unknown) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
  }

  private nav(delta: -1 | 1) { this.emit('leapmotor-nav', { delta }) }
  private close() { this.emit('leapmotor-close') }

  private onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.stopPropagation(); this.close(); return }
    if (!this.navigable) return
    if (e.key === 'ArrowLeft') { e.preventDefault(); this.nav(-1) }
    else if (e.key === 'ArrowRight') { e.preventDefault(); this.nav(1) }
  }

  private onPointerDown(e: PointerEvent) {
    // Só toque e caneta: com o rato, arrastar sobre o card é seleção de texto,
    // não um gesto.
    if (e.pointerType === 'mouse') return
    this.pointerId = e.pointerId
    this.startX = e.clientX
    this.startY = e.clientY
  }

  private onPointerEnd(e: PointerEvent) {
    if (this.pointerId !== e.pointerId) return
    this.pointerId = undefined
    if (e.type === 'pointercancel' || !this.navigable) return
    const decision = decideSwipe(e.clientX - this.startX, e.clientY - this.startY)
    if (decision === 'prev') this.nav(-1)
    else if (decision === 'next') this.nav(1)
  }

  override render() {
    const style = this.reservedHeight > 0 ? `min-height:${Math.round(this.reservedHeight)}px` : ''
    return html`<div
      class="wrap"
      role="group"
      aria-label=${this.heading}
      tabindex="-1"
      @keydown=${this.onKeyDown}
      @pointerdown=${this.onPointerDown}
      @pointerup=${this.onPointerEnd}
      @pointercancel=${this.onPointerEnd}
    >
      <div class="bar">
        <button class="nav plain" aria-label=${this.t('detail.close')} @click=${this.close}>
          <ha-icon icon="mdi:close"></ha-icon>
        </button>
        <div class="heading">${this.heading}</div>
        ${this.navigable
          ? html`
            <button class="nav plain" aria-label=${this.t('detail.previous')} @click=${() => this.nav(-1)}>
              <ha-icon icon="mdi:chevron-left"></ha-icon>
            </button>
            <button class="nav plain" aria-label=${this.t('detail.next')} @click=${() => this.nav(1)}>
              <ha-icon icon="mdi:chevron-right"></ha-icon>
            </button>`
          : nothing}
      </div>

      <div class="body" style=${style}>
        <div class="content"><slot></slot></div>
      </div>

      ${this.updatedLabel
        ? html`<div class="updated muted">${this.updatedLabel}</div>`
        : nothing}
    </div>`
  }

  static override styles = [sharedStyles, css`
    /*
     * `pan-y` entrega o arrasto vertical ao browser e deixa-nos só o
     * horizontal: é metade da convivência com o scroll do dashboard. A outra
     * metade é o `decideSwipe`.
     */
    .wrap { touch-action: pan-y; outline: none; }
    .wrap:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; border-radius: var(--lm-radius); }
    .bar {
      display: flex; align-items: center; gap: 4px;
      margin-top: var(--lm-gap);
    }
    .heading { flex: 1 1 auto; min-width: 0; font-size: 1.05rem; font-weight: 600; }
    /*
     * Seletor composto: o `button.plain` do theme.ts faz `all: unset` a
     * (0,1,1) e apagaria as dimensões, o raio e o box-sizing destes botões.
     */
    button.nav.plain {
      box-sizing: border-box; display: grid; place-items: center; flex: 0 0 auto;
      width: 34px; height: 34px; border-radius: 50%;
      background: var(--lm-chip); color: var(--lm-text);
    }
    button.nav.plain ha-icon { --mdc-icon-size: 20px; }
    .body { display: flex; flex-direction: column; }
    .content { flex: 1 1 auto; }
    .updated { margin-top: 10px; font-size: 0.72rem; text-align: center; }
    @media (prefers-reduced-motion: no-preference) {
      .content { animation: enter 160ms ease-out; }
      @keyframes enter { from { opacity: 0; transform: translateY(4px); } }
    }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-group-detail': LeapmotorGroupDetail }
}
```

- [ ] **Step 3: Verificar**

Run: `npm run typecheck && npm test && npm run build`
Expected: tudo passa.

- [ ] **Step 4: Commit**

```bash
git add src/sections/group-detail.ts src/translations/en.json src/translations/pt.json
git commit -m "feat: moldura da sub-vista, com teclado, gesto e altura medida

A barra fecha-e-navega, o corpo por slot, e o rodapé com a hora da
última leitura. As secções vêm por slot e não por tag dinâmica: quem as
instancia é o card, que é onde os dados estão.

Mede o conteúdo e não o corpo, de propósito: o corpo leva o min-height
que o card impõe, e medi-lo era medir o próprio mínimo.

O foco vai para a moldura no primeiro render, senão as setas e o Esc só
funcionavam depois de alguém dar Tab. E o touch-action: pan-y entrega o
arrasto vertical ao browser, que é metade da convivência com o scroll
do dashboard."
```

---

## Task 10: hero compacto

**Files:**
- Modify: `src/sections/hero.ts`

**Interfaces:**
- Consumes: nada de novo.
- Produces: a propriedade `compact: boolean` em `<leapmotor-hero>`.

- [ ] **Step 1: Acrescentar a propriedade**

Depois do `allowSilhouette`:

```ts
  /**
   * A forma de uma linha, para quando uma sub-vista está aberta: nome,
   * autonomia, bateria e trancas, sem foto e sem rótulo de atividade. O que
   * fica é o que identifica o carro e o que se quer saber sem pensar; o resto
   * dá lugar aos dados da sub-vista. Ver spec §3.3.
   */
  @property({ type: Boolean }) compact = false
```

- [ ] **Step 2: Ramificar o `render()`**

Acrescenta este método antes do `render()`:

```ts
  private renderCompact() {
    const { range, lock } = this.state
    return html`<div class="compact-row">
      <div class="compact-name">${this.name || DASH}</div>
      <div class="compact-range">
        ${range ? formatNumber(range.km) : DASH}<span class="unit muted"> ${range?.unit ?? ''}</span>
      </div>
      ${this.bar()}
      <ha-icon
        class="compact-lock ${lock.stale ? 'stale' : ''}"
        title=${this.lockLabel()}
        icon=${lock.locked === false ? 'mdi:lock-open-variant-outline' : 'mdi:lock-outline'}
      ></ha-icon>
    </div>`
  }
```

E, na primeira linha do `render()`:

```ts
  override render() {
    if (this.compact) return this.renderCompact()
    const { range, lock, activity } = this.state
    // … o resto sem alteração …
```

- [ ] **Step 3: Acrescentar os estilos**

Ao fim do bloco `css`, antes do `@media (max-width: 360px)`:

```css
    .compact-row { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .compact-name {
      flex: 1 1 auto; min-width: 0; font-size: 1.05rem; font-weight: 600;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .compact-range { flex: 0 0 auto; font-size: 1.05rem; }
    /*
     * A barra é a mesma do hero completo, mas aqui vive numa fila: perde a
     * margem vertical e a largura máxima de 220px, que ali servia uma coluna.
     */
    .compact-row .bar { flex: 0 0 64px; margin: 0; max-width: 64px; }
    .compact-lock { flex: 0 0 auto; --mdc-icon-size: 20px; }
    .compact-lock.stale { opacity: 0.55; }
    @media (max-width: 360px) {
      .compact-row .bar { display: none; }
    }
```

- [ ] **Step 4: Verificar**

Run: `npm run typecheck && npm test && npm run build`
Expected: tudo passa. O hero completo não muda de aspeto — `compact` é `false` por omissão e nenhum dos seletores novos alcança a forma antiga.

- [ ] **Step 5: Commit**

```bash
git add src/sections/hero.ts
git commit -m "feat: dar ao hero uma forma de uma linha

Com uma sub-vista aberta, o hero encolhe a nome, autonomia, bateria e
trancas, sem foto e sem rótulo de atividade: o que fica é o que
identifica o carro, e o resto dá lugar aos dados.

A barra de bateria é a mesma; muda só a caixa onde vive, porque a
largura máxima de 220px servia uma coluna e aqui é uma fila."
```

---

## Task 11: ligar tudo no card, apagar o `tiles.ts` e cortar o `sections:`

A tarefa que muda visivelmente o card. Todas as anteriores foram aditivas.

**Files:**
- Modify: `src/leapmotor-card.ts`
- Delete: `src/sections/tiles.ts`
- Modify: `src/types.ts` (remover `SectionId`, `DEFAULT_SECTIONS`, campo `sections`)
- Modify: `src/translations/en.json`, `src/translations/pt.json` (remover as chaves `tiles.*` órfãs, acrescentar `error.sections_removed`)

**Interfaces:**
- Consumes: tudo o que as Tasks 1 a 10 produziram.
- Produces: o card com `_openGroup`, `_reservedHeight` e `_focusGroup`.

- [ ] **Step 1: Cortar `SectionId` e `DEFAULT_SECTIONS` de `src/types.ts`**

Apaga:

```ts
export type SectionId = 'location' | 'charging' | 'tiles' | 'tires' | 'trip' | 'comfort' | 'schedule'
```

```ts
export const DEFAULT_SECTIONS: Record<SectionId, boolean> = {
  location: false, charging: true, tiles: true, tires: false, trip: false, comfort: false, schedule: false,
}
```

E, da interface de configuração, a linha `sections?: Partial<Record<SectionId, boolean>>`.

- [ ] **Step 2: Apagar o `tiles.ts`**

```bash
git rm src/sections/tiles.ts
```

É literalmente aquilo que a grelha substitui: o tile de clima é o tile do grupo `climate`, o de aberturas o do grupo `status`, e a lista itemizada de aberturas mudou-se para o `openings.ts` na Task 7.

- [ ] **Step 3: Acrescentar a chave do aviso de rutura**

Nos dois catálogos, ao objeto `error` existente:

`pt.json`: `"sections_removed": "A opção «sections» deixou de existir nesta versão do card. Substitui-a por «grid», que escolhe e ordena os grupos da grelha — ver o README."`
`en.json`: `"sections_removed": "The 'sections' option no longer exists in this version of the card. Replace it with 'grid', which picks and orders the groups shown — see the README."`

- [ ] **Step 4: Reescrever a parte do card que renderiza**

Nos `import`s do topo, troca `import './sections/tiles'` por:

```ts
import './sections/openings'
import './sections/group-grid'
import './sections/group-detail'
```

E acrescenta:

```ts
import { alertFor, missingForGroups, resolveGrid, summaryFor, type ResolvedGroup } from './groups'
import type { GridTile } from './sections/group-grid'
import type { LeapmotorGroupGrid } from './sections/group-grid'
import { clampTireRange, type GroupId } from './types'
```

Substitui a constante `SECTION_KEYS` por:

```ts
/**
 * As chaves cuja falta se reporta sempre, independentemente da grelha: sem
 * bateria e sem trancas o card não tem nada para dizer, mesmo com a grelha
 * vazia. As chaves de cada grupo vêm do catálogo, via `missingForGroups`.
 */
const CORE_KEYS: LogicalKey[] = ['battery', 'lock']
```

Acrescenta o estado, junto aos outros `@internalState`:

```ts
  @internalState() private _openGroup?: GroupId
  /**
   * A maior altura de conteúdo já medida numa sub-vista, para o dashboard não
   * saltar ao passar de uma para outra. Campo simples e não estado reactivo: é
   * escrito de dentro de um `ResizeObserver`, e um `@internalState` aí dentro
   * pedia render a cada medição, incluindo as que não mudam o máximo.
   */
  private _reservedHeight = 0
  /** O grupo a quem devolver o foco depois de fechar. Ver spec §4.5. */
  private _focusGroup?: GroupId
```

Acrescenta, antes do `render()`:

```ts
  /**
   * Um grupo aberto pode deixar de existir sem ninguém o fechar: a
   * configuração muda, ou as entidades dele desaparecem. Fecha-se aqui, no
   * `willUpdate`, que é o sítio onde o Lit permite mexer em estado antes do
   * render — fazê-lo dentro do `render()` era pedir um segundo render a partir
   * do primeiro.
   */
  override willUpdate() {
    if (!this._openGroup || !this._config) return
    const result = this.resolved()
    if (!result || result.error || result.needsFallback) return
    const { groups } = resolveGrid(this._config, result.map)
    if (!groups.some(group => group.id === this._openGroup)) this._openGroup = undefined
  }

  /**
   * Devolve o foco ao tile que abriu a sub-vista que se acabou de fechar. Tem
   * de ser depois do render: o tile só existe outra vez quando a grelha volta.
   */
  override updated() {
    const id = this._focusGroup
    if (!id) return
    this._focusGroup = undefined
    this.renderRoot.querySelector<LeapmotorGroupGrid>('leapmotor-group-grid')?.focusTile(id)
  }
```

No `render()`, substitui `const sections = this.sections()` por:

```ts
    const tireRange = clampTireRange(config.tire_range)
    const grid = resolveGrid(config, map)
    const openGroup = grid.groups.find(group => group.id === this._openGroup)
```

E apaga o método `sections()` privado, junto com qualquer uso de `DEFAULT_SECTIONS`.

Acrescenta aos *handlers* locais do `render()`:

```ts
    const onOpenGroup = (e: CustomEvent<{ group: GroupId }>) => {
      // Abrir um grupo esconde a fila de ações, e com ela o botão que abriu o
      // painel da cortina: um painel órfão de um botão invisível é lixo no ecrã.
      this._expanded = undefined
      this._openGroup = e.detail.group
    }
    const onCloseGroup = () => {
      this._focusGroup = this._openGroup
      this._openGroup = undefined
    }
    const onNav = (e: CustomEvent<{ delta: -1 | 1 }>) => {
      const index = grid.groups.findIndex(group => group.id === this._openGroup)
      if (index < 0) return
      const size = grid.groups.length
      // Dá a volta: do último para o primeiro, e ao contrário.
      this._openGroup = grid.groups[(index + e.detail.delta + size) % size]!.id
    }
    const onMeasured = (e: CustomEvent<{ height: number }>) => {
      // O mapa tem altura fixa própria e não entra no máximo, senão impunha-a
      // a todas as outras sub-vistas. Ver spec §4.3.
      if (this._openGroup === 'location') return
      if (e.detail.height <= this._reservedHeight) return
      this._reservedHeight = e.detail.height
      this.requestUpdate()
    }
```

Acrescenta uma função local que instancia as secções de um grupo. Fica no `render()`, e não num método, para fechar sobre `state`, `map`, `t` e o resto sem passar um contexto de dez campos:

```ts
    const panelsFor = (group: ResolvedGroup) => {
      switch (group.id) {
        case 'charging':
          return html`
            <leapmotor-charging
              .state=${state} .t=${t} .language=${language}
              .limitEditable=${!!map.chargeLimitSet}
              .limitMin=${attr<number>(hass, map, 'chargeLimitSet', 'min') ?? 50}
              .limitMax=${attr<number>(hass, map, 'chargeLimitSet', 'max') ?? 100}
              .limitStep=${attr<number>(hass, map, 'chargeLimitSet', 'step') ?? 5}
            ></leapmotor-charging>
            <leapmotor-schedule .state=${state} .t=${t} .map=${map}></leapmotor-schedule>`
        case 'status':
          return html`<leapmotor-openings
            .state=${state} .t=${t} .map=${map} .pending=${this._pending}
          ></leapmotor-openings>`
        case 'climate':
          return html`
            <leapmotor-climate-panel
              .state=${state} .t=${t} .map=${map} .fanSpeed=${this._climateIntent.fanSpeed}
              .pendingTemp=${pendingTemp} .pendingRecirc=${pendingRecirc}
              .shownLevels=${shownLevels}
              .maxLevel=${attr<number>(hass, map, 'driverSeatHeat', 'max') ?? 3}
            ></leapmotor-climate-panel>
            <leapmotor-comfort
              .state=${state} .t=${t} .map=${map} .shownLevels=${shownLevels}
              .maxLevel=${attr<number>(hass, map, 'driverSeatHeat', 'max') ?? 3}
            ></leapmotor-comfort>`
        case 'tires':
          return html`<leapmotor-tires .state=${state} .t=${t} .limits=${tireRange}></leapmotor-tires>`
        case 'trip':
          return html`<leapmotor-trip .state=${state} .t=${t}></leapmotor-trip>`
        case 'location':
          return html`<leapmotor-location
            .state=${state} .t=${t} .mapElement=${this._mapElement}
          ></leapmotor-location>`
      }
    }
```

Troca a construção do mapa. Onde estava `if (sections.location && map.location) this.ensureMap(map.location)`:

```ts
    // O mapa só se constrói quando a sua sub-vista está aberta, em vez de a
    // cada carregamento do dashboard. Ver spec §5.5.
    if (this._openGroup === 'location' && map.location) this.ensureMap(map.location)
```

E substitui todo o corpo do `<div class="body">` por:

```ts
      <div class="body">
        ${/*
           * O `sections` já não é um campo de `LeapmotorCardConfig`, por isso a
           * leitura tem de passar por um índice: é uma chave que já não existe
           * no tipo mas que ainda existe no YAML de quem não migrou, e é
           * precisamente por isso que se lê.
           */
          (config as unknown as Record<string, unknown>).sections !== undefined
          ? html`<ha-alert alert-type="warning">${t('error.sections_removed')}</ha-alert>`
          : nothing}

        ${grid.unknown.length > 0
          ? html`<ha-alert alert-type="warning">${t('error.unknown_group', { groups: grid.unknown.join(', ') })}</ha-alert>`
          : nothing}

        <leapmotor-hero
          .state=${state} .t=${t} .now=${now} .name=${name}
          .language=${language} .imageUrl=${imageUrl}
          .showImage=${showImage} .allowSilhouette=${allowSilhouette}
          .compact=${openGroup !== undefined}
        ></leapmotor-hero>

        ${openGroup === undefined
          ? html`
            <leapmotor-actions-row
              .state=${state} .t=${t} .map=${map} .actions=${actions} .pending=${this._pending}
            ></leapmotor-actions-row>

            ${this._expanded === 'sunshade'
              ? html`<leapmotor-sunshade-control .t=${t}></leapmotor-sunshade-control>`
              : nothing}

            ${grid.groups.length > 0
              ? html`<leapmotor-group-grid
                  .state=${state}
                  .tiles=${grid.groups.map((group): GridTile => ({
                    group,
                    title: group.titleOverride ?? t(group.titleKey),
                    summary: summaryFor(group, state, t, language),
                    alert: alertFor(group, state, tireRange),
                  }))}
                  @leapmotor-open-group=${onOpenGroup}
                ></leapmotor-group-grid>`
              : nothing}`
          : html`
            <leapmotor-group-detail
              .t=${t}
              .heading=${openGroup.titleOverride ?? t(openGroup.titleKey)}
              .navigable=${grid.groups.length > 1}
              .reservedHeight=${this._reservedHeight}
              .updatedLabel=${formatUpdated(state.lastUpdate, now, t, language)}
              @leapmotor-close=${onCloseGroup}
              @leapmotor-nav=${onNav}
              @leapmotor-measured=${onMeasured}
            >${panelsFor(openGroup)}</leapmotor-group-detail>`}

        ${(() => {
          const missing = [
            ...CORE_KEYS.filter(key => result.missing.includes(key)),
            ...(grid.explicit ? missingForGroups(grid.groups, result.missing) : []),
          ]
          const unique = [...new Set(missing)]
          return unique.length === 0
            ? nothing
            : html`<div class="missing muted" title=${t('missing_entity', { keys: unique.join(', ') })}>
                <ha-icon icon="mdi:alert-outline"></ha-icon>
                ${t('missing_entity_count', { count: unique.length })}
              </div>`
        })()}
      </div>
```

Acrescenta `formatUpdated` ao `import` de `./format` no card.

- [ ] **Step 5: Acrescentar a chave do grupo desconhecido**

Nos dois catálogos, ao objeto `error`:

`pt.json`: `"unknown_group": "Grupo desconhecido em «grid»: {groups}"`
`en.json`: `"unknown_group": "Unknown group in 'grid': {groups}"`

- [ ] **Step 6: Limpar as chaves `tiles.*` que ficaram órfãs**

Depois de apagar o `tiles.ts`, estas chaves não têm quem as use. Confirma primeiro e só depois apaga:

```bash
for key in interior doors target openings all_closed open_count open_one roof; do
  printf '%-12s %s\n' "$key" "$(grep -rl "tiles\.$key" src/ | tr '\n' ' ')"
done
```

As que não aparecem em nenhum ficheiro de `src/` saem dos dois catálogos. `tiles.interior` é usada pelo painel de clima — verifica antes de a apagar.

- [ ] **Step 7: Verificar**

Run: `npm run typecheck && npm test && npm run build`
Expected: tudo passa. Se o `typecheck` acusar `SectionId` ou `DEFAULT_SECTIONS` em algum sítio, é um uso que ficou para trás — segue o erro.

- [ ] **Step 8: Commit**

```bash
git add -A src test
git commit -m "feat!: grelha de grupos e sub-vistas em vez da coluna única

O card deixa de crescer com cada secção ligada. Sem sub-vista aberta é
hero, ações e grelha; com uma aberta, o hero encolhe a uma linha, as
ações desaparecem e a sub-vista ocupa o corpo com altura reservada.

O tiles.ts é apagado: era exactamente o que a grelha substitui. Com ele
sai a expansão própria do painel de clima, que passa a ser o conteúdo
da sub-vista climate — e sai a lógica de exclusão mútua entre painéis,
que só existia para os dois tiles.

O mapa passa a construir-se apenas quando a sua sub-vista abre, em vez
de a cada carregamento do dashboard.

RUTURA: a opção sections: deixa de existir. Quem a tiver na
configuração vê um ha-alert a dizer qual é a substituta, em vez de
descobrir a mudança no CHANGELOG."
```

---

## Task 12: o editor visual

**Files:**
- Modify: `src/leapmotor-card-editor.ts`
- Modify: `src/translations/en.json`, `src/translations/pt.json`

**Interfaces:**
- Consumes: `GROUP_CATALOGUE`, `GROUP_ORDER` (Task 2); `GridEntry`, `GroupId` (Task 2).
- Produces: nada que outra tarefa consuma.

- [ ] **Step 1: Acrescentar as chaves de tradução**

Ao objeto `editor` existente, nos dois catálogos.

`pt.json`: `"grid": "Grelha"`, `"grid_up": "Subir"`, `"grid_down": "Descer"`, `"tire_range": "Faixa de pressão dos pneus (bar)"`
`en.json`: `"grid": "Grid"`, `"grid_up": "Move up"`, `"grid_down": "Move down"`, `"tire_range": "Tyre pressure range (bar)"`

- [ ] **Step 2: Substituir a entrada `sections` do esquema**

No método `schema()`, apaga o bloco:

```ts
      {
        type: 'expandable',
        name: 'sections',
        schema: SECTION_IDS.map(id => ({ name: id, selector: { boolean: {} } })),
      },
```

E apaga a constante `SECTION_IDS` e o `SectionId` do `import`.

- [ ] **Step 3: Acrescentar o bloco da grelha**

O `ha-form` do Home Assistant não tem selector de reordenação, por isso a grelha ganha um bloco próprio. Acrescenta à classe:

```ts
  /** Os grupos por ordem, com o estado da caixa de seleção de cada um. */
  private gridRows(): { id: GroupId; on: boolean }[] {
    const configured = this._config?.grid
    if (!Array.isArray(configured)) {
      // Sem `grid:` escrito, a grelha é o catálogo inteiro: mostra-se tudo
      // ligado, que é o que o card faz.
      return GROUP_ORDER.map(id => ({ id, on: true }))
    }
    const chosen = configured
      .map(entry => (typeof entry === 'string' ? entry : entry.group))
      .filter((id): id is GroupId => id in GROUP_CATALOGUE)
    const rest = GROUP_ORDER.filter(id => !chosen.includes(id))
    return [
      ...chosen.map(id => ({ id, on: true })),
      ...rest.map(id => ({ id, on: false })),
    ]
  }

  /**
   * Escreve o `grid:` a partir das linhas. Preserva a forma longa de uma
   * entrada que já a tinha: reordenar no editor não deve apagar um ícone ou um
   * título que alguém escreveu à mão em YAML.
   */
  private commitGrid(rows: { id: GroupId; on: boolean }[]) {
    const previous = Array.isArray(this._config?.grid) ? this._config!.grid : []
    const longForm = new Map<GroupId, GridEntry>()
    for (const entry of previous) {
      if (typeof entry !== 'string') longForm.set(entry.group, entry)
    }
    const grid: GridEntry[] = rows
      .filter(row => row.on)
      .map(row => longForm.get(row.id) ?? row.id)

    const config = { ...this._config, type: 'custom:leapmotor-card', grid } as LeapmotorCardConfig
    this._config = config
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config }, bubbles: true, composed: true }))
  }

  private toggleGroup(id: GroupId) {
    this.commitGrid(this.gridRows().map(row => (row.id === id ? { ...row, on: !row.on } : row)))
  }

  private moveGroup(id: GroupId, delta: -1 | 1) {
    const rows = this.gridRows()
    const index = rows.findIndex(row => row.id === id)
    const target = index + delta
    if (index < 0 || target < 0 || target >= rows.length) return
    const reordered = [...rows]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(target, 0, moved!)
    this.commitGrid(reordered)
  }

  private renderGridEditor(t: (k: string) => string) {
    const rows = this.gridRows()
    return html`<div class="grid-editor">
      <div class="grid-title">${t('editor.grid')}</div>
      ${rows.map((row, index) => html`
        <div class="grid-row">
          <ha-formfield .label=${t(GROUP_CATALOGUE[row.id].titleKey)}>
            <ha-checkbox
              .checked=${row.on}
              @change=${() => this.toggleGroup(row.id)}
            ></ha-checkbox>
          </ha-formfield>
          <ha-icon-button
            .label=${t('editor.grid_up')}
            .disabled=${index === 0}
            @click=${() => this.moveGroup(row.id, -1)}
          ><ha-icon icon="mdi:arrow-up"></ha-icon></ha-icon-button>
          <ha-icon-button
            .label=${t('editor.grid_down')}
            .disabled=${index === rows.length - 1}
            @click=${() => this.moveGroup(row.id, 1)}
          ><ha-icon icon="mdi:arrow-down"></ha-icon></ha-icon-button>
        </div>
      `)}
    </div>`
  }
```

Junta `html` e `css` ao `import` de `lit`, e `GROUP_CATALOGUE, GROUP_ORDER` ao `import` de `./groups`, e `GridEntry, GroupId` ao `import type` de `./types`.

- [ ] **Step 4: Chamar o bloco novo do `render()`**

```ts
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${data}
        .schema=${this.schema(t)}
        .computeLabel=${this.computeLabel(t)}
        @value-changed=${this.valueChanged}
      ></ha-form>
      ${this.renderGridEditor(t)}
    `
```

E no `data`, troca a linha do `sections` por nada — o `grid` não passa pelo `ha-form`:

```ts
    const data = {
      image: 'auto',
      actions: DEFAULT_ACTIONS,
      map_zoom: DEFAULT_MAP_ZOOM,
      ...this._config,
    }
```

Apaga `DEFAULT_SECTIONS` do `import`.

- [ ] **Step 5: Acrescentar os estilos**

O editor não tinha `styles`. Acrescenta à classe:

```ts
  static override styles = css`
    .grid-editor { margin-top: 16px; }
    .grid-title {
      font-size: 0.85rem; font-weight: 500;
      color: var(--secondary-text-color); margin-bottom: 4px;
    }
    .grid-row { display: flex; align-items: center; gap: 4px; }
    .grid-row ha-formfield { flex: 1 1 auto; min-width: 0; }
  `
```

- [ ] **Step 6: Estender o `computeLabel` ao `tire_range`**

```ts
  private computeLabel = (t: (k: string) => string) => (s: { name: string }): string => {
    if (s.name === 'map_zoom') return t('editor.map_zoom')
    if (s.name === 'tire_range') return t('editor.tire_range')
    return s.name
  }
```

O `tire_range` fica de fora do esquema do `ha-form`: é uma lista de dois números e não há selector para isso. Continua a ser YAML, como o `icon`, o `title` e o `summary` de cada grupo — a chave de tradução fica pronta para quando houver selector.

- [ ] **Step 7: Verificar**

Run: `npm run typecheck && npm test && npm run build`
Expected: tudo passa.

- [ ] **Step 8: Commit**

```bash
git add src/leapmotor-card-editor.ts src/translations/en.json src/translations/pt.json
git commit -m "feat: escolher e ordenar os grupos da grelha no editor visual

O ha-form do Home Assistant não tem selector de reordenação, por isso a
grelha ganha um bloco próprio: uma linha por grupo, com caixa de
seleção e setas para subir e descer.

Reordenar preserva a forma longa de uma entrada que já a tinha: mexer
na ordem no editor não apaga um ícone ou um título escritos à mão em
YAML."
```

---

## Task 13: documentação e versão 0.4.0

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `package.json`
- Modify: `src/leapmotor-card.ts` (`CARD_VERSION`)
- Delete: `images/card-dark.png`, `images/climate-panel-dark.png`

- [ ] **Step 1: Reescrever a abertura do README**

A primeira frase diz hoje que o card *«replicates the main vehicle screen of the Leapmotor mobile app»*. Deixou de ser verdade. Substitui os três primeiros parágrafos por:

```markdown
# Leapmotor Card

A Lovelace custom card for Home Assistant that shows a Leapmotor vehicle as a
compact card: range, battery and lock state at the top, a row of action
buttons, and a grid of groups — charging, status, climate, tyres, trip and
location — each opening a navigable sub-view in place, so the card keeps its
height instead of growing with every section you enable.

Built for a Leapmotor B10 running the
[kerniger/leapmotor-ha](https://github.com/kerniger/leapmotor-ha) integration.
```

- [ ] **Step 2: Remover as duas imagens e os parágrafos que as descrevem**

Apaga os blocos `![…](images/card-dark.png)` e `![…](images/climate-panel-dark.png)` e os parágrafos que os explicam — incluindo a frase que afirma que a segunda imagem é um render real e *«not markup arranged to look like it»*.

Isto não é opcional. A segunda imagem mostra o painel de clima aberto a partir de um tile que a Task 11 apaga; mantê-la ao lado daquela afirmação tornava a afirmação falsa. Ver spec §12.

```bash
git rm images/card-dark.png images/climate-panel-dark.png
```

No lugar delas:

```markdown
> **Screenshots pending.** The card's layout changed completely in 0.4.0 and
> the previous captures showed the old one. New ones will be taken from a real
> dashboard.
```

- [ ] **Step 3: Trocar `sections` por `grid` na tabela de opções e no exemplo**

No exemplo completo de configuração, substitui o bloco `sections:` por:

```yaml
grid:
  - charging
  - status
  - climate
  - tires
  - group: trip
    icon: mdi:road-variant
    summary: last7
tire_range: [2.0, 2.6]
```

E na tabela de opções, apaga a linha do `sections` e acrescenta:

```markdown
| `grid` | list | *(all groups the car supports)* | Which groups the grid shows, in order. Each entry is either a group name (`charging`, `status`, `climate`, `tires`, `trip`, `location`) or a mapping with `group` plus any of `icon`, `title` and `summary`. An empty list hides the grid. With no `grid:` at all, every group whose entities the car reports is shown. |
| `tire_range` | list of 2 numbers | `[2.0, 2.6]` | The tyre pressure range treated as normal, in bar. A pressure outside it marks the tyre, and the grid tile, as a warning. Check the sticker on the driver's door pillar for your car and tyre size — the default is narrow and a correctly inflated car may fall outside it. |
```

Acrescenta ainda uma tabela dos resumos por grupo, para o `summary` ser utilizável:

```markdown
| Group | `summary` values (first is the default) |
| --- | --- |
| `charging` | `battery`, `limit`, `phase`, `eta` |
| `status` | `lock`, `openings`, `trunk` |
| `climate` | `interior`, `target`, `state` |
| `tires` | `range`, `min`, `worst` |
| `trip` | `odometer`, `last7`, `consumption` |
| `location` | `activity`, `zone`, `age` |
```

- [ ] **Step 4: Escrever a entrada do CHANGELOG**

No topo, seguindo o formato que o ficheiro já usa:

```markdown
## 0.4.0

### Breaking

- The `sections` option no longer exists. The card's layout is now a grid of
  groups that open sub-views, and which sections are shown follows from which
  groups are in the grid. Replace `sections:` with `grid:` — the card shows a
  warning in place if it finds the old key. With no `grid:` at all, every group
  whose entities your car reports is shown.

### Added

- A grid of groups on the main view, each with an icon, a title and a live
  summary value, opening a sub-view in place with close and previous/next
  controls. Configurable and reorderable, in YAML or in the visual editor.
- Rows in the vehicle status sub-view command what they show: the windows row
  closes the windows, the trunk row opens the trunk. `confirm_actions` applies.
- Tile colour follows state: amber for unlocked or an opening open, red for two
  or more tyres out of range, battery colour for charging.
- Tyre pressures are laid out around a top view of the car.
- `tire_range` sets the pressure range treated as normal (default `[2.0, 2.6]`,
  the values previously hardcoded).
- Keyboard navigation throughout: arrows move between sub-views, Escape closes
  and returns focus to the tile that opened it. Horizontal swipe on touch.
- The card reserves the height of the tallest sub-view visited, so the
  dashboard stops jumping between them.

### Changed

- The map is built when its sub-view is opened, not on every dashboard load.
- The climate panel is the content of the climate sub-view; it no longer
  expands from a tile.
- Tyre warning colours use `--leapmotor-warn` and `--leapmotor-alert` instead
  of borrowing the battery colours.

### Removed

- The interior/openings tile pair, replaced by the grid.
- The two README screenshots, which showed the previous layout.
```

- [ ] **Step 5: Subir a versão nos dois sítios**

`package.json`: `"version": "0.4.0"`
`src/leapmotor-card.ts`: `export const CARD_VERSION = '0.4.0'`

O `test/smoke.test.ts` verifica que os dois não se separam — se só um subir, falha.

- [ ] **Step 6: Verificar**

Run: `npm run typecheck && npm test && npm run build`
Expected: tudo passa, com o teste de versão do `smoke` a confirmar o 0.4.0 dos dois lados.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: release 0.4.0

Documenta a rutura do sections:, o grid: que o substitui, o tire_range
e a tabela de resumos por grupo.

As duas capturas do README saem. A do painel de clima mostrava-o aberto
a partir de um tile que esta versão apaga, e o README afirmava
explicitamente que aquela imagem era um render real e não markup
arranjado para o parecer — manter a imagem tornava a afirmação falsa.
Capturas novas ficam para quando houver o card a correr."
```

---

## Depois do plano

Duas coisas que ficam para o utilizador, e que nenhuma tarefa pode fazer:

1. **Capturas novas para o README.** O ferramental do render *headless* que produziu as duas antigas não está no repositório — foi *ad hoc*. As novas têm de sair de um dashboard real, com o card 0.4.0 instalado.
2. **Decidir a faixa de pressão do B10.** O `tire_range` fica com a omissão `[2.0, 2.6]`, que são os valores antigos e são estreitos. O valor certo está na chapa do pilar da porta do condutor e depende da medida do pneu.
