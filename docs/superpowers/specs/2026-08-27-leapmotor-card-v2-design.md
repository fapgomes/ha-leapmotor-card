# Leapmotor Card v2 — design

Data: 2026-08-27
Estado: aprovado
Antecessor: `2026-08-27-leapmotor-card-design.md` (v1, implementado e verificado no HA do utilizador)

## 1. Objetivo

Cinco acrescentos pedidos pelo utilizador depois de ver o card v1 a funcionar:
mapa da posição, painel de clima expansível, tile de aberturas expansível,
buzina, e a cortina do teto num só botão.

## 2. Factos verificados no sistema real

Levantados por SSH e por leitura do código da integração `leapmotor` 0.6.35.
Não repetir estas verificações sem motivo; e não as contradizer sem voltar a
ler o sistema.

### 2.1 Posição

`device_tracker.leapmotor_b10_000000_demo_location` traz a posição do carro. Os
valores abaixo são os das fixtures — sintéticos, de um monumento público — mas a
forma (seis casas decimais, `source_type`, `gps_accuracy`) é a real:

| Atributo | Valor |
|---|---|
| `latitude` / `longitude` | 38.691584 / -9.215939 |
| `source_type` | `gps` |
| `gps_accuracy` | 0 |
| `location_age_seconds` | 2017 (~34 min no momento da leitura) |
| `location_is_stale` | **true** |
| `location_source` | **`cloud_stale`** |
| `in_zones` | `['zone.home']` |
| `privacy_gps` / `privacy_data` | 1 / 1 |

O mesmo problema das trancas na v1: a posição é utilizável mas **não é atual**.
A secção tem de mostrar a idade, pela mesma razão pela qual a pill das trancas
aparece esbatida.

### 2.2 Buzina

**Não existe uma ação de buzina separada — o `find_car` é a buzina.** A
`services.yaml` da integração descreve-o como *"Trigger the horn/find-vehicle
action"* e o `button.py` dá-lhe `icon="mdi:bullhorn"`. A entidade
`button.…_find_vehicle` já existe e o card já a suporta como `findVehicle`; só
não está entre as quatro ações por defeito, e a etiqueta «Localizar» esconde o
que faz.

### 2.3 Temperatura

`leapmotor.set_climate` aceita:

| Campo | Tipo |
|---|---|
| `mode` | **obrigatório**, um de `cold`, `hot`, `wind`, `nohotcold` |
| `temperature` | 18–32, defeito 26 |
| `fan_speed` | 1–7, defeito 3 |
| `recirculate` | booleano, defeito falso |
| `windshield_defrost` | booleano, defeito falso |

O PIN do veículo (`operation_password`) **está configurado** — 4 caracteres — e
não há erros de PIN no log, pelo que os serviços parametrizados funcionam.

Consequência de design: **não é um setpoint, é um comando que liga a
climatização.** Cada envio arranca o AC com aqueles parâmetros. A temperatura
alvo atual vem de um *sensor* (`climate_set_temp_left_c`), não de um controlo,
pelo que o valor mostrado após premir é otimista até o carro confirmar.

### 2.4 Cortina do teto

- `binary_sensor/skylight_open` vem do **sinal 1724** e é o **teto panorâmico**.
- A cortina é um campo diferente: `sunshade_position`, calculado em `api.py`
  como `_safe_int(status_data.get("sunShade"))`, numa escala **0–10**.
- **`sunshade_position` NÃO é exposto como entidade.** O card só vê entidades,
  logo não tem como ler a posição da cortina.
- `leapmotor.sunshade_open` e `leapmotor.sunshade_close` aceitam um campo
  `value` de **0 a 10**, ou seja uma **posição alvo**.
- **Não existe serviço de stop**, nem para a cortina nem para os vidros. Parar a
  meio do movimento não é possível através desta integração.

### 2.5 Como os serviços `leapmotor.*` recebem o veículo

Diferença importante face a tudo o que o card chama na v1. Os serviços de
domínio `leapmotor` recebem o veículo como **campo** (`vin` ou `entity_id`) e
não como *target* de serviço:

```yaml
# v1: entity_id é target
service: button.press
target: { entity_id: button.…_find_vehicle }

# v2: entity_id é campo
service: leapmotor.set_climate
data: { mode: cold, temperature: 24, entity_id: sensor.…_battery }
```

