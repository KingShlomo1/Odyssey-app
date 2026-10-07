import type { AppData } from './types';

export const STORAGE_KEY = 'odyssey-app:data';

export const emptyData = (): AppData => ({ version: 1, profile: null, sessions: [], courses: [], tasks: [] });

/** Validates and normalizes untrusted JSON (from storage or an imported backup). */
export function parseData(raw: unknown): AppData | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Partial<AppData>;
  if (d.version !== 1) return null;
  if (!Array.isArray(d.sessions) || !Array.isArray(d.courses) || !Array.isArray(d.tasks)) return null;
  return {
    version: 1,
    profile: d.profile ?? null,
    sessions: d.sessions,
    courses: d.courses,
    tasks: d.tasks,
  };
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return parseData(JSON.parse(raw)) ?? emptyData();
  } catch {
    // Storage unavailable or corrupt: start fresh.
  }
  return emptyData();
}

export function saveData(data: AppData): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function downloadFile(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
