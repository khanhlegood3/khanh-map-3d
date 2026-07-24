/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * This file defines the main `gdm-map-app` LitElement component.
 * This component is responsible for:
 * - Rendering the user interface, including the Google Photorealistic 3D Map,
 *   chat messages area, and user input field.
 * - Managing the state of the chat (e.g., idle, generating, thinking).
 * - Handling user input and sending messages to the Gemini AI model.
 * - Processing responses from the AI, including displaying text and handling
 *   function calls (tool usage) related to map interactions.
 * - Integrating with the Google Maps JavaScript API to load and control the map,
 *   display markers, polylines for routes, and geocode locations.
 * - Providing the `handleMapQuery` method, which is called by the MCP server
 *   (via index.tsx) to update the map based on AI tool invocations.
 */

// Google Maps JS API Loader: Used to load the Google Maps JavaScript API.
import {Loader} from '@googlemaps/js-api-loader';
import hljs from 'highlight.js';
import {html, LitElement, PropertyValueMap} from 'lit';
import {customElement, query, state} from 'lit/decorators.js';
import {classMap} from 'lit/directives/class-map.js';
import {Marked} from 'marked';
import {markedHighlight} from 'marked-highlight';

import {MapParams} from './mcp_maps_server';
import './affiliate_dashboard';
import './user_profile_panel';
import './body_pixel_panel';
import './body_care_panel';
import { getReferredUsers, ReferredUser, getUserInfo, UserInfo } from './affiliate_db';
import { auth, googleProvider } from './firebase_init';
import { onAuthStateChanged, signInWithPopup, User } from 'firebase/auth';
import { setLanguage, Language, t } from './src/i18n';

/** Markdown formatting function with syntax hilighting */
export const marked = new Marked(
  markedHighlight({
    async: true,
    emptyLangClass: 'hljs',
    langPrefix: 'hljs language-',
    highlight(code, lang, info) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(code, {language}).value;
    },
  }),
);

const ICON_BUSY = html`<svg
  class="rotating"
  xmlns="http://www.w3.org/2000/svg"
  height="24px"
  viewBox="0 -960 960 960"
  width="24px"
  fill="currentColor">
  <path
    d="M480-80q-82 0-155-31.5t-127.5-86Q143-252 111.5-325T80-480q0-83 31.5-155.5t86-127Q252-817 325-848.5T480-880q17 0 28.5 11.5T520-840q0 17-11.5 28.5T480-800q-133 0-226.5 93.5T160-480q0 133 93.5 226.5T480-160q133 0 226.5-93.5T800-480q0-17 11.5-28.5T840-520q17 0 28.5 11.5T880-480q0 82-31.5 155t-86 127.5q-54.5 54.5-127 86T480-80Z" />
</svg>`;

/**
 * Chat state enum to manage the current state of the chat interface.
 */
export enum ChatState {
  IDLE,
  GENERATING,
  THINKING,
  EXECUTING,
}

/**
 * Chat tab enum to manage the current selected tab in the chat interface.
 */
enum ChatTab {
  GEMINI,
  AFFILIATE,
  BODY_PIXEL,
  BODY_CARE,
}

/**
 * Chat role enum to manage the current role of the message.
 */
export enum ChatRole {
  USER,
  ASSISTANT,
  SYSTEM,
}

export interface SavedPlace {
  id: string;
  name: string;
  lat: number;
  lng: number;
  description?: string;
  savedAt: string;
}

