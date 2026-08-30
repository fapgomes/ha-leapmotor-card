import { formatAgo, formatNumber, formatTimeOfDay } from './format'
import type { LogicalKey } from './keys'
import { DASH, formatDuration, type TranslateFn } from './localize'
import type { EntityMap, GridEntry, GroupId, LeapmotorCardConfig, PanelId, VehicleState } from './types'

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

const TIRE_CORNERS = [
  { key: 'fl', labelKey: 'tires.corner_fl' },
  { key: 'fr', labelKey: 'tires.corner_fr' },
  { key: 'rl', labelKey: 'tires.corner_rl' },
  { key: 'rr', labelKey: 'tires.corner_rr' },
] as const

/** Os pneus com leitura válida, do mais baixo para o mais alto. */
function sortedTires(state: VehicleState): { value: number; labelKey: string }[] {
  return TIRE_CORNERS
    // O `labelKey` explícito como `string` larga a união de literais do
    // `as const`: sem isto o predicado do `filter` seguinte não tipifica —
    // não pode estreitar `labelKey` de um literal para `string`.
    .map((corner): { value: number | undefined; labelKey: string } => ({ value: state.tires[corner.key], labelKey: corner.labelKey }))
    .filter((entry): entry is { value: number; labelKey: string } => entry.value !== undefined)
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

export type AlertLevel = 'none' | 'warn' | 'alert'

/**
 * O nível de alerta do tile de um grupo. Três regras que valem a pena fixar
 * aqui, porque nenhuma delas é óbvia:
 *
 *  - **Offline não alerta.** Ausência de leitura não é problema; um card que
 *    ficasse todo âmbar ao perder a ligação à cloud ensinava a ignorá-lo.
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
