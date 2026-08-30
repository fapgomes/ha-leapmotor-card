import { LitElement, css, html, nothing } from 'lit'
import { customElement, property, state as internalState } from 'lit/decorators.js'
import type { HomeAssistant } from './ha-types'
import { GROUP_CATALOGUE, GROUP_ORDER } from './groups'
import { createTranslator, pickLanguage } from './localize'
import {
  DEFAULT_ACTIONS, DEFAULT_MAP_ZOOM, MAP_ZOOM_MAX, MAP_ZOOM_MIN,
  type ActionId, type GridEntry, type GroupId, type LeapmotorCardConfig,
} from './types'

/**
 * Uma entrada por ação, e não uma lista: `Record<ActionId, boolean>` obriga o
 * compilador a exigir uma decisão sobre cada ação nova. Com a lista, uma
 * décima-oitava ação compilava, passava os testes exaustivos, e simplesmente
 * nunca aparecia no editor — sem ninguém dar por isso.
 *
 * As cinco que ficam de fora não são utilizáveis como botão da linha de ações:
 * `steeringWheelHeat`, `mirrorHeat` e `batteryPreheat` vivem na secção de
 * conforto, e `setChargeLimit` e `setClimate` precisam de um valor que só um
 * painel fornece (ver `PAYLOAD_ACTIONS` em `actions.ts`).
 */
const OFFERED_IN_EDITOR: Record<ActionId, boolean> = {
  unlock: true, lock: true, trunk: true, windows: true, sunshade: true,
  quickCool: true, quickHeat: true, defrost: true,
  findVehicle: true, unlockCharger: true, refresh: true, climate: true,
  steeringWheelHeat: false, mirrorHeat: false, batteryPreheat: false,
  setChargeLimit: false, setClimate: false,
}

const ALL_ACTIONS: ActionId[] = (Object.keys(OFFERED_IN_EDITOR) as ActionId[])
  .filter(a => OFFERED_IN_EDITOR[a])

