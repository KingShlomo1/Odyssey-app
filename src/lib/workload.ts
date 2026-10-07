import type { Task } from './types';
import { daysUntil } from './time';

/** Open tasks sorted by due date, earliest first. */
export function openTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => !t.done).sort((a, b) => a.due.localeCompare(b.due));
}

export function isOverdue(task: Task, now: Date = new Date()): boolean {
  return !task.done && daysUntil(task.due, now) < 0;
}

/**
 * Flags a crunch: a 3-day window (starting today or later) with 3 or more open items,
 * or 2 or more exams/quizzes. Returns the first such window's start date, or null.
 */
export function findCrunch(tasks: Task[], now: Date = new Date()): { start: string; count: number } | null {
  const upcoming = openTasks(tasks).filter((t) => daysUntil(t.due, now) >= 0);
  for (let i = 0; i < upcoming.length; i++) {
    const startDay = daysUntil(upcoming[i].due, now);
    const window = upcoming.filter((t) => {
      const d = daysUntil(t.due, now);
      return d >= startDay && d < startDay + 3;
    });
    const tests = window.filter((t) => t.kind === 'exam' || t.kind === 'quiz').length;
    if (window.length >= 3 || tests >= 2) return { start: upcoming[i].due, count: window.length };
  }
  return null;
}
