/**
 * Tradie design tokens (brand system v4, approved 2026-10-06 — see brand/BRAND-BRIEF.md).
 *
 * Eight colours, each with a light and a dark value. Screens never use raw hex:
 * - In className, use the token utilities from tailwind.config.js
 *   (`bg-bg`, `bg-surface`, `border-divider`, `text-fg`, `text-secondary`,
 *   `bg-accent`, `text-on-accent`, `text-link`, `text-alert`). They read CSS
 *   variables that ThemeRoot sets from the phone's light/dark setting.
 * - For icon `color` props and other JS values, use `useTheme()`.
 */
import { useColorScheme, Appearance as RNAppearance } from 'react-native';
import { vars } from 'nativewind';
import { useTradeStore } from './store';

export interface Palette {
  /** Screen behind everything */
  bg: string;
  /** Grouped lists, sheets, tab bar */
  surface: string;
  /** Lines inside lists, input borders */
  divider: string;
  /** Titles, body, amounts */
  fg: string;
  /** Supporting text, idle icons */
  secondary: string;
  /** Logo cyan: primary button fill, active marks */
  accent: string;
  /** Text and icons on the accent fill */
  onAccent: string;
  /** Links, active tab, "Paid" */
  link: string;
  /** Overdue, emergency, delete */
  alert: string;
}

export const palettes: Record<'light' | 'dark', Palette> = {
  light: {
    bg: '#F3F5F7',
    surface: '#FFFFFF',
    divider: '#E4E7EB',
    fg: '#0B1220',
    secondary: '#5B6676',
    accent: '#00F5F5',
    onAccent: '#0F172A',
    link: '#0E7C86',
    alert: '#B91C1C',
  },
  dark: {
    bg: '#0F172A',
    surface: '#1E293B',
    divider: '#334155',
    fg: '#F8FAFC',
    secondary: '#94A3B8',
    accent: '#00F5F5',
    onAccent: '#0F172A',
    link: '#00F5F5',
    alert: '#F87171',
  },
};

export type ColorMode = 'light' | 'dark';

/**
 * Applies the tradie's Appearance choice to the whole app, including native parts
 * (switches, date pickers, keyboard). "automatic" hands control back to the iPhone.
 */
export function applyAppearance(choice: 'automatic' | 'light' | 'dark' | undefined) {
  try {
    RNAppearance.setColorScheme(choice === 'light' || choice === 'dark' ? choice : 'unspecified');
  } catch {
    // not supported here (web preview): the system setting applies
  }
}

/** Light or dark: the tradie's Appearance choice, or the iPhone's setting when it's Automatic. */
export function useColorMode(): ColorMode {
  const system = useColorScheme();
  const choice = useTradeStore((s) => s.settings.appearance);
  if (choice === 'light' || choice === 'dark') return choice;
  return system === 'light' ? 'light' : 'dark';
}

/** The current palette, for icon colours and other values outside className. */
export function useTheme(): Palette & { mode: ColorMode } {
  const mode = useColorMode();
  return { ...palettes[mode], mode };
}

function rgbTriplet(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

function cssVars(p: Palette) {
  return vars({
    '--c-bg': rgbTriplet(p.bg),
    '--c-surface': rgbTriplet(p.surface),
    '--c-divider': rgbTriplet(p.divider),
    '--c-fg': rgbTriplet(p.fg),
    '--c-secondary': rgbTriplet(p.secondary),
    '--c-accent': rgbTriplet(p.accent),
    '--c-on-accent': rgbTriplet(p.onAccent),
    '--c-link': rgbTriplet(p.link),
    '--c-alert': rgbTriplet(p.alert),
  });
}

/** NativeWind variable sets, applied by ThemeRoot at the top of the app. */
export const themeVars = { light: cssVars(palettes.light), dark: cssVars(palettes.dark) };
