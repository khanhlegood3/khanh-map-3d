import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import QRCode from 'qrcode';
import * as d3 from 'd3';
import { 
  UserInfo, 
  ReferredUser 
} from './src/affiliate_types';
import { t } from './src/i18n';
import { 
  getLevelForReferrals, 
  getNextLevelMilestone, 
  LEVEL_MILESTONES,
  RECENT_MILESTONES, 
  getLocationForMilestone 
} from './src/affiliate_utils';
import { 
  seedDefaultData, 
  getUserInfo, 
  getReferredUsers, 
  addReferredUser, 
  resetDatabase, 
  updateUserInfo
} from './affiliate_db';
import { auth, googleProvider } from './firebase_init';
import { signInWithPopup, onAuthStateChanged } from 'firebase/auth';



/**
 * Gets the current level milestone based on total referred users.
 */
export function getLevelForReferrals(count: number): LevelMilestone {
  let currentMilestone = LEVEL_MILESTONES[0];
  for (const milestone of LEVEL_MILESTONES) {
    if (count >= milestone.minReferrals) {
      currentMilestone = milestone;
    }
  }
  return currentMilestone;
}

/**
 * Gets the next level milestone if any.
 */
export function getNextLevelMilestone(currentLevel: number): LevelMilestone | null {
  const next = LEVEL_MILESTONES.find(m => m.level === currentLevel + 1);
  return next || null;
}

export const RECENT_MILESTONES = [
  'Explored Tokyo Tower 🗼',
  'Visited Grand Canyon 🏜️',
  'Reached Paris Louvre 🎨',
  'Created 3 Custom Routes 🗺️',
  'Unlocked Level 2 ✈️',
  'Discovered Venice Canals 🛶',
  'Traveled 2500 km 🛩️',
  'Explored Machu Picchu ⛰️',
  'Viewed Golden Gate Bridge 🌁',
  'Discovered Great Wall 🧱',
  'Explored Diamond Head 🌋',
  'Visited Stonehenge 🗿',
];

export interface LocationDetails {
  locationName: string;
  latitude: number;
  longitude: number;
}

