export type InstitutionId = 'bgu' | 'biu' | 'tau' | 'huji' | 'technion' | 'telhai' | 'ariel';
export type GradeLevel = 9 | 10 | 11 | 12;
export type TrackId = 'math' | 'physics' | 'cs' | 'chem' | 'other';
/** 0 = Sunday ... 6 = Saturday, same as Date.getDay(). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Profile {
  name: string;
  institution: InstitutionId;
  grade: GradeLevel;
  tracks: TrackId[];
  /** Minutes it takes to get from school to campus. */
  travelMinutes: number;
  remindersEnabled: boolean;
}

export type SessionKind = 'lecture' | 'tutorial' | 'lab' | 'other';

export interface Session {
  id: string;
  title: string;
  day: Weekday;
  /** "HH:MM" */
  start: string;
  /** "HH:MM" */
  end: string;
  location: string;
  kind: SessionKind;
}

export type CourseStatus = 'planned' | 'active' | 'passed' | 'failed';

export interface Course {
  id: string;
  name: string;
  track: TrackId;
  /** The school grade the course is taken in. 9th-grade courses are preparatory and earn no credit. */
  gradeLevel: GradeLevel;
  credits: number;
  status: CourseStatus;
  /** Final grade 0-100, when known. */
  finalGrade?: number;
}

export type TaskKind = 'homework' | 'exam' | 'quiz' | 'project';
export type TaskSource = 'odyssey' | 'school';

export interface Task {
  id: string;
  title: string;
  kind: TaskKind;
  source: TaskSource;
  /** "YYYY-MM-DD" */
  due: string;
  courseId?: string;
  done: boolean;
  notes?: string;
}

export interface AppData {
  version: 1;
  profile: Profile | null;
  sessions: Session[];
  courses: Course[];
  tasks: Task[];
}
