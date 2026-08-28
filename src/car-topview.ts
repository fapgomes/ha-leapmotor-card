import { html, type TemplateResult } from 'lit'

/**
 * Vista de topo genérica do habitáculo, para servir de base aos controlos de
 * conforto. Desenho original; o repositório não distribui imagens da Leapmotor.
 *
 * O carro está inteiro — contorno fechado com o nariz afilado, pára-brisas,
 * linha do tablier com um espelho retrovisor em cada ponta, volante, dois
 * bancos à frente e o banco de trás — mas termina logo a seguir a esse banco: a
 * mala não tem controlo nenhum e ocupava quase metade da altura do painel.
 *
 * A razão do `viewBox` (200 x 196) é o que fixa a altura da caixa onde os pinos
 * se posicionam, e cada pino está sobre uma peça concreta: o dos espelhos na
 * linha do tablier que os une (y = 62), o do volante sobre a roda (y = 82), e os
 * dos assentos dentro do banco respectivo, a meia altura dele (y = 124) — dois
 * por banco, aquecer à esquerda e ventilar à direita, portanto nenhum deles no
 * centro. Mexer no desenho obriga a rever as percentagens `top` em
 * `climate-panel.ts`.
 */
export const CAR_TOPVIEW: TemplateResult = html`
  <svg viewBox="0 0 200 196" aria-hidden="true" part="topview">
    <g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" opacity="0.3">
      <path d="M72 8 C50 12 30 28 28 54 L28 168 C28 182 34 188 48 188 L152 188 C166 188 172 182 172 168 L172 54 C170 28 150 12 128 8 C109 4 91 4 72 8 Z" />
      <path d="M40 52 C70 38 130 38 160 52" />
      <path d="M28 62 L172 62" />
      <rect x="14" y="56" width="14" height="12" rx="3" />
      <rect x="172" y="56" width="14" height="12" rx="3" />
      <circle cx="62" cy="82" r="12" />
      <rect x="40" y="100" width="52" height="48" rx="12" />
      <rect x="108" y="100" width="52" height="48" rx="12" />
      <rect x="44" y="154" width="112" height="26" rx="9" />
      <path d="M100 154 L100 180" />
    </g>
  </svg>
`
