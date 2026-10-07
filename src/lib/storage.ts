import { AppDataSchema, type AppData } from '../../shared/schema';

/** Where the earlier offline-only version of the app kept its data. */
export const LEGACY_STORAGE_KEY = 'odyssey-app:data';

/** Validates untrusted JSON (an imported backup or legacy local data). */
export function parseData(raw: unknown): AppData | null {
  const result = AppDataSchema.safeParse(raw);
  return result.success ? (result.data as AppData) : null;
}

/** Data saved by the offline version on this device, if any is worth importing. */
export function legacyData(): AppData | null {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    const data = raw ? parseData(JSON.parse(raw)) : null;
    return data && (data.sessions.length || data.courses.length || data.tasks.length) ? data : null;
  } catch {
    return null;
  }
}

export function clearLegacyData(): void {
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function downloadFile(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
