import { html, type TemplateResult } from 'lit'

/**
 * O habitáculo visto de cima, para servir de base aos controlos de conforto.
 * Desenho original, feito de rectângulos e círculos; o repositório é GPL v3 e
 * não distribui — nem decalca — arte da Leapmotor.
 *
 * Não é um carro visto de fora: não há carroçaria, nem nariz, nem rodas. É só a
 * cabina, cortada à frente na linha do tablier e atrás logo a seguir ao banco
 * corrido, que é onde acabam os controlos. Isso é o que fixa a razão do
 * `viewBox` em 200 x 240 (1 : 1,2) — a vista de topo do carro inteiro que aqui
 * esteve era 1 : 2,5 e obrigava a espremer os controlos numa faixa estreita.
 *
 * A caixa era 200 x 228 e cresceu 12 unidades EM BAIXO, sem nada mudar de
 * tamanho: o tablier ficou onde estava e tudo o que vem depois dele — bancos,
 * consola, banco de trás, painéis de trás — desceu 12, com os painéis das
 * portas da frente a esticarem os mesmos 12 para continuarem a nascer nas
 * pontas do tablier. O que se ganhou foi a distância entre o tablier e os
 * bancos, que é onde o volante vive: com 228 não havia como pôr o chip do
 * volante à frente do condutor sem lhe encostar ao encosto de cabeça ou sem o
 * traço do tablier lhe entrar pelo canto redondo. Agora há 36,9 unidades de
 * banda livre para um chip de 25, e sobram ~6 de cada lado.
 *
 * ONDE HÁ CONTROLO NÃO HÁ DESENHO. Esta é a regra que rege o que aqui está e,
 * sobretudo, o que aqui deixou de estar. Um chip é uma caixa opaca de cantos
 * redondos: pôr por baixo dele outra peça com a mesma forma — a roda do volante
 * era uma elipse, o espelho um rectângulo arredondado — não acrescenta leitura
 * nenhuma, só deixa espreitar uma orla à volta do chip que se lê como uma
 * nódoa. Foi o que aconteceu no dashboard, e é por isso que nem o volante nem
 * os espelhos estão desenhados: o chip que os comanda É a peça. Quem mexer
 * neste ficheiro não os volte a acrescentar.
 *
 * O que está desenhado, de cima para baixo:
 *   - a linha do tablier, que é o corte da frente da cabina. Não vai de espelho
 *     a espelho: as pontas caem em (11,5; 46) e (188,5; 46), que são os topos
 *     dos painéis das portas da frente, e a linha entra por eles dentro. Tinha
 *     de ser: sem os espelhos nas pontas, uma linha que acabava no ar lia-se
 *     como um risco solto e não como o tablier. Ao meio sobe até y = 29,5.
 *     Agora não passa por trás de chip nenhum — nem o dos espelhos nem o do
 *     volante lhe tocam, e a folga mais curta para cada um deles está anotada
 *     em `climate-panel.ts`;
 *   - dois bancos da frente, cada um com encosto de cabeça (y 72), espaldar
 *     (y 90 a 138) e assento (y 141 a 168), centrados em x = 57 e x = 143;
 *   - a consola central entre eles (x 88 a 112), com dois porta-copos em
 *     cima (y 100) e o apoio de braço em baixo (y 124 a 164);
 *   - o banco corrido de trás a toda a largura (x 24 a 176), com o espaldar
 *     dividido ao meio (y 176 a 212) e o assento por baixo (y 215 a 234);
 *   - os painéis das portas, dois de cada lado (frente e trás), nas margens.
 *
 * As percentagens `left`/`top` dos controlos em `climate-panel.ts` resolvem
 * contra esta caixa e estão calculadas sobre estas coordenadas: cada controlo
 * está no lugar da peça que comanda (um chip de espelho em cada canto da
 * frente, o do volante à frente do banco do condutor, e a pastilha de cada
 * banco sobre o espaldar respectivo). Mexer no desenho obriga a revê-las — e
 * as `top` resolvem contra a ALTURA da caixa, portanto mexer no 240 mexe em
 * todas elas.
 */
export const CABIN_TOPVIEW: TemplateResult = html`
  <svg viewBox="0 0 200 240" aria-hidden="true" part="topview">
    <g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" opacity="0.3">
      <path d="M11.5 46 C56 24 144 24 188.5 46" />

      <rect x="6" y="46" width="11" height="96" rx="5" />
      <rect x="6" y="148" width="11" height="66" rx="5" />
      <rect x="183" y="46" width="11" height="96" rx="5" />
      <rect x="183" y="148" width="11" height="66" rx="5" />

      <rect x="44" y="72" width="26" height="15" rx="7" />
      <rect x="30" y="90" width="54" height="48" rx="13" />
      <rect x="33" y="141" width="48" height="27" rx="11" />

      <rect x="130" y="72" width="26" height="15" rx="7" />
      <rect x="116" y="90" width="54" height="48" rx="13" />
      <rect x="119" y="141" width="48" height="27" rx="11" />

      <rect x="88" y="82" width="24" height="86" rx="8" />
      <circle cx="94" cy="100" r="4.5" />
      <circle cx="106" cy="100" r="4.5" />
      <rect x="91" y="124" width="18" height="40" rx="7" />

      <rect x="24" y="176" width="152" height="36" rx="10" />
      <path d="M100 176 L100 212" />
      <rect x="24" y="215" width="152" height="19" rx="8" />
    </g>
  </svg>
`