O `doCall` da v1 passa sempre `entity_id` como target. A v2 tem de suportar as
duas formas.

## 3. Decisões

| Decisão | Escolha | Porquê |
|---|---|---|
| Mapa | Embutir o card `map` do Home Assistant, via `loadCardHelpers()` | Mapa real sem dependências novas; o HA trata dos tiles e do tema. Custo assumido: apoia-se num global semi-público. Fallback para tile sem mapa se falhar. |
| Desenhar o mapa nós, com Leaflet | **Rejeitado** | Duplica o que o HA já tem e traz dependências que a spec proíbe. |
| Painel de clima | Expansível ao tocar no tile da temperatura interior | Espelha o ecrã da app sem sair do card. |
| Stepper de temperatura | Agrupa os cliques e envia **um** comando após pausa | Sem isso cada toque é uma chamada à cloud. |
| `mode` do `set_climate` | Derivado: modo atual se conhecido, senão `cold` se o interior está acima do alvo e `hot` se abaixo | O campo é obrigatório e o utilizador não o deve ter de escolher. |
| Buzina | Reetiquetar `findVehicle` para «Buzinar» / «Honk» com `mdi:bullhorn` | É o que a ação faz observavelmente, e o que o utilizador lhe chama. |
| Cortina | **Um** botão que abre um controlo de posição 0–10 | A posição não é legível, logo um alternante mentiria. O controlo usa a capacidade real do serviço e dá mais do que a app: uma posição intermédia é o «parar a meio» na prática. |
| Cortina alternante com memória local | **Rejeitado** | Mentiria sempre que a cortina fosse mexida pela app ou pelo carro, e esqueceria ao recarregar. Um botão que diz «fechar» e abre é pior que dois botões honestos. |
| Stop a meio do movimento | **Fora de âmbito, por impossibilidade** | A integração não tem serviço de stop. |

## 4. Âmbito

### 4.1 `location` é uma secção, com tudo o que isso implica

O mapa é **activável e desactivável na configuração**, e off por defeito. Ser
uma secção — e não uma opção solta — dá-lhe as três coisas de uma vez:

- `sections: { location: true }` no YAML;
- um interruptor próprio na lista de secções do **editor visual**, que é gerada
  a partir de `SectionId`;
- nada renderizado até ser ligado, tal como `tires`, `trip`, `comfort` e
  `schedule`.

Implica tocar em quatro sítios, e esquecer um deixa a secção meio-ligada:
`SectionId` e `DEFAULT_SECTIONS` em `src/types.ts`, `SECTION_IDS` no editor, e
`SECTION_KEYS` no aviso de entidades em falta do elemento principal. O
interruptor no editor vem de graça a partir do primeiro.

Secções novas, ambas opcionais e off por defeito:

- **`location`** — mapa embutido, zona, e idade da posição. Nunca apresenta uma
  posição obsoleta como atual.
- **`climatePanel`** — não é uma secção própria: é a expansão do tile da
  temperatura interior, com stepper, A/C, arrefecer/aquecer rápido e desembaciar.

  **Desvio registado a 2026-08-27, depois da revisão final.** Esta secção dizia
  originalmente que o painel incluiria também as linhas de assentos, volante e
  espelhos que vivem em `comfort`. O plano não as levou e o código não as tem. A
  revisão final apanhou a divergência, que nenhuma revisão por task podia ver —
  o código correspondia ao plano, e era o plano que divergia da spec. Mantém-se
  o comportamento implementado, por duas razões: mover essas linhas duplicá-las-ia
  ou esvaziaria a secção `comfort`, e `comfort` é activável em paralelo com o
  painel. A spec passa a descrever o que o código faz.

Alterações a secções existentes:

- **tile de aberturas** — passa a expandir e a listar quais portas, vidros, mala
  e teto estão abertos, em vez de só a contagem.
- **`actions.ts`** — `findVehicle` reetiquetado; `sunshade` passa a uma ação
  única com posição; `ServiceCall` ganha suporte a `entity_id` como campo.

## 5. Fora de âmbito

Expor `sunshade_position` como entidade — é trabalho na integração, não no card.
Vale um issue em `kerniger/leapmotor-ha`, já que o valor é calculado e
descartado. Com essa entidade, um botão alternante honesto passa a ser trivial.