// Google Maps API Key: read from the Vite env var VITE_GOOGLE_MAPS_API_KEY
// (set it in the project's .env file). It must be a key you own, with the
// "Maps JavaScript API" enabled and billing turned on for the Cloud project
// (3D Maps is currently in Preview / free, but still requires an enabled,
// non-restricted-by-referrer-mismatch key). The key that shipped with the
// original AI Studio demo only works on Google's own demo domain, which is
// why the globe was not rendering after the integration — replace it with
// your own key below.
const USER_PROVIDED_GOOGLE_MAPS_API_KEY: string =
  (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';

const EXAMPLE_PROMPTS = [
  "Show me directions from Tokyo Tower to Shibuya Crossing.",
  "Can you show me a beautiful beach?",
  "Show me San Francisco",
  "Give me directions from the Eiffel Tower to the Louvre Museum.",
  "Where is a place with a tilted tower?",
  "Can you show me Diamond Head in Hawaii?",
  "Let's go to Venice, Italy.",
  "Take me to the northernmost capital city in the world",
  "What's the way from Buckingham Palace to the Tower of London?",
  "How about the southernmost permanently inhabited settlement? What's it called and where is it?",
  "Let's jump to Machu Picchu in Peru",
  "Can you show me the Three Gorges Dam in China?",
  "Can you find a town or city with an unusual name and show it to me?",
  "How do I get from Times Square, New York to Central Park?",
  "Show me the route from the Golden Gate Bridge to Alcatraz Island.",
];

/**
 * MapApp component for Photorealistic 3D Maps.
 */
@customElement('gdm-map-app')
export class MapApp extends LitElement {
  @query('#anchor') anchor?: HTMLDivElement;
  // Google Maps: Reference to the <gmp-map-3d> DOM element where the map is rendered.
  @query('#mapContainer') mapContainerElement?: HTMLElement; // Will be <gmp-map-3d>
  @query('#messageInput') messageInputElement?: HTMLInputElement;

  @state() chatState = ChatState.IDLE;
  @state() isRunning = true;
  @state() selectedChatTab = ChatTab.GEMINI;
  @state() inputMessage = '';
  @state() messages: HTMLElement[] = [];
  @state() mapInitialized = false;
  @state() mapError = '';

  @state() private showReferralMarkers = true;
  @state() private showLocationLabels = true;
  @state() private labelStyle: 'Simple' | 'Bubble' | 'Minimalist' = 'Simple';
  @state() private visualizationMode: 'pins' | 'heat' = 'pins';
  @state() private referralList: ReferredUser[] = [];
  @state() private cinematicFlight = true;
  @state() private selectedReferral: ReferredUser | null = null;
  @state() private autoRotate = false;
  @state() private savedPlaces: SavedPlace[] = [];
  @state() private selectedAffiliateSubTab: 'dashboard' | 'saved' | 'profile' = 'dashboard';
  @state() private isMeasuringMode = false;
  @state() private isFullscreen = false;
  @state() private lang: Language = 'vi';
  @state() private isLoggedIn = false;
  @state() private isAuthReady = false;
  @state() private userInfo: UserInfo | null = null;
  @state() private currentUser: User | null = null;
  @state() private measurePointA: { lat: number; lng: number } | null = null;
  @state() private measurePointB: { lat: number; lng: number } | null = null;
  @state() private measureDistance: number | null = null;
  private _measureMarkerA: any = null;
  private _measureMarkerB: any = null;
  private _measurePolyline: any = null;
  private _referralMarkers: any[] = [];
  private _stage1EndHandler: (() => void) | null = null;
  private _rotateFrameId: number | null = null;

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('language-changed', this._handleLangChange);
    document.addEventListener('fullscreenchange', this._handleFullscreenChange);
    onAuthStateChanged(auth, async (user) => {
      this.isAuthReady = true;
      this.isLoggedIn = !!user;
      this.currentUser = user;
      if (user) {
        try {
          this.userInfo = await getUserInfo();
        } catch (e) {
          console.error('Error fetching user info', e);
        }
        this._loadReferralsFromDB();
      } else {
        this.referralList = [];
        this.userInfo = null;
        this._clearReferralMarkers();
      }
    });
  }

  disconnectedCallback() {
    window.removeEventListener('language-changed', this._handleLangChange);
    this._stopRotation();
    document.removeEventListener('fullscreenchange', this._handleFullscreenChange);
    super.disconnectedCallback();
  }

  private _handleLangChange = (e: Event) => {
    this.lang = (e as CustomEvent).detail;
    this.requestUpdate();
  }

  private toggleLang() {
    this.lang = this.lang === 'vi' ? 'en' : 'vi';
    setLanguage(this.lang);
  }

  // Google Maps: Instance of the Google Maps 3D map.
  private map?: any;
  // Google Maps: Instance of the Google Maps Geocoding service.
  private geocoder?: any;
  // Google Maps: Instance of the current map marker (Marker3DElement).
  private marker?: any;

  // Google Maps: References to 3D map element constructors.
  private Map3DElement?: any;
  private Marker3DElement?: any;
  private Polyline3DElement?: any;

  // Google Maps: Instance of the Google Maps Directions service.
  private directionsService?: any;
  // Google Maps: Instance of the current route polyline.
  private routePolyline?: any;
  // Google Maps: Markers for origin and destination of a route.
  private originMarker?: any;
  private destinationMarker?: any;

  sendMessageHandler?: CallableFunction;

  constructor() {
    super();
    // Set initial input from a random example prompt
    this.setNewRandomPrompt();
    this.loadSavedPlaces();
  }

  createRenderRoot() {
    return this;
  }

  protected updated(changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>) {
    super.updated(changedProperties);
    if (!this.mapInitialized && this.isAuthReady && this.mapContainerElement) {
      this.loadMap();
    }
  }

  protected firstUpdated(
    _changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>,
  ): void {
    // Moved to updated
  }

  /**
   * Sets the input message to a new random prompt from EXAMPLE_PROMPTS.
   */
  private setNewRandomPrompt() {
    if (EXAMPLE_PROMPTS.length > 0) {
      this.inputMessage =
        EXAMPLE_PROMPTS[Math.floor(Math.random() * EXAMPLE_PROMPTS.length)];
    }
  }

  /**
   * Google Maps: Loads the Google Maps JavaScript API using the JS API Loader.
   * It initializes necessary map services like Geocoding and Directions,
   * and imports 3D map elements (Map3DElement, Marker3DElement, Polyline3DElement).
   * Handles API key validation and error reporting.
   */
  async loadMap() {
    const isApiKeyPlaceholder =
      USER_PROVIDED_GOOGLE_MAPS_API_KEY ===
        'YOUR_ACTUAL_GOOGLE_MAPS_API_KEY_REPLACE_ME' ||
      USER_PROVIDED_GOOGLE_MAPS_API_KEY === '';

    if (isApiKeyPlaceholder) {
      this.mapError = `Chưa cấu hình Google Maps API Key.
Hãy thêm dòng "VITE_GOOGLE_MAPS_API_KEY=<khoá-của-bạn>" vào file .env ở
thư mục gốc dự án, rồi khởi động lại "npm run dev". Khoá này cần được bật
"Maps JavaScript API" và có billing account (3D Maps hiện đang ở Preview,
miễn phí, nhưng vẫn cần bật trên Cloud project).`;
      console.error(this.mapError);
      this.requestUpdate();
      return;
    }

    const loader = new Loader({
      apiKey: USER_PROVIDED_GOOGLE_MAPS_API_KEY,
      version: 'beta', // Using 'beta' for Photorealistic 3D Maps features
      libraries: ['geocoding', 'routes', 'geometry'], // Request necessary libraries
    });

    try {
      await loader.load();
      // Google Maps: Import 3D map specific library elements.
      const maps3dLibrary = await (window as any).google.maps.importLibrary(
        'maps3d',
      );
      this.Map3DElement = maps3dLibrary.Map3DElement;
      this.Marker3DElement = maps3dLibrary.Marker3DElement;
      this.Polyline3DElement = maps3dLibrary.Polyline3DElement;
      
      await customElements.whenDefined('gmp-map-3d');

      if ((window as any).google && (window as any).google.maps) {
        // Google Maps: Initialize the DirectionsService.
        this.directionsService = new (
          window as any
        ).google.maps.DirectionsService();
      } else {
        console.error('DirectionsService not loaded.');
      }

      // Google Maps: Initialize the map itself.
      this.initializeMap();
      this.mapInitialized = true;
      this.mapError = '';
    } catch (error) {
      console.error('Error loading Google Maps API:', error);
      this.mapError =
        'Could not load Google Maps. Check console for details and ensure API key is correct. If using 3D features, ensure any necessary Map ID is correctly configured if required programmatically.';
      this.mapInitialized = false;
    }
    this.requestUpdate();
  }

  /**
   * Google Maps: Initializes the map instance and the Geocoder service.
   * This is called after the Google Maps API has been successfully loaded.
   */
  initializeMap() {
    if (!this.mapContainerElement || !this.Map3DElement) {
      console.error('Map container or Map3DElement class not ready.', { mapContainerElement: !!this.mapContainerElement, Map3DElement: !!this.Map3DElement });
      return;
    }
    // Google Maps: Assign the <gmp-map-3d> element to the map property.
    this.map = this.mapContainerElement;
    if ((window as any).google && (window as any).google.maps) {
      // Google Maps: Initialize the Geocoder.
      this.geocoder = new (window as any).google.maps.Geocoder();
    } else {
      console.error('Geocoder not loaded.');
    }

    // Clear selected referral popover when user clicks on the map background, or measure distance if in measuring mode
    const handleMapClick = (evt: any) => {
      if (this.isMeasuringMode) {
        this.handleMapClickForMeasurement(evt);
        return;
      }
      this.selectedReferral = null;
    };
    this.map.addEventListener('click', handleMapClick);
    this.map.addEventListener('gmp-click', handleMapClick);

    // Google Maps: <gmp-map-3d> does not reject the loader promise on
    // auth/config failures (invalid key, referrer not allowed, API not
    // enabled, billing disabled, etc.) — it just fails to render tiles.
    // Surface those failures in the UI instead of showing a silent blank
    // globe.
    this.map.addEventListener('gmp-error', (evt: any) => {
      console.error('gmp-map-3d error:', evt?.error || evt);
      this.mapError = `Google 3D Map báo lỗi khi tải: ${
        evt?.error?.message || 'không rõ nguyên nhân'
      }. Kiểm tra: API key có đúng dự án, "Maps JavaScript API" đã bật, có
billing account, và HTTP referrer restriction (nếu có) cho phép domain
đang chạy app.`;
      this.requestUpdate();
    });

    // Load referrals and set markers
    this._loadReferralsFromDB();
  }

  private async _loadReferralsFromDB() {
    try {
      this.referralList = await getReferredUsers();
      this._updateReferralMarkers();
      this.requestUpdate();
    } catch (e) {
      console.error('Error loading referrals in MapApp:', e);
    }
  }

  private _clearReferralMarkers() {
    if (this._referralMarkers && this._referralMarkers.length > 0) {
      this._referralMarkers.forEach(m => {
        try {
          m.remove();
        } catch (e) {
          console.warn('Error removing marker:', e);
        }
      });
    }
    this._referralMarkers = [];
  }

  private async _updateReferralMarkers() {
    if (!this.mapInitialized || !this.map || !this.Marker3DElement) {
      return;
    }

    // Always clear existing referral markers first
    this._clearReferralMarkers();

    if (!this.showReferralMarkers) {
      return;
    }

    // Generate markers for each user
    this.referralList.forEach(user => {
      if (user.latitude !== undefined && user.longitude !== undefined) {
        try {
          const marker = new this.Marker3DElement();
          marker.position = { lat: user.latitude, lng: user.longitude, altitude: 0 };
          
          let labelText = '';
          if (this.showLocationLabels) {
            const name = user.username || 'User';
            const reward = user.reward || 0;
            const style = this.labelStyle;
            
            if (this.visualizationMode === 'pins') {
                if (style === 'Simple') labelText = `${name} (${reward} pts) 📍`;
                else if (style === 'Bubble') labelText = `💬 ${name} (${reward} pts)`;
                else labelText = `${name}`;
            } else {
                if (style === 'Simple') labelText = `🔥 ${reward} pts`;
                else if (style === 'Bubble') labelText = `🔥 ${name}`;
                else labelText = `${reward}`;
            }
          }
          marker.label = labelText;
          
          if (this.visualizationMode === 'pins') {
            marker.style = {
              color: {r: 0, g: 191, b: 255, a: 1}, // Deep Sky Blue for clean Pins
            };
          } else {
            // Heat / glowing dots mode: hot coral color
            marker.style = {
              color: {r: 255, g: 69, b: 0, a: 0.95}, // Orange Red heatmap dot
            };
          }

          const onMarkerClick = (evt: Event) => {
            if (evt && typeof evt.stopPropagation === 'function') {
              evt.stopPropagation();
            }
            this.flyToReferral(user);
          };

          marker.addEventListener('click', onMarkerClick);
          marker.addEventListener('gmp-click', onMarkerClick);

          this.map.appendChild(marker);
          this._referralMarkers.push(marker);
        } catch (e) {
          console.error('Error creating referral marker:', e);
        }
      }
    });
  }

  toggleReferralMarkers(e: Event) {
    const checkbox = e.target as HTMLInputElement;
    this.showReferralMarkers = checkbox.checked;
    this._updateReferralMarkers();
  }

  setVisualizationMode(mode: 'pins' | 'heat') {
    this.visualizationMode = mode;
    this._updateReferralMarkers();
  }

  toggleCinematicFlight(e: Event) {
    const checkbox = e.target as HTMLInputElement;
    this.cinematicFlight = checkbox.checked;
  }

  async login() {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Error signing in', error);
    }
  }

  private _handleFullscreenChange = () => {
    this.isFullscreen = !!document.fullscreenElement;
  };

  toggleFullscreen() {
    const container = this.querySelector('.main-container');
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  }

  toggleAutoRotate(e: Event) {
    const checkbox = e.target as HTMLInputElement;
    this.autoRotate = checkbox.checked;
    if (this.autoRotate) {
      try {
        if (typeof this.map?.stopCameraAnimation === 'function') {
          this.map.stopCameraAnimation();
        }
      } catch (err) {
        console.warn('Could not stop camera animation:', err);
      }
      this._startRotation();
    } else {
      this._stopRotation();
    }
  }

  private _startRotation() {
    this._stopRotation();
    this._animateRotation();
  }

  private _stopRotation() {
    if (this._rotateFrameId !== null) {
      cancelAnimationFrame(this._rotateFrameId);
      this._rotateFrameId = null;
    }
  }

  private _animateRotation() {
    if (!this.autoRotate || !this.map) {
      return;
    }
    try {
      const currentHeading = this.map.heading ?? 0;
      // Increment slowly. 0.08 degrees per frame is very smooth.
      this.map.heading = (currentHeading + 0.08) % 360;
    } catch (e) {
      console.error('Error in auto-rotate animation:', e);
    }
    this._rotateFrameId = requestAnimationFrame(() => this._animateRotation());
  }

  private _stopAutoRotateIfActive() {
    if (this.autoRotate) {
      this.autoRotate = false;
      this._stopRotation();
    }
  }

  clearMeasurement() {
    this.measurePointA = null;
    this.measurePointB = null;
    this.measureDistance = null;
    if (this._measureMarkerA) {
      try {
        this._measureMarkerA.remove();
      } catch (e) {}
      this._measureMarkerA = null;
    }
    if (this._measureMarkerB) {
      try {
        this._measureMarkerB.remove();
      } catch (e) {}
      this._measureMarkerB = null;
    }
    if (this._measurePolyline) {
      try {
        this._measurePolyline.remove();
      } catch (e) {}
      this._measurePolyline = null;
    }
  }

  calculateDistance(pos1: { lat: number; lng: number }, pos2: { lat: number; lng: number }): number {
    if (
      (window as any).google &&
      (window as any).google.maps &&
      (window as any).google.maps.geometry &&
      (window as any).google.maps.geometry.spherical
    ) {
      const p1 = new (window as any).google.maps.LatLng(pos1.lat, pos1.lng);
      const p2 = new (window as any).google.maps.LatLng(pos2.lat, pos2.lng);
      return (window as any).google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
    }
    // Fallback: Haversine formula
    const R = 6371000; // earth radius in meters
    const dLat = ((pos2.lat - pos1.lat) * Math.PI) / 180;
    const dLng = ((pos2.lng - pos1.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((pos1.lat * Math.PI) / 180) *
        Math.cos((pos2.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  handleMapClickForMeasurement(evt: any) {
    let lat: number | undefined;
    let lng: number | undefined;
    if (evt.position) {
      lat = typeof evt.position.lat === 'function' ? evt.position.lat() : evt.position.lat;
      lng = typeof evt.position.lng === 'function' ? evt.position.lng() : evt.position.lng;
    } else if (evt.latLng) {
      lat = evt.latLng.lat();
      lng = evt.latLng.lng();
    }

    if (lat === undefined || lng === undefined) {
      console.warn('Click coordinate not found', evt);
      return;
    }

    if (!this.measurePointA) {
      // First point
      this.measurePointA = { lat, lng };
      if (this.Marker3DElement) {
        try {
          this._measureMarkerA = new this.Marker3DElement();
          this._measureMarkerA.position = { lat, lng, altitude: 0 };
          this._measureMarkerA.label = '📏 Point A';
          this._measureMarkerA.style = {
            color: { r: 59, g: 130, b: 246, a: 1 }, // Tailwind blue-500
          };
          this.map.appendChild(this._measureMarkerA);
        } catch (e) {
          console.error('Error creating measure marker A:', e);
        }
      }
    } else if (!this.measurePointB) {
      // Second point
      this.measurePointB = { lat, lng };
      if (this.Marker3DElement) {
        try {
          this._measureMarkerB = new this.Marker3DElement();
          this._measureMarkerB.position = { lat, lng, altitude: 0 };
          this._measureMarkerB.label = '📏 Point B';
          this._measureMarkerB.style = {
            color: { r: 16, g: 185, b: 129, a: 1 }, // Tailwind emerald-500
          };
          this.map.appendChild(this._measureMarkerB);
        } catch (e) {
          console.error('Error creating measure marker B:', e);
        }
      }

      // Draw polyline
      if (this.Polyline3DElement) {
        try {
          this._measurePolyline = new this.Polyline3DElement();
          this._measurePolyline.coordinates = [
            { lat: this.measurePointA.lat, lng: this.measurePointA.lng, altitude: 5 },
            { lat: this.measurePointB.lat, lng: this.measurePointB.lng, altitude: 5 },
          ];
          this._measurePolyline.strokeColor = '#3b82f6'; // blue-500
          this._measurePolyline.strokeWidth = 8;
          this.map.appendChild(this._measurePolyline);
        } catch (e) {
          console.error('Error creating measure polyline:', e);
        }
      }

      // Calculate distance
      this.measureDistance = this.calculateDistance(this.measurePointA, this.measurePointB);
    } else {
      // Reset and start over with Point A
      this.clearMeasurement();
      this.measurePointA = { lat, lng };
      if (this.Marker3DElement) {
        try {
          this._measureMarkerA = new this.Marker3DElement();
          this._measureMarkerA.position = { lat, lng, altitude: 0 };
          this._measureMarkerA.label = '📏 Point A';
          this._measureMarkerA.style = {
            color: { r: 59, g: 130, b: 246, a: 1 },
          };
          this.map.appendChild(this._measureMarkerA);
        } catch (e) {
          console.error('Error creating measure marker A:', e);
        }
      }
    }
  }

  loadSavedPlaces() {
    try {
      const stored = localStorage.getItem('gdm-saved-places');
      if (stored) {
        this.savedPlaces = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load saved places', e);
    }
  }

  saveSavedPlaces() {
    try {
      localStorage.setItem('gdm-saved-places', JSON.stringify(this.savedPlaces));
    } catch (e) {
      console.error('Failed to save saved places', e);
    }
  }

  isReferralFavorited(user: ReferredUser): boolean {
    if (!user || user.latitude === undefined || user.longitude === undefined) return false;
    return this.savedPlaces.some(place => 
      Math.abs(place.lat - user.latitude) < 0.0001 && 
      Math.abs(place.lng - user.longitude) < 0.0001
    );
  }

  toggleFavoriteReferral(user: ReferredUser, e: Event) {
    if (e) {
      e.stopPropagation();
    }
    const isFavorited = this.isReferralFavorited(user);
    if (isFavorited) {
      this.savedPlaces = this.savedPlaces.filter(place => 
        !(Math.abs(place.lat - user.latitude) < 0.0001 && 
          Math.abs(place.lng - user.longitude) < 0.0001)
      );
    } else {
      const newPlace: SavedPlace = {
        id: `ref-${user.username}-${Date.now()}`,
        name: user.locationName || `${user.username}'s Location`,
        lat: user.latitude,
        lng: user.longitude,
        description: `Checked in for milestone: ${user.milestone || 'Registered'}`,
        savedAt: new Date().toLocaleDateString()
      };
      this.savedPlaces = [...this.savedPlaces, newPlace];
    }
    this.saveSavedPlaces();
  }

  flyToSavedPlace(place: SavedPlace) {
    if (!this.map) return;
    this._stopAutoRotateIfActive();
    
    const cameraOptions = {
      center: { lat: place.lat, lng: place.lng, altitude: 0 },
      heading: 45,
      tilt: 65,
      range: 1500,
    };
    
    try {
      if (typeof this.map.flyCameraTo === 'function') {
        this.map.flyCameraTo(cameraOptions);
      }
    } catch (e) {
      console.error('Error flying to saved place:', e);
    }
  }

  deleteSavedPlace(id: string, e: Event) {
    if (e) {
      e.stopPropagation();
    }
    this.savedPlaces = this.savedPlaces.filter(place => place.id !== id);
    this.saveSavedPlaces();
  }

  async flyToReferral(user: ReferredUser) {
    if (!this.map || user.latitude === undefined || user.longitude === undefined) {
      return;
    }

    this._stopAutoRotateIfActive();

    // Clean up any pending transition handlers and stop current animation
    if (this._stage1EndHandler) {
      try {
        this.map.removeEventListener('gmp-animationend', this._stage1EndHandler);
      } catch (err) {
        console.warn('Could not remove previous listener:', err);
      }
      this._stage1EndHandler = null;
    }

    try {
      if (typeof this.map.stopCameraAnimation === 'function') {
        this.map.stopCameraAnimation();
      }
    } catch (e) {
      console.warn('stopCameraAnimation failed or not supported:', e);
    }

    const targetCameraOptions = {
      center: { lat: user.latitude, lng: user.longitude, altitude: 0 },
      heading: 45,
      tilt: 65,
      range: 1500, // Distance from target in meters
    };

    // If cinematic flight is disabled, do a direct linear transition
    if (!this.cinematicFlight) {
      try {
        this.map.flyCameraTo({
          endCamera: targetCameraOptions,
          durationMillis: 2500,
        });
      } catch (e) {
        console.error('Error in standard flight:', e);
      }
      return;
    }

    // Cinematic curved flight path calculation
    const startCam = this.map.camera;
    const startLat = startCam?.center?.lat ?? user.latitude;
    const startLng = startCam?.center?.lng ?? user.longitude;

    const dLat = user.latitude - startLat;
    const dLng = user.longitude - startLng;
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);

    // If the movement is very small, a 2-stage flight is unnecessary and might jitter
    if (dist < 0.05) {
      try {
        this.map.flyCameraTo({
          endCamera: targetCameraOptions,
          durationMillis: 2000,
        });
      } catch (e) {
        console.error('Error in micro flight:', e);
      }
      return;
    }

    // Midpoint of the flight path
    const midLat = (startLat + user.latitude) / 2;
    const midLng = (startLng + user.longitude) / 2;

    // Perpendicular vector offset to create a beautiful curve (arc lateral deviation)
    // Scale is proportional to the distance traveled to look elegant on all zoom scales
    const offsetScale = 0.18; 
    const offsetLat = -dLng * offsetScale;
    const offsetLng = dLat * offsetScale;

    const apexLat = midLat + offsetLat;
    const apexLng = midLng + offsetLng;

    // Dynamic peak height based on distance, capped to high altitude
    const baseRange = Math.max(startCam?.range ?? 2000, 2000);
    const apexRange = Math.min(8000000, baseRange + dist * 120000);

    // Calculate facing direction heading along the curved sweep
    const travelHeading = (Math.atan2(dLng, dLat) * 180) / Math.PI;
    const startHeading = startCam?.heading ?? 0;
    // Slightly shift heading of final destination for rich 3D perception
    const endHeading = travelHeading + 45; 

    // Apex heading is a smooth interpolation between start and final heading
    const apexHeading = (startHeading + endHeading) / 2;
    const apexTilt = Math.max(30, Math.min(45, (startCam?.tilt ?? 45) - 10)); // Flatten slightly at apex to capture the curve of the Earth

    const apexCamera = {
      center: { lat: apexLat, lng: apexLng, altitude: 0 },
      heading: apexHeading,
      tilt: apexTilt,
      range: apexRange,
    };

    const finalCamera = {
      center: { lat: user.latitude, lng: user.longitude, altitude: 0 },
      heading: endHeading,
      tilt: 65,
      range: 1500,
    };

    // Allocate total cinematic flight time dynamically based on geographical distance
    const totalDuration = Math.min(6500, Math.max(3200, dist * 220 + 2500));
    const stage1Duration = totalDuration * 0.45;
    const stage2Duration = totalDuration * 0.55;

    // We define our completion callback for Stage 1
    const stage1EndHandler = () => {
      // Clear listener reference
      this._stage1EndHandler = null;
      try {
        this.map.flyCameraTo({
          endCamera: finalCamera,
          durationMillis: stage2Duration,
        });
      } catch (e) {
        console.error('Error executing flyToReferral Stage 2:', e);
      }
    };

    this._stage1EndHandler = stage1EndHandler;

    try {
      // Attach transition end listener and execute Stage 1
      this.map.addEventListener('gmp-animationend', this._stage1EndHandler, { once: true });
      
      this.map.flyCameraTo({
        endCamera: apexCamera,
        durationMillis: stage1Duration,
      });

    } catch (e) {
      console.error('Error starting cinematic flight (Stage 1):', e);
      // Clean up on immediate error
      if (this._stage1EndHandler) {
        this.map.removeEventListener('gmp-animationend', this._stage1EndHandler);
        this._stage1EndHandler = null;
      }
      // Fallback straight flight
      try {
        this.map.flyCameraTo({
          endCamera: finalCamera,
          durationMillis: 2500,
        });
      } catch (fallbackErr) {
        console.error('Fallback direct flight failed:', fallbackErr);
      }
    }
  }

  async flyToAllReferrals() {
    if (!this.map || this.referralList.length === 0) {
      return;
    }

    this._stopAutoRotateIfActive();

    const validUsers = this.referralList.filter(u => u.latitude !== undefined && u.longitude !== undefined);
    if (validUsers.length === 0) return;

    // Calculate bounding box or average center
    let minLat = Infinity, maxLat = -Infinity;
    let minLng = Infinity, maxLng = -Infinity;
    let sumLat = 0, sumLng = 0;

    validUsers.forEach(u => {
      const lat = u.latitude!;
      const lng = u.longitude!;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      sumLat += lat;
      sumLng += lng;
    });

    const avgLat = sumLat / validUsers.length;
    const avgLng = sumLng / validUsers.length;

    // Range depends on the spread of the coordinates
    const latSpread = maxLat - minLat;
    const lngSpread = maxLng - minLng;
    const spread = Math.max(latSpread, lngSpread);
    
    // Convert degrees spread to range in meters (roughly 111,000 meters per degree, let's scale it elegantly)
    const range = Math.max(1500, Math.min(20000000, spread * 150000 + 4000000));

    const cameraOptions = {
      center: { lat: avgLat, lng: avgLng, altitude: 0 },
      heading: 0,
      tilt: 45,
      range: range,
    };

    try {
      this.map.flyCameraTo({
        endCamera: cameraOptions,
        durationMillis: 3000,
      });
    } catch (e) {
      console.error('Error flying to all referrals overview:', e);
    }
  }

  setChatState(state: ChatState) {
    this.chatState = state;
  }

  /**
   * Google Maps: Clears existing map elements like markers and polylines
   * before adding new ones. This ensures the map doesn't get cluttered with
   * old search results or routes.
   */
  private _clearMapElements() {
    if (this.marker) {
      this.marker.remove();
      this.marker = undefined;
    }
    if (this.routePolyline) {
      this.routePolyline.remove();
      this.routePolyline = undefined;
    }
    if (this.originMarker) {
      this.originMarker.remove();
      this.originMarker = undefined;
    }
    if (this.destinationMarker) {
      this.destinationMarker.remove();
      this.destinationMarker = undefined;
    }
  }

  /**
   * Google Maps: Handles viewing a specific location on the map.
   * It uses the Geocoding service to find coordinates for the `locationQuery`,
   * then flies the camera to that location and places a 3D marker.
   * @param locationQuery The string query for the location (e.g., "Eiffel Tower").
   */
  private async _handleViewLocation(locationQuery: string) {
    if (
      !this.mapInitialized ||
      !this.map ||
      !this.geocoder ||
      !this.Marker3DElement
    ) {
      if (!this.mapError) {
        const {textElement} = this.addMessage('error', 'Processing error...');
        textElement.innerHTML = await marked.parse(
          'Map is not ready to display locations. Please check configuration.',
        );
      }
      console.warn(
        'Map not initialized, geocoder or Marker3DElement not available, cannot render query.',
      );
      return;
    }
    this._clearMapElements(); // Google Maps: Clear previous elements.

    // Google Maps: Use Geocoding service to find the location.
    this.geocoder.geocode(
      {address: locationQuery},
      async (results: any, status: string) => {
        if (status === 'OK' && results && results[0] && this.map) {
          const location = results[0].geometry.location;

          // Google Maps: Define camera options and fly to the location.
          const cameraOptions = {
            center: {lat: location.lat(), lng: location.lng(), altitude: 0},
            heading: 0,
            tilt: 67.5,
            range: 2000, // Distance from the target in meters
          };
          (this.map as any).flyCameraTo({
            endCamera: cameraOptions,
            durationMillis: 1500,
          });

          // Google Maps: Create and add a 3D marker to the map.
          this.marker = new this.Marker3DElement();
          this.marker.position = {
            lat: location.lat(),
            lng: location.lng(),
            altitude: 0,
          };
          const label =
            locationQuery.length > 30
              ? locationQuery.substring(0, 27) + '...'
              : locationQuery;
          this.marker.label = label;
          (this.map as any).appendChild(this.marker);
        } else {
          console.error(
            `Geocode was not successful for "${locationQuery}". Reason: ${status}`,
          );
          const rawErrorMessage = `Could not find location: ${locationQuery}. Reason: ${status}`;
          const {textElement} = this.addMessage('error', 'Processing error...');
          textElement.innerHTML = await marked.parse(rawErrorMessage);
        }
      },
    );
  }

  /**
   * Google Maps: Handles displaying directions between an origin and destination.
   * It uses the DirectionsService to calculate the route, then draws a 3D polyline
   * for the route and places 3D markers at the origin and destination.
   * The camera is adjusted to fit the entire route.
   * @param originQuery The starting point for directions.
   * @param destinationQuery The ending point for directions.
   */
  private async _handleDirections(
    originQuery: string,
    destinationQuery: string,
  ) {
    if (
      !this.mapInitialized ||
      !this.map ||
      !this.directionsService ||
      !this.Marker3DElement ||
      !this.Polyline3DElement
    ) {
      if (!this.mapError) {
        const {textElement} = this.addMessage('error', 'Processing error...');
        textElement.innerHTML = await marked.parse(
          'Map is not ready for directions. Please check configuration.',
        );
      }
      console.warn(
        'Map not initialized or DirectionsService/3D elements not available, cannot render directions.',
      );
      return;
    }
    this._clearMapElements(); // Google Maps: Clear previous elements.

    // Google Maps: Use DirectionsService to get the route.
    this.directionsService.route(
      {
        origin: originQuery,
        destination: destinationQuery,
        travelMode: (window as any).google.maps.TravelMode.DRIVING,
      },
      async (response: any, status: string) => {
        if (
          status === 'OK' &&
          response &&
          response.routes &&
          response.routes.length > 0
        ) {
          const route = response.routes[0];

          // Google Maps: Draw the route polyline using Polyline3DElement.
          if (route.overview_path && this.Polyline3DElement) {
            const pathCoordinates = route.overview_path.map((p: any) => ({
              lat: p.lat(),
              lng: p.lng(),
              altitude: 5,
            })); // Add slight altitude
            this.routePolyline = new this.Polyline3DElement();
            this.routePolyline.coordinates = pathCoordinates;
            this.routePolyline.strokeColor = 'blue';
            this.routePolyline.strokeWidth = 10;
            (this.map as any).appendChild(this.routePolyline);
          }

          // Google Maps: Add marker for the origin.
          if (
            route.legs &&
            route.legs[0] &&
            route.legs[0].start_location &&
            this.Marker3DElement
          ) {
            const originLocation = route.legs[0].start_location;
            this.originMarker = new this.Marker3DElement();
            this.originMarker.position = {
              lat: originLocation.lat(),
              lng: originLocation.lng(),
              altitude: 0,
            };
            this.originMarker.label = 'Origin';
            this.originMarker.style = {
              color: {r: 0, g: 128, b: 0, a: 1}, // Green
            };
            (this.map as any).appendChild(this.originMarker);
          }

          // Google Maps: Add marker for the destination.
          if (
            route.legs &&
            route.legs[0] &&
            route.legs[0].end_location &&
            this.Marker3DElement
          ) {
            const destinationLocation = route.legs[0].end_location;
            this.destinationMarker = new this.Marker3DElement();
            this.destinationMarker.position = {
              lat: destinationLocation.lat(),
              lng: destinationLocation.lng(),
              altitude: 0,
            };
            this.destinationMarker.label = 'Destination';
            this.destinationMarker.style = {
              color: {r: 255, g: 0, b: 0, a: 1}, // Red
            };
            (this.map as any).appendChild(this.destinationMarker);
          }

          // Google Maps: Adjust camera to fit the route bounds.
          if (route.bounds) {
            const bounds = route.bounds;
            const center = bounds.getCenter();
            let range = 10000; // Default range

            // Calculate a more appropriate range based on the route's diagonal distance
            if (
              (window as any).google.maps.geometry &&
              (window as any).google.maps.geometry.spherical
            ) {
              const spherical = (window as any).google.maps.geometry.spherical;
              const ne = bounds.getNorthEast();
              const sw = bounds.getSouthWest();
              const diagonalDistance = spherical.computeDistanceBetween(ne, sw);
              range = diagonalDistance * 1.7; // Multiplier to ensure bounds are visible
            } else {
              console.warn(
                'google.maps.geometry.spherical not available for range calculation. Using fallback range.',
              );
            }

            range = Math.max(range, 2000); // Ensure a minimum sensible range

            const cameraOptions = {
              center: {lat: center.lat(), lng: center.lng(), altitude: 0},
              heading: 0,
              tilt: 45, // Tilt for better 3D perspective of the route
              range: range,
            };
            (this.map as any).flyCameraTo({
              endCamera: cameraOptions,
              durationMillis: 2000,
            });
          }
        } else {
          console.error(
            `Directions request failed. Origin: "${originQuery}", Destination: "${destinationQuery}". Status: ${status}. Response:`,
            response,
          );
          const rawErrorMessage = `Could not get directions from "${originQuery}" to "${destinationQuery}". Reason: ${status}`;
          const {textElement} = this.addMessage('error', 'Processing error...');
          textElement.innerHTML = await marked.parse(rawErrorMessage);
        }
      },
    );
  }

  /**
   * Google Maps: This function is the primary interface for the MCP server (via index.tsx)
   * to trigger updates on the Google Map. When the AI model uses a map-related tool
   * (e.g., view location, get directions), the MCP server processes this request
   * and calls this function with the appropriate parameters.
   *
   * Based on the `params` received, this function will:
   * - If `params.location` is present, call `_handleViewLocation` to show a specific place.
   * - If `params.origin` and `params.destination` are present, call `_handleDirections`
   *   to display a route.
   * - If only `params.destination` is present (as a fallback), it will treat it as a location to view.
   *
   * This mechanism allows the AI's tool usage to be directly reflected on the map UI.
   * @param params An object containing parameters for the map query, like
   *               `location`, `origin`, or `destination`.
   */
  async handleMapQuery(params: MapParams) {
    this._stopAutoRotateIfActive();

    if (params.location) {
      this._handleViewLocation(params.location);
    } else if (params.origin && params.destination) {
      this._handleDirections(params.origin, params.destination);
    } else if (params.destination) {
      // Fallback if only destination is provided, treat as viewing a location
      this._handleViewLocation(params.destination);
    }
  }

  setInputField(message: string) {
    this.inputMessage = message.trim();
  }

  addMessage(role: string, message: string) {
    const div = document.createElement('div');
    div.classList.add('turn');
    div.classList.add(`role-${role.trim()}`);
    div.setAttribute('aria-live', 'polite');

    const thinkingDetails = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = 'Thinking process';
    thinkingDetails.classList.add('thinking');
    thinkingDetails.setAttribute('aria-label', 'Model thinking process');
    const thinkingElement = document.createElement('div');
    thinkingDetails.append(summary);
    thinkingDetails.append(thinkingElement);
    div.append(thinkingDetails);

    const textElement = document.createElement('div');
    textElement.className = 'text';
    textElement.innerHTML = message;
    div.append(textElement);

    this.messages = [...this.messages, div];
    this.scrollToTheEnd();
    return {
      thinkingContainer: thinkingDetails,
      thinkingElement: thinkingElement,
      textElement: textElement,
    };
  }

  scrollToTheEnd() {
    if (!this.anchor) return;
    this.anchor.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    });
  }

  async sendMessageAction(message?: string, role?: string) {
    if (this.chatState !== ChatState.IDLE) return;

    let msg = '';
    let usedComponentInput = false; // Flag to track if component's input was used

    if (message) {
      // Message is provided programmatically
      msg = message.trim();
    } else {
      // Message from the UI input field
      msg = this.inputMessage.trim();
      // Clear the input field state only if we are using its content
      // and there was actual content to send.
      if (msg.length > 0) {
        this.inputMessage = '';
        usedComponentInput = true;
      } else if (
        this.inputMessage.trim().length === 0 &&
        this.inputMessage.length > 0
      ) {
        // If inputMessage contained only whitespace, clear it and mark as used.
        this.inputMessage = '';
        usedComponentInput = true;
      }
    }

    if (msg.length === 0) {
      // If the final message to send is empty (e.g., user entered only spaces, or an empty programmatic message)
      // set a new random prompt if the component's input was cleared.
      if (usedComponentInput) {
        this.setNewRandomPrompt();
      }
      return;
    }

    const msgRole = role ? role.toLowerCase() : 'user';

    // Add user's message to the chat display
    if (msgRole === 'user' && msg) {
      const {textElement} = this.addMessage(msgRole, '...');
      textElement.innerHTML = await marked.parse(msg);
    }

    // Send the message via the handler (to AI)
    if (this.sendMessageHandler) {
      await this.sendMessageHandler(msg, msgRole);
    }

    // If the component's main input field was used and cleared, set a new random prompt.
    if (usedComponentInput) {
      this.setNewRandomPrompt();
    }
  }

  private async inputKeyDownAction(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.sendMessageAction();
    }
  }

  render() {
    if (!this.isAuthReady) {
      return html`<div style="display: flex; height: 100vh; align-items: center; justify-content: center; font-family: sans-serif; color: #666;">Loading...</div>`;
    }

    // Google Maps: Initial camera parameters for the <gmp-map-3d> element.
    const initialCenter = '0,0,100'; // lat,lng,altitude
    const initialRange = '20000000'; // View range in meters
    const initialTilt = '45'; // Camera tilt in degrees
    const initialHeading = '0'; // Camera heading in degrees

    return html`<div class="gdm-map-app">
      <div
        class="main-container"
        role="application"
        aria-label="Interactive Map Area">
        ${this.mapError
          ? html`<div
              class="map-error-message"
              role="alert"
              aria-live="assertive"
              >${this.mapError}</div
            >`
          : ''}
        <!-- Google Maps: The core 3D Map custom element -->
        <gmp-map-3d
          id="mapContainer"
          style="height: 100%; width: 100%;"
          aria-label="Google Photorealistic 3D Map Display"
          mode="hybrid"
          center="${initialCenter}"
          heading="${initialHeading}"
          tilt="${initialTilt}"
          range="${initialRange}"
          internal-usage-attribution-ids="gmp_aistudio_threedmapjsmcp_v0.1_showcase"
          default-ui-disabled="true"
          role="application">
        </gmp-map-3d>
        
        <!-- Fullscreen Toggle Button -->
        <button style="margin-right: 5px; background: #555; color: #fff; border: none; padding: 5px 10px; cursor: pointer;" @click=${this.toggleLang}>
          ${this.lang === 'vi' ? 'English' : 'Tiếng Việt'}
        </button>
        <button 
          class="map-fullscreen-btn" 
          @click=${this.toggleFullscreen} 
          aria-label="Toggle Fullscreen Mode"
          title="${this.isFullscreen ? t('exitFullscreen') : t('enterFullscreen')}">
          ${this.isFullscreen ? html`
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm11 0h-3V5h-2v5h5V8zm-2 11h2v-2h-5v5h2v-3z"/>
            </svg>
          ` : html`
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
            </svg>
          `}
        </button>

        <!-- Floating Referral Overlay Widget -->
        <div class="referrals-overlay-panel">
          <div class="overlay-header">
            <div class="overlay-header-left">
              <svg viewBox="0 0 24 24" class="overlay-icon">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
              <span class="overlay-title">${t('referrals_overlay')}</span>
            </div>
            <label class="switch">
              <input 
                type="checkbox" 
                .checked=${this.showReferralMarkers} 
                @change=${this.toggleReferralMarkers}
              />
              <span class="slider"></span>
            </label>
          </div>

          ${this.showReferralMarkers ? html`
            <div class="overlay-body">
              <!-- Mode Selection -->
              <div class="mode-selectors">
                <button 
                  class="mode-btn ${this.visualizationMode === 'pins' ? 'active' : ''}" 
                  @click=${() => this.setVisualizationMode('pins')}>
                  📍 ${t('pins')}
                </button>
                <button 
                  class="mode-btn ${this.visualizationMode === 'heat' ? 'active' : ''}" 
                  @click=${() => this.setVisualizationMode('heat')}>
                  🔥 ${t('heat_dots')}
                </button>
              </div>

              <!-- Cinematic Flight Toggle -->
              <div class="transition-selector-row">
                <span class="transition-label">🎬 ${t('cinematic_curved_fly')}</span>
                <label class="switch small-switch">
                  <input 
                    type="checkbox" 
                    .checked=${this.cinematicFlight} 
                    @change=${this.toggleCinematicFlight}
                  />
                  <span class="slider"></span>
                </label>
              </div>

              <!-- Auto-Rotate Toggle -->
              <div class="transition-selector-row">
                <span class="transition-label">🔄 ${t('auto_rotate_camera')}</span>
                <label class="switch small-switch">
                  <input 
                    type="checkbox" 
                    .checked=${this.autoRotate} 
                    @change=${this.toggleAutoRotate}
                  />
                  <span class="slider"></span>
                </label>
              </div>

              <!-- Location Labels Toggle -->
              <div class="transition-selector-row">
                <span class="transition-label">🏷️ ${t('show_location_labels')}</span>
                <label class="switch small-switch">
                  <input 
                    type="checkbox" 
                    .checked=${this.showLocationLabels} 
                    @change=${(e: Event) => {
                      this.showLocationLabels = (e.target as HTMLInputElement).checked;
                      this._updateReferralMarkers();
                    }}
                  />
                  <span class="slider"></span>
                </label>
              </div>

              <!-- Label Style Dropdown -->
              <div class="transition-selector-row">
                <span class="transition-label">🎨 ${t('label_style')}</span>
                <select 
                  class="mode-btn"
                  style="padding: 2px 6px; font-size: 0.75rem;"
                  @change=${(e: Event) => {
                    this.labelStyle = (e.target as HTMLSelectElement).value as 'Simple' | 'Bubble' | 'Minimalist';
                    this._updateReferralMarkers();
                  }}
                >
                  <option value="Simple" ?selected=${this.labelStyle === 'Simple'}>${t('simple')}</option>
                  <option value="Bubble" ?selected=${this.labelStyle === 'Bubble'}>${t('bubble')}</option>
                  <option value="Minimalist" ?selected=${this.labelStyle === 'Minimalist'}>${t('minimalist')}</option>
                </select>
              </div>

              <!-- Distance Measurement Tool -->
              <div class="transition-selector-row flex-col items-stretch gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-700">
                <div class="flex items-center justify-between w-full">
                  <span class="transition-label font-bold flex items-center gap-1.5 text-neutral-800 dark:text-neutral-200">
                    📏 Measure Distance
                  </span>
                  <label class="switch small-switch">
                    <input 
                      type="checkbox" 
                      .checked=${this.isMeasuringMode} 
                      @change=${(e: Event) => {
                        this.isMeasuringMode = (e.target as HTMLInputElement).checked;
                        if (!this.isMeasuringMode) {
                          this.clearMeasurement();
                        }
                      }}
                    />
                    <span class="slider"></span>
                  </label>
                </div>

                ${this.isMeasuringMode ? html`
                  <div class="measurement-panel-inner animate-fade-in text-xs flex flex-col gap-2 mt-1 bg-neutral-100 dark:bg-neutral-800 p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200">
                    <p class="text-neutral-500 dark:text-neutral-400 text-[11px] leading-relaxed m-0">
                      Click two points on the map to measure the real-world distance.
                    </p>
                    
                    <div class="flex flex-col gap-1.5 mt-1">
                      <div class="flex justify-between items-center gap-2">
                        <span class="font-medium text-neutral-500 dark:text-neutral-400">Point A:</span>
                        <span class="font-mono text-[11px] text-right truncate">
                          ${this.measurePointA && typeof this.measurePointA.lat === 'number' && typeof this.measurePointA.lng === 'number'
                            ? `${this.measurePointA.lat.toFixed(4)}°, ${this.measurePointA.lng.toFixed(4)}°`
                            : 'Not Selected'}
                        </span>
                      </div>
                      <div class="flex justify-between items-center gap-2">
                        <span class="font-medium text-neutral-500 dark:text-neutral-400">Point B:</span>
                        <span class="font-mono text-[11px] text-right truncate">
                          ${this.measurePointB && typeof this.measurePointB.lat === 'number' && typeof this.measurePointB.lng === 'number'
                            ? `${this.measurePointB.lat.toFixed(4)}°, ${this.measurePointB.lng.toFixed(4)}°`
                            : 'Not Selected'}
                        </span>
                      </div>
                    </div>

                    ${this.measureDistance !== null && typeof this.measureDistance === 'number' ? html`
                      <div class="mt-1 pt-1.5 border-t border-dashed border-neutral-300 dark:border-neutral-600 flex flex-col gap-1">
                        <div class="flex justify-between items-center">
                          <span class="font-bold text-neutral-700 dark:text-neutral-300 text-xs">Distance:</span>
                          <span class="font-mono text-sm font-extrabold text-blue-600 dark:text-blue-400">
                            ${this.measureDistance < 1000 
                              ? `${this.measureDistance.toFixed(1)} meters` 
                              : `${(this.measureDistance / 1000).toFixed(3)} km`}
                          </span>
                        </div>
                      </div>
                    ` : ''}

                    <div class="flex gap-2 mt-1 w-full">
                      <button class="bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-neutral-700 dark:text-neutral-200 font-bold py-1 px-2.5 rounded transition text-[11px] flex-1 cursor-pointer border-none"
                              @click=${this.clearMeasurement}>
                        Clear Points
                      </button>
                    </div>
                  </div>
                ` : ''}
              </div>

              <!-- Referral List with Fly Buttons -->
              <div class="overlay-list">
                ${this.referralList.length === 0 ? html`
                  <div class="empty-list">No referred users found.</div>
                ` : this.referralList.map(user => html`
                  <div class="overlay-item" @click=${(e: Event) => { e.stopPropagation(); this.flyToReferral(user); }}>
                    <div class="item-info">
                      <div class="item-username">${user.username}</div>
                      <div class="item-location">${user.locationName || 'Unknown Location'}</div>
                      <div class="item-milestone">${user.milestone || 'Registered'}</div>
                    </div>
                    <div class="item-actions">
                      <span class="item-reward">+${user.reward} pts</span>
                      <button class="btn-favorite-item ${this.isReferralFavorited(user) ? 'favorited' : ''}" 
                              @click=${(e: Event) => this.toggleFavoriteReferral(user, e)}
                              title="${this.isReferralFavorited(user) ? 'Remove from Saved Places' : 'Save to Saved Places'}">
                        ⭐
                      </button>
                      <button class="btn-fly" title="Fly camera here">✈️</button>
                    </div>
                  </div>
                `)}
              </div>

              <div class="overlay-footer">
                <button class="btn-fly-all" @click=${this.flyToAllReferrals}>
                  🌐 Fit Map to All Referrals
                </button>
              </div>
            </div>
          ` : html`
            <div class="overlay-disabled-msg">
              Overlay is hidden. Enable the switch above to display referred users on the 3D globe!
            </div>
          `}
        </div>


      </div>
      <div class="sidebar" role="complementary" aria-labelledby="chat-heading">
        <div class="selector" role="tablist" aria-label="Chat providers">
          <button
            id="geminiTab"
            role="tab"
            aria-selected=${this.selectedChatTab === ChatTab.GEMINI}
            aria-controls="chat-panel"
            class=${classMap({
              'selected-tab': this.selectedChatTab === ChatTab.GEMINI,
            })}
            @click=${() => {
              this.selectedChatTab = ChatTab.GEMINI;
            }}>
            <span id="chat-heading">Gemini</span>
          </button>
          <button
            id="affiliateTab"
            role="tab"
            aria-selected=${this.selectedChatTab === ChatTab.AFFILIATE}
            aria-controls="affiliate-panel"
            class=${classMap({
              'selected-tab': this.selectedChatTab === ChatTab.AFFILIATE,
            })}
            @click=${() => {
              this.selectedChatTab = ChatTab.AFFILIATE;
            }}>
            <span>Affiliate</span>
          </button>
          <button
            id="bodyPixelTab"
            role="tab"
            aria-selected=${this.selectedChatTab === ChatTab.BODY_PIXEL}
            aria-controls="body-pixel-panel"
            class=${classMap({
              'selected-tab': this.selectedChatTab === ChatTab.BODY_PIXEL,
            })}
            @click=${() => {
              this.selectedChatTab = ChatTab.BODY_PIXEL;
            }}>
            <span>Body Pixel</span>
          </button>
          <button
            id="bodyCareTab"
            role="tab"
            aria-selected=${this.selectedChatTab === ChatTab.BODY_CARE}
            aria-controls="body-care-panel"
            class=${classMap({
              'selected-tab': this.selectedChatTab === ChatTab.BODY_CARE,
            })}
            @click=${() => {
              this.selectedChatTab = ChatTab.BODY_CARE;
            }}>
            <span>Body Care</span>
          </button>
        </div>
        <div
          id="chat-panel"
          role="tabpanel"
          aria-labelledby="geminiTab"
          class=${classMap({
            'tabcontent': true,
            'showtab': this.selectedChatTab === ChatTab.GEMINI,
          })}>
          <div class="chat-messages" aria-live="polite" aria-atomic="false">
            ${this.messages}
            <div id="anchor"></div>
          </div>
          <div class="footer">
            <div
              id="chatStatus"
              aria-live="assertive"
              class=${classMap({'hidden': this.chatState === ChatState.IDLE})}>
              ${this.chatState === ChatState.GENERATING
                ? html`${ICON_BUSY} Generating...`
                : html``}
              ${this.chatState === ChatState.THINKING
                ? html`${ICON_BUSY} Thinking...`
                : html``}
              ${this.chatState === ChatState.EXECUTING
                ? html`${ICON_BUSY} Executing...`
                : html``}
            </div>
            <div
              id="inputArea"
              role="form"
              aria-labelledby="message-input-label">
              <label id="message-input-label" class="hidden"
                >Type your message</label
              >
              <input
                type="text"
                id="messageInput"
                .value=${this.inputMessage}
                @input=${(e: InputEvent) => {
                  this.inputMessage = (e.target as HTMLInputElement).value;
                }}
                @keydown=${(e: KeyboardEvent) => {
                  this.inputKeyDownAction(e);
                }}
                placeholder="Type your message..."
                autocomplete="off"
                aria-labelledby="message-input-label"
                aria-describedby="sendButton-desc" />
              <button
                id="sendButton"
                @click=${() => {
                  this.sendMessageAction();
                }}
                aria-label="Send message"
                aria-describedby="sendButton-desc"
                ?disabled=${this.chatState !== ChatState.IDLE}
                class=${classMap({
                  'disabled': this.chatState !== ChatState.IDLE,
                })}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  height="30px"
                  viewBox="0 -960 960 960"
                  width="30px"
                  fill="currentColor"
                  aria-hidden="true">
                  <path d="M120-160v-240l320-80-320-80v-240l760 320-760 320Z" />
                </svg>
              </button>
              <p id="sendButton-desc" class="hidden"
                >Sends the typed message to the AI.</p
              >
            </div>
          </div>
        </div>
        <div
          id="affiliate-panel"
          role="tabpanel"
          aria-labelledby="affiliateTab"
          class=${classMap({
            'tabcontent': true,
            'showtab': this.selectedChatTab === ChatTab.AFFILIATE,
          })}>
          
          <div class="affiliate-tabs-header">
            <button class="affiliate-tab-btn ${this.selectedAffiliateSubTab === 'dashboard' ? 'active' : ''}"
                    @click=${() => this.selectedAffiliateSubTab = 'dashboard'}>
              📊 Referrals & Stats
            </button>
            <button class="affiliate-tab-btn ${this.selectedAffiliateSubTab === 'saved' ? 'active' : ''}"
                    @click=${() => this.selectedAffiliateSubTab = 'saved'}>
              ⭐ Saved Places (${this.savedPlaces.length})
            </button>
            <button class="affiliate-tab-btn ${this.selectedAffiliateSubTab === 'profile' ? 'active' : ''}"
                    @click=${() => this.selectedAffiliateSubTab = 'profile'}>
              👤 Profile
            </button>
          </div>

          <div class="affiliate-tab-content">
            ${this.selectedAffiliateSubTab === 'profile' ? html`
              <user-profile-panel .userInfo=${this.userInfo} .user=${this.currentUser} @request-login=${this.login}></user-profile-panel>
            ` : this.selectedAffiliateSubTab === 'dashboard' ? html`
              <affiliate-dashboard @referrals-updated=${this._loadReferralsFromDB}></affiliate-dashboard>
            ` : html`
              <div class="saved-places-panel">
                <h3 class="saved-places-title">⭐ Saved Places</h3>
                <p class="saved-places-subtitle">Fly to and manage your favorited locations</p>
                
                ${this.savedPlaces.length === 0 ? html`
                  <div class="empty-saved-places">
                    <div class="empty-icon">📍</div>
                    <p class="empty-title">No saved places yet</p>
                    <p class="empty-desc">Click the star icon in a referred friend's location popover on the map to save it here.</p>
                  </div>
                ` : html`
                  <div class="saved-places-list">
                    ${this.savedPlaces.map((place, index) => html`
                      <div class="saved-place-item" 
                           style="--delay: ${index * 60}ms"
                           @click=${() => this.flyToSavedPlace(place)}>
                        <div class="saved-place-icon">⭐</div>
                        <div class="saved-place-info">
                          <h4 class="saved-place-name">${place.name}</h4>
                          ${place.description ? html`<p class="saved-place-desc">${place.description}</p>` : ''}
                          <p class="saved-place-coords">
                            📍 ${typeof place.lat === 'number' ? place.lat.toFixed(4) : '0.0000'}°, 
                            ${typeof place.lng === 'number' ? place.lng.toFixed(4) : '0.0000'}° • ${place.savedAt}
                          </p>
                        </div>
                        <div class="saved-place-actions">
                          <button class="btn-delete-saved" @click=${(e: Event) => this.deleteSavedPlace(place.id, e)} title="Remove from Saved">
                            🗑️
                          </button>
                        </div>
                      </div>
                    `)}
                  </div>
                `}
              </div>
            `}
          </div>
        </div>
      </div>

      <!-- Fullscreen Body Pixel Overlay -->
      <div class=${classMap({
        'body-pixel-fullscreen-overlay': true,
        'visible': this.selectedChatTab === ChatTab.BODY_PIXEL
      })}>
        <div class="header-bar">
          <button class="back-btn" @click=${() => this.selectedChatTab = ChatTab.AFFILIATE}>
            ← Back to Maps
          </button>
        </div>
        <body-pixel-panel .lang=${this.lang} style="flex-grow: 1; overflow-y: auto;" @navigate-to-body-care=${() => this.selectedChatTab = ChatTab.BODY_CARE}></body-pixel-panel>
      </div>

      <!-- Fullscreen Body Care Overlay -->
      <div class=${classMap({
        'body-pixel-fullscreen-overlay': true,
        'visible': this.selectedChatTab === ChatTab.BODY_CARE
      })}>
        <div class="header-bar">
          <button class="back-btn" @click=${() => this.selectedChatTab = ChatTab.AFFILIATE}>
            ← Back to Maps
          </button>
        </div>
        <body-care-panel style="flex-grow: 1;"></body-care-panel>
      </div>

    </div>`;
  }
}
