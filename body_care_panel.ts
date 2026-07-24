import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('body-care-panel')
export class BodyCarePanel extends LitElement {
  static styles = css`
    :host { display: block; height: 100%; width: 100%; }
    iframe { width: 100%; height: 100%; border: none; }
  `;

  render() {
    return html`<iframe src="https://bao-ve-co-the.vercel.app/game-portal.html"></iframe>`;
  }
}
