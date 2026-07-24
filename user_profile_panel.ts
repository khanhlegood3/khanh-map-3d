import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { UserInfo, getUserInfo, updateUserInfo } from './affiliate_db';
import { auth, googleProvider } from './firebase_init';
import { updateProfile, User } from 'firebase/auth';

@customElement('user-profile-panel')
export class UserProfilePanel extends LitElement {
  @property({ type: Object }) userInfo: UserInfo | null = null;
  @property({ type: Object }) user: User | null = null;

  @state() private name: string = '';
  @state() private phone: string = '';
  @state() private saving: boolean = false;
  @state() private saved: boolean = false;

  static styles = css`
    :host {
      display: block;
      font-family: system-ui, -apple-system, sans-serif;
      color: #1a2035;
      --border: rgba(0,0,0,0.1);
      --surface: #fff;
      --surface2: #f8fafc;
      --text: #1a2035;
      --text2: #555;
      --text3: #888;
    }
    
    .panel-container {
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .card {
      border-radius: 24px;
      overflow: hidden;
      border: 1px solid var(--border);
      background: var(--surface);
      box-shadow: 0 24px 70px rgba(35,45,80,0.08);
    }

    .header {
      padding: 24px 28px;
      background: linear-gradient(135deg, #4285F4, #34A853, #FBBC05, #EA4335);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }

    .header-content {
      color: #fff;
    }

    .header-label {
      font-size: 11px;
      letter-spacing: .16em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.78);
      font-family: monospace;
    }

    .header-title {
      margin: 6px 0 4px;
      font-size: 28px;
      font-weight: 900;
      color: #fff;
    }

    .header-desc {
      font-size: 13px;
      color: rgba(255,255,255,0.82);
    }

    .provider-badge {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border-radius: 999px;
      background: rgba(255,255,255,0.16);
      border: 1px solid rgba(255,255,255,0.3);
      color: #fff;
      font-weight: 800;
    }

    .content-grid {
      padding: 24px;
      display: grid;
      grid-template-columns: minmax(260px, 360px) 1fr;
      gap: 22px;
    }

    @media (max-width: 900px) {
      .content-grid {
        grid-template-columns: 1fr;
      }
    }

    .avatar-column {
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 20px;
      background: var(--surface2);
      text-align: center;
    }

    .avatar-wrapper {
      position: relative;
      width: 154px;
      height: 154px;
      margin: 0 auto 14px;
    }

    .avatar-img {
      width: 154px;
      height: 154px;
      border-radius: 50%;
      object-fit: cover;
      border: 4px solid rgba(66,133,244,0.35);
      box-shadow: 0 16px 45px rgba(66,133,244,0.35);
    }

    .user-name {
      font-size: 18px;
      font-weight: 900;
      margin-bottom: 4px;
    }

    .user-email {
      font-size: 12px;
      color: var(--text3);
      margin-bottom: 16px;
    }

    .info-column {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .info-card {
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 22px;
      background: var(--surface2);
    }

    .info-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 18px;
    }

    .info-title {
      font-size: 11px;
      color: #4285F4;
      letter-spacing: .14em;
      text-transform: uppercase;
      font-family: monospace;
      font-weight: 800;
    }

    .info-desc {
      font-size: 12px;
      color: var(--text3);
      margin-top: 5px;
    }

    .verified-badge {
      padding: 7px 10px;
      border-radius: 999px;
      background: rgba(66,133,244,0.12);
      border: 1px solid rgba(66,133,244,0.35);
      color: #4285F4;
      font-size: 11px;
      font-weight: 800;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 14px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 12px;
      color: var(--text3);
      font-weight: 700;
    }

    .form-input {
      width: 100%;
      padding: 12px 13px;
      border-radius: 12px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text);
      outline: none;
      box-sizing: border-box;
      font-size: 14px;
      font-family: inherit;
    }
    
    .form-input:disabled {
      opacity: 0.72;
      cursor: not-allowed;
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 12px;
      margin-top: 22px;
    }

    .save-btn {
      padding: 12px 22px;
      border-radius: 12px;
      border: none;
      cursor: pointer;
      background: linear-gradient(135deg, #00b8cc, #6b3fd4);
      color: #fff;
      font-size: 14px;
      font-weight: 900;
      font-family: inherit;
      box-shadow: 0 12px 30px rgba(0,184,204,0.22);
      transition: opacity 0.2s;
    }

    .save-btn:disabled {
      opacity: 0.58;
      cursor: not-allowed;
    }
    
    .saved-text {
      color: #00e676;
      font-size: 12px;
      font-weight: 800;
    }
    
    .uuid-box {
      border: 1px solid rgba(66,133,244,0.35);
      border-radius: 16px;
      padding: 16px;
      background: rgba(66,133,244,0.12);
      margin-bottom: 16px;
    }
    
    .uuid-title {
      font-size: 11px;
      font-weight: 700;
      color: #4285F4;
      margin-bottom: 8px;
      letter-spacing: .1em;
      text-transform: uppercase;
    }
  `;

