# Leapmotor Card v4 — design

Data: 2026-08-30
Estado: aprovado
Antecessor: `2026-08-27-leapmotor-card-v2-design.md` (a v3 não teve especificação
própria; os seus factos ficaram no plano `2026-08-27-leapmotor-card-v3.md`)
Versão-alvo: **0.4.0** — com rutura de configuração, ver §7

## 1. Objetivo

O card deixa de ser uma coluna única que cresce com cada secção ligada e passa a
ser um **hero compacto com uma grelha de grupos que abrem sub-vistas
navegáveis**, ao estilo do
[`ngocjohn/vehicle-info-card`](https://github.com/ngocjohn/vehicle-info-card),
com quatro melhorias sobre essa referência.

O pedido do utilizador foi textualmente *«podemos fazer algo do estilo e
melhor?»*. O «do estilo» está em §3; o «melhor» está em §4, e são quatro coisas
concretas, escolhidas pelo utilizador de uma lista de candidatas.

## 2. Factos verificados no código deste repositório

Levantados por leitura do próprio repositório em 2026-08-30, no commit `1943aa1`
(release 0.3.4). Não repetir estas verificações sem motivo; e não as contradizer
sem voltar a ler o código.

### 2.1 As onze secções já são componentes autónomos

Cada `src/sections/*.ts` é um elemento Lit que recebe `.state` (um
`VehicleState`) e `.t` (um `TranslateFn`), e desenha o seu próprio `.panel` com
título. Nenhuma delas depende do contexto onde é instanciada, e nenhuma importa
`vehicle-state.ts` — essa fronteira é o que garante que nenhuma secção alcança o
`hass`, e está documentada no comentário do `isWindowOpen` em `format.ts`.

**Consequência:** uma sub-vista pode instanciar as secções que já existem sem
lhes tocar. É isto que faz este desenho custar uma fração do que custaria de
outra forma, e é a razão pela qual a abordagem escolhida em §3.1 é possível.

### 2.2 Os *handlers* de evento vivem todos no `ha-card`

`leapmotor-card.ts:486-494` registra sete *listeners* no elemento `ha-card`:
`leapmotor-action`, `leapmotor-set-charge-limit`, `leapmotor-set-number`,
`leapmotor-set-switch`, `leapmotor-fan-speed`, `leapmotor-climate-change`,
`leapmotor-expand`. As secções emitem com `bubbles: true, composed: true`.

**Consequência:** mover uma secção da coluna para dentro de uma sub-vista **não
exige mudar nada no encaminhamento de eventos**. O borbulhamento chega ao
`ha-card` de qualquer profundidade.

### 2.3 O `cabin-topview.ts` não serve para os pneus

O seu próprio comentário diz: *«Não é um carro visto de fora: não há carroçaria,
nem nariz, nem rodas. É só a cabina, cortada à frente na linha do tablier e
atrás logo a seguir ao banco corrido.»*

Mais: as posições `left`/`top` em percentagem dos controlos de conforto em
`climate-panel.ts` resolvem contra a sua caixa de `200 × 240`, e o comentário
avisa que mexer no desenho obriga a revê-las todas.

**Consequência:** os pneus precisam de um desenho **novo** (`car-topview.ts`).
Reutilizar o `cabin-topview.ts` partiria o painel de clima e, de resto, não teria
rodas onde ancorar os quatro valores.

### 2.4 Os limiares de pressão dos pneus estão fixos no código, e são estreitos

`tires.ts:8-9`:

```ts
const TIRE_MIN = 2.0
const TIRE_MAX = 2.6
```

A captura de referência que o utilizador forneceu (`vehicle-info-card`, um
Mercedes) mostra **`2.6 - 2.8 Bar` como valores normais**. Sob este limiar, 2,8
bar é aviso e 2,6 está exatamente em cima do limite.

Hoje isso produz um número âmbar dentro de uma secção que por omissão está
desligada (`DEFAULT_SECTIONS.tires === false`). Com o alerta no tile (§4.2),
passa a produzir um quadrado âmbar **permanente na grelha** de quem tenha o carro
corretamente calibrado. A funcionalidade nova torna o limiar errado muito mais
visível — e é por isso que a §5.3 o torna configurável.

### 2.5 O aviso de pneu pede emprestada a cor da bateria

`tires.ts:48` e `tires.ts:51` usam `var(--leapmotor-battery-mid, #f5a623)` para
um aviso de pressão. `tiles.ts:193` faz o mesmo. Não há em `theme.ts` nenhum
símbolo cuja semântica seja «aviso».

### 2.6 Os testes são inteiramente de lógica pura

1533 linhas em `test/`, distribuídas por `actions`, `vehicle-state`, `resolver`,
`format`, `keys`, `types`, `localize` e `smoke`. **Zero testes de render**, zero
`@open-wc/testing`, zero `jsdom` a fingir layout.

O padrão do repositório é: a decisão sai para uma função pura
(`decideAction`, `mapRequestChanged`, `clampMapZoom`, `pendingValue`,
`pruneRequests`), a função é testada exaustivamente, e a cola no DOM fica fina e
sem testes. Este desenho segue o mesmo padrão, em §5.1 e §4.4.

Confirmado também: **nenhum dos 138 testes existentes toca em `tiles.ts`**, que
este desenho apaga.

### 2.7 O `ha-form` do Home Assistant não tem selector de reordenação

Não existe selector com arrastar-para-reordenar em `ha-form`. Um
`select: { multiple: true, mode: 'list' }` dá quais os itens, mas devolve-os pela
ordem do catálogo de opções, não por uma ordem escolhida. Daí a decisão de §6.

## 3. O que se copia da referência

### 3.1 Decisão estruturante: um grupo é um conjunto de secções existentes

Foram consideradas três formas de dar grupos configuráveis:

| | Abordagem | Porque não |
|---|---|---|
| A | **Um grupo é um conjunto de secções que já existem.** Catálogo em código; o `grid:` escolhe, reordena e sobrepõe rótulos. | **Escolhida.** |
| B | Um grupo é uma lista de linhas de entidade declaradas na configuração. | O painel de clima (541 linhas, com a vista de topo da cabina e as pastilhas por banco), o `charging` com o seu *stepper* de limite e os pneus sobre o diagrama **não são linhas** e não se expressam neste modelo. Ficariam como casos especiais fora dele, e o resultado eram dois mecanismos em paralelo. |
| C | Um grupo é qualquer card Lovelace, como na referência. | Incompatível com três das quatro melhorias de §4: linhas acionáveis, alerta no tile e altura estável exigem que o card conheça o conteúdo. Um card estranho não o deixa conhecer. Exigiria ainda `loadCardHelpers()`, ciclo de vida aninhado e propagação de `hass`. |

### 3.2 O catálogo

Seis grupos, em código, nesta ordem por omissão:

Cada grupo tem um conjunto **enumerado** de `summary` possíveis, e o primeiro de
cada linha é o da omissão:

| Grupo | Instancia | `summary` (o 1.º é a omissão) | O que mostra por omissão |
|---|---|---|---|
| `charging` | `charging` + `schedule` | `battery`, `limit`, `phase`, `eta` | percentagem de bateria |
| `status` | `openings` *(novo, §4.1)* | `lock`, `openings`, `parking` | estado das trancas |
| `climate` | `climate-panel` + `comfort` | `interior`, `target`, `state` | temperatura interior |
| `tires` | `tires` *(redesenhado, §3.5)* | `range`, `min`, `worst` | faixa mín.–máx. em bar |
| `trip` | `trip` | `odometer`, `last7`, `consumption` | conta-quilómetros |
| `location` | `location` | `activity`, `zone`, `age` | estacionado / a conduzir |

Ser enumerado é o que permite validar e testar. Um `summary` fora do conjunto do
seu grupo cai na omissão desse grupo, pela mesma regra do `tire_range` (§5.3).
`summary` a apontar para uma entidade arbitrária fica fora de âmbito (§8).

### 3.3 A grelha e as sub-vistas

Sem sub-vista aberta: hero completo (com foto), grelha de duas colunas, fila de
ações. Um tile é um `<button>` com ícone, título e valor-resumo.

Com sub-vista aberta:

- o **hero encolhe** a uma linha — nome, autonomia, bateria, trancas — sem foto e
  sem rótulo de atividade;
- a **fila de ações desaparece**. São comandos, não informação, e não pertencem a
  nenhuma sub-vista;
- segue a barra `✕ ‹ ›`, o corpo com as secções do grupo, e o rodapé
  *«Atualizado às…»* que a referência também tem.

A ordem de navegação é a ordem da grelha resolvida, e os `‹ ›` dão a volta.

### 3.4 Simplificação que isto traz

O estado `_expanded` encolhe: os valores `'climate'` e `'openings'` deixam de
existir. O painel de clima passa a ser *o conteúdo* da sub-vista `climate`,
sempre aberto lá. Desaparecem:

- a lógica de exclusão mútua no `onExpand` (`leapmotor-card.ts:416-424`);
- a canalização do `pendingTemp` para os tiles e o comentário que a justificava;
- o próprio `sections/tiles.ts`.

Sobra `_expanded === 'sunshade'`, que vem da fila de ações e só existe em modo
grelha.

### 3.5 Os pneus

Os quatro valores dispostos em volta do `CAR_TOPVIEW` novo, em vez da grelha 2×2
de caixas de hoje. Desenho original de rectângulos e círculos, com quatro rodas,
na disciplina dos outros dois SVG do repositório: *o repositório é GPL v3 e não
distribui — nem decalca — arte da Leapmotor.*

## 4. O que se faz melhor que a referência

As quatro foram escolhidas pelo utilizador de uma lista de candidatas. Todas
entram no âmbito.

São quatro melhorias em cinco subsecções: a terceira escolha — *«altura estável +
teclado/aria»* — é um só item, mas os dois mecanismos não têm nada em comum e
ficam separados em §4.3 e §4.5.

### 4.1 Linhas acionáveis nas sub-vistas

Na referência as sub-vistas são só de leitura e os comandos vivem noutra secção.
Aqui, `actions.ts` (448 linhas) já sabe trancar, abrir a mala, fechar os vidros e
comandar o clima: a linha «Vidros · 2 abertos» é o botão que os fecha.

O novo `openings.ts` — «Estado do veículo» — em linhas de ícone + rótulo + valor:

| Linha | Valor | Comando |
|---|---|---|
| Trancas | trancado / destrancado | `lock` / `unlock` |
| Vidros | fechados / *n* abertos | `windows` |
| Portas | fechadas / itemizadas | — |
| Mala | fechada / aberta | `trunk` |
| Teto | fechado / aberto | — |

O botão só aparece quando `resolveAction()` de facto resolve a ação. As portas
ficam só de leitura porque **não há comando de porta na integração**, e uma linha
com um botão que não faz nada é pior do que uma linha sem botão. O
`confirm_actions` existente aplica-se sem alterações.

A lista itemizada de aberturas — hoje `openingsRows()` em `tiles.ts:46-67` —
muda-se para cá.

### 4.2 Estado de alerta no tile

A grelha diz o que precisa de atenção sem se abrir nada. A referência só colore a
palavra `Unlocked`.

| Grupo | `warn` (âmbar) | `alert` (vermelho) |
|---|---|---|
| `status` | destrancado, ou alguma abertura aberta | — |
| `tires` | um valor fora da faixa | dois ou mais fora da faixa |
| `location` | posição obsoleta (`state.location.stale`) | — |
| `charging` | usa `batteryColor()` de `theme.ts`, que já tem a semântica certa | — |
| `climate`, `trip` | — | — |

Trancas com leitura obsoleta (`state.lock.stale`, que o card já distingue) ficam
em `none` e o resumo sai esbatido: **uma leitura velha não é um alerta, é uma
leitura velha.** Carro `offline`: resumos a `—` e sem alertas — ausência de
leitura também não é alerta.

`theme.ts` ganha `--lm-warn` e `--lm-alert`, com os valores por omissão de hoje
(`#f5a623`, `#e5484d`), para o significado deixar de vir emprestado da bateria
(§2.5). Os usos em `tires.ts` passam a apontar para os símbolos novos.

### 4.3 Altura estável

As duas capturas de referência têm 553 px e 690 px: 137 px de salto ao passar de
Pneus para Viagem. A referência salta.

Um `ResizeObserver` mede cada sub-vista quando abre e o card guarda o máximo
visto, aplicando-o como `min-height`. Sem números mágicos, e adapta-se ao carro
de cada um.

**Limite honesto:** a primeira visita a uma sub-vista mais alta ainda cresce o
card uma vez; a partir daí fica estável. As alternativas foram consideradas e
rejeitadas: manter todas as sub-vistas no DOM sobrepostas nunca saltaria, mas
desfazia o ganho do mapa preguiçoso (§5.4) e deixava o painel de clima sempre
vivo; um `min_height` fixo por configuração é um número mágico que não sabe nada
do conteúdo.

O grupo `location` fica fora do cálculo: o mapa tem altura fixa própria.

### 4.4 Deslizar horizontal entre sub-vistas

`touch-action: pan-y` no contentor da sub-vista entrega o arrasto vertical ao
browser e deixa-nos só o horizontal — é o CSS a resolver metade do conflito com o
scroll do dashboard. A outra metade é decidir, ao primeiro movimento, se o dedo
vai para o lado ou para baixo, e isso sai para uma função pura:

```ts
decideSwipe(dx, dy, threshold) → 'prev' | 'next' | 'none' | 'scroll'
```

Os testes atacam a função com pares de números. A cola no DOM — três *listeners*
de `pointer` que a chamam — fica fina e sem testes, porque testá-la em `vitest`
seria testar um `jsdom` que não faz scroll (§2.6). A transição respeita
`prefers-reduced-motion`.

### 4.5 Teclado e aria

| Onde | Tecla | O quê |
|---|---|---|
| Grelha | `Tab` | tile a tile; cada um é um `<button>` com `aria-label` de título + resumo |
| Grelha | `Enter` / `Space` | abre |
| Sub-vista | `←` `→` | anterior / seguinte |
| Sub-vista | `Esc` | fecha **e devolve o foco ao tile de origem** |

A região da sub-vista leva `role="group"` e `aria-labelledby` a apontar para o
seu título. As setas levam `aria-label` traduzido, não só um ícone.

A devolução do foco ao tile de origem é a parte que a maioria das implementações
esquece, e é a diferença entre navegar por teclado e ficar perdido no topo do
documento.

## 5. Arquitetura

### 5.1 Ficheiros novos

| Ficheiro | O quê |
|---|---|
| `src/groups.ts` | O catálogo e as decisões. `resolveGrid(config)`, `summaryFor(group, state, t, language)`, `alertFor(group, state, limits)`. **Puro**: sem DOM e sem `hass`. É aqui que os testes atacam. |
| `src/sections/group-grid.ts` | `<leapmotor-group-grid>` — a grelha de duas colunas. Emite `leapmotor-open-group`. O tile é burro: recebe título, ícone, texto e nível, e pinta. |
| `src/sections/group-detail.ts` | `<leapmotor-group-detail>` — a barra `✕ ‹ ›`, o corpo, o rodapé, a altura reservada, o teclado e o gesto. |
| `src/sections/openings.ts` | `<leapmotor-openings>` — §4.1. |
| `src/car-topview.ts` | O `CAR_TOPVIEW` — §3.5. |

### 5.2 Ficheiros alterados

- **`src/leapmotor-card.ts`** — o `render()` bifurca em `renderGrid()` /
  `renderDetail()`. Estado novo: `_openGroup?: string`. Os *handlers* ficam onde
  estão, no `ha-card` (§2.2).
- **`src/sections/hero.ts`** — propriedade `compact`.
- **`src/sections/tires.ts`** — §3.5, e os símbolos de cor de §4.2.
- **`src/theme.ts`** — `--lm-warn`, `--lm-alert`.
- **`src/types.ts`** — `grid`, `tire_range`; fora o `sections` (§7).
- **`src/leapmotor-card-editor.ts`** — §6.
- **`src/translations/{en,pt}.json`** — as chaves novas, nas duas línguas.

### 5.3 O `tire_range`

Nova opção `tire_range: [min, max]`, por omissão `[2.0, 2.6]` — os valores de
hoje, para não mudar o comportamento de ninguém sem que o peça. Validação na
leitura, como o `clampMapZoom` já faz e pela mesma razão (YAML escrito à mão não
passa por esquema nenhum): números finitos, `min < max`, comprimento 2. Qualquer
coisa fora disso cai na omissão.

Esta especificação **não** decide qual é a pressão recomendada para o B10. É um
valor que depende da medida do pneu e da carga, não se verifica a partir do
código, e fica para quem tem o carro à frente.

### 5.4 Ficheiro apagado

**`src/sections/tiles.ts`** — é literalmente aquilo que a grelha de grupos
substitui. O tile de clima passa a ser o tile do grupo `climate`, o de aberturas o
do grupo `status`, e o `openingsRows()` muda-se para `openings.ts` (§4.1).

### 5.5 O mapa

`location` é um grupo, portanto o mapa vive numa sub-vista e não
permanentemente visível. Ganho concreto: o `ensureMap()` só corre quando essa
sub-vista abre, em vez de construir um mapa Leaflet a cada carregamento do
dashboard. Quem quiser o mapa sempre à vista põe o card `map` do Home Assistant
ao lado deste.

### 5.6 O `DEFAULT_GRID` e as entidades que faltam

Hoje o `DEFAULT_SECTIONS` tem quase tudo a `false`, porque nem todos os carros
dão tudo, e uma secção ligada sem entidades produz o aviso `missing_entity`.

Com grupos, inverte-se: **o `DEFAULT_GRID` é o catálogo inteiro, e um grupo sem
entidades resolvíveis desaparece da grelha em silêncio.** Configuração zero passa
a mostrar tudo o que *aquele* carro dá.

O aviso `missing_entity` mantém-se, mas só para grupos escritos explicitamente no
`grid:` — aí o silêncio seria esconder um erro de quem configurou.

## 6. O editor visual

`ha-form` não tem reordenação (§2.7). O editor fica com duas partes: o `ha-form`
de hoje para o resto da configuração, e um bloco próprio para a grelha — uma
linha por grupo, com caixa de seleção e dois botões de subir/descer. Cerca de 80
linhas de código próprio, sem dependências novas.

`icon`, `title` e `summary` por grupo ficam apenas em YAML. Um editor completo com
seletor de ícone fica fora (§8).

## 7. Rutura de configuração

`sections:` **deixa de existir** na 0.4.0. Foram consideradas as alternativas de
honrar-e-depreciar e de suportar as duas formas para sempre; a decisão do
utilizador foi o corte limpo, por um só caminho de código e um README mais curto.

Mitigação, para o custo assumido nessa decisão não ser um card que muda sem
aviso: **se a configuração ainda tiver a chave `sections:`, o card mostra um
`ha-alert`** a dizer que a chave saiu e que a substituta é `grid:`. Cinco linhas,
não reintroduz o segundo caminho de configuração, e põe o aviso onde a pessoa
está a olhar em vez de só no CHANGELOG.

Exemplo do esquema novo:

```yaml
type: custom:leapmotor-card
grid:
  - charging                    # forma curta
  - status
  - group: tires                # forma longa, só quando é preciso
    icon: mdi:car-tire-alert
    title: Pressões
    summary: worst
tire_range: [2.4, 3.0]
```

Ordem no YAML = ordem na grelha.

## 8. Fora de âmbito

- `summary` a apontar para uma entidade arbitrária.
- Cards Lovelace dentro dos grupos (abordagem C de §3.1).
- Grupos inventados pelo utilizador: só do catálogo.
- Gráficos, *sparklines* ou histórico do Home Assistant nas sub-vistas.
- Sobreposição de ícone, título e resumo pelo editor visual — fica em YAML.
- Descobrir a pressão recomendada do B10 (§5.3).

## 9. Invariantes herdadas

Não são propostas desta especificação. Estão nos planos v2 e v3 e continuam a
valer:

- **Nenhuma cadeia literal visível no render** — tudo por `t()`, exceto símbolos
  de unidade e o `DASH`. Aplica-se aos títulos e resumos dos tiles.
- **Valor ausente renderiza `—`** — nunca `NaN`, `unknown` ou `unavailable`.
- **Nenhuma secção importa `vehicle-state.ts`.** O `groups.ts` fica do lado puro
  e não viola esta fronteira.
- **`noImplicitOverride: true`.**
- **O `all: unset` do `button.plain`** em `theme.ts` reinicia todas as
  propriedades e está a (0,1,1). Os tiles da grelha e os botões da barra de
  navegação são botões: precisam de seletores compostos que reponham a caixa que
  exigem. O comentário no `theme.ts` conta que isto já produziu seis defeitos
  neste projeto, dois deles visíveis no dashboard de um utilizador.

## 10. Casos-limite

| Situação | Comportamento |
|---|---|
| Nenhum grupo tem entidades resolvíveis | Sem grelha. Hero + fila de ações, como um card mínimo válido. |
| Só um grupo na grelha | As setas `‹ ›` não aparecem; o `✕` fica. Navegar para si mesmo não é navegação. |
| `_openGroup` deixa de existir (config mudou, entidades desapareceram) | Fecha e volta à grelha, em vez de mostrar uma sub-vista vazia. |
| `grid:` com um grupo desconhecido | `ha-alert` a nomear o grupo, como já se faz nos erros de resolução de dispositivo. |
| `sections:` ainda presente | `ha-alert` de rutura (§7). |
| Painel da cortina aberto e abre-se um grupo | O painel fecha. A fila de ações que o abriu desaparece, e um painel órfão de um botão invisível é lixo no ecrã. |
| Carro `offline` | Grelha com `—` nos resumos e sem alertas (§4.2). |

## 11. Testes

Tudo novo é lógica pura, na disciplina de §2.6 — **nenhum teste de render**.

| Ficheiro | O que verifica |
|---|---|
| `test/groups.test.ts` | `resolveGrid()`: ordem, forma curta e longa, grupo desconhecido, grupo sem entidades. `summaryFor()`: cada grupo, cada valor enumerado, ausências a dar `—`, e um `summary` fora do conjunto do grupo a cair na omissão. `alertFor()`: cada regra, incluindo o um-versus-dois pneus e o `stale` a não alertar. |
| `test/swipe.test.ts` | `decideSwipe()` com pares de números: eixo, limiar, e o caso `'scroll'`. |
| `test/types.test.ts` *(estendido)* | Validação do `tire_range`: `min < max`, não-finitos, comprimento errado — tudo a cair na omissão, como o `clampMapZoom`. |
| `test/localize.test.ts` *(estendido)* | As chaves novas existem nas duas línguas. |

Estimativa: ~40 testes novos. Os 138 existentes mantêm-se — nenhum toca em
`tiles.ts` (§2.6).

## 12. Documentação

- **A primeira frase do README deixa de ser verdade.** Diz hoje que o card
  *«replicates the main vehicle screen of the Leapmotor mobile app»*. Tem de ser
  reescrita.
- A tabela de opções perde `sections` e ganha `grid` e `tire_range`.
- **As duas imagens do README ficam obsoletas.** A segunda é a mais séria:
  mostra o painel de clima aberto a partir de um tile que este desenho apaga. E o
  README afirma explicitamente que essa imagem é um render real e não *«markup
  arranged to look like it»* — manter a imagem antiga tornaria essa afirmação
  falsa. Ambas têm de ser refeitas, e o ferramental do render *headless* não está
  no repositório: foi *ad hoc*.
- `CHANGELOG.md` com secção de rutura, e `package.json` + `CARD_VERSION` em
  **0.4.0** (o teste de `smoke` verifica que os dois não se separam).
