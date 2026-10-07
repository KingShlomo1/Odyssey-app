import type { Session, Task } from './types';
import { nextOccurrence, toISODate, parseISODate } from './time';
import { SESSION_KINDS, TASK_KINDS } from './constants';

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Folds a content line to at most 75 octets per line, without splitting UTF-8 characters. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const len = enc.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // continuation lines start with a space
    if (bytes + len > limit) {
      out.push(current);
      current = '';
      bytes = 0;
    }
    current += ch;
    bytes += len;
  }
  out.push(current);
  return out.join('\r\n ');
}

const pad = (n: number) => String(n).padStart(2, '0');
const localStamp = (d: Date) =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
const dateStamp = (iso: string) => iso.replace(/-/g, '');
const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** The last day of the school year (June 30) that `now` falls in. */
export function schoolYearEnd(now: Date): Date {
  const year = now.getMonth() >= 7 ? now.getFullYear() + 1 : now.getFullYear();
  return new Date(year, 5, 30, 23, 59);
}

export interface IcsOptions {
  travelMinutes: number;
  now?: Date;
}

/**
 * Builds an iCalendar file with weekly recurring campus sessions (with a "time to leave" alarm)
 * and open tasks as all-day events (with an alarm the evening before).
 * Times are written in floating local time, which calendar apps read as the device's time zone.
 */
export function buildIcs(sessions: Session[], tasks: Task[], { travelMinutes, now = new Date() }: IcsOptions): string {
  const stamp = utcStamp(now);
  const until = utcStamp(schoolYearEnd(now));
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Odyssey App//HE', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:אודיסאה'];

  // Only the first session of each weekday needs a "time to leave" alarm.
  const firstOfDay = new Map<number, Session>();
  for (const s of sessions) {
    const cur = firstOfDay.get(s.day);
    if (!cur || s.start < cur.start) firstOfDay.set(s.day, s);
  }

  for (const s of sessions) {
    const occ = nextOccurrence(s, now);
    lines.push(
      'BEGIN:VEVENT',
      `UID:session-${s.id}@odyssey-app`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${localStamp(occ.start)}`,
      `DTEND:${localStamp(occ.end)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[s.day]};UNTIL=${until}`,
      `SUMMARY:${escapeText(`${s.title} (${SESSION_KINDS[s.kind]})`)}`,
    );
    if (s.location) lines.push(`LOCATION:${escapeText(s.location)}`);
    if (firstOfDay.get(s.day) === s) {
      lines.push(
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:${escapeText(`הגיע הזמן לצאת ל${s.title}`)}`,
        `TRIGGER:-PT${Math.max(0, Math.round(travelMinutes))}M`,
        'END:VALARM',
      );
    }
    lines.push('END:VEVENT');
  }

  for (const t of tasks) {
    if (t.done) continue;
    const next = parseISODate(t.due);
    next.setDate(next.getDate() + 1);
    lines.push(
      'BEGIN:VEVENT',
      `UID:task-${t.id}@odyssey-app`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${dateStamp(t.due)}`,
      `DTEND;VALUE=DATE:${dateStamp(toISODate(next))}`,
      `SUMMARY:${escapeText(`${TASK_KINDS[t.kind]}: ${t.title}`)}`,
    );
    if (t.notes) lines.push(`DESCRIPTION:${escapeText(t.notes)}`);
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(`מחר: ${t.title}`)}`,
      'TRIGGER:-PT6H',
      'END:VALARM',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
