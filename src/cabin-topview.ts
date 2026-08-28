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
 *   - a linha do tablier, que é o corte da frente da cabina. Já não vai de
 *     espelho a espelho: as pontas caem agora em (11,5; 46) e (188,5; 46), que
 *     são os topos dos painéis das portas da frente, e a linha entra por eles
 *     dentro. Tinha de ser: sem os espelhos nas pontas, uma linha que acabava
 *     no ar lia-se como um risco solto e não como o tablier. Ao meio sobe até
 *     y = 29,5, e é por trás do chip do volante que ela passa — entra-lhe pela
 *     aresta esquerda a y = 35 e sai pela direita a y = 31, ambas dentro da
 *     caixa do chip e mais de 8,75 unidades abaixo do topo dele, portanto para
 *     lá do raio do canto (7,5) e sem o roçar. Um volante montado no tablier é
 *     o que se vê, e é o que é;
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
 * está no lugar da peça que comanda (o dos espelhos no canto da frente à
 * esquerda, o do volante à frente do banco do condutor, e a pastilha de cada
 * banco sobre o espaldar respectivo). Mexer no desenho obriga a revê-las.
 */
export const CABIN_TOPVIEW: TemplateResult = html`
  <svg viewBox="0 0 200 228" aria-hidden="true" part="topview">
    <g fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" opacity="0.3">
      <path d="M11.5 46 C56 24 144 24 188.5 46" />

      <rect x="6" y="46" width="11" height="84" rx="5" />
      <rect x="6" y="136" width="11" height="66" rx="5" />
      <rect x="183" y="46" width="11" height="84" rx="5" />
      <rect x="183" y="136" width="11" height="66" rx="5" />

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
