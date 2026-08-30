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
