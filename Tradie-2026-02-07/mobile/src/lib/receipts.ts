/**
 * Receipt photos live in the app's Documents folder. iOS moves that folder on every
 * app update, so an expense keeps only the file's name ("receipts/receipt_123.jpg")
 * and the full address is worked out each time it's needed.
 */
import * as FileSystem from 'expo-file-system/legacy';

const DIR = 'receipts/';

/** Copies a picked or taken photo into the receipts folder and returns what to store on the expense. */
export async function saveReceipt(pickedUri: string): Promise<string> {
  await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}${DIR}`, { intermediates: true });
  const stored = `${DIR}receipt_${Date.now()}.jpg`;
  await FileSystem.copyAsync({ from: pickedUri, to: `${FileSystem.documentDirectory}${stored}` });
  return stored;
}

/**
 * Where the photo is today. Also repairs receipts saved before 1.6, which stored the
 * whole address (now stale after an update): only the file name is kept.
 */
export function receiptFileUri(stored: string): string {
  const name = stored.slice(stored.lastIndexOf('/') + 1);
  return `${FileSystem.documentDirectory}${DIR}${name}`;
}

/** Deletes a receipt photo that nothing uses any more. Never throws. */
export async function deleteReceipt(stored: string | undefined): Promise<void> {
  if (!stored) return;
  try {
    await FileSystem.deleteAsync(receiptFileUri(stored), { idempotent: true });
  } catch {
    // A leftover photo is harmless.
  }
}

/** Deletes every receipt photo (Clear all data). */
export async function deleteAllReceipts(): Promise<void> {
  try {
    await FileSystem.deleteAsync(`${FileSystem.documentDirectory}${DIR}`, { idempotent: true });
  } catch {
    // Nothing to delete.
  }
}
