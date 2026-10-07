import type { CourseStatus, InstitutionId, SessionKind, TaskKind, TaskSource, TrackId } from './types';

export const INSTITUTIONS: Record<InstitutionId, string> = {
  bgu: 'אוניברסיטת בן-גוריון בנגב',
  biu: 'אוניברסיטת בר-אילן',
  tau: 'אוניברסיטת תל אביב',
  huji: 'האוניברסיטה העברית בירושלים',
  technion: 'הטכניון',
  telhai: 'אוניברסיטת תל-חי',
  ariel: 'אוניברסיטת אריאל',
};

export const TRACKS: Record<TrackId, string> = {
  math: 'מתמטיקה',
  physics: 'פיזיקה',
  cs: 'מדעי המחשב',
  chem: 'כימיה',
  other: 'אחר',
};

export const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'] as const;

export const GRADE_NAMES: Record<number, string> = { 9: 'ט׳', 10: 'י׳', 11: 'י״א', 12: 'י״ב' };

export const SESSION_KINDS: Record<SessionKind, string> = {
  lecture: 'הרצאה',
  tutorial: 'תרגול',
  lab: 'מעבדה',
  other: 'אחר',
};

export const COURSE_STATUSES: Record<CourseStatus, string> = {
  planned: 'מתוכנן',
  active: 'בלימודים',
  passed: 'עבר',
  failed: 'לא עבר',
};

export const TASK_KINDS: Record<TaskKind, string> = {
  homework: 'שיעורי בית',
  exam: 'מבחן',
  quiz: 'בוחן',
  project: 'פרויקט',
};

export const TASK_SOURCES: Record<TaskSource, string> = {
  odyssey: 'אודיסאה',
  school: 'בית ספר',
};
