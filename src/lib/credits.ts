import type { Course, TrackId } from './types';

export interface CreditSummary {
  earned: number;
  inProgress: number;
  planned: number;
  /** Credit-weighted average of passed courses with a final grade, or null if none. */
  average: number | null;
  byTrack: Partial<Record<TrackId, number>>;
}

/** 9th-grade courses are preparatory and never earn academic credit. */
export function countsForCredit(course: Course): boolean {
  return course.gradeLevel !== 9;
}

export function summarizeCredits(courses: Course[]): CreditSummary {
  const summary: CreditSummary = { earned: 0, inProgress: 0, planned: 0, average: null, byTrack: {} };
  let weighted = 0;
  let weight = 0;
  for (const c of courses) {
    if (!countsForCredit(c)) continue;
    if (c.status === 'passed') {
      summary.earned += c.credits;
      summary.byTrack[c.track] = (summary.byTrack[c.track] ?? 0) + c.credits;
      if (c.finalGrade != null && c.credits > 0) {
        weighted += c.finalGrade * c.credits;
        weight += c.credits;
      }
    } else if (c.status === 'active') {
      summary.inProgress += c.credits;
    } else if (c.status === 'planned') {
      summary.planned += c.credits;
    }
  }
  if (weight > 0) summary.average = Math.round((weighted / weight) * 10) / 10;
  return summary;
}