  updated(changedProperties: Map<string, any>) {
    if (changedProperties.has('user') && this.user) {
      this.name = this.user.displayName || '';
    }
  }

  private async handleSave() {
    if (!this.user) return;
    this.saving = true;
    this.saved = false;
    
    try {
      await updateProfile(this.user, {
        displayName: this.name
      });
      
      // We could also save other fields to our custom user info document here
      // For now, let's pretend we saved it.
      await new Promise(r => setTimeout(r, 600));
      
      this.saved = true;
      setTimeout(() => {
        this.saved = false;
      }, 2000);
    } catch (e) {
      console.error("Error saving profile", e);
    } finally {
      this.saving = false;
    }
  }

  private getAvatarUrl() {
    if (this.user?.photoURL) return this.user.photoURL;
    const nameStr = encodeURIComponent(this.name || this.user?.email || 'User');
    return `https://ui-avatars.com/api/?name=${nameStr}&background=6b3fd4&color=fff&size=256&bold=true&rounded=true`;
  }

  render() {
    if (!this.user || !this.userInfo) return html`<div>Loading profile...</div>`;
    
    return html`
      <div class="panel-container">
        <div class="card">
          <div class="header">
            <div class="header-content">
              <div class="header-label">User Account</div>
              <h2 class="header-title">My Profile</h2>
              <div class="header-desc">Sync from Google, customize your display information.</div>
            </div>
            <div class="provider-badge">
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z"/>
                <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z"/>
                <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 010-3.04V5.41H1.83a8 8 0 000 7.18z"/>
                <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.5 7.49a4.77 4.77 0 014.48-3.3z"/>
              </svg>
              <span>Google</span>
            </div>
          </div>

          <div class="content-grid">
            <div class="avatar-column">
              <div class="avatar-wrapper">
                <img src="${this.getAvatarUrl()}" class="avatar-img" alt="Avatar" />
              </div>
              
              <div class="user-name">${this.user.displayName || 'Unnamed User'}</div>
              <div class="user-email">${this.user.email}</div>
              
              <div class="uuid-box">
                <div class="uuid-title">Referral Code</div>
                <code style="font-size: 14px; font-weight: bold; color: #4285F4;">
                  ${this.userInfo.referralCode}
                </code>
              </div>
              
              <div class="uuid-box" style="margin-top: 16px; border-color: rgba(52,168,83,0.35); background: rgba(52,168,83,0.12);">
                <div class="uuid-title" style="color: #34A853">Earned Rewards</div>
                <code style="font-size: 18px; font-weight: bold; color: #34A853;">
                  ${this.userInfo.earnedRewards} Points
                </code>
              </div>
            </div>

            <div class="info-column">
              <div class="info-card">
                <div class="info-header">
                  <div>
                    <div class="info-title">Display Information</div>
                    <div class="info-desc">Customize your profile data.</div>
                  </div>
                  <div class="verified-badge">
                    ${this.user.emailVerified ? '✓ Verified email' : 'Unverified'}
                  </div>
                </div>
                
                <div class="form-grid">
                  <label class="form-group">
                    Full Name
                    <input 
                      type="text" 
                      class="form-input" 
                      .value="${this.name}" 
                      @input="${(e: any) => this.name = e.target.value}"
                      placeholder="John Doe" 
                    />
                  </label>
                  
                  <label class="form-group">
                    Sign-in Provider
                    <input 
                      type="text" 
                      class="form-input" 
                      disabled 
                      value="Google · ${this.user.email}" 
                    />
                  </label>
                </div>
                
                <div class="actions">
                  ${this.saved ? html`<span class="saved-text">Profile saved ✓</span>` : ''}
                  <button 
                    class="save-btn" 
                    ?disabled="${this.saving || !this.name.trim()}"
                    @click="${this.handleSave}"
                  >
                    ${this.saving ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
