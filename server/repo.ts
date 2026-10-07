import { randomUUID } from 'node:crypto';
import type { DB } from './db';
import { transaction } from './db';
import type { AppData, Course, Profile, Session, Task } from '../shared/schema';

export type Collection = 'class_sessions' | 'courses' | 'tasks';
type Item = Session | Course | Task;

/**
 * Each student's records are stored as validated JSON documents keyed by user,
 * since the client always reads and writes whole records.
 */
export function loadAppData(db: DB, userId: string): AppData {
  const profileRow = db.prepare('SELECT data FROM profiles WHERE user_id = ?').get(userId) as { data: string } | undefined;
  const list = <T>(table: Collection) =>
    (db.prepare(`SELECT data FROM ${table} WHERE user_id = ? ORDER BY rowid`).all(userId) as { data: string }[]).map(
      (r) => JSON.parse(r.data) as T,
    );
  return {
    version: 1,
    profile: profileRow ? (JSON.parse(profileRow.data) as Profile) : null,
    sessions: list<Session>('class_sessions'),
    courses: list<Course>('courses'),
    tasks: list<Task>('tasks'),
  };
}

export function saveProfile(db: DB, userId: string, profile: Profile): void {
  db.prepare(
    'INSERT INTO profiles (user_id, data) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data',
  ).run(userId, JSON.stringify(profile));
  db.prepare('UPDATE users SET name = ? WHERE id = ?').run(profile.name, userId);
}

export function getItem<T extends Item>(db: DB, table: Collection, userId: string, id: string): T | null {
  const row = db.prepare(`SELECT data FROM ${table} WHERE id = ? AND user_id = ?`).get(id, userId) as { data: string } | undefined;
  return row ? (JSON.parse(row.data) as T) : null;
}

/** Inserts a new record with a server-generated id. */
export function createItem<T extends Item>(db: DB, table: Collection, userId: string, item: Omit<T, 'id'>): T {
  const saved = { ...item, id: randomUUID() } as T;
  db.prepare(`INSERT INTO ${table} (id, user_id, data) VALUES (?, ?, ?)`).run(saved.id, userId, JSON.stringify(saved));
  return saved;
}

/** Replaces a record the user owns; returns false when there is no such record. */
export function updateItem<T extends Item>(db: DB, table: Collection, userId: string, item: T): boolean {
  const res = db.prepare(`UPDATE ${table} SET data = ? WHERE id = ? AND user_id = ?`).run(JSON.stringify(item), item.id, userId);
  return res.changes > 0;
}

export function deleteItem(db: DB, table: Collection, userId: string, id: string): boolean {
  return db.prepare(`DELETE FROM ${table} WHERE id = ? AND user_id = ?`).run(id, userId).changes > 0;
}

/** When a course is deleted, tasks that referenced it keep existing without the link. */
export function unlinkCourse(db: DB, userId: string, courseId: string): void {
  const rows = db.prepare('SELECT id, data FROM tasks WHERE user_id = ?').all(userId) as { id: string; data: string }[];
  for (const r of rows) {
    const t = JSON.parse(r.data) as Task;
    if (t.courseId === courseId) {
      delete t.courseId;
      db.prepare('UPDATE tasks SET data = ? WHERE id = ?').run(JSON.stringify(t), r.id);
    }
  }
}

/** Replaces all of a user's planner data (used for importing a backup from the old offline version). */
export function replaceAppData(db: DB, userId: string, data: AppData): AppData {
  return transaction(db, () => {
    for (const table of ['class_sessions', 'courses', 'tasks'] as const) {
      db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(userId);
    }
    if (data.profile) saveProfile(db, userId, data.profile);
    // Give records fresh ids so a backup can't collide with another user's ids; remap task->course links.
    const courseIds = new Map<string, string>();
    for (const c of data.courses) {
      const saved = createItem<Course>(db, 'courses', userId, { ...c });
      courseIds.set(c.id, saved.id);
    }
    for (const s of data.sessions) createItem<Session>(db, 'class_sessions', userId, { ...s });
    for (const t of data.tasks) {
      const courseId = t.courseId ? courseIds.get(t.courseId) : undefined;
      const { courseId: _old, ...rest } = t;
      createItem<Task>(db, 'tasks', userId, courseId ? { ...rest, courseId } : rest);
    }
    return loadAppData(db, userId);
  });
}

export function resetAppData(db: DB, userId: string): void {
  transaction(db, () => {
    for (const table of ['class_sessions', 'courses', 'tasks', 'profiles', 'conversations', 'uploads'] as const) {
      db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(userId);
    }
  });
}
