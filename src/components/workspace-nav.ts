export const PRIMARY_TAB_ROUTES = [
  {
    name: 'dashboard',
    href: '/dashboard',
    label: 'Dashboard',
    icon: 'home',
    sf: 'house.fill',
    md: 'home',
  },
  {
    name: 'sessions',
    href: '/sessions',
    label: 'Sessions',
    icon: 'clock',
    sf: 'clock.fill',
    md: 'schedule',
  },
  {
    name: 'invoices',
    href: '/invoices',
    label: 'Invoices',
    icon: 'file',
    sf: 'doc.text.fill',
    md: 'description',
  },
  {
    name: 'mercury',
    href: '/mercury',
    label: 'Mercury',
    icon: 'credit-card',
    sf: 'building.columns.fill',
    md: 'account_balance',
  },
] as const;

export type PrimaryTabRoute = (typeof PRIMARY_TAB_ROUTES)[number];

export const CANVAS_BACKGROUND = {
  light: '#f8f7f3',
  dark: '#1a1f16',
} as const;

export const CANVAS_FOREGROUND = {
  light: '#1a1f16',
  dark: '#f8f7f3',
} as const;

export const TAB_TINT = {
  light: '#bb7e5d',
  dark: '#d4955f',
} as const;

export const TAB_PILL = {
  light: {
    inactive: '#AFE4B7',
    active: '#bb7e5d',
    inactiveText: '#1a1f16',
    activeText: '#ffffff',
    glow: '0 0 12px 3px rgba(175, 228, 183, 0.55)',
  },
  dark: {
    inactive: '#8fd49a',
    active: '#d4955f',
    inactiveText: '#f8f7f3',
    activeText: '#ffffff',
    glow: '0 0 12px 3px rgba(143, 212, 154, 0.45)',
  },
} as const;

export function canvasBackground(isDark: boolean): string {
  return isDark ? CANVAS_BACKGROUND.dark : CANVAS_BACKGROUND.light;
}

export function canvasForeground(isDark: boolean): string {
  return isDark ? CANVAS_FOREGROUND.dark : CANVAS_FOREGROUND.light;
}

export function tabTint(isDark: boolean): string {
  return isDark ? TAB_TINT.dark : TAB_TINT.light;
}
