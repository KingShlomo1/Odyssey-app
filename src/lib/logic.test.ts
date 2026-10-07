import { describe, expect, it } from 'vitest';
import type { Course, Session, Task } from './types';
import { daysUntil, leaveBy, nextOccurrence, upcomingCampusDays, formatMinutes } from './time';
import { summarizeCredits } from './credits';
import { findCrunch, isOverdue } from './workload';
import { buildIcs, foldLine, schoolYearEnd } from './ics';
import { parseData } from './storage';

// Wednesday 7 Oct 2026, 10:00 local time.
const NOW = new Date(2026, 9, 7, 10, 0);

const session = (over: Partial<Session> = {}): Session => ({
  id: 's1', title: 'חדו״א', day: 0, start: '15:00', end: '17:00', location: 'בניין 5', kind: 'lecture', ...over,
});

const course = (over: Partial<Course>): Course => ({
  id: 'c', name: 'קורס', track: 'math', gradeLevel: 10, credits: 4, status: 'passed', ...over,
});

const task = (over: Partial<Task>): Task => ({
  id: 't', title: 'משימה', kind: 'homework', source: 'odyssey', due: '2026-10-08', done: false, ...over,
});

describe('time', () => {
  it('finds the next weekly occurrence', () => {
    const occ = nextOccurrence(session({ day: 0 }), NOW); // Sunday
    expect(occ.start).toEqual(new Date(2026, 9, 11, 15, 0));
  });

  it('treats a session later today as today, and a finished one as next week', () => {
    expect(nextOccurrence(session({ day: 3, start: '15:00', end: '17:00' }), NOW).start.getDate()).toBe(7);
    expect(nextOccurrence(session({ day: 3, start: '08:00', end: '09:30' }), NOW).start.getDate()).toBe(14);
  });

  it('keeps a session in progress as current', () => {
    expect(nextOccurrence(session({ day: 3, start: '09:00', end: '11:00' }), NOW).start.getDate()).toBe(7);
  });

  it('picks the first session of each campus day', () => {
    const days = upcomingCampusDays(
      [session({ id: 'a', day: 4, start: '17:00', end: '18:00' }), session({ id: 'b', day: 4, start: '15:00', end: '16:30' }), session({ id: 'c', day: 0 })],
      NOW,
    );
    expect(days.map((d) => d.session.id)).toEqual(['b', 'c']);
  });

  it('computes when to leave', () => {
    const occ = nextOccurrence(session({ day: 0, start: '15:00' }), NOW);
    expect(leaveBy(occ, 50)).toEqual(new Date(2026, 9, 11, 14, 10));
    expect(formatMinutes(15 * 60 - 50)).toBe('14:10');
  });

  it('counts calendar days', () => {
    expect(daysUntil('2026-10-07', NOW)).toBe(0);
    expect(daysUntil('2026-10-08', NOW)).toBe(1);
    expect(daysUntil('2026-10-01', NOW)).toBe(-6);
  });
});

describe('credits', () => {
  it('sums passed credits, excludes 9th grade, and weights the average', () => {
    const s = summarizeCredits([
      course({ id: '1', credits: 4, finalGrade: 90, track: 'math' }),
      course({ id: '2', credits: 2, finalGrade: 60, track: 'cs' }),
      course({ id: '3', credits: 3, status: 'active' }),
      course({ id: '4', credits: 5, gradeLevel: 9, finalGrade: 50 }),
      course({ id: '5', credits: 3, status: 'failed', finalGrade: 40 }),
    ]);
    expect(s.earned).toBe(6);
    expect(s.inProgress).toBe(3);
    expect(s.average).toBe(80);
    expect(s.byTrack).toEqual({ math: 4, cs: 2 });
  });

  it('has no average without grades', () => {
    expect(summarizeCredits([course({ finalGrade: undefined })]).average).toBeNull();
  });
});

describe('workload', () => {
  it('flags three items within three days', () => {
    const crunch = findCrunch(
      [task({ id: '1', due: '2026-10-09' }), task({ id: '2', due: '2026-10-10' }), task({ id: '3', due: '2026-10-11' }), task({ id: '4', due: '2026-10-20' })],
      NOW,
    );
    expect(crunch).toEqual({ start: '2026-10-09', count: 3 });
  });

  it('flags two exams close together', () => {
    expect(findCrunch([task({ id: '1', kind: 'exam', due: '2026-10-12' }), task({ id: '2', kind: 'quiz', due: '2026-10-13' })], NOW)).not.toBeNull();
  });

  it('ignores done and past tasks', () => {
    expect(
      findCrunch([task({ id: '1', done: true }), task({ id: '2', due: '2026-10-01' }), task({ id: '3', due: '2026-10-02' }), task({ id: '4' })], NOW),
    ).toBeNull();
  });

  it('detects overdue tasks', () => {
    expect(isOverdue(task({ due: '2026-10-06' }), NOW)).toBe(true);
    expect(isOverdue(task({ due: '2026-10-07' }), NOW)).toBe(false);
  });
});

describe('ics', () => {
  it('folds lines by UTF-8 bytes without splitting characters', () => {
    const line = 'SUMMARY:' + 'א'.repeat(80);
    const folded = foldLine(line);
    for (const part of folded.split('\r\n')) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.split('\r\n ').join('')).toBe(line);
  });

  it('ends the school year on June 30', () => {
    expect(schoolYearEnd(NOW).getFullYear()).toBe(2027);
    expect(schoolYearEnd(new Date(2027, 2, 1)).getFullYear()).toBe(2027);
  });

  it('exports recurring sessions with a leave alarm and open tasks only', () => {
    const ics = buildIcs([session({ title: 'פיזיקה, תרגול' })], [task({ id: 'open' }), task({ id: 'closed', done: true })], { travelMinutes: 40, now: NOW });
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=SU;UNTIL=');
    expect(ics).toContain('DTSTART:20261011T150000');
    expect(ics).toContain('TRIGGER:-PT40M');
    expect(ics).toContain('פיזיקה\\, תרגול');
    expect(ics).toContain('UID:task-open@odyssey-app');
    expect(ics).not.toContain('task-closed');
    expect(ics).toContain('DTEND;VALUE=DATE:20261009');
  });

  it('puts the leave alarm only on the first session of each day', () => {
    const ics = buildIcs(
      [session({ id: 'late', start: '17:45', end: '18:45' }), session({ id: 'early', start: '15:30', end: '17:30' })],
      [],
      { travelMinutes: 30, now: NOW },
    );
    const events = ics.split('BEGIN:VEVENT').slice(1);
    expect(events.find((e) => e.includes('session-early'))).toContain('VALARM');
    expect(events.find((e) => e.includes('session-late'))).not.toContain('VALARM');
  });
});

describe('storage', () => {
  it('rejects data that is not a backup', () => {
    expect(parseData({ foo: 1 })).toBeNull();
    expect(parseData({ version: 2, sessions: [], courses: [], tasks: [] })).toBeNull();
    expect(parseData({ version: 1, sessions: [], courses: [], tasks: [] })?.profile).toBeNull();
  });
});
