import { LitElement, html, nothing } from 'lit'
import { customElement, property, state as internalState } from 'lit/decorators.js'
import type { HomeAssistant } from './ha-types'
import { createTranslator, pickLanguage } from './localize'
import {
  DEFAULT_ACTIONS, DEFAULT_MAP_ZOOM, DEFAULT_SECTIONS, MAP_ZOOM_MAX, MAP_ZOOM_MIN,
  type ActionId, type LeapmotorCardConfig, type SectionId,
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

const SECTION_IDS: SectionId[] = ['location', 'charging', 'tiles', 'tires', 'trip', 'comfort', 'schedule']

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
        name: 'map_zoom',
        selector: { number: { min: MAP_ZOOM_MIN, max: MAP_ZOOM_MAX, mode: 'box' } },
      },
      {
        type: 'expandable',
        name: 'sections',
        schema: SECTION_IDS.map(id => ({ name: id, selector: { boolean: {} } })),
      },
    ]
  }

  /**
   * Os campos de topo mostram o próprio nome do campo, sem tradução — é assim
   * desde sempre, e mudar isso para todos fica fora do âmbito de uma opção
   * nova. O `map_zoom` é a excepção: só existe uma vez por catálogo (ver
   * `editor.map_zoom`), por isso ganha rótulo traduzido sem tocar nos outros.
   */
  private computeLabel = (t: (k: string) => string) => (s: { name: string }): string =>
    s.name === 'map_zoom' ? t('editor.map_zoom') : s.name

  private valueChanged(e: CustomEvent<{ value: Record<string, unknown> }>) {
    const raw = { ...e.detail.value }
    if (raw.language === '') delete raw.language
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
      map_zoom: DEFAULT_MAP_ZOOM,
      ...this._config,
      sections: { ...DEFAULT_SECTIONS, ...(this._config.sections ?? {}) },
    }

    return html`<ha-form
      .hass=${this.hass}
      .data=${data}
      .schema=${this.schema(t)}
      .computeLabel=${this.computeLabel(t)}
      @value-changed=${this.valueChanged}
    ></ha-form>`
  }
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-card-editor': LeapmotorCardEditor }
}
