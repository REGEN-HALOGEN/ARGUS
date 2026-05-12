// ─── ARGUS Design Tokens ─────────────────────────────────────────

export const colors = {
  // Primary — Cyber Blue
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
    950: '#172554',
  },

  // Accent — Neon Cyan
  accent: {
    50: '#ecfeff',
    100: '#cffafe',
    200: '#a5f3fc',
    300: '#67e8f9',
    400: '#22d3ee',
    500: '#06b6d4',
    600: '#0891b2',
    700: '#0e7490',
    800: '#155e75',
    900: '#164e63',
    950: '#083344',
  },

  // Threat — Danger Red
  threat: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
    950: '#450a0a',
  },

  // Warning — Amber
  warning: {
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
  },

  // Success — Emerald
  success: {
    400: '#34d399',
    500: '#10b981',
    600: '#059669',
  },

  // Neutral — Slate (dark mode friendly)
  neutral: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    850: '#172033',
    900: '#0f172a',
    950: '#020617',
  },
} as const;

// ─── Typography ──────────────────────────────────────────────────

export const typography = {
  fontFamily: {
    sans: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
    '5xl': '3rem',
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

// ─── Spacing ─────────────────────────────────────────────────────

export const spacing = {
  px: '1px',
  0: '0',
  0.5: '0.125rem',
  1: '0.25rem',
  1.5: '0.375rem',
  2: '0.5rem',
  2.5: '0.625rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
  20: '5rem',
  24: '6rem',
} as const;

// ─── Motion ──────────────────────────────────────────────────────

export const motion = {
  duration: {
    instant: 0.1,
    fast: 0.15,
    normal: 0.25,
    slow: 0.35,
    slower: 0.5,
  },
  ease: {
    default: [0.25, 0.1, 0.25, 1],
    in: [0.4, 0, 1, 1],
    out: [0, 0, 0.2, 1],
    inOut: [0.4, 0, 0.2, 1],
    spring: [0.175, 0.885, 0.32, 1.275],
  },
} as const;

// ─── Glassmorphism ───────────────────────────────────────────────

export const glass = {
  light: {
    background: 'rgba(255, 255, 255, 0.08)',
    border: 'rgba(255, 255, 255, 0.12)',
    blur: '12px',
  },
  medium: {
    background: 'rgba(255, 255, 255, 0.12)',
    border: 'rgba(255, 255, 255, 0.18)',
    blur: '20px',
  },
  heavy: {
    background: 'rgba(255, 255, 255, 0.18)',
    border: 'rgba(255, 255, 255, 0.25)',
    blur: '30px',
  },
} as const;

// ─── Shadows ─────────────────────────────────────────────────────

export const shadows = {
  glow: {
    primary: '0 0 20px rgba(59, 130, 246, 0.3)',
    accent: '0 0 20px rgba(6, 182, 212, 0.3)',
    threat: '0 0 20px rgba(239, 68, 68, 0.3)',
    success: '0 0 20px rgba(16, 185, 129, 0.3)',
  },
  elevation: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
  },
} as const;
