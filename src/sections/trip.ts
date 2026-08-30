import { LitElement, css, html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { formatNumber } from '../format'
import { DASH, type TranslateFn } from '../localize'
import { sharedStyles } from '../theme'
import type { VehicleState } from '../types'

interface Row {
  label: string
  value: string
}

/**
 * Um cabeçalho e as linhas que ele cobre. As cinco linhas desta sub-vista
 * misturavam duas coisas — quilómetros andados e energia gasta — e sem a
 * separação era o leitor que tinha de a fazer de cabeça, o que se via sobretudo
 * na linha dos 7 dias, que juntava uma de cada.
 */
interface Section {
  heading: string
  rows: Row[]
}

@customElement('leapmotor-trip')
export class LeapmotorTrip extends LitElement {
  @property({ attribute: false }) state!: VehicleState
  @property({ attribute: false }) t!: TranslateFn

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
    return parts.length > 0 ? parts.join(' · ') : DASH
  }

  private sections(): Section[] {
    const trip = this.state.trip
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
          {
            /*
             * NÃO juntar esta energia aos 84 km dos «Últimos 7 dias», e NÃO
             * dividir uma pela outra para tirar uma média do período. Os dois
             * números não são um par: na integração, o
             * `last_7_days_mileage_km` é o `totalAccumulatedMileage` que a API
             * devolve já somado, enquanto o `last_7_days_energy_kwh` é uma soma
             * feita sobre a lista `detail`, dia a dia, por um ajudante que SALTA
             * os dias em que o campo não vem (`if value is None: continue`).
             *
             * Os números do utilizador confirmam-no: 4,0 kWh ao ritmo de 19,6
             * kWh/100 km dele dão cerca de 20 km, contra os 84 km da mesma
             * semana. A energia cobre um subconjunto dos dias. Escrita ao lado
             * dos quilómetros — «84 km · 4,0 kWh» — prometia um período comum
             * que ela não tem, e dividi-las fabricaria uma média que nenhum dos
             * dois lados sustenta.
             *
             * Daí a linha própria, sob CONSUMO, e uma etiqueta que não promete
             * período nenhum: «Energia registada» é tudo o que se sabe dela.
             */
            label: this.t('trip.energy_logged'),
            value: trip.last7DaysKwh !== undefined ? `${formatNumber(trip.last7DaysKwh, 1)} kWh` : DASH,
          },
        ],
      },
    ]
  }

  override render() {
    /*
     * Os cabeçalhos aparecem sempre, mesmo com todas as linhas em DASH: as
     * linhas também aparecem sempre — um valor em falta escreve-se DASH, não se
     * esconde — e um cabeçalho existe para dizer o que as linhas abaixo dele
     * são. Escondê-lo deixava linhas órfãs, que é o problema que ele resolve.
     */
    return html`<div class="panel">
      <div class="title">${this.t('trip.title')}</div>
      ${this.sections().map(section => html`
        <div class="heading muted">${section.heading}</div>
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
      font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em;
      font-weight: 600; margin: 12px 0 2px;
    }
    .title + .heading { margin-top: 0; }
    .line { display: flex; justify-content: space-between; gap: 12px; padding: 5px 0; font-size: 0.9rem; }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-trip': LeapmotorTrip }
}