/**
 * `trunk` e `windows` são alternantes e não têm chave `action.trunk` nem
 * `action.windows` — as chaves reais são `action.trunk_open`/`_close` e
 * `action.windows_open`/`_close`. No editor mostramos a forma de abrir, que é
 * o rótulo que a app usa. Sem este mapa, `t('action.trunk')` devolveria a
 * própria chave e o dropdown mostraria "action.trunk".
 *
 * `climate` também é alternante desde que o `actionLabel` lhe passou a dar
 * `action.climate_on`/`_off`, mas continua a ter chave neutra — e é ela que o
 * editor usa, pelo caminho por omissão. Aqui escolhe-se a ação, não se executa
 * nenhuma: um dropdown a oferecer «Ligar climatização» prometia um sentido que
 * o botão configurado não tem.
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
    this.rememberLongForm(config.grid)
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
        name: 'map_zoom',
        selector: { number: { min: MAP_ZOOM_MIN, max: MAP_ZOOM_MAX, mode: 'box' } },
      },
    ]
  }

  /**
   * Os campos de topo mostram o próprio nome do campo, sem tradução — é assim
   * desde sempre, e mudar isso para todos fica fora do âmbito de uma opção
   * nova. O `map_zoom` é a excepção: só existe uma vez por catálogo (ver
   * `editor.map_zoom`), por isso ganha rótulo traduzido sem tocar nos outros.
   * O `tire_range` não está no esquema do `ha-form` (é uma lista de dois
   * números, sem selector), mas o ramo fica pronto para quando houver um.
   */
  private computeLabel = (t: (k: string) => string) => (s: { name: string }): string => {
    if (s.name === 'map_zoom') return t('editor.map_zoom')
    if (s.name === 'tire_range') return t('editor.tire_range')
    return s.name
  }

  private valueChanged(e: CustomEvent<{ value: Record<string, unknown> }>) {
    const raw = { ...e.detail.value }
    if (raw.language === '') delete raw.language
    // `sections` já não existe no tipo, mas pode existir em configurações
    // ainda não migradas — o `ha-form` devolve tudo o que lhe foi dado, por
    // isso é aqui, no editor, que a chave morta finalmente desaparece.
    delete (raw as Record<string, unknown>)['sections']
    const config = { type: 'custom:leapmotor-card', ...raw } as LeapmotorCardConfig
    this._config = config
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config }, bubbles: true, composed: true }))
  }

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
   * O que cada grupo tinha na forma longa — ícone, título, resumo — mesmo depois
   * de o utilizador o desligar. Nunca se limpa por inteiro, de propósito: é
   * isso que faz desligar-e-voltar-a-ligar não perder o que estava em YAML.
   *
   * Um grupo que reapareça na forma CURTA apaga a sua entrada aqui — senão um
   * ícone que alguém tirasse do YAML à mão ressuscitava no toque seguinte.
   */
  private _longForm = new Map<GroupId, GridEntry>()

  private rememberLongForm(grid: GridEntry[] | undefined): void {
    if (!Array.isArray(grid)) return
    for (const entry of grid) {
      if (typeof entry === 'string') this._longForm.delete(entry)
      else if (entry.group in GROUP_CATALOGUE) this._longForm.set(entry.group, entry)
    }
  }

  /**
   * Escreve o `grid:` a partir das linhas. Preserva a forma longa de uma
   * entrada que já a tinha: reordenar ou desligar no editor não deve apagar um
   * ícone, um título ou um resumo que alguém escreveu à mão em YAML.
   *
   * A memória é o `_longForm` e não o `grid:` actual, e isso é a correcção de um
   * defeito real: desligar um grupo tira-lhe a entrada do `grid:`, portanto ler
   * a forma longa de lá significava que voltar a ligá-lo já não a encontrava e
   * escrevia o grupo na forma curta — o ícone desaparecia sem aviso.
   */
  private commitGrid(rows: { id: GroupId; on: boolean }[]) {
    const grid: GridEntry[] = rows
      .filter(row => row.on)
      .map(row => this._longForm.get(row.id) ?? row.id)

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

  /**
   * `ha-formfield`, `ha-checkbox` e `ha-icon-button` vêm do frontend do Home
   * Assistant, não deste pacote — não há forma de os verificar a partir deste
   * repositório. Se este bloco aparecer vazio num dashboard real, é o
   * primeiro sítio a suspeitar: um elemento personalizado sem definição não
   * dá erro nenhum, só não desenha nada.
   */
  private renderGridEditor(t: (k: string) => string) {
    const rows = this.gridRows()
    /*
     * As setas só operam dentro do bloco dos grupos escolhidos, porque só esses
     * são escritos no `grid:`. Mover uma linha desligada não persistia nada e a
     * renderização seguinte recolocava-a — a seta parecia avariada. O mesmo
     * valia para empurrar a última linha ligada para baixo da fronteira entre
     * os dois blocos.
     */
    const onCount = rows.filter(row => row.on).length
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
            .disabled=${!row.on || index === 0}
            @click=${() => this.moveGroup(row.id, -1)}
          ><ha-icon icon="mdi:arrow-up"></ha-icon></ha-icon-button>
          <ha-icon-button
            .label=${t('editor.grid_down')}
            .disabled=${!row.on || index >= onCount - 1}
            @click=${() => this.moveGroup(row.id, 1)}
          ><ha-icon icon="mdi:arrow-down"></ha-icon></ha-icon-button>
        </div>
      `)}
    </div>`
  }

  static override styles = css`
    .grid-editor { margin-top: 16px; }
    .grid-title {
      font-size: 0.85rem; font-weight: 500;
      color: var(--secondary-text-color); margin-bottom: 4px;
    }
    .grid-row { display: flex; align-items: center; gap: 4px; }
    .grid-row ha-formfield { flex: 1 1 auto; min-width: 0; }
  `

  override render() {
    if (!this._config || !this.hass) return nothing
    const language = pickLanguage(this._config.language, this.hass.locale?.language)
    const t = createTranslator(language)

    const data = {
      image: 'auto',
      actions: DEFAULT_ACTIONS,
      map_zoom: DEFAULT_MAP_ZOOM,
      ...this._config,
    }

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
  }
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-card-editor': LeapmotorCardEditor }
}
