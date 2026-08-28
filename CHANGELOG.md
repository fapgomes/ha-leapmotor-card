# Changelog

Todas as alterações relevantes deste projeto ficam registadas aqui.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e o projeto usa [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [0.3.0] — 2026-08-28

### Adicionado

- Painel de climatização com a vista de topo do carro e os controlos de
  conforto sobrepostos: espelhos, volante, e aquecimento e ventilação de cada
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
