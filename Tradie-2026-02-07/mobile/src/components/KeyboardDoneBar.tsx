/**
 * The bar above the keyboard: Done (number pads and multi-line fields have no other way to
 * close it) and arrows to move between fields. Every screen gets one through the root Stack's
 * screenLayout; a Modal is its own window, so FormSheet renders its own.
 */
import React from 'react';
import { KeyboardToolbar } from 'react-native-keyboard-controller';
import { useTheme } from '@/lib/theme';

/** The Done bar's height (the library's KEYBOARD_TOOLBAR_HEIGHT, which it doesn't export). */
const DONE_BAR_HEIGHT = 42;

/** Space to keep between the field being typed in and the keyboard: clears the Done bar, plus a gap. */
export const KEYBOARD_CLEARANCE = DONE_BAR_HEIGHT + 20;

export function KeyboardDoneBar() {
  const t = useTheme();
  // The app's own light/dark (Account → Appearance), not the phone's, so both entries match it.
  const theme = { primary: t.link, disabled: t.divider, background: t.surface, ripple: t.divider };
  return <KeyboardToolbar doneText="Done" theme={{ light: theme, dark: theme }} />;
}
