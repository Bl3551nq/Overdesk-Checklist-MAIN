import React, { useState, useEffect, useRef } from 'react';

// Declaration to access global Electron API from preload script
declare global {
  interface Window {
    electronAPI?: {
      checkLicense: () => Promise<{ ok: boolean; key?: string }>;
      validateLicense: (key: string) => Promise<{ ok: boolean; test?: boolean }>;
      closeApp: () => void;
      setHeight: (height: number) => void;
      cardBounds: (bounds: { x: number; y: number; w: number; h: number }) => void;
      scaleStart: () => void;
      scaleEnd: (scale: number) => void;
      installUpdate: () => void;
      onUpdateAvailable: (cb: (version: string) => void) => void;
      onUpdateDownloaded: (cb: () => void) => void;
    };
  }
}

// Icon Definitions Dictionary
const ICON_LIBRARY: Record<string, { label: string; svg: React.ReactNode }> = {
  target: {
    label: 'Target',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
        <line x1="12" y1="2" x2="12" y2="6" />
        <line x1="12" y1="18" x2="12" y2="22" />
        <line x1="2" y1="12" x2="6" y2="12" />
        <line x1="18" y1="12" x2="22" y2="12" />
      </svg>
    ),
  },
  candle: {
    label: 'Candles',
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <rect x="4.2" y="4" width="1.3" height="4" rx="0.6" />
        <rect x="3" y="8" width="3.8" height="6" rx="0.8" />
        <rect x="4.2" y="14" width="1.3" height="3" rx="0.6" />
        <rect x="10.4" y="2" width="1.3" height="5" rx="0.6" />
        <rect x="9.2" y="7" width="3.8" height="8" rx="0.8" />
        <rect x="10.4" y="15" width="1.3" height="4" rx="0.6" />
        <rect x="16.6" y="6" width="1.3" height="4" rx="0.6" />
        <rect x="15.4" y="10" width="3.8" height="5" rx="0.8" />
        <rect x="16.6" y="15" width="1.3" height="4" rx="0.6" />
      </svg>
    ),
  },
  dollar: {
    label: 'Dollar',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 1 0 7H6" />
      </svg>
    ),
  },
  shield: {
    label: 'DND',
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L4 6v6c0 5.25 3.5 9.74 8 11 4.5-1.26 8-5.75 8-11V6L12 2z" opacity="0.9" />
        <rect x="9.2" y="9" width="2" height="6" rx="0.6" fill="#fff" opacity="0.85" />
        <rect x="12.8" y="9" width="2" height="6" rx="0.6" fill="#fff" opacity="0.85" />
      </svg>
    ),
  },
  bell: {
    label: 'Alerts',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
  trending_up: {
    label: 'Bull',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </svg>
    ),
  },
  trending_dn: {
    label: 'Bear',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
        <polyline points="17 18 23 18 23 12" />
      </svg>
    ),
  },
  activity: {
    label: 'Signal',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  bar_chart: {
    label: 'Bars',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
        <line x1="2" y1="20" x2="22" y2="20" />
      </svg>
    ),
  },
  line_chart: {
    label: 'Line',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 17 8 11 12 14 16 7 20 10" />
        <line x1="4" y1="21" x2="20" y2="21" />
      </svg>
    ),
  },
  percent: {
    label: 'Percent',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="19" y1="5" x2="5" y2="19" />
        <circle cx="6.5" cy="6.5" r="2.5" />
        <circle cx="17.5" cy="17.5" r="2.5" />
      </svg>
    ),
  },
  pie: {
    label: 'Portfolio',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
        <path d="M22 12A10 10 0 0 0 12 2v10z" />
      </svg>
    ),
  },
  bitcoin: {
    label: 'Crypto',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 7h6a3 3 0 0 1 0 6H7V7z" />
        <path d="M7 13h6.5a3 3 0 0 1 0 6H7V13z" />
        <line x1="9" y1="4" x2="9" y2="7" />
        <line x1="14" y1="4" x2="14" y2="7" />
        <line x1="9" y1="19" x2="9" y2="22" />
        <line x1="14" y1="19" x2="14" y2="22" />
      </svg>
    ),
  },
  wallet: {
    label: 'Wallet',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
        <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
        <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" />
      </svg>
    ),
  },
  clock: {
    label: 'Clock',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="9" />
        <polyline points="12 7 12 12 15.5 15.5" />
      </svg>
    ),
  },
  calendar: {
    label: 'Calendar',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  lock: {
    label: 'Lock',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
  star: {
    label: 'Star',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
  lightning: {
    label: 'Flash',
    svg: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M13 2L4.09 12.8c-.36.44-.56.99-.56 1.56 0 1.38 1.12 2.5 2.5 2.5H11l-1 6.5L19.91 11.2c.36-.44.56-.99.56-1.56 0-1.38-1.12-2.5-2.5-2.5H13l1-6.14z" />
      </svg>
    ),
  },
  eye: {
    label: 'Watch',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  flag: {
    label: 'Flag',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
        <line x1="4" y1="22" x2="4" y2="15" />
      </svg>
    ),
  },
  bookmark: {
    label: 'Saves',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  layers: {
    label: 'Layers',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    ),
  },
  settings: {
    label: 'Config',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
  fire: {
    label: 'Hot',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
      </svg>
    ),
  },

  /* ── Business Icons ── */
  briefcase: {
    label: 'Business',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
        <line x1="12" y1="12" x2="12" y2="12" />
        <path d="M2 12h20" />
      </svg>
    ),
  },
  handshake: {
    label: 'Deal',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42z" />
        <path d="M12 5.36 8.87 8.5a2.13 2.13 0 0 0 0 3l3.13 3.13 3.13-3.13a2.13 2.13 0 0 0 0-3L12 5.36z" />
      </svg>
    ),
  },
  users: {
    label: 'Team',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  growth: {
    label: 'Growth',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </svg>
    ),
  },
  target2: {
    label: 'Goal',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    ),
  },
  cash: {
    label: 'Revenue',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
  },
  invoice: {
    label: 'Invoice',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  megaphone: {
    label: 'Market',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11l19-9-9 19-2-8-8-2z" />
      </svg>
    ),
  },
  network: {
    label: 'Network',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="5" r="3" />
        <circle cx="19" cy="19" r="3" />
        <circle cx="5" cy="19" r="3" />
        <line x1="12" y1="8" x2="12" y2="14" />
        <line x1="12" y1="14" x2="19" y2="16" />
        <line x1="12" y1="14" x2="5" y2="16" />
      </svg>
    ),
  },
  checklist: {
    label: 'Tasks',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="9" y1="11" x2="21" y2="11" />
        <line x1="9" y1="17" x2="21" y2="17" />
        <line x1="9" y1="5" x2="21" y2="5" />
        <polyline points="4 11 2 13 4 15" />
        <polyline points="4 5 2 7 4 9" />
      </svg>
    ),
  },
  strategy: {
    label: 'Strategy',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
  balance: {
    label: 'P&L',
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M5 5h14" />
        <path d="M5 19h14" />
        <path d="M5 12h14" />
      </svg>
    ),
  },
};

