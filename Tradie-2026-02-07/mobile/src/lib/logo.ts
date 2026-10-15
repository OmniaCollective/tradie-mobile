/**
 * The business logo, printed on quotes and invoices. Kept in the app's Documents folder by
 * file name only (iOS moves the folder on updates, see receipts.ts). The PDF maker can't
 * read app files, so the logo goes into the page as base64.
 */
import * as FileSystem from 'expo-file-system/legacy';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

const DIR = 'logo/';

/**
 * The PDF prints the logo at up to 180 × 64 points. Three times that is sharp on paper and
 * keeps every PDF small, where a phone photo would add megabytes to each one.
 */
const MAX_WIDTH = 540;
const MAX_HEIGHT = 192;

const extOf = (uri: string) => {
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase();
  return ext === 'png' ? 'png' : 'jpg';
};

/**
 * Saves a picked image as the logo, replacing any old one, and returns its file name. It's
 * scaled down to print size and kept as PNG, so a transparent background stays transparent.
 */
export async function saveLogo(pickedUri: string, previous?: string): Promise<string> {
  await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}${DIR}`, { intermediates: true });
  const context = ImageManipulator.manipulate(pickedUri);
  const original = await context.renderAsync();
  const scale = Math.min(1, MAX_WIDTH / original.width, MAX_HEIGHT / original.height);
  const image = scale < 1 ? await context.resize({ width: Math.round(original.width * scale) }).renderAsync() : original;
  const saved = await image.saveAsync({ format: SaveFormat.PNG });
  const name = `logo_${Date.now()}.png`;
  await FileSystem.moveAsync({ from: saved.uri, to: logoFileUri(name) });
  if (previous) await deleteLogo(previous);
  return name;
}

export function logoFileUri(name: string): string {
  return `${FileSystem.documentDirectory}${DIR}${name.slice(name.lastIndexOf('/') + 1)}`;
}

/** Deletes a logo file. Never throws. */
export async function deleteLogo(name: string | undefined): Promise<void> {
  if (!name) return;
  try {
    await FileSystem.deleteAsync(logoFileUri(name), { idempotent: true });
  } catch {
    // A leftover image is harmless.
  }
}

/** The logo as a data URI for the PDF, or nothing if there isn't one (or it's gone missing). */
export async function logoDataUri(name: string | undefined): Promise<string | undefined> {
  if (!name) return undefined;
  try {
    const base64 = await FileSystem.readAsStringAsync(logoFileUri(name), { encoding: FileSystem.EncodingType.Base64 });
    return `data:image/${extOf(name) === 'png' ? 'png' : 'jpeg'};base64,${base64}`;
  } catch {
    return undefined;
  }
}
