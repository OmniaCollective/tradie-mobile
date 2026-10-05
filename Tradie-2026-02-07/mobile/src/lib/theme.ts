/**
 * App-wide design tokens.
 * Import from here instead of defining colors inline.
 *
 * NOTE: NativeWind className strings (e.g. `bg-[#0F172A]`) must use literal hex
 * values — Tailwind cannot resolve JS constants at build time. Use these exports
 * for icon `color` props, inline `style` objects, and any JS-computed values.
 */

// ─── Primary accent ───────────────────────────────────────────────────────────
export const TURQUOISE = '#14B8A6';
export const TURQUOISE_DARK = '#0D9488';
export const TURQUOISE_DEEPER = '#134E4A';

// ─── Backgrounds ──────────────────────────────────────────────────────────────
export const DARK_BG = '#0F172A';
export const CARD_BG = '#1E293B';

// ─── Borders & UI chrome ──────────────────────────────────────────────────────
export const BORDER = '#334155';

// ─── Slate scale (low → high luminance) ──────────────────────────────────────
export const SLATE_600 = '#475569';   // placeholder text
export const SLATE_500 = '#64748B';   // muted icons / secondary text
export const SLATE_400 = '#94A3B8';   // tertiary text
export const SLATE_300 = '#CBD5E1';
export const SLATE_200 = '#E2E8F0';

// ─── Text ─────────────────────────────────────────────────────────────────────
export const TEXT_PRIMARY = '#F8FAFC';  // near-white, headings / body on dark BG
export const WHITE = '#FFFFFF';         // pure white — icons on coloured buttons

// ─── Semantic status colours ──────────────────────────────────────────────────
export const GREEN = '#22C55E';    // completed / success
export const EMERALD = '#10B981';  // paid / approved
export const AMBER = '#F59E0B';    // warning / pending / urgent
export const ORANGE = '#F97316';   // invoiced
export const RED = '#EF4444';      // danger / error / emergency
export const BLUE = '#3B82F6';     // scheduled / info
export const PURPLE = '#8B5CF6';   // quoted / sent (invoice)

// ─── Premium / highlight ──────────────────────────────────────────────────────
export const YELLOW = '#FCD34D';   // premium star / lifetime badge