// Colors Palettes
const COLOR_PRESETS = [
  { accent: 'rgba(215,25,75,0.9)', soft: 'rgba(255,40,100,0.16)', hex: '#d7194b' },
  { accent: 'rgba(140,0,225,0.9)', soft: 'rgba(170,0,255,0.16)', hex: '#8c00e1' },
  { accent: 'rgba(205,15,95,0.9)', soft: 'rgba(255,30,110,0.16)', hex: '#cd0f5f' },
  { accent: 'rgba(110,0,210,0.9)', soft: 'rgba(130,0,255,0.16)', hex: '#6e00d2' },
  { accent: 'rgba(0,180,155,0.9)', soft: 'rgba(0,210,180,0.18)', hex: '#00b49b' },
  { accent: 'rgba(220,100,0,0.9)', soft: 'rgba(255,140,0,0.18)', hex: '#dc6400' },
  { accent: 'rgba(30,140,255,0.9)', soft: 'rgba(60,170,255,0.18)', hex: '#1e8cff' },
  { accent: 'rgba(0,190,80,0.9)', soft: 'rgba(0,230,100,0.16)', hex: '#00be50' },
  { accent: 'rgba(200,170,0,0.9)', soft: 'rgba(255,220,0,0.16)', hex: '#c8aa00' },
];

function hexToAccent(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return {
    accent: `rgba(${r},${g},${b},0.9)`,
    soft: `rgba(${r},${g},${b},0.18)`,
  };
}

interface ModeDetail {
  title: string;
  accent: string;
  soft: string;
  defaultAccent: string;
  defaultSoft: string;
  options: string[];
}

const DEFAULT_MODES: Record<string, ModeDetail> = {
  target: {
    title: 'Precision',
    accent: 'rgba(215,25,75,0.9)',
    soft: 'rgba(255,40,100,0.16)',
    defaultAccent: 'rgba(215,25,75,0.9)',
    defaultSoft: 'rgba(255,40,100,0.16)',
    options: ['Scalping session', 'Sniper entry only', 'Wait for confluence', 'HTF confirmation'],
  },
  candle: {
    title: 'Analysis',
    accent: 'rgba(140,0,225,0.9)',
    soft: 'rgba(170,0,255,0.16)',
    defaultAccent: 'rgba(140,0,225,0.9)',
    defaultSoft: 'rgba(170,0,255,0.16)',
    options: ['1H candlestick review', '4H structure check', 'Daily bias', 'Weekly trend'],
  },
  dollar: {
    title: 'Risk & P&L',
    accent: 'rgba(205,15,95,0.9)',
    soft: 'rgba(255,30,110,0.16)',
    defaultAccent: 'rgba(205,15,95,0.9)',
    defaultSoft: 'rgba(255,30,110,0.16)',
    options: ['1% risk per trade', 'Review open P&L', 'Set daily loss limit', 'Check margin level'],
  },
  sync: {
    title: 'Do Not Disturb',
    accent: 'rgba(110,0,210,0.9)',
    soft: 'rgba(130,0,255,0.16)',
    defaultAccent: 'rgba(110,0,210,0.9)',
    defaultSoft: 'rgba(130,0,255,0.16)',
    options: ['For an hour', 'For Today', 'Until This Weekend', 'Until Goals Met'],
  },
  alerts: {
    title: 'Alerts',
    accent: 'rgba(0,180,155,0.9)',
    soft: 'rgba(0,210,180,0.18)',
    defaultAccent: 'rgba(0,180,155,0.9)',
    defaultSoft: 'rgba(0,210,180,0.18)',
    options: ['NFP release', 'FOMC statement', 'CPI data drop', 'Market open bell'],
  },
};

