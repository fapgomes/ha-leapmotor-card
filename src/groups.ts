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
