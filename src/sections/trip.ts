import { LitElement, css, html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { formatNumber, formatWeekRange } from '../format'
import { DASH, type TranslateFn } from '../localize'
import { sharedStyles } from '../theme'
import type { EnergySlice, VehicleState } from '../types'

interface Row {
  label: string
  value: string
}

/**
 * Um cabeçalho e as linhas que ele cobre. As linhas desta sub-vista misturavam
 * coisas de natureza diferente — quilómetros andados e energia gasta — e sem a
 * separação era o leitor que tinha de a fazer de cabeça.
 *
 * O `value` opcional serve o cabeçalho da energia, que leva o total da semana à
 * direita. Vai no cabeçalho e não numa linha própria porque as três fatias
 * abaixo são partes dele: uma linha «Total» a fechar repetia, como soma, o que o
 * título da secção já nomeia, e punha o número mais longe das partes que o
 * compõem. Os outros dois cabeçalhos não têm total porque não têm um: um
 * conta-quilómetros e uma média não se somam.
 *
 * O `unit` serve o cabeçalho da série semanal, cujas linhas são números nus.
 * Ocupa a mesma direita, mas com estilo próprio: um total é um valor, uma
 * unidade é o rótulo da coluna abaixo — e o cabeçalho passa por
 * `text-transform: uppercase`, que num símbolo de unidade estraga a grafia
 * («KWH/100 KM»). Por isso é um campo à parte e não texto dentro do `heading`:
 * a maiúscula é do CSS e não se consegue desligar em parte de um nó de texto.
 */
interface Section {
  heading: string
  value?: string
  unit?: string
  rows: Row[]
}

@customElement('leapmotor-trip')
export class LeapmotorTrip extends LitElement {
  @property({ attribute: false }) state!: VehicleState
  @property({ attribute: false }) t!: TranslateFn
  @property({ type: String }) language = 'en'

  /** As partes que existem, com o separador do card. Nenhuma parte, DASH. */
  private joined(parts: string[]): string {
    return parts.length > 0 ? parts.join(' · ') : DASH
  }

  /**
   * A média desde sempre e a energia total são o MESMO facto dito duas vezes: a
   * média é a total a dividir pelo conta-quilómetros (133,0 kWh / 679 km × 100 =
   * 19,6 kWh/100 km, que é exactamente o que o card mostrava nas duas linhas).
   * Ficam por isso numa linha só, com o numerador ao lado do resultado.
   *
   * É também isso que dispensa o qualificador «(calculada)» que a etiqueta
   * tinha: ele existia para avisar que o número não vinha do carro, e com o
   * numerador à vista a derivação vê-se.
   *
   * Aditivo, e não «os dois ou nenhum»: na prática a média só existe se a total
   * existir — é dela que sai — mas quem lê a total sem conta-quilómetros ainda
   * tem um valor verdadeiro para mostrar, e escondê-lo era perder informação.
   */
  private lifetimeValue(): string {
    const { lifetimeConsumption, totalEnergyKwh } = this.state.trip
    const parts: string[] = []
    if (lifetimeConsumption !== undefined) parts.push(`${formatNumber(lifetimeConsumption, 1)} kWh/100 km`)
    if (totalEnergyKwh !== undefined) parts.push(`${formatNumber(totalEnergyKwh, 1)} kWh`)
    return this.joined(parts)
  }

  /**
   * Uma fatia da energia da semana: os kWh e a percentagem, lado a lado. Os dois
   * números vêm de sítios diferentes — a percentagem é o `state` da entidade, os
   * kWh são um atributo — e ambos fazem falta: a percentagem diz o peso da fatia
   * sem dizer quanto é, e os kWh dizem quanto é sem dizer se é muito.
   */
  private sliceValue(slice: EnergySlice): string {
    const parts: string[] = []
    if (slice.kwh !== undefined) parts.push(`${formatNumber(slice.kwh, 1)} kWh`)
    if (slice.percent !== undefined) parts.push(`${formatNumber(slice.percent, 1)} %`)
    return this.joined(parts)
  }

  /**
   * A série semanal: uma linha por semana, com o período por etiqueta e o
   * consumo por valor.
   *
   * Ao contrário dos outros três, este bloco não tem um conjunto FIXO de linhas:
   * as suas linhas são os próprios dados. Isso muda o que fazer quando não há
   * nada — sem série não há bloco. Um cabeçalho sozinho, sem linha nenhuma
   * debaixo dele, é o cabeçalho órfão que a doutrina das linhas sempre visíveis
   * existe para evitar, e não há onde escrever o travessão: uma linha sem
   * período não se consegue etiquetar. Nos outros três blocos cada linha é uma
   * pergunta que o card sabe fazer sempre, e o travessão é uma resposta válida.
   *
   * A unidade vai no cabeçalho e não em cada linha: repetida seis vezes era
   * ruído, e é o que o card já faz nos cantos dos pneus, onde o «bar» aparece
   * uma vez por canto ao lado do número em vez de estar escrito por extenso.
   * Fica alinhada à direita, em cima da coluna de números que ela rotula.
   */
  private weeklySection(): Section | undefined {
    const weeks = this.state.trip.weeklyConsumption
    if (weeks.length === 0) return undefined

    return {
      heading: this.t('trip.heading_weekly'),
      unit: 'kWh/100 km',
      /*
       * Da mais recente para a mais antiga, ao contrário da ordem em que a API
       * as devolve. A semana que interessa é a última, e com a ordem da API
       * ficava no fim, depois de todas as semanas em que o carro não andou —
       * eram quatro travessões antes do primeiro número, no carro real.
       */
      rows: [...weeks].reverse().map(week => ({
        // O travessão nunca deve acontecer: o parser deixa cair as semanas com
        // datas que não se leem, precisamente para toda a linha ter etiqueta.
        // Fica como rede, porque é a resposta do card para «não há nada aqui».
        label: formatWeekRange(week.start, week.end, this.language) ?? DASH,
        // Uma semana a zero é uma semana em que o carro não andou, e é isso que
        // o travessão diz. «0,0» dizia que ele andou sem gastar nada.
        value: week.kwhPer100Km !== undefined ? formatNumber(week.kwhPer100Km, 1) : DASH,
      })),
    }
  }

  private sections(): Section[] {
    const trip = this.state.trip
    const energy = trip.weekEnergy
    const weekly = this.weeklySection()
    return [
      {
        heading: this.t('trip.heading_distance'),
        rows: [
          {
            label: this.t('trip.odometer'),
            value: trip.odometerKm !== undefined ? `${formatNumber(trip.odometerKm)} km` : DASH,
          },
          {
            label: this.t('trip.last7days'),
            value: trip.last7DaysKm !== undefined ? `${formatNumber(trip.last7DaysKm)} km` : DASH,
          },
        ],
      },
      {
        heading: this.t('trip.heading_consumption'),
        rows: [
          {
            label: this.t('trip.consumption'),
            value: trip.avgConsumption !== undefined ? `${formatNumber(trip.avgConsumption, 1)} kWh/100 km` : DASH,
          },
          { label: this.t('trip.lifetime'), value: this.lifetimeValue() },
        ],
      },
      {
        heading: this.t('trip.heading_week_energy'),
        value: energy.totalKwh !== undefined ? `${formatNumber(energy.totalKwh, 1)} kWh` : DASH,
        rows: [
          { label: this.t('trip.energy_driving'), value: this.sliceValue(energy.driving) },
          { label: this.t('trip.energy_climate'), value: this.sliceValue(energy.climate) },
          { label: this.t('trip.energy_other'), value: this.sliceValue(energy.other) },
        ],
      },
      // A série vai em último: é a coisa mais detalhada e menos urgente da
      // sub-vista, e são seis linhas onde as outras são duas ou três.
      ...(weekly ? [weekly] : []),
    ]
  }

  override render() {
    /*
     * Os cabeçalhos aparecem sempre, mesmo com todas as linhas em DASH: as
     * linhas também aparecem sempre — um valor em falta escreve-se DASH, não se
     * esconde — e um cabeçalho existe para dizer o que as linhas abaixo dele
     * são. Escondê-lo deixava linhas órfãs, que é o problema que ele resolve.
     *
     * Vale também para o bloco da energia, que num carro que não reporte a
     * repartição são quatro linhas seguidas em DASH. Esconder só este bloco
     * fazia da sub-vista duas coisas ao mesmo tempo: uma que diz o que não sabe
     * e outra que cala. E o argumento para o esconder — poupar linhas vazias —
     * vale exactamente o mesmo para os outros dois, que o card já decidiu
     * mostrar. Quem não tem estas entidades já é avisado pelo aviso de entidades
     * em falta, e um grupo sem entidade nenhuma resolvida nem chega à grelha.
     *
     * O bloco da série semanal é a única excepção, e é-o por não ter linhas
     * fixas: sem série não há linha nenhuma para escrever o travessão, e a
     * regra passa a produzir um cabeçalho órfão em vez de evitar um. Ver o
     * `weeklySection`.
     */
    return html`<div class="panel">
      <div class="title">${this.t('trip.title')}</div>
      ${this.sections().map(section => html`
        <div class="heading muted">
          <span>${section.heading}</span>
          ${section.value !== undefined ? html`<span class="total">${section.value}</span>` : nothing}
          ${section.unit !== undefined ? html`<span class="unit">${section.unit}</span>` : nothing}
        </div>
        ${section.rows.map(row => html`
          <div class="line"><span class="muted">${row.label}</span><span>${row.value}</span></div>
        `)}
      `)}
    </div>`
  }

  static override styles = [sharedStyles, css`
    .title { font-size: 1.05rem; font-weight: 600; margin-bottom: 8px; }
    /*
     * A escala é a da etiqueta de canto dos pneus (tires.ts): pequena, em
     * maiúsculas e com a mesma dose de espaçamento. É de propósito que não é uma
     * escala nova — um cabeçalho de secção e a etiqueta de um valor são o mesmo
     * tipo de texto secundário, e o card já tinha um.
     *
     * O primeiro cabeçalho não leva margem de topo: o .title acima já traz a
     * dele, e as duas somadas abriam um buraco no início do painel. O seletor é
     * o irmão adjacente e não um :first-of-type — o .title também é um div,
     * portanto é ele o primeiro div do painel e o :first-of-type nunca casaria
     * com cabeçalho nenhum. Os marcadores que a Lit deixa entre os dois são
     * comentários, que não contam para a adjacência.
     */
    .heading {
      display: flex; justify-content: space-between; gap: 12px; align-items: baseline;
      font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em;
      font-weight: 600; margin: 12px 0 2px;
    }
    .title + .heading { margin-top: 0; }
    /*
     * O total sai da escala do cabeçalho que o transporta: em maiúsculas,
     * minúsculo e esbatido, «10,8 kWh» lia-se como um adorno do título e não
     * como o número que ele é. Fica com o corpo e a cor das linhas de valor
     * abaixo, que é o que ele é — a soma delas.
     */
    .heading .total {
      font-size: 0.9rem; text-transform: none; letter-spacing: normal;
      font-weight: 600; color: var(--lm-text);
    }
    /*
     * A unidade fica na escala do cabeçalho — é rótulo, não valor — mas sem a
     * maiúscula, que num símbolo de unidade estraga a grafia: kWh não é KWH.
     * (Sem acentos graves nesta zona: o bloco é um template literal de CSS.)
     */
    .heading .unit { text-transform: none; letter-spacing: normal; font-weight: 400; }
    .line { display: flex; justify-content: space-between; gap: 12px; padding: 5px 0; font-size: 0.9rem; }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-trip': LeapmotorTrip }
}
