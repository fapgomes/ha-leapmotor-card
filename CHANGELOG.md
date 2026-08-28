# Changelog

Todas as alterações relevantes deste projeto ficam registadas aqui.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e o projeto usa [Versionamento Semântico](https://semver.org/lang/pt-BR/).

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