export default function App() {
  // ── State ──
  const [currentMode, setCurrentMode] = useState<string>('sync');
  const [editMode, setEditMode] = useState<boolean>(false);
  const [isLight, setIsLight] = useState<boolean>(false);
  const [minimized, setMinimized] = useState<boolean>(false);

  // License State
  const [licenseActive, setLicenseActive] = useState<boolean>(true); // active by default in web preview
  const [licenseInput, setLicenseInput] = useState<string>('');
  const [licenseError, setLicenseError] = useState<boolean>(false);

  // Modular Modes Storage
  const [modes, setModes] = useState<Record<string, ModeDetail>>(() => {
    try {
      const saved = localStorage.getItem('fm_modes');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Ensure accurate merge with initial fields
        const mergedObj = { ...DEFAULT_MODES };
        Object.keys(parsed).forEach((k) => {
          if (mergedObj[k]) {
            if (typeof parsed[k].title === 'string' && parsed[k].title.length > 0) {
              mergedObj[k].title = parsed[k].title;
            }
            if (Array.isArray(parsed[k].options) && parsed[k].options.length > 0) {
              mergedObj[k].options = parsed[k].options;
            }
            if (parsed[k].accent) mergedObj[k].accent = parsed[k].accent;
            if (parsed[k].soft) mergedObj[k].soft = parsed[k].soft;
          }
        });
        return mergedObj;
      }
    } catch (e) {}
    return DEFAULT_MODES;
  });

  // Current selections for each mode
  const [selections, setSelections] = useState<Record<string, number[]>>(() => {
    const defaultSels: Record<string, number[]> = {};
    Object.keys(DEFAULT_MODES).forEach((m) => {
      try {
        const savedS = localStorage.getItem('fm_sel_' + m);
        if (savedS) {
          defaultSels[m] = JSON.parse(savedS);
        } else {
          defaultSels[m] = [];
        }
      } catch (e) {
        defaultSels[m] = [];
      }
    });
    return defaultSels;
  });

  // Mode customizer icons assignment
  const [iconAssignments, setIconAssignments] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('fm_icons');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {}
    return {
      target: 'target',
      candle: 'candle',
      dollar: 'dollar',
      sync: 'shield',
      alerts: 'bell',
    };
  });

  // Scale tracking (from localStorage)
  const [scale, setScale] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('fm_scale');
      if (saved) {
        const parsed = parseFloat(saved);
        if (parsed >= 0.6 && parsed <= 1.8) return parsed;
      }
    } catch (e) {}
    return 1.0;
  });

  // Customizer picker state
  const [pickerOpen, setPickerOpen] = useState<boolean>(false);
  const [pickerTargetMode, setPickerTargetMode] = useState<string | null>(null);

  // Title focus, item editing tracking
  const [editingTitle, setEditingTitle] = useState<boolean>(false);
  const [titleInputValue, setTitleInputValue] = useState<string>('');
  const [editingItemIdx, setEditingItemIdx] = useState<number | null>(null);
  const [editingItemValue, setEditingItemValue] = useState<string>('');

  // Auto Updater State
  const [updateAvailable, setUpdateAvailable] = useState<boolean>(false);
  const [updateVersion, setUpdateVersion] = useState<string>('');
  const [updateInstalling, setUpdateInstalling] = useState<boolean>(false);

  // Card Draggability (pointer-based with long press) State
  const [translate, setTranslate] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      return { x: 0, y: 0 };
    }
    try {
      const saved = localStorage.getItem('fm_translate');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {}
    return { x: 0, y: 0 };
  });
  const [isGripped, setIsGripped] = useState<boolean>(false);

  const dragPointerRef = useRef<{
    dragging: boolean;
    startX: number;
    startY: number;
    startTX: number;
    startTY: number;
    timer: NodeJS.Timeout | null;
  }>({
    dragging: false,
    startX: 0,
    startY: 0,
    startTX: 0,
    startTY: 0,
    timer: null,
  });

  const justDraggedRef = useRef<boolean>(false);

  // Refs
  const cardRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const listInputRef = useRef<HTMLInputElement>(null);

  const isDraggable = (target: HTMLElement): boolean => {
    let curr: HTMLElement | null = target;
    while (curr && curr !== cardRef.current) {
      if (
        curr.classList?.contains('no-drag') ||
        ['BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'A'].includes(curr.tagName) ||
        curr.closest('button') ||
        curr.closest('input') ||
        curr.closest('.icon-btn') ||
        curr.closest('.edit-toggle') ||
        curr.closest('.close-btn') ||
        curr.closest('.add-btn') ||
        curr.closest('.theme-switch') ||
        curr.closest('.minimize-pill') ||
        curr.closest('.minimize-bar') ||
        curr.closest('.resize-handle') ||
        curr.closest('.reset-wrap') ||
        curr.closest('.color-swatch') ||
        curr.closest('.color-custom-wrap') ||
        curr.closest('.picker-grid') ||
        curr.closest('.check-box') ||
        curr.closest('.del-btn')
      ) {
        return false;
      }
      curr = curr.parentElement;
    }
    return true;
  };

  const handleCardPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (window.electronAPI) return; // Native -webkit-app-region: drag handles physical layout movement in Electron
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (!isDraggable(target)) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const startTX = translate.x;
    const startTY = translate.y;

    if (dragPointerRef.current.timer) {
      clearTimeout(dragPointerRef.current.timer);
    }

    let isDraggingActive = false;

    const onPointerMove = (moveEv: PointerEvent) => {
      const dx = moveEv.clientX - startX;
      const dy = moveEv.clientY - startY;

      if (!isDraggingActive) {
        // If they move too much before the long press completes, cancel the timer
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
          if (dragPointerRef.current.timer) {
            clearTimeout(dragPointerRef.current.timer);
            dragPointerRef.current.timer = null;
          }
          cleanup();
        }
        return;
      }

      setTranslate({
        x: startTX + dx,
        y: startTY + dy,
      });
    };

    const onPointerUp = () => {
      if (dragPointerRef.current.timer) {
        clearTimeout(dragPointerRef.current.timer);
        dragPointerRef.current.timer = null;
      }

      if (isDraggingActive) {
        isDraggingActive = false;
        setIsGripped(false);
        dragPointerRef.current.dragging = false;
        justDraggedRef.current = true;
        setTimeout(() => {
          justDraggedRef.current = false;
        }, 80);
      }

      cleanup();
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };

    // 250ms long press trigger
    dragPointerRef.current.timer = setTimeout(() => {
      isDraggingActive = true;
      setIsGripped(true);
      dragPointerRef.current.dragging = true;
      playSoundChime('check');
    }, 250);

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerUp, { passive: true });
  };

  const handleCardPointerMove = () => {
    // Handled globally at window level for complete robustness
  };

  const handleCardPointerUp = () => {
    // Handled globally at window level for complete robustness
  };

  // ── Audio Tone Synthesizer Chimes ──
  const playSoundChime = (type: 'check' | 'complete' | 'reset') => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'complete') {
        osc.frequency.setValueAtTime(660, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      } else if (type === 'check') {
        osc.frequency.setValueAtTime(520, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
        osc.start();
        osc.stop(ctx.currentTime + 0.18);
      } else if (type === 'reset') {
        osc.frequency.setValueAtTime(330, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch (e) {}
  };

  // ── Sync states on load ──
  useEffect(() => {
    // Clear stale old states if any config mismatch from legacy assets
    const ver = localStorage.getItem('fm_state_ver');
    if (ver !== '3.1') {
      localStorage.removeItem('fm_modes');
      localStorage.removeItem('fm_theme');
      localStorage.removeItem('fm_scale');
      localStorage.removeItem('fm_icons');
      Object.keys(DEFAULT_MODES).forEach((m) => localStorage.removeItem('fm_sel_' + m));
      localStorage.setItem('fm_state_ver', '3.1');
    }

    // Determine stored Theme
    const isLightStored = localStorage.getItem('fm_theme') === '1';
    setIsLight(isLightStored);

    // Initial check license trigger on Electron if available
    if (window.electronAPI) {
      document.body.classList.add('electron');
      window.electronAPI.checkLicense().then((res) => {
        if (!res.ok) {
          setLicenseActive(false);
        } else {
          setLicenseActive(true);
        }
      });

      // Hook up Electron automatic updater listeners
      window.electronAPI.onUpdateAvailable((version) => {
        setUpdateVersion(version);
        setUpdateAvailable(true);
      });

      window.electronAPI.onUpdateDownloaded(() => {
        setUpdateVersion((prev) => prev + ' (Ready)');
      });
    }
  }, []);

  // Set card accent variables dynamically on change
  useEffect(() => {
    if (cardRef.current) {
      const modeData = modes[currentMode];
      if (modeData) {
        cardRef.current.style.setProperty('--accent', modeData.accent);
        cardRef.current.style.setProperty('--accent-soft', modeData.soft);
      }
    }
  }, [currentMode, modes]);

  // Persist items & configuration on updates
  useEffect(() => {
    localStorage.setItem('fm_modes', JSON.stringify(modes));
  }, [modes]);

  useEffect(() => {
    localStorage.setItem('fm_theme', isLight ? '1' : '0');
  }, [isLight]);

  useEffect(() => {
    localStorage.setItem('fm_icons', JSON.stringify(iconAssignments));
  }, [iconAssignments]);

  useEffect(() => {
    setScale(scale);
    localStorage.setItem('fm_scale', scale.toString());
    if (window.electronAPI) {
      window.electronAPI.scaleEnd(scale);
    }
  }, [scale]);

  useEffect(() => {
    localStorage.setItem('fm_translate', JSON.stringify(translate));
  }, [translate]);

  useEffect(() => {
    document.body.classList.toggle('editing', editMode);
    return () => {
      document.body.classList.remove('editing');
    };
  }, [editMode]);

  // Dynamic custom high-resolution system-tray & window icon canvas render pipeline
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, 256, 256);

          ctx.save();
          // Scale down around the center to add proper safety margin padding to match standard taskbar icons perfectly
          ctx.translate(128, 128);
          ctx.scale(0.76, 0.76);
          ctx.translate(-128, -128);

          ctx.save();
          // Diagonal rotation angle matching Saturn orbital design in UI
          ctx.translate(128, 128);
          ctx.rotate(-12 * Math.PI / 180);
          ctx.translate(-128, -128);

          // 1. Draw back of the ring
          ctx.strokeStyle = '#0e0e11';
          ctx.lineWidth = 26;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.ellipse(128, 128, 110, 40, 0, Math.PI, 0, true);
          ctx.stroke();

          // 2. Draw Sphere
          const grad = ctx.createRadialGradient(98, 98, 10, 128, 128, 76);
          grad.addColorStop(0, '#56efff');
          grad.addColorStop(0.35, '#00b4d8');
          grad.addColorStop(0.7, '#0077b6');
          grad.addColorStop(1, '#003e5c');

          ctx.fillStyle = grad;
          ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
          ctx.shadowBlur = 15;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 10;
          ctx.beginPath();
          ctx.arc(128, 128, 76, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.restore(); // cancel shadow mappings

          // 3. Draw front of the ring (using a clip path to clip to bottom half)
          ctx.save();
          ctx.translate(128, 128);
          ctx.rotate(-12 * Math.PI / 180);
          ctx.translate(-128, -128);

          ctx.strokeStyle = '#0e0e11';
          ctx.lineWidth = 26;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.ellipse(128, 128, 110, 40, 0, 0, Math.PI, false);
          ctx.stroke();

          ctx.restore();

          ctx.restore(); // restore global scale transformation

          const dataUrl = canvas.toDataURL('image/png');
          (window as any).electronAPI.saveIcon(dataUrl);
        }
      } catch (err) {
        console.error('Error auto-generating and saving dynamic logo:', err);
      }
    }
  }, []);

  // Handle reporting dynamic visual bounding box to Electron to prevent clipping with ResizeObserver
  useEffect(() => {
    if (!window.electronAPI || !cardRef.current) return;

    let resizeTimer: any = null;
    const observer = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      // Fast, ultra-smooth boundary synchronization
      resizeTimer = setTimeout(() => {
        if (cardRef.current) {
          const rect = cardRef.current.getBoundingClientRect();
          window.electronAPI?.cardBounds({
            x: rect.left,
            y: rect.top,
            w: 320, // Standard exact card width constant
            h: cardRef.current.offsetHeight,
          });
        }
      }, 16); // ~1 frame debounce
    });

    observer.observe(cardRef.current);
    
    // Immediate measurement for swift loading bounds alignment
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      window.electronAPI?.cardBounds({
        x: rect.left,
        y: rect.top,
        w: 320,
        h: cardRef.current.offsetHeight,
      });
    }

    return () => {
      observer.disconnect();
      if (resizeTimer) clearTimeout(resizeTimer);
    };
  }, [scale]);

  // ── Custom Sizing drag logic ──
  const sizingRef = useRef({ dragging: false, startX: 0, startScale: 1.0 });

  const handleSizingMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    sizingRef.current.dragging = true;
    sizingRef.current.startX = 'touches' in e ? e.touches[0].screenX : e.screenX;
    sizingRef.current.startScale = scale;
    window.electronAPI?.scaleStart();
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!sizingRef.current.dragging) return;
      const screenX = 'touches' in e ? e.touches[0].screenX : (e as MouseEvent).screenX;
      const deltaX = sizingRef.current.startX - screenX;
      const computedScale = Math.min(1.8, Math.max(0.6, sizingRef.current.startScale + deltaX / 300));
      setScale(parseFloat(computedScale.toFixed(4)));
    };

    const handleStop = () => {
      if (!sizingRef.current.dragging) return;
      sizingRef.current.dragging = false;
      document.body.style.userSelect = '';
      if (window.electronAPI) {
        window.electronAPI.scaleEnd(scale);
      }
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleStop);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleStop);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleStop);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleStop);
    };
  }, [scale]);

  // ── Gumroad License verification triggering ──
  const formatLicenseKey = (val: string) => {
    const raw = val.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 32);
    const groups = [
      raw.slice(0, 8),
      raw.slice(8, 12),
      raw.slice(12, 16),
      raw.slice(16, 20),
      raw.slice(20, 32),
    ].filter((s) => s.length > 0);
    return groups.join('-');
  };

  const handleLicenseInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatLicenseKey(e.target.value);
    setLicenseInput(formatted);
  };

  const attemptActivation = async () => {
    const cleaned = licenseInput.trim();
    if (cleaned.length < 32) {
      setLicenseError(true);
      setTimeout(() => setLicenseError(false), 800);
      return;
    }

    if (window.electronAPI) {
      const resp = await window.electronAPI.validateLicense(cleaned);
      if (resp.ok) {
        setLicenseActive(true);
      } else {
        setLicenseError(true);
        setTimeout(() => setLicenseError(false), 800);
      }
    } else {
      // Fallback bypass mode on standard web preview
      setLicenseActive(true);
    }
  };

  // ── Switch Active Tab Tab Modes ──
  const handleModeIconClick = (mode: string) => {
    if (editMode) {
      // Toggle mode visual configuration overlay
      setPickerTargetMode(mode);
      setPickerOpen(true);
    } else {
      setEditingTitle(false);
      setEditingItemIdx(null);
      setCurrentMode(mode);
    }
  };

  // ── Selection checklist Toggling ──
  const handleOptionToggle = (idx: number) => {
    if (justDraggedRef.current) {
      return;
    }

    if (editMode) {
      // Item editing trigger
      setEditingItemIdx(idx);
      setEditingItemValue(modes[currentMode].options[idx]);
      setTimeout(() => listInputRef.current?.focus(), 60);
      return;
    }

    let activeList = selections[currentMode] || [];
    let updated: number[];
    if (activeList.includes(idx)) {
      updated = activeList.filter((v) => v !== idx);
      playSoundChime('check');
    } else {
      updated = [...activeList, idx];
      playSoundChime('check');
      const totalOptionsCount = modes[currentMode].options.length;
      if (updated.length === totalOptionsCount) {
        setTimeout(() => playSoundChime('complete'), 150);
      }
    }

    const nextSelections = { ...selections, [currentMode]: updated };
    setSelections(nextSelections);
    localStorage.setItem('fm_sel_' + currentMode, JSON.stringify(updated));
  };

  // ── Reset entire checklist indices ──
  const triggerResetChecklist = () => {
    if (editMode) {
      // In edit mode - reset all checkboxes of ALL modes to blank empty values
      const emptyChecklists: Record<string, number[]> = {};
      Object.keys(modes).forEach((m) => {
        emptyChecklists[m] = [];
        localStorage.setItem('fm_sel_' + m, JSON.stringify([]));
      });
      setSelections(emptyChecklists);
    } else {
      // Reset checkboxes of ONLY the selected current mode block
      const nextSelections = { ...selections, [currentMode]: [] };
      setSelections(nextSelections);
      localStorage.setItem('fm_sel_' + currentMode, JSON.stringify([]));
    }
    playSoundChime('reset');
  };

  // ── Edit operations: Rename mode titles ──
  const startEditingTitle = () => {
    if (!editMode) return;
    setTitleInputValue(modes[currentMode].title);
    setEditingTitle(true);
    setTimeout(() => titleInputRef.current?.focus(), 60);
  };

  const commitTitleEditing = () => {
    if (!editingTitle) return;
    const nextVal = titleInputValue.trim() || modes[currentMode].title;
    setModes((prev) => ({
      ...prev,
      [currentMode]: {
        ...prev[currentMode],
        title: nextVal,
      },
    }));
    setEditingTitle(false);
  };

  // ── Edit operations: Rename items ──
  const commitItemEditing = (idx: number) => {
    if (editingItemIdx === null) return;
    const listCopy = [...modes[currentMode].options];
    const finalVal = editingItemValue.trim() || listCopy[idx];
    listCopy[idx] = finalVal;

    setModes((prev) => ({
      ...prev,
      [currentMode]: {
        ...prev[currentMode],
        options: listCopy,
      },
    }));
    setEditingItemIdx(null);
  };

  // ── Delete item ──
  const deleteItemOption = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    if (modes[currentMode].options.length <= 1) return; // cannot delete of size 1

    const updatedOptions = modes[currentMode].options.filter((_, i) => i !== idx);
    setModes((prev) => ({
      ...prev,
      [currentMode]: {
        ...prev[currentMode],
        options: updatedOptions,
      },
    }));

    // Re-adjust check offset mappings on item deletion
    const currentChecked = selections[currentMode] || [];
    const reassignedChecked = currentChecked
      .map((oldIdx) => {
        if (oldIdx === idx) return -1;
        if (oldIdx > idx) return oldIdx - 1;
        return oldIdx;
      })
      .filter((v) => v !== -1);

    setSelections((prev) => ({ ...prev, [currentMode]: reassignedChecked }));
    localStorage.setItem('fm_sel_' + currentMode, JSON.stringify(reassignedChecked));
  };

  // ── Add dynamic item option checklist ──
  const addNewItemOption = () => {
    const listCopy = [...modes[currentMode].options, 'New option'];
    setModes((prev) => ({
      ...prev,
      [currentMode]: {
        ...prev[currentMode],
        options: listCopy,
      },
    }));

    const nextIdx = listCopy.length - 1;
    setEditingItemIdx(nextIdx);
    setEditingItemValue('New option');
    setTimeout(() => {
      listInputRef.current?.focus();
      listInputRef.current?.select();
    }, 60);
  };

  // ── Mode customized color-picker operations ──
  const assignModeColor = (targetMode: string, accent: string, soft: string) => {
    setModes((prev) => ({
      ...prev,
      [targetMode]: {
        ...prev[targetMode],
        accent,
        soft,
      },
    }));
  };

  const resetModeColorToDefault = (targetMode: string) => {
    const defaults = DEFAULT_MODES[targetMode];
    assignModeColor(targetMode, defaults.defaultAccent, defaults.defaultSoft);
  };

  const assignModeIcon = (targetMode: string, iconKey: string) => {
    setIconAssignments((prev) => ({
      ...prev,
      [targetMode]: iconKey,
    }));
    setPickerOpen(false);
    setPickerTargetMode(null);
  };

  const triggerAppShutdown = () => {
    if (window.electronAPI) {
      window.electronAPI.closeApp();
    } else {
      // Direct Web hide emulation
      if (cardRef.current) {
        cardRef.current.style.transition = 'opacity 0.28s ease, transform 0.28s ease';
        cardRef.current.style.opacity = '0';
        cardRef.current.style.transform = 'scale(0.88)';
        setTimeout(() => {
          if (cardRef.current) cardRef.current.style.display = 'none';
        }, 290);
      }
    }
  };

  // Auto Updater triggers
  const executeUpdateInstall = () => {
    setUpdateInstalling(true);
    if (window.electronAPI) {
      window.electronAPI.installUpdate();
    }
  };

  // ── Render Helpers: Liquid Wave Path Calculation ──
  const compileLiquidWaveData = (modeKey: string) => {
    const totalOptions = modes[modeKey]?.options.length || 0;
    const checkedOptions = selections[modeKey]?.length || 0;
    const pct = totalOptions > 0 ? checkedOptions / totalOptions : 0;

    const accentRaw = modes[modeKey]?.accent || 'rgba(110,0,210,0.9)';
    const m = accentRaw.match(/[\d.]+/g) || ['110', '0', '210'];
    const r = parseInt(m[0]),
      g = parseInt(m[1]),
      b = parseInt(m[2]);

    const baseColor = `rgba(${r},${g},${b},0.5)`;
    const gradientHigh = `rgba(${Math.min(r + 80, 255)},${Math.min(g + 60, 255)},${Math.min(b + 80, 255)},0.75)`;

    const size = 50;
    const waterY = size * (1 - pct);
    const amp = pct > 0.02 && pct < 0.98 ? 3.5 : 0;

    const waveWidth = size + 30; // 80px wide
    const startX = -15;
    const steps = 60;
    const pts = [];

    for (let i = 0; i <= steps; i++) {
      const x = startX + (waveWidth / steps) * i;
      const y = waterY + amp * Math.sin((i / steps) * Math.PI * 4);
      pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`);
    }

    const wavePath = pts.join(' ') + ` L${startX + waveWidth},50 L${startX},50 Z`;

    return {
      pct,
      baseColor,
      gradientHigh,
      waterY,
      wavePath,
    };
  };

  // Calculations for current selected Mode items totals
  const totalModeOptions = modes[currentMode]?.options.length || 0;
  const totalModeChecked = selections[currentMode]?.length || 0;

  return (
    <>
      {/* Gumroad License validation screen */}
      {!licenseActive && (
        <div className="license-screen" id="license-screen">
          <svg className="license-logo" viewBox="0 0 100 100" style={{ width: '90px', height: '90px', transform: 'rotate(-12deg)', overflow: 'visible', marginBottom: '16px' }}>
            <defs>
              <radialGradient id="sphereGrad" cx="30%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#4df3ff" />
                <stop offset="50%" stopColor="#00b0ff" />
                <stop offset="100%" stopColor="#0a6080" />
              </radialGradient>
              <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="50%">
                <stop offset="0%" stopColor="#2c2c35" />
                <stop offset="50%" stopColor="#15151b" />
                <stop offset="100%" stopColor="#070709" />
              </linearGradient>
              <clipPath id="frontClip">
                <rect x="0" y="45" width="100" height="55" />
              </clipPath>
            </defs>
            {/* Back of the orbit ring */}
            <path 
              d="M 10 50 C 10 32, 90 32, 90 50" 
              fill="none" 
              stroke="url(#ringGrad)" 
              strokeWidth="11" 
              strokeLinecap="round"
            />
            {/* Glossy Planet Sphere */}
            <circle cx="50" cy="50" r="30" fill="url(#sphereGrad)" filter="drop-shadow(0px 8px 12px rgba(0,0,0,0.455))" />
            {/* Front of the orbit ring */}
            <path 
              d="M 10 50 C 10 68, 90 68, 90 50" 
              fill="none" 
              stroke="url(#ringGrad)" 
              strokeWidth="11" 
              strokeLinecap="round"
              clipPath="url(#frontClip)"
            />
          </svg>
          <div className="license-title">Overdesk Checklist</div>
          <div className="license-sub">
            Enter your license key to activate.
            <br />
            Find your license key inside your Gumroad purchase receipt.
          </div>
          <input
            className={`license-input ${licenseError ? 'error' : ''}`}
            id="license-input"
            type="text"
            placeholder="E.g. XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
            maxLength={36}
            value={licenseInput}
            onChange={handleLicenseInputChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter') attemptActivation();
            }}
          />
          <button className="license-btn" onClick={attemptActivation}>
            Activate
          </button>
          
          <div className="license-hint" style={{ fontSize: '11px', marginTop: '12px' }}>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>
              Get your license key on Gumroad: <a href="https://overdesk.gumroad.com/l/app3" target="_blank" rel="noreferrer" style={{ color: '#00ccff', textDecoration: 'underline' }}>overdesk.gumroad.com/l/app3</a>
            </span>
          </div>
        </div>
      )}

      {/* Main checklist canvas card widget */}
      <div
        className={`card ${isLight ? 'light' : ''} ${minimized ? 'minimized' : ''} ${isGripped ? 'gripped' : ''}`}
        id="card"
        ref={cardRef}
        onPointerDown={handleCardPointerDown}
        onPointerMove={handleCardPointerMove}
        onPointerUp={handleCardPointerUp}
        onPointerCancel={handleCardPointerUp}
        onDragStart={(e) => e.preventDefault()}
        style={{
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${isGripped ? scale * 1.035 : scale})`,
          boxShadow: isGripped ? `0 18px 50px 5px ${modes[currentMode]?.soft || 'var(--accent-soft)'}, 0 6px 18px rgba(0, 0, 0, 0.45)` : undefined,
          transition: isGripped ? 'transform 0s, box-shadow 0.2s ease' : 'transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease',
          cursor: isGripped ? 'grabbing' : undefined,
        }}
      >
        {/* Aspect Sizer Handle (Draggable resize left-bar) */}
        <div className="resize-handle" id="resize-handle" onMouseDown={handleSizingMouseDown} onTouchStart={handleSizingMouseDown}></div>

        {/* Floating corner indicator block */}
        <div className="drag-corner" id="drag-corner"></div>

        {/* Automatic updates banner notifier */}
        <div className={`update-banner ${updateAvailable ? 'show' : ''}`} id="update-banner">
          <div className="update-banner-text">
            Update available
            <span id="update-version">{updateVersion}</span>
          </div>
          <button className="update-install-btn" id="update-install-btn" onClick={executeUpdateInstall}>
            {updateInstalling ? 'Installing...' : 'Install'}
          </button>
        </div>

        {/* Top Header Controls row */}
        <div className="top-bar" id="top-bar">
          {/* Left Theme toggle button */}
          <div
            className="theme-switch"
            id="theme-switch"
            onClick={() => {
              setIsLight(!isLight);
              localStorage.setItem('fm_theme', !isLight ? '1' : '0');
            }}
          >
            <div
              className="theme-switch-knob"
              id="theme-knob"
              style={{
                transform: isLight ? 'translateX(18px)' : 'translateX(0px)',
              }}
            >
              {isLight ? (
                // Moon Icon
                <svg id="theme-icon" viewBox="0 0 24 24">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              ) : (
                // Sun Icon
                <svg id="theme-icon" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              )}
            </div>
          </div>

          {/* Center Minimize Pill */}
          <div
            className="minimize-bar"
            onClick={() => {
              setMinimized(!minimized);
              if (!minimized && editMode) setEditMode(false);
            }}
          >
            <div className="minimize-pill"></div>
          </div>

          {/* Right toggle configurations */}
          <div className="top-bar-right">
            <button className="close-btn" id="close-btn" onClick={triggerAppShutdown} title="Shutdown App">
              <svg viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <button
              className={`edit-toggle ${editMode ? 'on' : ''}`}
              id="edit-toggle"
              onClick={() => {
                if (minimized) setMinimized(false);
                setEditMode(!editMode);
                setEditingTitle(false);
                setEditingItemIdx(null);
              }}
              title="Edit List Configurations"
            >
              {editMode ? (
                // Checked Done Icon in edit mode
                <svg viewBox="0 0 24 24">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                // Pencil Icon in default view mode
                <svg viewBox="0 0 24 24">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Tab mode selection icons row */}
        <div className="icons">
          {Object.keys(modes).map((mKey) => {
            const hasLiquidFill = selections[mKey]?.length > 0;
            const isSelected = mKey === currentMode;
            const waveParams = compileLiquidWaveData(mKey);

            return (
              <div className="icon-wrap" key={mKey}>
                {/* Dynamically calculated filling liquid SVG wave structure */}
                {hasLiquidFill && (
                  <div className="liquid-container">
                    <svg viewBox="0 0 50 50">
                      <defs>
                        <clipPath id={`lc-clip-${mKey}`}>
                          <circle cx="25" cy="25" r="24.5" />
                        </clipPath>
                        <linearGradient id={`lc-grad-${mKey}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={waveParams.gradientHigh} />
                          <stop offset="100%" stopColor={waveParams.baseColor} />
                        </linearGradient>
                      </defs>
                      <g clipPath={`url(#lc-clip-${mKey})`}>
                        {/* Underlay color rectangle */}
                        <rect x="-15" y={waveParams.waterY} width="80" height={52 - waveParams.waterY} fill={waveParams.baseColor} />
                        {/* Floating wave overlay using CSS math slosh animation */}
                        <g style={{ animation: 'liquidBob 3.2s ease-in-out infinite' }}>
                          <path
                            style={{
                              animation: 'liquidSlosh 3.8s ease-in-out infinite',
                              transformOrigin: 'center center',
                            }}
                            d={waveParams.wavePath}
                            fill={`url(#lc-grad-${mKey})`}
                          />
                        </g>
                      </g>
                    </svg>
                  </div>
                )}

                <button
                  className={`icon-btn ${isSelected ? 'active' : ''} ${hasLiquidFill ? 'has-liquid' : ''}`}
                  data-mode={mKey}
                  onClick={() => handleModeIconClick(mKey)}
                  style={{
                    backgroundColor: isSelected && !hasLiquidFill ? modes[mKey]?.accent : undefined,
                  }}
                >
                  {ICON_LIBRARY[iconAssignments[mKey]]?.svg || ICON_LIBRARY.target.svg}
                </button>
              </div>
            );
          })}
        </div>

        {/* Tab Mode configuration Picker overlay */}
        {pickerOpen && pickerTargetMode && (
          <div className={`icon-picker open`} id="icon-picker">
            <div className="picker-header">
              <span className="picker-title">Config Mode</span>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button
                  className="picker-done"
                  onClick={() => {
                    setPickerOpen(false);
                    setPickerTargetMode(null);
                  }}
                  title="Done"
                >
                  <svg viewBox="0 0 24 24">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Done
                </button>
                <button
                  className="picker-close"
                  onClick={() => {
                    setPickerOpen(false);
                    setPickerTargetMode(null);
                  }}
                >
                  <svg viewBox="0 0 24 24">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Accent selection row */}
            <div className="color-row">
              {/* Reset to base accent button */}
              <div
                className="color-swatch color-reset"
                title="Reset default color"
                style={{ background: DEFAULT_MODES[pickerTargetMode]?.accent }}
                onClick={() => resetModeColorToDefault(pickerTargetMode)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 .49-4.5" />
                </svg>
              </div>

              {/* presets */}
              {COLOR_PRESETS.map((colorObj, idx) => (
                <div
                  className={`color-swatch ${modes[pickerTargetMode]?.accent === colorObj.accent ? 'active' : ''}`}
                  key={idx}
                  style={{ background: colorObj.accent }}
                  onClick={() => assignModeColor(pickerTargetMode, colorObj.accent, colorObj.soft)}
                ></div>
              ))}

              {/* Custom input color element */}
              <div className="color-custom-wrap" title="Custom hex color">
                <svg viewBox="0 0 24 24">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <input
                  className="color-custom-input"
                  type="color"
                  defaultValue="#6e00d2"
                  onChange={(e) => {
                    const parsed = hexToAccent(e.target.value);
                    assignModeColor(pickerTargetMode, parsed.accent, parsed.soft);
                  }}
                />
              </div>
            </div>

            {/* Icon grid options list selector */}
            <div className="picker-grid">
              {Object.entries(ICON_LIBRARY).map(([libKey, def]) => (
                <div
                  className={`picker-item ${iconAssignments[pickerTargetMode] === libKey ? 'current' : ''}`}
                  key={libKey}
                  onClick={() => assignModeIcon(pickerTargetMode, libKey)}
                >
                  {def.svg}
                  <span>{def.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Text Header Mode Descriptions */}
        <p className="mode-label">Mode</p>
        <div className="title-wrap">
          {editingTitle ? (
            <input
              ref={titleInputRef}
              className="title-input"
              style={{ display: 'block' }}
              type="text"
              value={titleInputValue}
              onChange={(e) => setTitleInputValue(e.target.value)}
              onBlur={commitTitleEditing}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitTitleEditing();
              }}
            />
          ) : (
            <h1 className={`title ${editMode ? 'editable' : ''}`} id="mode-title" onClick={startEditingTitle}>
              {modes[currentMode]?.title || 'Precision'}
            </h1>
          )}
          <span className="mode-counter" id="mode-counter">
            {totalModeChecked}/{totalModeOptions}
          </span>
        </div>

        <div className="divider"></div>

        {/* Dynamic Items list area */}
        <div className="card-body">
          <div className="scroll-area">
            <ul className="options" id="options-list">
              {modes[currentMode]?.options.map((itemText, optionIdx) => {
                const isItemChecked = (selections[currentMode] || []).includes(optionIdx);
                const isEditingItem = editingItemIdx === optionIdx;

                return (
                  <li className={`option ${isItemChecked ? 'selected' : ''}`} key={optionIdx} onClick={() => handleOptionToggle(optionIdx)}>
                    {/* Tick box checkbox circle */}
                    <span className="check-box">
                      <svg viewBox="0 0 16 16">
                        <polyline points="2,8 6,12 14,4" />
                      </svg>
                    </span>

                    {isEditingItem ? (
                      <input
                        ref={listInputRef}
                        className="opt-input"
                        style={{ display: 'block' }}
                        type="text"
                        value={editingItemValue}
                        onChange={(e) => setEditingItemValue(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onBlur={() => commitItemEditing(optionIdx)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitItemEditing(optionIdx);
                        }}
                      />
                    ) : (
                      <span className="opt-text">{itemText}</span>
                    )}

                    {/* Action delete toggle */}
                    {editMode && (
                      <button className="del-btn animate-fade-in" style={{ display: 'flex' }} onClick={(e) => deleteItemOption(e, optionIdx)}>
                        ×
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>

            {editMode && (
              <button className="add-btn" style={{ display: 'flex' }} onClick={addNewItemOption}>
                <svg viewBox="0 0 24 24">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add option
              </button>
            )}
          </div>

          {/* Reset tab-checkboxes trigger */}
          <div className="reset-wrap font-sans" onClick={triggerResetChecklist} style={{ userSelect: 'none' }}>
            <button className="reset-btn" tabIndex={-1}>
              <svg viewBox="0 0 24 24">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 .49-4.5" />
              </svg>
              <span id="reset-label">{editMode ? 'Reset all columns' : 'Reset active column'}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
