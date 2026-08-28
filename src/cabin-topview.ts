import { html, type TemplateResult } from 'lit'

/**
 * O habitáculo visto de cima, para servir de base aos controlos de conforto.
 * Desenho original, feito de rectângulos e círculos; o repositório é GPL v3 e
 * não distribui — nem decalca — arte da Leapmotor.
 *
 * Não é um carro visto de fora: não há carroçaria, nem nariz, nem rodas. É só a
 * cabina, cortada à frente na linha do tablier e atrás logo a seguir ao banco
 * corrido, que é onde acabam os controlos. Isso é o que fixa a razão do
 * `viewBox` em 200 x 228 (1 : 1,14) — a vista de topo do carro inteiro que aqui
 * esteve era 1 : 2,5 e obrigava a espremer os controlos numa faixa estreita.
 *
 * O que está desenhado, de cima para baixo:
 *   - dois espelhos exteriores (x 10 a 25 e x 175 a 190, y 26 a 35), unidos
 *     pela linha do tablier. Estão para dentro, e não encostados à margem, por
 *     causa do chip que se encosta por baixo do da esquerda: com o espelho no
 *     canto, o chip saía da caixa;
 *   - o volante em cima à esquerda (elipse de 38 x 28 centrada em 57, 42), com
 *     o cubo. É deliberadamente maior do que o chip que o acompanha: com uma
 *     roda de 30 x 22 o chip tapava-a toda menos 4px de cada lado e a peça
 *     lia-se como uma nódoa. Agora o chip está encostado à direita e a metade
 *     esquerda da roda fica à vista;
 *   - dois bancos da frente, cada um com encosto de cabeça (y 60), espaldar
 *     (y 78 a 126) e assento (y 129 a 156), centrados em x = 57 e x = 143;
 *   - a consola central entre eles (x 88 a 112), com dois porta-copos em
 *     cima (y 88) e o apoio de braço em baixo (y 112 a 152);
 *   - o banco corrido de trás a toda a largura (x 24 a 176), com o espaldar
 *     dividido ao meio (y 164 a 200) e o assento por baixo (y 203 a 222);
 *   - os painéis das portas, dois de cada lado (frente e trás), nas margens.
 *
 * As percentagens `left`/`top` dos controlos em `climate-panel.ts` resolvem
 * contra esta caixa e estão calculadas sobre estas coordenadas: cada controlo
 * está sobre a peça que comanda (o das ventoinhas dos espelhos a meio do
 * tablier que os une, o do volante sobre a roda, e a pastilha de cada banco
 * sobre o espaldar respectivo). Mexer no desenho obriga a revê-las.
 */
export const CABIN_TOPVIEW: TemplateResult = html`
  <svg viewBox="0 0 200 228" aria-hidden="true" part="topview">
    <g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" opacity="0.3">
      <rect x="10" y="26" width="15" height="9" rx="4" />
      <rect x="175" y="26" width="15" height="9" rx="4" />
      <path d="M25 31 C70 19 130 19 175 31" />

      <rect x="6" y="46" width="11" height="84" rx="5" />
      <rect x="6" y="136" width="11" height="66" rx="5" />
      <rect x="183" y="46" width="11" height="84" rx="5" />
      <rect x="183" y="136" width="11" height="66" rx="5" />

      <ellipse cx="57" cy="42" rx="19" ry="14" />
      <rect x="50" y="38.5" width="14" height="7" rx="3" />

      <rect x="44" y="60" width="26" height="15" rx="7" />
      <rect x="30" y="78" width="54" height="48" rx="13" />
      <rect x="33" y="129" width="48" height="27" rx="11" />

      <rect x="130" y="60" width="26" height="15" rx="7" />
      <rect x="116" y="78" width="54" height="48" rx="13" />
      <rect x="119" y="129" width="48" height="27" rx="11" />

      <rect x="88" y="70" width="24" height="86" rx="8" />
      <circle cx="94" cy="88" r="4.5" />
      <circle cx="106" cy="88" r="4.5" />
      <rect x="91" y="112" width="18" height="40" rx="7" />

      <rect x="24" y="164" width="152" height="36" rx="10" />
      <path d="M100 164 L100 200" />
      <rect x="24" y="203" width="152" height="19" rx="8" />
    </g>
  </svg>
`
