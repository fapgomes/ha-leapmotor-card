# Changelog

Todas as alterações relevantes deste projeto ficam registadas aqui.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e o projeto usa [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [0.4.2] — 2026-08-30

### Corrigido

- Uma sub-vista já não fica com a altura da mais alta que se abriu antes. O card
  reservava a maior altura vista e aplicava-a a todas, e como o painel de clima é
  muito mais alto que os outros, abri-lo uma vez deixava as restantes com
  centenas de píxeis de vazio até se recarregar a página. A reserva foi removida
  por inteiro: cada sub-vista tem a sua altura.
- A linha do teto, no estado do veículo, passa a abrir o controlo da cortina. O
  comando existia — é o mesmo da fila de ações, que precisa de uma posição e por
  isso abre um painel em vez de chamar um serviço — mas a linha nunca lhe tinha
  sido ligada.

## [0.4.1] — 2026-08-30

### Corrigido

- Arrastar um controlo dentro de uma sub-vista já não a troca por outra. Os
  dois deslizadores que vivem em sub-vistas — o limite de carga e a ventoinha —
  e o mapa embutido eram indistinguíveis de um deslize horizontal entre grupos:
  o card saltava a meio do gesto. Estes controlos passaram para a coluna
  principal, que não tinha gesto nenhum, na 0.4.0, e é aí que o defeito nasceu.
- O tile de estado já não afirma «Tudo fechado» a um carro que não reportou
  nada. A contagem de aberturas só conta leituras positivas, portanto tudo
  desconhecido dava zero e lia-se como fecho. Agora dá `—`, tal como acontece
  quando o carro está desligado.
- Concordância de género em português: «1 aberta» em vez de «1 abertos» na
  linha das portas, e «Bagageira: Aberta» em vez de «Aberto». O teto continua
  masculino.
- Abrir uma sub-vista já não arrasta a página quando o card está meio fora do
  ecrã.

## [0.4.0] — 2026-08-30

### Rutura

- A opção `sections` deixou de existir. A disposição do card passa a ser uma
  grelha de grupos que abrem sub-vistas, e que secções são mostradas decorre
  de que grupos estão na grelha. Substitui `sections:` por `grid:` — o card
  mostra um aviso no lugar se ainda encontrar a chave antiga. Sem nenhum
  `grid:` escrito, mostra-se cada grupo cujas entidades o carro reporta.

### Adicionado

- Uma grelha de grupos na vista principal — carga, estado, clima, pneus,
  viagem e localização —, cada um com ícone, título e um resumo ao vivo, que
  abre uma sub-vista no lugar com fecho e navegação anterior/seguinte.
  Configurável e reordenável, em YAML ou no editor visual.
- As linhas da sub-vista do estado do veículo comandam o que mostram: a das
  trancas tranca ou destranca, a dos vidros fecha-os, a da bagageira abre-a.
  As portas e o teto ficam sem ação, porque a integração não expõe comando
  nenhum para eles. O `confirm_actions` aplica-se a estas linhas como às
  restantes ações.
- A cor do tile segue o estado: âmbar para destrancado ou uma abertura
  aberta, vermelho para dois ou mais pneus fora da faixa, a cor da bateria
  durante a carga.
- As pressões dos pneus passam a estar dispostas à volta de uma vista de
  topo do carro.
- `tire_range` define a faixa de pressão considerada normal (por omissão
  `[2.0, 2.6]`, os valores que já estavam fixos no código).
- Navegação por teclado em toda a sub-vista: as setas alternam entre grupos,
  Escape fecha e devolve o foco ao tile que a abriu. Deslize horizontal no
  toque.
- O card reserva a altura da sub-vista mais alta já visitada, para o
  dashboard deixar de saltar entre elas.

### Alterado

- O mapa passa a construir-se quando a sua sub-vista abre, e não em cada
  carregamento do dashboard.
- O painel de climatização passa a ser o conteúdo da sub-vista de clima;
  deixou de expandir a partir de um tile.
- As cores de aviso dos pneus passam a usar `--leapmotor-warn` e
  `--leapmotor-alert`, em vez de tomarem de empréstimo as cores da bateria.

### Removido

- O par de tiles interior/aberturas, substituído pela grelha.
- As duas capturas do README, que mostravam a disposição anterior.

## [0.3.4] — 2026-08-28

### Adicionado

- Opção `map_zoom` para o zoom do mapa embutido, por omissão **16** em vez dos
  14 do Home Assistant, e disponível no editor visual. Fica limitada a 1–20
  onde é lida, e não no editor, porque a configuração também se escreve à mão.

### Corrigido

- Mudar o zoom ou o veículo no editor passa a reconstruir o mapa. Antes o mapa
  era construído uma única vez e a pré-visualização ficava a mostrar o anterior.

### Nota

- O mapa mostra uma marca de água «API KEY REQUIRED» desde que a CARTO passou a
  exigir chave para os mosaicos que o Home Assistant usa. É um problema do
  próprio Home Assistant (`home-assistant/core#180277`), não deste card, e o
  card `map` do HA não permite escolher outro fornecedor. Espera-se a correção
  a montante.

## [0.3.3] — 2026-08-28

### Alterado

- O volante desceu da linha do tablier para a frente do banco do condutor,
  alinhado com a pastilha desse banco. Estava a ler-se como um emblema colado
  ao tablier em vez de um volante.
- Os espelhos passaram a **dois botões, um em cada canto**, como na app. Os
  dois comandam o mesmo interruptor — que é o único que a integração expõe —,
  acendem e apagam juntos, e o nome acessível de cada um diz que comuta o par.
  A versão anterior mostrava um só botão por eu ter julgado que dois seriam
  enganadores; não são, porque os dois espelhos aquecem mesmo em conjunto.
  Enganador seria dois botões que parecessem independentes.
- A cabina ganhou doze unidades de altura à frente, para o volante caber entre
  o tablier e o encosto de cabeça sem encostar a nenhum dos dois.

## [0.3.2] — 2026-08-28

### Alterado

- No volante e nos espelhos, **o botão passou a ser a peça**. Estavam ambos
  desenhados com o botão por cima, e duas formas redondas sobrepostas liam-se
  como um borrão. O desenho por baixo saiu; o botão fica onde a peça está.
- O ícone dos espelhos passou de `mdi:mirror-rectangle`, que se lia como um
  telemóvel, para `mdi:mirror`. O ícone de vidro aquecido que a app usa era o
  candidato óbvio, mas em Material Design Icons é traço por traço o mesmo que
  o do Desembaciar, que já está no fundo deste painel — a 18 px seriam
  indistinguíveis. O calor fica dito no rótulo.
- A linha do tablier fechou-se de porta a porta. Ia de espelho a espelho, e
  sem eles ficava com as pontas no ar.

## [0.3.1] — 2026-08-28

### Alterado

- **O painel de climatização passou a desenhar a cabina, não o carro visto de
  fora.** A referência é o ecrã da app, e o que ele mostra é o interior visto
  de cima — bancos, consola, banco traseiro —, sem carroçaria. A 0.3.0 desenhou
  um carro inteiro porque a descrição escrita dizia «vista de topo do carro» e
  ninguém tinha aberto a imagem. Corrigir isso resolveu de uma vez os controlos
  que se sobrepunham e a altura excessiva do painel: são duas pastilhas largas
  em vez de seis pinos redondos, e uma cabina não é comprida como um carro.
- Os controlos de cada banco da frente ficam agora **numa pastilha só**, com o
  aquecimento e a ventilação lado a lado, como na app. Continuam a ser dois
  controlos independentes; a pastilha agrupa-os, não os funde.
- O botão dos espelhos passou a ficar junto ao espelho desenhado e a dizer
  «os dois», porque a integração expõe **um só interruptor** para o par.

### Adicionado

- Anel de foco visível em todos os botões do card, e resposta ao toque nos
  controlos do painel de climatização.
- Teste que obriga os catálogos PT e EN a terem exactamente as mesmas chaves,
  incluindo as aninhadas. Não existia; os catálogos estavam certos por cuidado
  de quem lá mexia, não por verificação.

## [0.3.0] — 2026-08-28

### Adicionado

- Painel de climatização com os controlos de conforto sobrepostos a um
  desenho do veículo (substituído na 0.3.1 pelo interior da cabina): espelhos, volante, e aquecimento e ventilação de cada
  banco da frente. Desenho original, em SVG.
- Controlo da velocidade da ventoinha, de 1 a 7.
- Indicador e controlo da recirculação do ar. Fica desactivado com a
  climatização desligada, porque mexer nele obrigaria a reenviar o comando
  inteiro e ligaria o ar condicionado sem o utilizador o pedir.
- Média de consumo de sempre na secção da viagem, derivada da energia e da
  distância acumuladas. Vem rotulada como cálculo do card, não como leitura do
  carro.

### Corrigido

- **Cada comando de climatização repunha a ventoinha no nível 3.** O card
  enviava só o modo e a temperatura, e a integração aplicava os seus valores
  por defeito a tudo o resto. Os comandos passam a levar sempre temperatura,
  ventoinha e recirculação juntas.
- Mudar a temperatura desfazia uma alteração de recirculação feita antes, e
  vice-versa.
- Um pedido por confirmar deixava de ser mostrado ao fechar e reabrir o painel,
  e o comando seguinte era composto a partir da leitura antiga.
- Um pedido cuja chamada falhasse ficava a ser mostrado indefinidamente, e o
  toque seguinte partia do valor errado.
- A temperatura era mostrada com uma casa decimal num sítio e nenhuma noutro,
  e um toque no «+» podia saltar 1,5 grau.
- O nível de um banco podia aparecer diferente na secção de conforto e no
  painel de climatização ao mesmo tempo.

### Alterado

- As decisões que comandam o veículo — compor o comando de climatização,
  bloquear ações com o carro em andamento, exigir confirmação — passaram a
  funções puras com testes. Duas delas deixaram de poder ser removidas sem
  quebrar a compilação.
- As fixtures de teste e os documentos de desenho deixaram de conter dados do
  veículo real e do seu proprietário.

## [0.2.1] — 2026-08-27

Primeira versão instalada. Estado do veículo, ações, carregamento, pneus,
viagem, conforto, agendamento, mapa opcional e controlo da cortina do tejadilho.
