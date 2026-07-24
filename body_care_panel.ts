import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// React chart component
const SummaryChart = ({ data }: { data: any[] }) => {
  return React.createElement(ResponsiveContainer, { width: '100%', height: 300 },
    React.createElement(LineChart, { data },
      React.createElement(CartesianGrid, { strokeDasharray: '3 3' }),
      React.createElement(XAxis, { dataKey: 'time' }),
      React.createElement(YAxis, { dataKey: 'healthScore' }),
      React.createElement(Tooltip, {}),
      React.createElement(Line, { type: 'monotone', dataKey: 'healthScore', stroke: '#60a5fa' })
    )
  );
};

@customElement('body-care-panel')
export class BodyCarePanel extends LitElement {
  @state() private simulationData: any[] = [];
  private reactRoot: any;

  static styles = css`
    :host { display: block; height: 100%; width: 100%; }
    .container { display: flex; flex-direction: column; height: 100%; }
    iframe { width: 100%; height: 70%; border: none; }
    .bottom-panel { display: flex; height: 30%; border-top: 1px solid #e5e7eb; }
    #chart-container { flex: 2; background: #f9fafb; padding: 10px; }
    #log-container { flex: 1; overflow-y: auto; padding: 10px; background: #f3f4f6; }
    .log-item { margin-bottom: 5px; border-bottom: 1px solid #e5e7eb; padding-bottom: 3px; font-size: 0.8rem; }
    @media (max-width: 600px) {
      .bottom-panel { flex-direction: column; height: 50%; }
      iframe { height: 50%; }
    }
  `;

  constructor() {
    super();
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'simulation-update') {
        const payload = { ...event.data.payload, timestamp: new Date().toLocaleTimeString() };
        this.simulationData = [...this.simulationData, payload];
      }
    });
  }

  protected firstUpdated() {
    const container = this.shadowRoot?.getElementById('chart-container');
    if (container) {
      this.reactRoot = createRoot(container);
    }
  }

  protected updated() {
    const container = this.shadowRoot?.getElementById('chart-container');
    if (container) {
      if (!this.reactRoot) {
        this.reactRoot = createRoot(container);
      }
      this.reactRoot.render(React.createElement(SummaryChart, { data: this.simulationData }));
    }
  }

  render() {
    return html`
      <div class="container">
        <iframe src="https://bao-ve-co-the.vercel.app/game-portal.html"></iframe>
        <div class="bottom-panel">
          <div id="chart-container"></div>
          <div id="log-container">
            <h3 style="margin-top: 0; font-size: 0.9rem; font-weight: 600;">History Log</h3>
            <ul style="list-style: none; padding: 0; margin: 0;">
              ${this.simulationData.slice().reverse().map(item => html`
                <li class="log-item">
                  <strong>${item.timestamp}</strong>: ${item.message || 'Event recorded'}
                </li>
              `)}
            </ul>
          </div>
        </div>
      </div>
    `;
  }
}