export function getLocationForMilestone(milestone: string): LocationDetails {
  const mapping: { [key: string]: LocationDetails } = {
    'Explored Tokyo Tower 🗼': { locationName: 'Tokyo Tower, Tokyo, Japan', latitude: 35.6586, longitude: 139.7454 },
    'Visited Grand Canyon 🏜️': { locationName: 'Grand Canyon, Arizona', latitude: 36.0544, longitude: -112.1401 },
    'Reached Paris Louvre 🎨': { locationName: 'Paris Louvre, Paris, France', latitude: 48.8606, longitude: 2.3376 },
    'Created 3 Custom Routes 🗺️': { locationName: 'Amsterdam, Netherlands', latitude: 52.3676, longitude: 4.9041 },
    'Unlocked Level 2 ✈️': { locationName: 'London, UK', latitude: 51.5074, longitude: -0.1278 },
    'Discovered Venice Canals 🛶': { locationName: 'Venice, Italy', latitude: 45.4408, longitude: 12.3155 },
    'Traveled 2500 km 🛩️': { locationName: 'Reykjavik, Iceland', latitude: 64.1466, longitude: -21.9426 },
    'Explored Machu Picchu ⛰️': { locationName: 'Machu Picchu, Peru', latitude: -13.1631, longitude: -72.5450 },
    'Viewed Golden Gate Bridge 🌁': { locationName: 'Golden Gate Bridge, San Francisco, CA', latitude: 37.8199, longitude: -122.4783 },
    'Discovered Great Wall 🧱': { locationName: 'Great Wall of China, Beijing, China', latitude: 40.4319, longitude: 116.5704 },
    'Explored Diamond Head 🌋': { locationName: 'Diamond Head, Honolulu, Hawaii', latitude: 21.2618, longitude: -157.8078 },
    'Visited Stonehenge 🗿': { locationName: 'Stonehenge, UK', latitude: 51.1789, longitude: -1.8262 },
  };

  const cleanMilestone = milestone ? milestone.trim() : '';
  if (mapping[cleanMilestone]) {
    return mapping[cleanMilestone];
  }

  // Fallback / standard travel destinations
  const fallbacks: LocationDetails[] = [
    { locationName: 'Rome, Italy', latitude: 41.9028, longitude: 12.4964 },
    { locationName: 'Cape Town, South Africa', latitude: -33.9249, longitude: 18.4241 },
    { locationName: 'Sydney, Australia', latitude: -33.8688, longitude: 151.2093 },
    { locationName: 'Rio de Janeiro, Brazil', latitude: -22.9068, longitude: -43.1729 },
    { locationName: 'Cairo, Egypt', latitude: 30.0444, longitude: 31.2357 },
    { locationName: 'Vancouver, Canada', latitude: 49.2827, longitude: -123.1207 },
    { locationName: 'Zermatt, Switzerland', latitude: 46.0207, longitude: 7.7491 },
    { locationName: 'Queenstown, New Zealand', latitude: -45.0312, longitude: 168.6626 },
    { locationName: 'Kyoto, Japan', latitude: 35.0116, longitude: 135.7681 },
    { locationName: 'New York City, USA', latitude: 40.7128, longitude: -74.0060 },
  ];

  let hash = 0;
  for (let i = 0; i < cleanMilestone.length; i++) {
    hash = cleanMilestone.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % fallbacks.length;
  return fallbacks[index];
}

@customElement('affiliate-dashboard')
export class AffiliateDashboard extends LitElement {
  @state() private isLoggedIn = false;
  @state() private isAuthReady = false;
  @state() private userInfo: UserInfo | null = null;
  @state() private referredUsers: ReferredUser[] = [];
  @state() private showCopiedAlert = false;
  @state() private newUsernameInput = '';
  @state() private newCityInput = 'New York';
  @state() private simulationReward = 50;
  @state() private isSubmitting = false;

  // Level-up animation states
  @state() private justLeveledUp = false;
  @state() private leveledUpMilestone: LevelMilestone | null = null;

  // QR Code states
  @state() private showQRCode = false;
  @state() private qrCodeDataUrl = '';
  @state() private qrColorDark = '#0f172a';

  // Notification settings states
  @state() private showEmailSavedAlert = false;
  @state() private isSavingEmail = false;
  @state() private showEmailAlertToast = false;
  @state() private emailAlertToastText = '';
  @state() private emailAlertSubject = '';

  // Chart hover state
  @state() private hoverPoint: ChartDataPoint | null = null;
  @state() private hoverX = 0;
  @state() private hoverY = 0;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow-y: auto;
      font-family: 'Google Sans Text', 'Google Sans', system-ui, -apple-system, sans-serif;
      background-color: var(--color-bg);
      color: var(--color-text);
      padding: 1.25rem;
      box-sizing: border-box;
      position: relative;
    }

    .header-section {
      margin-bottom: 1.25rem;
    }

    .title {
      font-size: 1.35rem;
      font-weight: 600;
      letter-spacing: -0.02em;
      margin: 0 0 0.35rem 0;
      color: var(--color-text);
    }

    .subtitle {
      font-size: 0.85rem;
      color: var(--color-text2);
      margin: 0;
      opacity: 0.8;
    }

    /* Level Progression Banner */
    .level-banner {
      background: linear-gradient(135deg, var(--color-bg2) 0%, var(--color-bg3) 100%);
      border: 1px solid var(--color-sidebar-border);
      border-radius: 12px;
      padding: 1.25rem;
      margin-bottom: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      position: relative;
      overflow: hidden;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
    }

    .level-banner::before {
      content: '';
      position: absolute;
      top: -30%;
      right: -10%;
      width: 140px;
      height: 140px;
      background: radial-gradient(circle, rgba(234, 179, 8, 0.1) 0%, transparent 75%);
      pointer-events: none;
    }

    .level-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .level-badge-container {
      background-color: var(--color-bg);
      border: 1px solid var(--color-sidebar-border);
      width: 48px;
      height: 48px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.75rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
      animation: gentle-bounce 3s ease-in-out infinite;
    }

    @keyframes gentle-bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-4px); }
    }

    .level-info {
      display: flex;
      flex-direction: column;
    }

    .level-tag {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-text2);
      font-weight: 600;
      opacity: 0.85;
    }

    .level-name {
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--color-text);
      margin: 0;
    }

    .level-progress-section {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    .progress-bar-container {
      height: 8px;
      background-color: var(--color-bg);
      border-radius: 9999px;
      overflow: hidden;
      border: 1px solid var(--color-sidebar-border);
    }

    .progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--color-accent) 0%, #a855f7 100%);
      border-radius: 9999px;
      transition: width 0.8s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .progress-labels {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
      color: var(--color-text2);
      font-weight: 500;
    }

    .level-tip {
      display: flex;
      align-items: center;
      font-size: 0.78rem;
      color: var(--color-text2);
      background-color: rgba(120, 120, 120, 0.05);
      padding: 0.4rem 0.6rem;
      border-radius: 6px;
      border-left: 3px solid var(--color-accent);
      gap: 4px;
    }

    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .stat-card {
      background-color: var(--color-bg2);
      border: 1px solid var(--color-sidebar-border);
      border-radius: 12px;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      position: relative;
      transition: transform 0.2s ease, border-color 0.2s ease;
    }

    .stat-card:hover {
      border-color: var(--color-accent);
    }

    .stat-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-text2);
      margin-bottom: 0.5rem;
      font-weight: 500;
      opacity: 0.8;
    }

    .stat-value {
      font-size: 1.6rem;
      font-weight: 700;
      color: var(--color-text);
      line-height: 1.1;
    }

    .referral-code-box {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--color-bg);
      border: 1px dashed var(--color-sidebar-border);
      border-radius: 8px;
      padding: 0.5rem 0.75rem;
      margin-top: 0.5rem;
    }

    .code-text {
      font-family: 'Inconsolata', monospace;
      font-size: 1.1rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: var(--color-accent);
    }

    .btn-copy {
      background: none;
      border: none;
      color: var(--color-text2);
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s, color 0.2s;
    }

    .btn-copy:hover {
      background: var(--color-bg3);
      color: var(--color-text);
    }

    .copied-tooltip {
      font-size: 0.75rem;
      color: #10b981; /* Emerald green */
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 3px;
    }

    .btn-qr-toggle {
      background-color: var(--color-bg3);
      border: 1px solid var(--color-sidebar-border);
      color: var(--color-text);
      font-size: 0.72rem;
      font-weight: 600;
      padding: 0.35rem 0.65rem;
      border-radius: 6px;
      cursor: pointer;
      margin-top: 0.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: background-color 0.2s, border-color 0.2s;
    }

    .btn-qr-toggle:hover {
      background-color: var(--color-bg);
      border-color: var(--color-accent);
    }

    .qr-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.6rem;
      padding-top: 0.85rem;
      margin-top: 0.75rem;
      border-top: 1px dashed var(--color-sidebar-border);
      animation: slideDown 0.25s cubic-bezier(0.16, 1, 0.3, 1) both;
    }

    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .qr-wrapper {
      background-color: #ffffff;
      padding: 0.6rem;
      border-radius: 10px;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(0, 0, 0, 0.05);
    }

    .qr-image {
      width: 130px;
      height: 130px;
      display: block;
    }

    .qr-controls {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
    }

    .qr-color-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
    }

    .qr-color-label {
      font-size: 0.65rem;
      color: var(--color-text2);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .qr-color-picker {
      display: flex;
      gap: 0.4rem;
      justify-content: center;
      align-items: center;
    }

    .qr-color-dot {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      cursor: pointer;
      border: 2px solid var(--color-bg2);
      box-shadow: 0 0 0 1px var(--color-sidebar-border);
      transition: transform 0.15s, box-shadow 0.15s;
    }

    .qr-color-dot:hover {
      transform: scale(1.2);
    }

    .qr-color-dot.active {
      box-shadow: 0 0 0 2px var(--color-accent);
      transform: scale(1.1);
    }

    .btn-qr-download {
      background: none;
      border: 1px solid var(--color-sidebar-border);
      color: var(--color-text2);
      font-size: 0.65rem;
      font-weight: 600;
      padding: 0.2rem 0.4rem;
      border-radius: 5px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 3px;
      transition: all 0.2s;
    }

    .btn-qr-download:hover {
      color: var(--color-text);
      border-color: var(--color-accent);
      background-color: var(--color-bg3);
    }

    /* Simulation Forms */
    .section-box {
      background-color: var(--color-bg2);
      border: 1px solid var(--color-sidebar-border);
      border-radius: 12px;
      padding: 1rem;
      margin-bottom: 1.5rem;
    }

    .section-title {
      font-size: 0.95rem;
      font-weight: 600;
      margin: 0 0 0.75rem 0;
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--color-text);
    }

    .form-group {
      margin-bottom: 0.75rem;
    }

    .form-label {
      display: block;
      font-size: 0.75rem;
      font-weight: 500;
      margin-bottom: 0.25rem;
      color: var(--color-text2);
    }

    .input-row {
      display: flex;
      gap: 0.5rem;
    }

    .form-input {
      flex: 1;
      background-color: var(--color-bg);
      border: 1px solid var(--color-sidebar-border);
      color: var(--color-text);
      border-radius: 8px;
      padding: 0.5rem 0.75rem;
      font-size: 0.85rem;
      outline: none;
      transition: border-color 0.2s;
    }

    .form-input:focus {
      border-color: var(--color-accent);
    }

    .btn-primary {
      background-color: var(--color-accent);
      color: var(--color-accent-text);
      border: none;
      border-radius: 8px;
      padding: 0.5rem 1rem;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
      white-space: nowrap;
    }

    .btn-primary:hover {
      opacity: 0.9;
    }

    .btn-secondary {
      background: none;
      border: 1px solid var(--color-sidebar-border);
      color: var(--color-text);
      border-radius: 8px;
      padding: 0.5rem 0.75rem;
      font-size: 0.85rem;
      font-weight: 500;
      cursor: pointer;
      width: 100%;
      margin-top: 0.5rem;
      transition: background 0.2s;
    }

    .btn-secondary:hover {
      background-color: var(--color-bg3);
    }

    .reward-options {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }

    .reward-pill {
      flex: 1;
      background-color: var(--color-bg);
      border: 1px solid var(--color-sidebar-border);
      color: var(--color-text2);
      border-radius: 6px;
      padding: 0.35rem;
      font-size: 0.75rem;
      text-align: center;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.2s;
    }

    .reward-pill.active {
      background-color: var(--color-accent);
      border-color: var(--color-accent);
      color: var(--color-accent-text);
    }

    /* List / Table Section */
    .history-table-container {
      width: 100%;
      overflow-x: auto;
      border: 1px solid var(--color-sidebar-border);
      border-radius: 10px;
      background-color: var(--color-bg);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
    }

    .history-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.8rem;
      min-width: 390px;
    }

    .history-table th {
      background-color: var(--color-bg2);
      color: var(--color-text2);
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.65rem;
      letter-spacing: 0.05em;
      padding: 0.6rem 0.75rem;
      border-bottom: 1px solid var(--color-sidebar-border);
    }

    .history-table td {
      padding: 0.65rem 0.75rem;
      border-bottom: 1px solid var(--color-sidebar-border);
      vertical-align: middle;
    }

    .history-table tr:last-child td {
      border-bottom: none;
    }

    .history-table tr:hover {
      background-color: rgba(120, 120, 120, 0.03);
    }

    .table-user-cell {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .table-avatar {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background-color: var(--color-accent);
      color: var(--color-accent-text);
      font-size: 0.65rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .table-username {
      font-weight: 600;
      color: var(--color-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 105px;
    }

    .table-date {
      color: var(--color-text2);
      font-size: 0.7rem;
      opacity: 0.8;
      white-space: nowrap;
    }

    .table-milestone {
      color: var(--color-text);
      font-size: 0.75rem;
      font-weight: 500;
      max-width: 140px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .table-reward {
      font-weight: 700;
      color: #10b981;
      white-space: nowrap;
    }

    .badge {
      font-size: 0.6rem;
      font-weight: 600;
      padding: 1px 5px;
      border-radius: 4px;
      text-transform: uppercase;
      display: inline-block;
      white-space: nowrap;
    }

    .badge-active {
      background-color: rgba(16, 185, 129, 0.12);
      color: #10b981;
    }

    .badge-pending {
      background-color: rgba(245, 158, 11, 0.12);
      color: #f59e0b;
    }

    .empty-state {
      text-align: center;
      padding: 1.5rem;
      color: var(--color-text2);
      font-size: 0.85rem;
      opacity: 0.7;
      border: 1px dashed var(--color-sidebar-border);
      border-radius: 8px;
    }

    .db-controls {
      display: flex;
      justify-content: center;
      margin-top: auto;
      padding-top: 1.5rem;
    }

    .btn-reset {
      font-size: 0.75rem;
      color: var(--color-text2);
      background: none;
      border: none;
      cursor: pointer;
      text-decoration: underline;
      opacity: 0.7;
      transition: opacity 0.2s;
    }

    .btn-reset:hover {
      opacity: 1;
      color: #ef4444; /* soft red */
    }

    /* Utility icons */
    .icon {
      width: 16px;
      height: 16px;
      fill: currentColor;
    }

    /* Level Up Modal / Overlay */
    .levelup-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.88);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
      padding: 2rem;
      box-sizing: border-box;
      text-align: center;
      backdrop-filter: blur(10px);
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .levelup-card {
      background: linear-gradient(135deg, #18181b 0%, #09090b 100%);
      border: 2px solid #eab308; /* Yellow/Gold border */
      border-radius: 24px;
      padding: 2.5rem 2rem;
      max-width: 380px;
      width: 100%;
      box-shadow: 0 0 40px rgba(234, 179, 8, 0.25);
      transform: scale(0.9);
      animation: popIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.25rem;
      position: relative;
      overflow: hidden;
    }

    @keyframes popIn {
      to { transform: scale(1); }
    }

    .levelup-badge-emoji {
      font-size: 5rem;
      line-height: 1;
      filter: drop-shadow(0 0 15px rgba(234, 179, 8, 0.6));
      animation: float 2s ease-in-out infinite;
      z-index: 2;
    }

    @keyframes float {
      0%, 100% { transform: translateY(0) scale(1); }
      50% { transform: translateY(-12px) scale(1.05); }
    }

    .levelup-title {
      font-size: 1.8rem;
      font-weight: 800;
      color: #f6e05e;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin: 0;
      text-shadow: 0 0 15px rgba(234, 179, 8, 0.4);
      z-index: 2;
    }

    .levelup-subtitle {
      font-size: 0.9rem;
      color: #cbd5e1;
      margin: 0;
      z-index: 2;
    }

    .levelup-name {
      font-size: 1.5rem;
      font-weight: 800;
      margin: 0;
      background: linear-gradient(to right, #facc15, #ffffff, #facc15);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
      z-index: 2;
    }

    .btn-claim {
      background: linear-gradient(90deg, #ca8a04, #facc15);
      color: #000000;
      font-weight: 800;
      border: none;
      border-radius: 30px;
      padding: 0.85rem 2.2rem;
      font-size: 1rem;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(234, 179, 8, 0.45);
      transition: transform 0.2s, box-shadow 0.2s;
      width: 100%;
      z-index: 2;
      letter-spacing: 0.02em;
    }

    .btn-claim:hover {
      transform: scale(1.04);
      box-shadow: 0 6px 25px rgba(234, 179, 8, 0.65);
    }

    /* Sparkles background animation */
    .sparkle {
      position: absolute;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      opacity: 0;
      pointer-events: none;
    }
    
    .sparkle:nth-child(1) { top: 12%; left: 15%; animation: sparkleAnim 1.6s ease-out infinite; background-color: #f59e0b; }
    .sparkle:nth-child(2) { top: 22%; right: 20%; animation: sparkleAnim 1.8s ease-out infinite 0.2s; background-color: #eab308; }
    .sparkle:nth-child(3) { bottom: 25%; left: 18%; animation: sparkleAnim 1.4s ease-out infinite 0.4s; background-color: #3b82f6; }
    .sparkle:nth-child(4) { bottom: 18%; right: 15%; animation: sparkleAnim 1.5s ease-out infinite 0.1s; background-color: #ec4899; }
    .sparkle:nth-child(5) { top: 8%; right: 40%; animation: sparkleAnim 1.7s ease-out infinite 0.3s; background-color: #10b981; }
    .sparkle:nth-child(6) { bottom: 35%; right: 38%; animation: sparkleAnim 1.9s ease-out infinite 0.5s; background-color: #8b5cf6; }

    @keyframes sparkleAnim {
      0% { transform: scale(0) translateY(0) rotate(0deg); opacity: 0; }
      50% { opacity: 1; }
      100% { transform: scale(1.2) translateY(-60px) rotate(180deg); opacity: 0; }
    }

    /* Toggle switch styles */
    .toggle-container {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      padding: 0.5rem 0;
    }

    .toggle-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .toggle-title {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--color-text);
    }

    .toggle-description {
      font-size: 0.72rem;
      color: var(--color-text2);
      opacity: 0.8;
      max-width: 480px;
    }

    .switch {
      position: relative;
      display: inline-block;
      width: 40px;
      height: 22px;
      flex-shrink: 0;
    }

    .switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: var(--color-bg3);
      border: 1px solid var(--color-sidebar-border);
      transition: .3s;
      border-radius: 34px;
    }

    .slider:before {
      position: absolute;
      content: "";
      height: 14px;
      width: 14px;
      left: 3px;
      bottom: 3px;
      background-color: var(--color-text2);
      transition: .3s;
      border-radius: 50%;
    }

    input:checked + .slider {
      background-color: var(--color-accent);
      border-color: var(--color-accent);
    }

    input:checked + .slider:before {
      transform: translateX(18px);
      background-color: var(--color-accent-text);
    }

    .email-input-group {
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px dashed var(--color-sidebar-border);
    }

    .email-saved-toast {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background-color: rgba(16, 185, 129, 0.08);
      border: 1px solid rgba(16, 185, 129, 0.2);
      border-radius: 6px;
      padding: 0.4rem 0.6rem;
      margin-top: 0.5rem;
      font-size: 0.75rem;
      color: #10b981;
      font-weight: 500;
      animation: slideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1) both;
    }

    /* Email Alert Notification Toast */
    .email-alert-toast {
      position: fixed;
      bottom: 1.5rem;
      right: 1.5rem;
      background-color: var(--color-bg2);
      border: 1px solid var(--color-sidebar-border);
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
      border-radius: 12px;
      padding: 1rem;
      width: 320px;
      max-width: calc(100vw - 3rem);
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      animation: slideInFromRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
    }

    @keyframes slideInFromRight {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }

    .email-alert-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--color-sidebar-border);
      padding-bottom: 0.4rem;
    }

    .email-alert-title {
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--color-accent);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .email-alert-close {
      background: none;
      border: none;
      color: var(--color-text2);
      cursor: pointer;
      font-size: 0.85rem;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2px;
      opacity: 0.7;
    }

    .email-alert-close:hover {
      opacity: 1;
      color: var(--color-text);
    }

    .email-alert-body {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .email-alert-subject {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--color-text);
    }

    .email-alert-msg {
      font-size: 0.72rem;
      color: var(--color-text2);
    }

    /* 30-Day Reward Growth Chart CSS */
    .chart-box {
      background-color: var(--color-bg2);
      border: 1px solid var(--color-sidebar-border);
      border-radius: 12px;
      padding: 1.25rem;
      margin-bottom: 1.5rem;
      position: relative;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.02);
    }

    .chart-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .chart-title {
      font-size: 0.95rem;
      font-weight: 600;
      color: var(--color-text);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .chart-legend {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 0.7rem;
      color: var(--color-text2);
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .legend-color {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: var(--color-accent);
    }

    .svg-container {
      position: relative;
      width: 100%;
      height: auto;
    }

    .chart-svg {
      width: 100%;
      height: auto;
      overflow: visible;
    }

    .chart-line {
      fill: none;
      stroke: var(--color-accent);
      stroke-width: 2.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .chart-area {
      fill: url(#chart-gradient);
      opacity: 0.15;
    }

    .grid-line {
      stroke: var(--color-sidebar-border);
      stroke-width: 1;
      stroke-dasharray: 3 3;
      opacity: 0.6;
    }

    .axis-line {
      stroke: var(--color-sidebar-border);
      stroke-width: 1;
    }

    .tick-text {
      font-size: 10px;
      fill: var(--color-text2);
      opacity: 0.8;
      font-family: inherit;
    }

    .chart-tooltip-overlay {
      position: absolute;
      top: 10px;
      right: 15px;
      background-color: var(--color-bg);
      border: 1px solid var(--color-sidebar-border);
      padding: 0.4rem 0.6rem;
      border-radius: 8px;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
      pointer-events: none;
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 0.7rem;
      z-index: 10;
      animation: fadeIn 0.15s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(2px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .tooltip-date {
      font-weight: 500;
      color: var(--color-text2);
    }

    .tooltip-value {
      font-weight: 700;
      color: var(--color-accent);
    }

    .interactive-overlay {
      fill: none;
      pointer-events: all;
      cursor: crosshair;
    }

    .hover-marker {
      fill: var(--color-accent);
      stroke: var(--color-bg);
      stroke-width: 2;
    }

    .hover-indicator-line {
      stroke: var(--color-accent);
      stroke-width: 1;
      stroke-dasharray: 2 2;
      opacity: 0.5;
    }
  `;

  getRewardGrowthData(): ChartDataPoint[] {
    const data: ChartDataPoint[] = [];
    const now = new Date();
    
    // Create 30 days array from 29 days ago until today
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      // Format date string to match YYYY-MM-DD
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateCompareStr = `${yyyy}-${mm}-${dd}`;
      
      // Sum rewards of all users whose join date is <= this date
      let cumulativeReward = 0;
      this.referredUsers.forEach(user => {
        const userDatePart = user.joinDate.split(' ')[0]; // "YYYY-MM-DD"
        if (userDatePart <= dateCompareStr) {
          cumulativeReward += user.reward;
        }
      });

      data.push({
        date: d,
        dateStr: `${d.getMonth() + 1}/${d.getDate()}`,
        rewards: cumulativeReward
      });
    }
    return data;
  }

  getChartPath(data: ChartDataPoint[], width: number, height: number, padding: { top: number; right: number; bottom: number; left: number }) {
    if (data.length === 0) return '';
    
    const xScale = d3.scaleTime()
      .domain([data[0].date, data[data.length - 1].date])
      .range([padding.left, width - padding.right]);

    const maxReward = d3.max(data, d => d.rewards) || 100;
    const yScale = d3.scaleLinear()
      .domain([0, Math.max(10, maxReward * 1.15)])
      .range([height - padding.bottom, padding.top]);

    const lineGenerator = d3.line<ChartDataPoint>()
      .x(d => xScale(d.date))
      .y(d => yScale(d.rewards))
      .curve(d3.curveMonotoneX);

    return lineGenerator(data) || '';
  }

  getChartAreaPath(data: ChartDataPoint[], width: number, height: number, padding: { top: number; right: number; bottom: number; left: number }) {
    if (data.length === 0) return '';
    
    const xScale = d3.scaleTime()
      .domain([data[0].date, data[data.length - 1].date])
      .range([padding.left, width - padding.right]);

    const maxReward = d3.max(data, d => d.rewards) || 100;
    const yScale = d3.scaleLinear()
      .domain([0, Math.max(10, maxReward * 1.15)])
      .range([height - padding.bottom, padding.top]);

    const areaGenerator = d3.area<ChartDataPoint>()
      .x(d => xScale(d.date))
      .y0(height - padding.bottom)
      .y1(d => yScale(d.rewards))
      .curve(d3.curveMonotoneX);

    return areaGenerator(data) || '';
  }

  getChartTicks(data: ChartDataPoint[], width: number, height: number, padding: { top: number; right: number; bottom: number; left: number }) {
    if (data.length === 0) return { xTicks: [], yTicks: [] };

    const xScale = d3.scaleTime()
      .domain([data[0].date, data[data.length - 1].date])
      .range([padding.left, width - padding.right]);

    const maxReward = d3.max(data, d => d.rewards) || 100;
    const yScale = d3.scaleLinear()
      .domain([0, Math.max(10, maxReward * 1.15)])
      .range([height - padding.bottom, padding.top]);

    const xTicks = xScale.ticks(5).map(date => ({
      x: xScale(date),
      label: `${date.getMonth() + 1}/${date.getDate()}`
    }));

    const yTicks = yScale.ticks(4).map(val => ({
      y: yScale(val),
      label: `${val} pts`
    }));

    return { xTicks, yTicks };
  }

  handleChartMouseMove(e: MouseEvent, data: ChartDataPoint[], width: number, height: number, padding: { top: number; right: number; bottom: number; left: number }) {
    const svg = e.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    if (mouseX < padding.left || mouseX > width - padding.right) {
      this.hoverPoint = null;
      return;
    }

    const xScale = d3.scaleTime()
      .domain([data[0].date, data[data.length - 1].date])
      .range([padding.left, width - padding.right]);

    const maxReward = d3.max(data, d => d.rewards) || 100;
    const yScale = d3.scaleLinear()
      .domain([0, Math.max(10, maxReward * 1.15)])
      .range([height - padding.bottom, padding.top]);

    let closestPoint = data[0];
    let minDiff = Infinity;
    
    data.forEach(p => {
      const px = xScale(p.date);
      const diff = Math.abs(px - mouseX);
      if (diff < minDiff) {
        minDiff = diff;
        closestPoint = p;
      }
    });

    if (closestPoint) {
      this.hoverPoint = closestPoint;
      this.hoverX = xScale(closestPoint.date);
      this.hoverY = yScale(closestPoint.rewards);
    }
  }

  handleChartMouseLeave() {
    this.hoverPoint = null;
  }

  connectedCallback() {
    super.connectedCallback();
    onAuthStateChanged(auth, (user) => {
      this.isAuthReady = true;
      if (user) {
        this.isLoggedIn = true;
        this.loadData();
      } else {
        this.isLoggedIn = false;
        this.userInfo = null;
        this.referredUsers = [];
      }
    });
  }

  async login() {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Error signing in', error);
    }
  }

  async logout() {
    try {
      await auth.signOut();
    } catch (error) {
      console.error('Error signing out', error);
    }
  }

  /**
   * Initial data load, seeding default values if database is fresh.
   */
  async loadData() {
    try {
      const data = await seedDefaultData();
      this.userInfo = data.userInfo;
      this.referredUsers = data.referredUsers.reverse(); // Show newest first
    } catch (err) {
      console.error('Error seeding/fetching affiliate data:', err);
    }
  }

  /**
   * Copy referral link to Clipboard.
   */
  async copyReferralCode() {
    if (!this.userInfo) return;
    const referralLink = `${window.location.origin}/?ref=${this.userInfo.referralCode}`;
    try {
      await navigator.clipboard.writeText(referralLink);
      this.showCopiedAlert = true;
      setTimeout(() => {
        this.showCopiedAlert = false;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  }

  /**
   * Evaluates if a level up occurred and sets corresponding triggers.
   */
  private checkLevelUp(oldReferrals: number, newReferrals: number) {
    const oldMilestone = getLevelForReferrals(oldReferrals);
    const newMilestone = getLevelForReferrals(newReferrals);

    if (newMilestone.level > oldMilestone.level) {
      this.leveledUpMilestone = newMilestone;
      this.justLeveledUp = true;

      if (this.userInfo?.emailAlertsEnabled) {
        this.triggerEmailAlert(newMilestone);
      }
    }
  }

  triggerEmailAlert(milestone: LevelMilestone) {
    const email = this.userInfo?.alertEmail || 'your email address';
    this.emailAlertSubject = `🎉 Reward Milestone Achieved: Level ${milestone.level} - ${milestone.name}!`;
    this.emailAlertToastText = `${t('emailAlertSent')} ${email}`;
    this.showEmailAlertToast = true;

    // Auto-dismiss after 6 seconds
    setTimeout(() => {
      this.showEmailAlertToast = false;
    }, 6000);
  }

  async handleToggleEmailAlerts(e: Event) {
    if (!this.userInfo) return;
    const checkbox = e.target as HTMLInputElement;
    const updatedInfo = {
      ...this.userInfo,
      emailAlertsEnabled: checkbox.checked
    };
    try {
      await updateUserInfo(updatedInfo);
      this.userInfo = updatedInfo;
    } catch (err) {
      console.error('Error toggling email alerts:', err);
    }
  }

  handleEmailInput(e: Event) {
    if (!this.userInfo) return;
    const input = e.target as HTMLInputElement;
    this.userInfo = {
      ...this.userInfo,
      alertEmail: input.value
    };
  }

  async handleSaveEmail() {
    if (!this.userInfo) return;
    this.isSavingEmail = true;
    try {
      await updateUserInfo(this.userInfo);
      this.showEmailSavedAlert = true;
      setTimeout(() => {
        this.showEmailSavedAlert = false;
      }, 3000);
    } catch (err) {
      console.error('Error saving email:', err);
    } finally {
      this.isSavingEmail = false;
    }
  }

  dismissEmailAlertToast() {
    this.showEmailAlertToast = false;
  }

  /**
   * Handle adding a user-defined simulated referral.
   */
  async handleAddReferral(e: Event) {
    e.preventDefault();
    if (!this.newUsernameInput.trim() || this.isSubmitting || !this.userInfo) return;

    this.isSubmitting = true;
    
    // Format timestamp
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const randomMilestone = RECENT_MILESTONES[Math.floor(Math.random() * RECENT_MILESTONES.length)];
    const locDetails = getLocationForMilestone(randomMilestone);

    const newFriend: ReferredUser = {
      username: this.newUsernameInput.trim(),
      city: this.newCityInput.trim(),
      joinDate: formattedDate,
      reward: this.simulationReward,
      status: Math.random() > 0.15 ? 'Active' : 'Pending', // 85% Active, 15% Pending
      milestone: randomMilestone,
      locationName: locDetails.locationName,
      latitude: locDetails.latitude,
      longitude: locDetails.longitude,
    };

    const oldReferralsCount = this.userInfo.totalReferredUsers;

    try {
      const updated = await addReferredUser(newFriend);
      this.checkLevelUp(oldReferralsCount, updated.userInfo.totalReferredUsers);
      this.userInfo = updated.userInfo;
      this.referredUsers = updated.referredUsers.reverse(); // Newest first
      this.newUsernameInput = '';
      this.dispatchEvent(new CustomEvent('referrals-updated', { bubbles: true, composed: true }));
    } catch (err) {
      console.error('Error adding referred user:', err);
    } finally {
      this.isSubmitting = false;
    }
  }

  /**
   * Fast click button to simulate a high-value random referral with geographical theme.
   */
  async simulateRandomReferral() {
    if (!this.userInfo) return;

    const locations = [
      'Zenith_Voyager', 'GlobeMaster', 'Astra_Map', 'MeridianExplorer', 
      'Atlas_Rider', 'TerraScout', 'NomadGuide', 'SummitSeeker', 
      'EchoTraveler', 'PolarisCompass', 'HorizonWalker', 'VectorPath'
    ];
    const suffix = Math.floor(Math.random() * 900) + 100;
    const randomUsername = `${locations[Math.floor(Math.random() * locations.length)]}_${suffix}`;
    
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    const possibleRewards = [20, 50, 100];
    const randomReward = possibleRewards[Math.floor(Math.random() * possibleRewards.length)];

    const randomMilestone = RECENT_MILESTONES[Math.floor(Math.random() * RECENT_MILESTONES.length)];
    const locDetails = getLocationForMilestone(randomMilestone);

    const newFriend: ReferredUser = {
      username: randomUsername,
      joinDate: formattedDate,
      reward: randomReward,
      status: 'Active',
      milestone: randomMilestone,
      locationName: locDetails.locationName,
      latitude: locDetails.latitude,
      longitude: locDetails.longitude,
    };

    const oldReferralsCount = this.userInfo.totalReferredUsers;

    try {
      const updated = await addReferredUser(newFriend);
      this.checkLevelUp(oldReferralsCount, updated.userInfo.totalReferredUsers);
      this.userInfo = updated.userInfo;
      this.referredUsers = updated.referredUsers.reverse(); // Newest first
      this.dispatchEvent(new CustomEvent('referrals-updated', { bubbles: true, composed: true }));
    } catch (err) {
      console.error('Error simulating random referral:', err);
    }
  }

  /**
   * Resets database back to default seed.
   */
  async handleResetDB() {
    if (confirm(t('confirmReset'))) {
      try {
        const seeded = await resetDatabase();
        this.userInfo = seeded.userInfo;
        this.referredUsers = seeded.referredUsers.reverse();
        this.justLeveledUp = false;
        this.leveledUpMilestone = null;
        if (this.showQRCode) {
          this.generateQRCode();
        } else {
          this.qrCodeDataUrl = '';
        }
        this.dispatchEvent(new CustomEvent('referrals-updated', { bubbles: true, composed: true }));
      } catch (err) {
        console.error('Error resetting database:', err);
      }
    }
  }

  dismissLevelUp() {
    this.justLeveledUp = false;
  }

  toggleQRCode() {
    this.showQRCode = !this.showQRCode;
    if (this.showQRCode && !this.qrCodeDataUrl) {
      this.generateQRCode();
    }
  }

  async generateQRCode() {
    if (!this.userInfo) return;
    const referralLink = `${window.location.origin}/?ref=${this.userInfo.referralCode}`;
    try {
      this.qrCodeDataUrl = await QRCode.toDataURL(referralLink, {
        width: 250,
        margin: 2,
        color: {
          dark: this.qrColorDark,
          light: '#ffffff'
        }
      });
    } catch (err) {
      console.error('Error generating QR code:', err);
    }
  }

  async setQRColor(colorHex: string) {
    this.qrColorDark = colorHex;
    await this.generateQRCode();
  }

  downloadQRCode() {
    if (!this.qrCodeDataUrl) return;
    const a = document.createElement('a');
    a.href = this.qrCodeDataUrl;
    a.download = `referral-qr-${this.userInfo?.referralCode || 'code'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  render() {
    if (!this.isAuthReady) {
      return html`<div style="display: flex; height: 100%; align-items: center; justify-content: center; color: var(--color-text-muted);">Loading...</div>`;
    }
    
    if (!this.isLoggedIn) {
      return html`
        <div style="display: flex; flex-direction: column; height: 100%; align-items: center; justify-content: center; padding: 2rem; text-align: center; gap: 1rem;">
          <h2 style="font-size: 1.5rem; font-weight: 600; color: var(--color-text);">Affiliate Dashboard</h2>
          <p style="color: var(--color-text-muted);">Please sign in to view your affiliate program details and referred users.</p>
          <button @click=${this.login} style="background: var(--color-primary, #3b82f6); color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 500; cursor: pointer; transition: opacity 0.2s;">
            Sign in with Google
          </button>
        </div>
      `;
    }

    if (!this.userInfo) {
      return html`<div style="display: flex; height: 100%; align-items: center; justify-content: center; color: var(--color-text-muted);">Loading dashboard...</div>`;
    }

    const totalReferredUsers = this.userInfo.totalReferredUsers;
    const currentMilestone = getLevelForReferrals(totalReferredUsers);
    const nextMilestone = getNextLevelMilestone(currentMilestone.level);

    // Calculate progression percentage within the current level's range
    let progressPercent = 100;
    if (currentMilestone.nextLevelReferrals !== null) {
      const currentRangeStart = currentMilestone.minReferrals;
      const currentRangeEnd = currentMilestone.nextLevelReferrals;
      const earnedInTier = totalReferredUsers - currentRangeStart;
      const totalNeededInTier = currentRangeEnd - currentRangeStart;
      progressPercent = Math.min(100, Math.max(0, (earnedInTier / totalNeededInTier) * 100));
    }

    return html`
      <!-- Level Up Animation Overlay -->
      ${this.justLeveledUp && this.leveledUpMilestone ? html`
        <div class="levelup-overlay">
          <div class="levelup-card">
            <!-- Floating Sparkles -->
            <div class="sparkle"></div>
            <div class="sparkle"></div>
            <div class="sparkle"></div>
            <div class="sparkle"></div>
            <div class="sparkle"></div>
            <div class="sparkle"></div>

            <span class="levelup-badge-emoji">${this.leveledUpMilestone.icon}</span>
            <h2 class="levelup-title">Level Up!</h2>
            <p class="levelup-subtitle">You have progressed to Level ${this.leveledUpMilestone.level}</p>
            <h3 class="levelup-name">${this.leveledUpMilestone.name}</h3>
            <p class="levelup-subtitle" style="font-size: 0.8rem; opacity: 0.85;">
              Fantastic job! Keep expanding your nomad community to unlock premium geographical badges.
            </p>
            <button class="btn-claim" @click=${this.dismissLevelUp}>
              Continue Journey
            </button>
          </div>
        </div>
      ` : ''}

      <div class="header-section" style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h2 class="title">Affiliate Dashboard</h2>
          <p class="subtitle">Invite friends to explore the 3D globe and earn travel explorer rewards!</p>
        </div>
        <button @click=${this.logout} class="btn-outline" style="padding: 0.4rem 0.75rem; font-size: 0.8rem;">Sign Out</button>
      </div>

      <!-- Level Progression Banner -->
      <div class="level-banner">
        <div class="level-header">
          <div class="level-badge-container">
            <span class="level-badge-emoji">${currentMilestone.icon}</span>
          </div>
          <div class="level-info">
            <span class="level-tag">Level ${currentMilestone.level} Progression</span>
            <h3 class="level-name">${currentMilestone.name}</h3>
          </div>
        </div>
        
        <div class="level-progress-section">
          <div class="progress-bar-container">
            <div class="progress-bar-fill" style="width: ${progressPercent}%"></div>
          </div>
          <div class="progress-labels">
            <span>${totalReferredUsers} referred</span>
            <span>
              ${currentMilestone.nextLevelReferrals !== null 
                ? `${currentMilestone.nextLevelReferrals} total referred for next level` 
                : 'Maximum Level reached!'
              }
            </span>
          </div>
        </div>
        
        ${currentMilestone.nextLevelReferrals !== null && nextMilestone
          ? html`
            <div class="level-tip">
              <svg class="icon" viewBox="0 0 24 24" style="fill: var(--color-text2); opacity: 0.8; width: 14px; height: 14px;">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
              </svg>
              <span>Refer <strong>${currentMilestone.nextLevelReferrals - totalReferredUsers}</strong> more friend${(currentMilestone.nextLevelReferrals - totalReferredUsers) > 1 ? 's' : ''} to unlock the <strong>${nextMilestone.name}</strong> tier!</span>
            </div>`
          : html`
            <div class="level-tip" style="border-left-color: #eab308;">
              <span style="color: #eab308; font-weight: 600;">👑 Master Pathfinder Status: You've unlocked the ultimate reward tier! Keep sharing!</span>
            </div>`
        }
      </div>

      <div class="stats-grid">
        <!-- Referral Code Card -->
        <div class="stat-card" id="ref-code-card">
          <span class="stat-label">Your Referral Link</span>
          <div class="referral-code-box">
            <span class="code-text">${this.userInfo.referralCode}</span>
            <button class="btn-copy" @click=${this.copyReferralCode} aria-label="Copy referral link">
              ${this.showCopiedAlert 
                ? html`<span class="copied-tooltip">Copied!</span>` 
                : html`<svg class="icon" viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`
              }
            </button>
          </div>

          <button class="btn-qr-toggle" @click=${this.toggleQRCode} aria-expanded="${this.showQRCode}">
            <svg class="icon" viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: currentColor;"><path d="M3 11h8V3H3v8zm2-6h4v4H5V5zM3 21h8v-8H3v8zm2-6h4v4H5v-4zm8-12v8h8V3h-8zm6 6h-4V5h4v4zm0 10h2v2h-2zm-6-6h2v2h-2zm2 2h2v2h-2zm-2 2h2v2h-2zm2 2h2v2h-2zm2-2h2v2h-2zm0-4h2v2h-2zm2 2h2v2h-2z"/></svg>
            ${this.showQRCode ? 'Hide QR Code' : 'Generate QR Code'}
          </button>

          ${this.showQRCode ? html`
            <div class="qr-container">
              <div class="qr-wrapper">
                ${this.qrCodeDataUrl ? html`
                  <img src="${this.qrCodeDataUrl}" alt="Referral QR Code" class="qr-image" />
                ` : html`
                  <div style="width: 130px; height: 130px; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; color: var(--color-text2);">Generating...</div>
                `}
              </div>
              <div class="qr-controls">
                <div class="qr-color-section">
                  <span class="qr-color-label">Theme Accent</span>
                  <div class="qr-color-picker">
                    <div class="qr-color-dot ${this.qrColorDark === '#0f172a' ? 'active' : ''}" style="background-color: #0f172a;" @click=${() => this.setQRColor('#0f172a')} title="Slate"></div>
                    <div class="qr-color-dot ${this.qrColorDark === '#4f46e5' ? 'active' : ''}" style="background-color: #4f46e5;" @click=${() => this.setQRColor('#4f46e5')} title="Indigo"></div>
                    <div class="qr-color-dot ${this.qrColorDark === '#059669' ? 'active' : ''}" style="background-color: #059669;" @click=${() => this.setQRColor('#059669')} title="Emerald"></div>
                    <div class="qr-color-dot ${this.qrColorDark === '#7c3aed' ? 'active' : ''}" style="background-color: #7c3aed;" @click=${() => this.setQRColor('#7c3aed')} title="Violet"></div>
                    <div class="qr-color-dot ${this.qrColorDark === '#db2777' ? 'active' : ''}" style="background-color: #db2777;" @click=${() => this.setQRColor('#db2777')} title="Pink"></div>
                  </div>
                </div>
                <button class="btn-qr-download" @click=${this.downloadQRCode} ?disabled=${!this.qrCodeDataUrl}>
                  <svg class="icon" viewBox="0 0 24 24" style="width: 11px; height: 11px; fill: currentColor;"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/></svg>
                  Save Image
                </button>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Total Referred Card -->
        <div class="stat-card" id="total-referred-card">
          <span class="stat-label">Total Referrals</span>
          <span class="stat-value">${totalReferredUsers}</span>
        </div>

        <!-- Earned Rewards Card -->
        <div class="stat-card" id="rewards-earned-card">
          <span class="stat-label">Earned Rewards</span>
          <span class="stat-value" style="color: #10b981;">${this.userInfo.earnedRewards} pts</span>
        </div>
      </div>

      <!-- 30-Day Reward Growth Chart -->
      ${(() => {
        const chartData = this.getRewardGrowthData();
        const width = 600;
        const height = 240;
        const padding = { top: 20, right: 20, bottom: 35, left: 50 };
        const linePath = this.getChartPath(chartData, width, height, padding);
        const areaPath = this.getChartAreaPath(chartData, width, height, padding);
        const { xTicks, yTicks } = this.getChartTicks(chartData, width, height, padding);

        return html`
          <div class="chart-box" id="reward-growth-chart">
            <div class="chart-header">
              <h3 class="chart-title">
                <svg class="icon" viewBox="0 0 24 24" style="fill: var(--color-accent); width: 16px; height: 16px;"><path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/></svg>
                30-Day Reward Growth Trend
              </h3>
              <div class="chart-legend">
                <div class="legend-item">
                  <span class="legend-color"></span>
                  <span>Cumulative Points</span>
                </div>
              </div>
            </div>

            <div class="svg-container">
              <svg 
                class="chart-svg" 
                viewBox="0 0 ${width} ${height}"
                @mousemove=${(e: MouseEvent) => this.handleChartMouseMove(e, chartData, width, height, padding)}
                @mouseleave=${this.handleChartMouseLeave}
              >
                <defs>
                  <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="var(--color-accent)" stop-opacity="0.3"/>
                    <stop offset="100%" stop-color="var(--color-accent)" stop-opacity="0"/>
                  </linearGradient>
                </defs>

                <!-- Grid lines (horizontal) -->
                ${yTicks.map(tick => html`
                  <line 
                    class="grid-line" 
                    x1="${padding.left}" 
                    y1="${tick.y}" 
                    x2="${width - padding.right}" 
                    y2="${tick.y}"
                  />
                  <text 
                    class="tick-text" 
                    x="${padding.left - 10}" 
                    y="${tick.y + 4}" 
                    text-anchor="end"
                  >
                    ${tick.label}
                  </text>
                `)}

                <!-- X Axis ticks & lines -->
                ${xTicks.map(tick => html`
                  <text 
                    class="tick-text" 
                    x="${tick.x}" 
                    y="${height - padding.bottom + 18}" 
                    text-anchor="middle"
                  >
                    ${tick.label}
                  </text>
                `)}

                <!-- Base axes -->
                <line 
                  class="axis-line" 
                  x1="${padding.left}" 
                  y1="${height - padding.bottom}" 
                  x2="${width - padding.right}" 
                  y2="${height - padding.bottom}"
                />
                <line 
                  class="axis-line" 
                  x1="${padding.left}" 
                  y1="${padding.top}" 
                  x2="${padding.left}" 
                  y2="${height - padding.bottom}"
                />

                <!-- Paths -->
                ${areaPath ? html`<path class="chart-area" d="${areaPath}" />` : ''}
                ${linePath ? html`<path class="chart-line" d="${linePath}" />` : ''}

                <!-- Hover vertical line indicator -->
                ${this.hoverPoint ? html`
                  <line 
                    class="hover-indicator-line" 
                    x1="${this.hoverX}" 
                    y1="${padding.top}" 
                    x2="${this.hoverX}" 
                    y2="${height - padding.bottom}"
                  />
                  <circle 
                    class="hover-marker" 
                    cx="${this.hoverX}" 
                    cy="${this.hoverY}" 
                    r="5"
                  />
                ` : ''}

                <!-- Interactive overlay for mouse capture -->
                <rect 
                  class="interactive-overlay" 
                  x="${padding.left}" 
                  y="${padding.top}" 
                  width="${width - padding.left - padding.right}" 
                  height="${height - padding.top - padding.bottom}"
                />
              </svg>

              <!-- Floating Tooltip Overlay -->
              ${this.hoverPoint ? html`
                <div class="chart-tooltip-overlay">
                  <span class="tooltip-date">Date: ${this.hoverPoint.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  <span class="tooltip-value">Total: ${this.hoverPoint.rewards} pts</span>
                </div>
              ` : ''}
            </div>
          </div>
        `;
      })()}

      <!-- Quick Actions / Simulation -->
      <div class="section-box" id="actions-panel">
        <h3 class="section-title">
          <svg class="icon" viewBox="0 0 24 24" style="fill: var(--color-accent);"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          Simulate Referral Signup
        </h3>
        
        <form @submit=${this.handleAddReferral}>
          <div class="form-group">
            <label class="form-label" for="username-input">Friend's Username</label>
            <div class="input-row">
              <input 
                id="username-input"
                type="text" 
                class="form-input" 
                placeholder="e.g. MapSovereign"
                .value=${this.newUsernameInput}
                @input=${(e: Event) => this.newUsernameInput = (e.target as HTMLInputElement).value}
              />
              <select 
                class="form-input"
                style="max-width: 120px;"
                .value=${this.newCityInput}
                @change=${(e: Event) => this.newCityInput = (e.target as HTMLSelectElement).value}
              >
                <option value="New York">New York</option>
                <option value="London">London</option>
                <option value="Tokyo">Tokyo</option>
                <option value="Paris">Paris</option>
              </select>
              <button type="submit" class="btn-primary" ?disabled=${!this.newUsernameInput.trim() || this.isSubmitting}>
                Invite
              </button>
            </div>
          </div>
        </form>

        <div class="form-group" style="margin-top: 0.5rem;">
          <label class="form-label">Set Simulated Reward</label>
          <div class="reward-options">
            <div class="reward-pill ${this.simulationReward === 20 ? 'active' : ''}" @click=${() => this.simulationReward = 20}>20 pts</div>
            <div class="reward-pill ${this.simulationReward === 50 ? 'active' : ''}" @click=${() => this.simulationReward = 50}>50 pts</div>
            <div class="reward-pill ${this.simulationReward === 100 ? 'active' : ''}" @click=${() => this.simulationReward = 100}>100 pts</div>
          </div>
        </div>

        <button class="btn-secondary" @click=${this.simulateRandomReferral}>
          ⚡ Generate Random Referral
        </button>
      </div>

      <!-- Notification Settings -->
      <div class="section-box" id="notifications-panel">
        <h3 class="section-title">
          <svg class="icon" viewBox="0 0 24 24" style="fill: var(--color-accent); width: 15px; height: 15px;"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/></svg>
          Notification Settings
        </h3>
        
        <div class="notification-settings-group">
          <div class="toggle-container">
            <div class="toggle-info">
              <span class="toggle-title">Email Alerts for Reward Milestones</span>
              <span class="toggle-description">Receive a notification email whenever you unlock a new reward tier or level up.</span>
            </div>
            <label class="switch">
              <input 
                type="checkbox" 
                .checked=${!!this.userInfo.emailAlertsEnabled}
                @change=${this.handleToggleEmailAlerts}
              />
              <span class="slider"></span>
            </label>
          </div>

          ${this.userInfo.emailAlertsEnabled ? html`
            <div class="email-input-group">
              <label class="form-label" for="alert-email-input">Notification Email Address</label>
              <div class="input-row">
                <input 
                  id="alert-email-input"
                  type="email" 
                  class="form-input" 
                  placeholder="name@example.com"
                  .value=${this.userInfo.alertEmail || ''}
                  @input=${this.handleEmailInput}
                />
                <button class="btn-primary" @click=${this.handleSaveEmail} ?disabled=${this.isSavingEmail}>
                  ${this.isSavingEmail ? 'Saving...' : 'Save'}
                </button>
              </div>
              ${this.showEmailSavedAlert ? html`
                <div class="email-saved-toast">
                  <svg class="icon" viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: #10b981;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                  <span>Email updated successfully!</span>
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Referral History -->
      <div class="section-box" id="history-panel" style="margin-bottom: 0.5rem; flex: 1;">
        <h3 class="section-title">Referred Friends History</h3>
        
        ${this.referredUsers.length === 0 
          ? html`<div class="empty-state">No referred users yet. Send your referral link to friends!</div>`
          : html`
            <div class="history-table-container">
              <table class="history-table">
                <thead>
                  <tr>
                    <th>Friend</th>
                    <th>Joined</th>
                    <th>Milestone Achieved</th>
                    <th>Status</th>
                    <th>Reward</th>
                  </tr>
                </thead>
                <tbody>
                  ${this.referredUsers.map(user => {
                    const firstChar = user.username ? user.username.charAt(0).toUpperCase() : '?';
                    return html`
                      <tr>
                        <td>
                          <div class="table-user-cell">
                            <div class="table-avatar">${firstChar}</div>
                            <span class="table-username" title="${user.username}">${user.username}</span>
                          </div>
                        </td>
                        <td>
                          <span class="table-date">${user.joinDate.split(' ')[0]}</span>
                        </td>
                        <td>
                          <span class="table-milestone" title="${user.milestone || 'Account Created ⛺'}">
                            ${user.milestone || 'Account Created ⛺'}
                          </span>
                        </td>
                        <td>
                          <span class="badge ${user.status === 'Active' ? 'badge-active' : 'badge-pending'}">
                            ${user.status}
                          </span>
                        </td>
                        <td>
                          <span class="table-reward">+${user.reward} pts</span>
                        </td>
                      </tr>
                    `;
                  })}
                </tbody>
              </table>
            </div>
          `
        }
      </div>

      <div class="db-controls">
        <button class="btn-reset" @click=${this.handleResetDB}>Reset Referral Data</button>
      </div>

      <!-- Simulated Email Toast Notification -->
      ${this.showEmailAlertToast ? html`
        <div class="email-alert-toast">
          <div class="email-alert-header">
            <span class="email-alert-title">
              <svg class="icon" viewBox="0 0 24 24" style="width: 12px; height: 12px; fill: var(--color-accent);"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
              Simulated Email Outbox
            </span>
            <button class="email-alert-close" @click=${this.dismissEmailAlertToast} aria-label="Close notification">×</button>
          </div>
          <div class="email-alert-body">
            <span class="email-alert-subject">${this.emailAlertSubject}</span>
            <span class="email-alert-msg">${this.emailAlertToastText}</span>
          </div>
        </div>
      ` : ''}
    `;
  }
}
