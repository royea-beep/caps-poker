export const CAPS_THEME = {
  bg: {
    primary: '#0A0A12',
    secondary: '#12121F',
    surface: '#1A1A2E',
    table: '#5C1818',
    tableDark: '#3A0E0E',
  },
  gold: {
    bright: '#FFD700',
    muted: '#C5A028',
    dim: '#8B7219',
  },
  text: {
    primary: '#F5F0E8',
    secondary: '#A09880',
    accent: '#FFD700',
    danger: '#FF4444',
    success: '#44DD88',
  },
  card: {
    bg: '#FFFEF8',
    border: '#E8E0D0',
    shadow: 'rgba(0,0,0,0.4)',
    red: '#CC0000',
    black: '#1A1A1A',
    radius: 8,
  },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  font: { brand: 'System', body: 'System', mono: 'Menlo' },
} as const;
