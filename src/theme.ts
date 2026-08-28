import { css, type CSSResult } from 'lit'

export function batteryColor(percent: number | undefined): string {
  if (percent === undefined) return 'var(--leapmotor-battery-unknown, var(--disabled-text-color, #9e9e9e))'
  if (percent >= 50) return 'var(--leapmotor-battery-high, #2fbf5c)'
  if (percent >= 20) return 'var(--leapmotor-battery-mid, #f5a623)'
  return 'var(--leapmotor-battery-low, #e5484d)'
}

export const sharedStyles: CSSResult = css`
  :host {
    --lm-gap: 16px;
    --lm-radius: 18px;
    --lm-text: var(--primary-text-color);
    --lm-muted: var(--secondary-text-color);
    --lm-surface: var(--leapmotor-surface, var(--card-background-color));
    --lm-chip: var(--leapmotor-chip, rgba(127, 127, 127, 0.12));
    color: var(--lm-text);
    font-family: var(--paper-font-body1_-_font-family, inherit);
  }
  .muted { color: var(--lm-muted); }
  .chip {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 10px; border-radius: 999px;
    background: var(--lm-chip); font-size: 0.8rem; white-space: nowrap;
  }
  .panel {
    background: var(--lm-chip); border-radius: var(--lm-radius);
    padding: var(--lm-gap); margin-top: var(--lm-gap);
  }
  .row { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--lm-gap); }
  /*
   * ATENÇÃO: o all: unset reinicia TODAS as propriedades, não só o aspeto
   * de botão — fundo, padding, cantos, dimensões, position e box-sizing
   * incluídos. Esta regra está a (0,1,1), logo qualquer regra de uma só
   * classe perde para ela. Um elemento com class="plain x" precisa de um
   * seletor composto button.plain.x que REPONHA tudo o que a caixa dele
   * exige. Isto já produziu seis defeitos neste projeto, dois deles visíveis
   * no dashboard de um utilizador.
   */
  button.plain {
    all: unset; cursor: pointer; display: flex;
    align-items: center; gap: 8px; -webkit-tap-highlight-color: transparent;
  }
  button.plain[disabled] { cursor: not-allowed; opacity: 0.4; }
  /*
   * O all: unset acima também apaga o contorno de foco, e o browser não o
   * repõe sozinho: qualquer botão do card ficava sem qualquer marca visível
   * ao ser alcançado pelo teclado. Isso doía sobretudo na pastilha de um
   * banco, cujas duas metades são contíguas e sem separador — sem anel de
   * foco não havia como saber qual delas ia disparar.
   *
   * Vive aqui, e não numa secção, porque o all: unset também vive aqui: a
   * regra tem de cobrir todos os class="plain …" do card, não só os de um
   * painel. Está a (0,2,1), portanto acima do button.plain (0,1,1) que a
   * apagou. Uma secção que precise do anel POR DENTRO da sua caixa — é o caso
   * das metades da pastilha, que vivem dentro de um contentor com
   * overflow: hidden — só tem de declarar o outline-offset no seu seletor
   * composto, que a (0,3,1) ganha a esta.
   */
  button.plain:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }
`
