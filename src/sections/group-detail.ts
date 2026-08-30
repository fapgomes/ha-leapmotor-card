import { LitElement, css, html, nothing } from 'lit'
import { customElement, property, query } from 'lit/decorators.js'
import type { TranslateFn } from '../localize'
import { decideSwipe } from '../swipe'
import { sharedStyles } from '../theme'

@customElement('leapmotor-group-detail')
export class LeapmotorGroupDetail extends LitElement {
  @property({ attribute: false }) t!: TranslateFn
  @property({ type: String }) heading = ''
  /** Falso quando só há um grupo: navegar para si mesmo não é navegação. */
  @property({ type: Boolean }) navigable = false
  /** A maior altura já medida, imposta pelo card. Ver spec §4.3. */
  @property({ type: Number }) reservedHeight = 0
  /** O «Atualizado às…», já formatado pelo card. */
  @property({ type: String }) updatedLabel = ''

  @query('.wrap') private wrapEl?: HTMLElement
  @query('.content') private contentEl?: HTMLElement

  private observer?: ResizeObserver
  private pointerId?: number
  private startX = 0
  private startY = 0

  override firstUpdated() {
    // O foco vai para a moldura, e não para o primeiro botão: sem isto, as
    // setas do teclado e o Esc só funcionavam depois de alguém dar Tab.
    this.wrapEl?.focus()

    // Mede o CONTEÚDO, não o corpo. O corpo leva o `min-height` que o card
    // impõe: medi-lo era medir o próprio mínimo e o máximo nunca passava de
    // onde já estava.
    if (typeof ResizeObserver === 'undefined' || !this.contentEl) return
    this.observer = new ResizeObserver(entries => {
      const height = entries[0]?.contentRect.height
      if (height === undefined || height <= 0) return
      // Quem guarda o máximo é o card: sobrevive à troca de sub-vista, e este
      // elemento é destruído em cada troca.
      this.dispatchEvent(new CustomEvent('leapmotor-measured', {
        detail: { height }, bubbles: true, composed: true,
      }))
    })
    this.observer.observe(this.contentEl)
  }

  override disconnectedCallback() {
    super.disconnectedCallback()
    this.observer?.disconnect()
    this.observer = undefined
  }

  private emit(name: string, detail?: unknown) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
  }

  private nav(delta: -1 | 1) { this.emit('leapmotor-nav', { delta }) }
  private close() { this.emit('leapmotor-close') }

  private onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.stopPropagation(); this.close(); return }
    if (!this.navigable) return
    if (e.key === 'ArrowLeft') { e.preventDefault(); this.nav(-1) }
    else if (e.key === 'ArrowRight') { e.preventDefault(); this.nav(1) }
  }

  private onPointerDown(e: PointerEvent) {
    // Só toque e caneta: com o rato, arrastar sobre o card é seleção de texto,
    // não um gesto.
    if (e.pointerType === 'mouse') return
    this.pointerId = e.pointerId
    this.startX = e.clientX
    this.startY = e.clientY
  }

  private onPointerEnd(e: PointerEvent) {
    if (this.pointerId !== e.pointerId) return
    this.pointerId = undefined
    if (e.type === 'pointercancel' || !this.navigable) return
    const decision = decideSwipe(e.clientX - this.startX, e.clientY - this.startY)
    if (decision === 'prev') this.nav(-1)
    else if (decision === 'next') this.nav(1)
  }

  override render() {
    const style = this.reservedHeight > 0 ? `min-height:${Math.round(this.reservedHeight)}px` : ''
    return html`<div
      class="wrap"
      role="group"
      aria-label=${this.heading}
      tabindex="-1"
      @keydown=${this.onKeyDown}
      @pointerdown=${this.onPointerDown}
      @pointerup=${this.onPointerEnd}
      @pointercancel=${this.onPointerEnd}
    >
      <div class="bar">
        <button class="nav plain" aria-label=${this.t('detail.close')} @click=${this.close}>
          <ha-icon icon="mdi:close"></ha-icon>
        </button>
        <div class="heading">${this.heading}</div>
        ${this.navigable
          ? html`
            <button class="nav plain" aria-label=${this.t('detail.previous')} @click=${() => this.nav(-1)}>
              <ha-icon icon="mdi:chevron-left"></ha-icon>
            </button>
            <button class="nav plain" aria-label=${this.t('detail.next')} @click=${() => this.nav(1)}>
              <ha-icon icon="mdi:chevron-right"></ha-icon>
            </button>`
          : nothing}
      </div>

      <div class="body" style=${style}>
        <div class="content"><slot></slot></div>
      </div>

      ${this.updatedLabel
        ? html`<div class="updated muted">${this.updatedLabel}</div>`
        : nothing}
    </div>`
  }

  static override styles = [sharedStyles, css`
    /*
     * pan-y entrega o arrasto vertical ao browser e deixa-nos só o
     * horizontal: é metade da convivência com o scroll do dashboard. A outra
     * metade é o decideSwipe.
     */
    .wrap { touch-action: pan-y; outline: none; }
    .wrap:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; border-radius: var(--lm-radius); }
    .bar {
      display: flex; align-items: center; gap: 4px;
      margin-top: var(--lm-gap);
    }
    .heading { flex: 1 1 auto; min-width: 0; font-size: 1.05rem; font-weight: 600; }
    /*
     * Seletor composto: o button.plain do theme.ts faz all: unset a
     * (0,1,1) e apagaria as dimensões, o raio e o box-sizing destes botões.
     */
    button.nav.plain {
      box-sizing: border-box; display: grid; place-items: center; flex: 0 0 auto;
      width: 34px; height: 34px; border-radius: 50%;
      background: var(--lm-chip); color: var(--lm-text);
    }
    button.nav.plain ha-icon { --mdc-icon-size: 20px; }
    .body { display: flex; flex-direction: column; }
    .content { flex: 1 1 auto; }
    .updated { margin-top: 10px; font-size: 0.72rem; text-align: center; }
    @media (prefers-reduced-motion: no-preference) {
      .content { animation: enter 160ms ease-out; }
      @keyframes enter { from { opacity: 0; transform: translateY(4px); } }
    }
  `]
}

declare global {
  interface HTMLElementTagNameMap { 'leapmotor-group-detail': LeapmotorGroupDetail }
}
