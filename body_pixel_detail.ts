import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { PARTS, buildOrganDots } from './src/body_data';
import { t, Language } from './src/i18n';

@customElement('body-pixel-detail')
export class BodyPixelDetail extends LitElement {
  @property({ type: String }) activePart: string = 'head';
  @property({ type: Array }) selectedSections: string[] = [];
  @property({ type: String }) lang: Language = 'vi';

  static styles = css`
    :host {
      display: block;
    }
    
    .pixelPane {
      min-height: 690px;
      background: #272622;
      padding: 30px 30px 26px;
      color: #c4bcb0;
      position: relative;
    }

    .kicker {
      display: block;
      color: #8d887f;
      font-family: monospace;
      letter-spacing: .18em;
      font-size: 12px;
      margin-bottom: 10px;
    }

    .select {
      width: 100%;
      border: 1px solid rgba(255,255,255,.13);
      border-radius: 12px;
      padding: 13px 18px;
      font-size: 17px;
      color: #f5f0e8;
      background: #2b2925;
      outline: none;
    }

    .dotMap {
      position: relative;
      height: 520px;
      margin-top: 18px;
    }

    .dot {
      position: absolute;
      width: 9px;
      height: 9px;
      border-radius: 99px;
      border: 0;
      transform: translate(-50%, -50%);
      cursor: pointer;
      transition: background 0.15s;
    }

    .chipsTitle {
      font-family: monospace;
      letter-spacing: .16em;
      color: #9c968d;
      font-size: 12px;
      margin-bottom: 12px;
      margin-top: 16px;
    }

    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 9px;
      min-height: 36px;
    }

    .chip {
      border: 0;
      border-radius: 18px;
      background: #56524b;
      color: #f0ece5;
      padding: 8px 12px;
      font-size: 14px;
      cursor: pointer;
    }

    .chipX {
      color: #d86b45;
      font-weight: 900;
      margin-left: 4px;
    }

    .emptyHint {
      color: #837d73;
      font-size: 14px;
      font-style: italic;
    }
  `;

  private handlePartChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    this.dispatchEvent(new CustomEvent('part-changed', {
      detail: select.value,
      bubbles: true,
      composed: true
    }));
  }

  private toggleSection(section: string) {
    this.dispatchEvent(new CustomEvent('section-toggled', {
      detail: section,
      bubbles: true,
      composed: true
    }));
  }

  render() {
    const part = PARTS.find(p => p.id === this.activePart) || PARTS[0];
    const dots = buildOrganDots(this.activePart);

    return html`
      <div class="pixelPane">
        <span class="kicker">BODY PART</span>
        <select class="select" @change=${this.handlePartChange}>
          ${PARTS.map(item => html`
            <option value=${item.id} ?selected=${item.id === this.activePart}>${item.label}</option>
          `)}
        </select>

        <div class="dotMap" aria-label="Interactive internal pixel pain map">
          ${dots.map(dot => {
            const isSelected = this.selectedSections.includes(dot.section);
            return html`
              <button
                type="button"
                class="dot"
                title=${dot.section}
                aria-label="${isSelected ? 'Deselect' : 'Select'} ${dot.section}"
                @click=${() => this.toggleSection(dot.section)}
                style="left: ${dot.x * 2.38}%; top: ${dot.y * 2.45}%; background: ${isSelected ? '#cc623d' : '#77736a'}"
              ></button>
            `;
          })}
        </div>

        <div class="chipsTitle">${part.label.toUpperCase()} · TAP A SECTION</div>
        <div class="chips">
          ${this.selectedSections.length === 0 
            ? html`<span class="emptyHint">${t('selectSection')}</span>`
            : this.selectedSections.map(section => html`
              <button type="button" class="chip" @click=${() => this.toggleSection(section)}>
                ${section} <span class="chipX">×</span>
              </button>
            `)
          }
        </div>
      </div>
    `;
  }
}
