import { LitElement, html, css } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { allBodyDots, PARTS, BODY_AREAS } from './src/body_data';
import { t, setLanguage, getLanguage, Language } from './src/i18n';
import './body_pixel_detail';
import './pdf_preview';

@customElement('body-pixel-panel')
export class BodyPixelPanel extends LitElement {
  @state() private step: 'body' | 'detailed' = 'body';
  @state() private view: 'front' | 'back' = 'front';
  @state() private selectedAreas: string[] = [];
  @property({ type: String }) lang: Language = 'vi';

  // Detailed step state
  @state() private activePart: string = 'head';
  @state() private selectedSections: string[] = [];
  
  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('language-changed', this._handleLangChange);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('language-changed', this._handleLangChange);
  }

  private _handleLangChange = (e: Event) => {
    this.lang = (e as CustomEvent).detail;
    this.requestUpdate();
  }

  // Question wizard state
  @state() private wizardStep: 'body' | 'detailed' | 'q1' | 'q2' | 'q3' | 'result' = 'body';
  @state() private showPreview = false;
  @state() private answers: { painType: string, duration: string, severity: string } = { painType: '', duration: '', severity: '' };
  @state() private result: any = null;

  private toggleLang() {
    this.lang = this.lang === 'vi' ? 'en' : 'vi';
    setLanguage(this.lang);
  }

  static styles = css`
    :host {
      display: block;
      min-height: 100%;
      background: #f5f3ee;
      color: #282725;
      font-family: system-ui, -apple-system, sans-serif;
      padding-bottom: 26px;
    }

    .stage {
      position: relative;
      width: calc(100% - 48px);
      margin: 10px auto 0;
      border-radius: 18px;
      background: #282724;
      padding: 50px 24px 12px;
      min-height: 820px;
      text-align: center;
    }
    .stage.detailed {
      background: #c75d3b;
    }

    .title {
      color: #fff;
      margin: 0 0 10px;
      font-size: 30px;
      font-weight: 850;
      letter-spacing: -0.02em;
    }

    .subtitle {
      color: #fff6ef;
      margin: 0;
      font-size: 20px;
    }

    .card {
      width: min(1260px, calc(100% - 120px));
      margin: 18px auto 0;
      display: grid;
      grid-template-columns: 45% 55%;
      border-radius: 22px;
      overflow: hidden;
      background: #fff;
      text-align: left;
    }
    
    @media (max-width: 900px) {
      .card {
        grid-template-columns: 1fr;
      }
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

    .dotMapBody {
      position: relative;
      height: 520px;
      margin-top: 20px;
      background-image: radial-gradient(rgba(255,255,255,.08) 1px, transparent 1px);
      background-size: 32px 32px;
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

    .infoPane {
      min-height: 690px;
      padding: 50px 52px;
      position: relative;
      background: #fffdfa;
    }

    .meta {
      display: grid;
      grid-template-columns: 120px 1fr;
      gap: 7px 18px;
      font-family: monospace;
      color: #948e85;
      letter-spacing: .08em;
    }

    .rule {
      border: 0;
      border-top: 1px solid #e4dfd6;
      margin: 28px 0;
    }

    .question {
      font-size: 30px;
      margin: 0;
      letter-spacing: -0.04em;
    }

    .helper {
      color: #69645e;
      font-size: 17px;
      line-height: 1.5;
    }

    .continueButton {
      position: absolute;
      left: 52px;
      right: 52px;
      bottom: 46px;
      border: 0;
      border-radius: 12px;
      background: #c85d3a;
      color: #fff;
      padding: 18px;
      font-size: 17px;
      font-weight: 800;
      cursor: pointer;
    }
    
    .continueButton:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .tabs {
      display: flex;
      gap: 20px;
      margin-bottom: 20px;
    }
    .tab {
      border: 0;
      background: transparent;
      color: #8c857b;
      letter-spacing: .12em;
      font-family: monospace;
      cursor: pointer;
      padding-bottom: 4px;
    }
    .tabActive {
      border: 0;
      border-bottom: 1px solid #c85d3a;
      background: transparent;
      color: #c85d3a;
      letter-spacing: .12em;
      font-family: monospace;
      cursor: pointer;
      padding-bottom: 4px;
    }

    .backStepBtn {
      position: absolute;
      top: 16px;
      left: 16px;
      background: transparent;
      border: none;
      color: #fff;
      cursor: pointer;
      font-family: monospace;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .backStepBtn:hover {
      color: #c85d3a;
    }
  `;

  // --- Step 1: Body Map Logic ---
  private handleBodyDotClick(areaId: string) {
    if (this.selectedAreas.includes(areaId)) {
      this.selectedAreas = this.selectedAreas.filter(id => id !== areaId);
    } else {
      this.selectedAreas = [...this.selectedAreas, areaId];
    }
  }

  // --- Step 2: Detailed Organ Logic ---
  private handlePartChange(e: CustomEvent) {
    this.activePart = e.detail;
    this.selectedSections = [];
  }

  private toggleSection(section: string) {
    if (this.selectedSections.includes(section)) {
      this.selectedSections = this.selectedSections.filter(s => s !== section);
    } else {
      this.selectedSections = [...this.selectedSections, section];
    }
  }

  private renderBodyStep() {
    const allDots = allBodyDots();
    const selectedCount = this.selectedAreas.length;
    const chips = this.selectedAreas.map(id => ({ id, label: BODY_AREAS.find(area => area.id === id)?.label || id }));

    return html`
      <div class="stage">
        <h1 class="title">Tell us where it hurts.</h1>
        <p class="subtitle">Tap on the body below, and we'll help you understand what's going on.</p>

        <div class="card">
          <div class="pixelPane">
            <div class="tabs">
              <button class="${this.view === 'front' ? 'tabActive' : 'tab'}" @click=${() => this.view = 'front'}>FRONT</button>
              <button class="${this.view === 'back' ? 'tabActive' : 'tab'}" @click=${() => this.view = 'back'}>BACK</button>
            </div>
            
            <div class="dotMapBody" aria-label="Interactive pain body map">
              ${allDots.map(dot => {
                const isSelected = this.selectedAreas.includes(dot.areaId);
                return html`
                  <button 
                    class="dot"
                    title=${dot.areaLabel}
                    @click=${() => this.handleBodyDotClick(dot.areaId)}
                    style="left: ${dot.x * 4}%; top: ${dot.y * 3.6}%; background: ${isSelected ? '#cc5d38' : '#747166'}"
                  ></button>
                `;
              })}
            </div>

            <div class="chipsTitle">BODY MAP · SELECT AFFECTED AREAS</div>
            <div class="chips">
              ${chips.length === 0 
                ? html`<span class="emptyHint">${t('selectArea')}</span>`
                : chips.map(chip => html`
                  <button type="button" class="chip" @click=${() => this.handleBodyDotClick(chip.id)}>
                    ${chip.label} <span class="chipX">×</span>
                  </button>
                `)
              }
            </div>
          </div>

          <div class="infoPane">
            <div class="meta">
              <span>STAGE</span><b>&gt; BODY SELECTION</b>
              <span>SELECTED</span><b>&gt; ${selectedCount} ${selectedCount === 1 ? 'AREA' : 'AREAS'}</b>
            </div>
            <hr class="rule" />
            <h2 class="question">Where does it hurt?</h2>
            <p class="helper">Choose how you'd like to select, then tap on the body to the left.</p>
            
            <button class="continueButton" ?disabled=${selectedCount === 0} @click=${() => {
              if (selectedCount > 0) {
                // Auto-select the last selected area's part if it matches
                const lastId = this.selectedAreas[this.selectedAreas.length - 1];
                if (PARTS.find(p => p.id === lastId)) {
                  this.activePart = lastId;
                } else if (lastId === 'neck') {
                  this.activePart = 'head';
                } else if (lastId === 'leftArm') {
                  this.activePart = 'leftHand';
                } else if (lastId === 'rightArm') {
                  this.activePart = 'rightHand';
                }
                this.wizardStep = 'detailed';
              }
            }}>
              ${selectedCount === 0 ? t('selectArea') : t('continueDetail')}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private renderDetailedStep() {
    const part = PARTS.find(p => p.id === this.activePart) || PARTS[0];
    const selectedCount = this.selectedSections.length;

    return html`
      <div class="stage detailed">
        <button class="backStepBtn" @click=${() => this.wizardStep = 'body'}>
          ${t('back')}
        </button>

        <h1 class="title">Detailed Body Pixel Check</h1>
        <p class="subtitle">Zoom into specific organs and sections to locate your pain</p>

        <div class="card">
          <body-pixel-detail
            .activePart=${this.activePart}
            .selectedSections=${this.selectedSections}
            .lang=${this.lang}
            @part-changed=${this.handlePartChange}
            @section-toggled=${(e: CustomEvent) => this.toggleSection(e.detail)}
          ></body-pixel-detail>

          <div class="infoPane">
            <div class="meta">
              <span>PART</span><b>&gt; ${part.label.toUpperCase()}</b>
              <span>SELECTED</span><b>&gt; ${selectedCount} ${selectedCount === 1 ? 'SECTION' : 'SECTIONS'}</b>
            </div>
            <hr class="rule" />
            <h2 class="question">Show me exactly where</h2>
            <p class="helper">Pick a body part from the dropdown, then tap the section that's bothering you. Tap an orange section again to remove it.</p>
            
            <button class="continueButton" ?disabled=${selectedCount === 0} @click=${() => {
              this.wizardStep = 'q1';
            }}>
              ${selectedCount === 0 ? t('selectSection') : t('continue')}
            </button>
            <button class="continueButton" style="bottom: -50px; background: #60a5fa;" @click=${() => this.dispatchEvent(new CustomEvent('navigate-to-body-care', { bubbles: true, composed: true }))}>Game Mô Phỏng Bảo Vệ Nội Tạng Này</button>
          </div>
        </div>
      </div>
    `;
  }

  private renderQuestionStep(questionNum: number, question: string, options: string[], onSelect: (val: string) => void, nextStep: 'q2' | 'q3' | 'result', selected: string) {
    return html`
      <div class="stage detailed">
        <button class="backStepBtn" @click=${() => this.wizardStep = questionNum === 1 ? 'detailed' : questionNum === 2 ? 'q1' : 'q2'}>
          ${t('back')}
        </button>

        <h1 class="title">${t('analysisTitle')}</h1>
        <p class="subtitle">${t('analysisSubtitle')}</p>

        <div class="card">
          <div class="pixelPane" style="display: flex; align-items: center; justify-content: center; color: #8d887f;">
            Visual placeholder
          </div>

          <div class="infoPane">
            <div class="meta">
              <span>STAGE</span><b>&gt; QUESTION ${questionNum} OF 3</b>
            </div>
            <hr class="rule" />
            <h2 class="question">${question}</h2>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 20px;">
              ${options.map(option => html`
                <button 
                  class="chip" 
                  style="text-align: left; padding: 20px; background: ${selected === option ? '#c85d3a' : '#fff'}; color: ${selected === option ? '#fff' : '#282725'}; border: 1px solid #e4dfd6;" 
                  @click=${() => onSelect(option)}
                >
                  ${option}
                </button>
              `)}
            </div>

            <button class="continueButton" ?disabled=${!selected} @click=${() => this.wizardStep = nextStep}>
              ${t('continue')}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private handleDownloadPDF() {
    this.showPreview = true;
  }

  private renderResultStep() {
    const part = PARTS.find(p => p.id === this.activePart) || PARTS[0];

    return html`
      <div class="stage detailed">
        <button class="backStepBtn" @click=${() => this.wizardStep = 'q3'}>
          ${t('back')}
        </button>

        <h1 class="title">${t('analysisTitle')}</h1>
        <p class="subtitle">${t('analysisSubtitle')}</p>

        <div class="card">
          <div class="pixelPane" style="display: flex; align-items: center; justify-content: center; color: #8d887f;">
            Visual placeholder
          </div>

          <div class="infoPane">
            <h2 class="question">${t('summary')}</h2>
            <p class="helper">${t('pain')}: ${this.answers.painType}</p>
            <p class="helper">${t('duration')}: ${this.answers.duration}</p>
            <p class="helper">${t('severity')}: ${this.answers.severity}</p>
            
            <hr class="rule" />

            <h2 class="question">${t('specialists')}</h2>
            <p class="helper">1. ${t('orthopedist')} - 50%</p>
            <p class="helper">2. ${t('generalPractitioner')} - 25%</p>

            <div style="display: flex; gap: 10px; margin-top: 20px;">
              <button class="continueButton" style="position: static; flex: 1;" @click=${this.handleDownloadPDF}>
                Download PDF
              </button>
              <button class="continueButton" style="position: static; flex: 1; background: #fff; color: #c85d3a; border: 1px solid #c85d3a;" @click=${() => {
                this.wizardStep = 'body';
                this.answers = { painType: '', duration: '', severity: '' };
                this.selectedAreas = [];
                this.selectedSections = [];
              }}>
                ${t('startOver')}
              </button>
            </div>
          </div>
        </div>
      </div>

      ${this.showPreview ? html`
        <pdf-preview
          .data=${{ part, selectedSections: this.selectedSections, answers: this.answers }}
          @close=${() => this.showPreview = false}
        ></pdf-preview>
      ` : ''}
    `;
  }

  render() {
    switch (this.wizardStep) {
      case 'body': return this.renderBodyStep();
      case 'detailed': return this.renderDetailedStep();
      case 'q1': return this.renderQuestionStep(1, t('question1'), t('options1'), (val) => this.answers = {...this.answers, painType: val}, 'q2', this.answers.painType);
      case 'q2': return this.renderQuestionStep(2, t('question2'), t('options2'), (val) => this.answers = {...this.answers, duration: val}, 'q3', this.answers.duration);
      case 'q3': return this.renderQuestionStep(3, t('question3'), t('options3'), (val) => this.answers = {...this.answers, severity: val}, 'result', this.answers.severity);
      case 'result': return this.renderResultStep();
      default: return this.renderBodyStep();
    }
  }
}
