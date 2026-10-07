import type { Session } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Local date as "YYYY-MM-DD". */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parses "YYYY-MM-DD" as a local date at midnight. */
export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Whole calendar days from `from` to the date `iso` (negative when in the past). */
export function daysUntil(iso: string, from: Date = new Date()): number {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((parseISODate(iso).getTime() - start.getTime()) / 86_400_000);
}

export function minutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function formatMinutes(total: number): string {
  const t = ((total % 1440) + 1440) % 1440;
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
}

export function formatDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric' });
}

export function relativeDay(iso: string, from: Date = new Date()): string {
  const n = daysUntil(iso, from);
  if (n === 0) return 'היום';
  if (n === 1) return 'מחר';
  if (n === -1) return 'אתמול';
  if (n < 0) return `לפני ${-n} ימים`;
  return `בעוד ${n} ימים`;
}

export interface Occurrence {
  session: Session;
  start: Date;
  end: Date;
}

/** The next time `session` starts at or after `now` (a session in progress counts as current). */
export function nextOccurrence(session: Session, now: Date = new Date()): Occurrence {
  const startMin = minutesOfDay(session.start);
  const endMin = minutesOfDay(session.end);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let offset = (session.day - now.getDay() + 7) % 7;
  if (offset === 0 && nowMin >= endMin) offset = 7;
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(startMin / 60), startMin % 60);
  const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(endMin / 60), endMin % 60);
  return { session, start, end };
}

/** Upcoming occurrences of all sessions, soonest first. */
export function upcomingSessions(sessions: Session[], now: Date = new Date()): Occurrence[] {
  return sessions.map((s) => nextOccurrence(s, now)).sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * The first session of each campus day, soonest first: that's the one you need to leave school for.
 */
export function upcomingCampusDays(sessions: Session[], now: Date = new Date()): Occurrence[] {
  const byDay = new Map<string, Occurrence>();
  for (const occ of upcomingSessions(sessions, now)) {
    const key = toISODate(occ.start);
    if (!byDay.has(key)) byDay.set(key, occ);
  }
  return [...byDay.values()];
}

export function leaveBy(occ: Occurrence, travelMinutes: number): Date {
  return new Date(occ.start.getTime() - travelMinutes * 60_000);
}

export function formatClock(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
