import { z } from 'zod';

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:MM');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');
const text = (max: number) => z.string().trim().max(max);

export const InstitutionId = z.enum(['bgu', 'biu', 'tau', 'huji', 'technion', 'telhai', 'ariel']);
export const GradeLevel = z.union([z.literal(9), z.literal(10), z.literal(11), z.literal(12)]);
export const TrackId = z.enum(['math', 'physics', 'cs', 'chem', 'other']);

export const ProfileSchema = z.object({
  name: text(60).min(1),
  institution: InstitutionId,
  grade: GradeLevel,
  tracks: z.array(TrackId).max(5),
  /** Minutes it takes to get from school to campus. */
  travelMinutes: z.number().int().min(0).max(300),
  remindersEnabled: z.boolean(),
});

export const SessionKind = z.enum(['lecture', 'tutorial', 'lab', 'other']);
export const SessionSchema = z
  .object({
    id: z.string(),
    title: text(120).min(1),
    day: z.number().int().min(0).max(6).transform((d) => d as 0 | 1 | 2 | 3 | 4 | 5 | 6),
    start: hhmm,
    end: hhmm,
    location: text(120),
    kind: SessionKind,
  })
  .refine((s) => s.end > s.start, { message: 'end must be after start', path: ['end'] });

export const CourseStatus = z.enum(['planned', 'active', 'passed', 'failed']);
export const CourseSchema = z.object({
  id: z.string(),
  name: text(120).min(1),
  track: TrackId,
  /** The school grade the course is taken in. 9th-grade courses are preparatory and earn no credit. */
  gradeLevel: GradeLevel,
  credits: z.number().min(0).max(20),
  status: CourseStatus,
  /** Final grade 0-100, when known. */
  finalGrade: z.number().min(0).max(100).optional(),
});

export const TaskKind = z.enum(['homework', 'exam', 'quiz', 'project']);
export const TaskSource = z.enum(['odyssey', 'school']);
export const TaskSchema = z.object({
  id: z.string(),
  title: text(160).min(1),
  kind: TaskKind,
  source: TaskSource,
  due: isoDate,
  courseId: z.string().optional(),
  done: z.boolean(),
  notes: text(2000).optional(),
});

export type InstitutionId = z.infer<typeof InstitutionId>;
export type GradeLevel = z.infer<typeof GradeLevel>;
export type TrackId = z.infer<typeof TrackId>;
/** 0 = Sunday ... 6 = Saturday, same as Date.getDay(). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type Profile = z.infer<typeof ProfileSchema>;
export type SessionKind = z.infer<typeof SessionKind>;
export type Session = z.infer<typeof SessionSchema>;
export type CourseStatus = z.infer<typeof CourseStatus>;
export type Course = z.infer<typeof CourseSchema>;
export type TaskKind = z.infer<typeof TaskKind>;
export type TaskSource = z.infer<typeof TaskSource>;
export type Task = z.infer<typeof TaskSchema>;

export interface AppData {
  version: 1;
  profile: Profile | null;
  sessions: Session[];
  courses: Course[];
  tasks: Task[];
}

export const AppDataSchema = z.object({
  version: z.literal(1),
  profile: ProfileSchema.nullable().default(null),
  sessions: z.array(SessionSchema).max(200),
  courses: z.array(CourseSchema).max(200),
  tasks: z.array(TaskSchema).max(2000),
});

export const RegisterSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8).max(200),
  name: text(60).min(1),
});

export const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().max(200),
  password: z.string().max(200),
});

export interface User {
  id: string;
  email: string;
  name: string;
}

// ---- Uploads and Odyssey (AI tutor) ----

export const UPLOAD_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'] as const;
export type UploadMime = (typeof UPLOAD_MIME_TYPES)[number];
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export interface Upload {
  id: string;
  taskId: string | null;
  filename: string;
  mime: UploadMime;
  size: number;
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  taskId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  uploads: Upload[];
  createdAt: string;
}

export const SendMessageSchema = z.object({
  text: text(8000),
  uploadIds: z.array(z.string()).max(8).default([]),
});

export const NewConversationSchema = z.object({
  taskId: z.string().optional(),
});
