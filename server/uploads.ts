import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { DB } from './db';
import { MAX_UPLOAD_BYTES, type Upload, type UploadMime } from '../shared/schema';

/** Detects the real file type from its first bytes; the browser-supplied type isn't trusted. */
export function sniffMime(buf: Uint8Array): UploadMime | null {
  const starts = (sig: number[], offset = 0) => sig.every((b, i) => buf[offset + i] === b);
  if (starts([0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (starts([0x47, 0x49, 0x46, 0x38])) return 'image/gif';
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  if (starts([0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf';
  return null;
}

/** Keeps a display-safe file name: no path parts or control characters, bounded length. */
export function cleanFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const cleaned = base.replace(/[\u0000-\u001f\u007f"<>|:*?]/g, '').trim().slice(0, 120);
  return cleaned || 'file';
}

interface UploadRow {
  id: string;
  task_id: string | null;
  filename: string;
  mime: UploadMime;
  size: number;
  created_at: string;
}

const toUpload = (r: UploadRow): Upload => ({
  id: r.id,
  taskId: r.task_id,
  filename: r.filename,
  mime: r.mime,
  size: r.size,
  createdAt: r.created_at,
});

export class UploadStore {
  constructor(private db: DB, private dir: string) {}

  private filePath(userId: string, id: string) {
    return path.join(this.dir, userId, id);
  }

  async save(userId: string, file: { name: string; bytes: Uint8Array }, taskId: string | null): Promise<Upload | { error: string }> {
    if (file.bytes.byteLength === 0) return { error: 'empty_file' };
    if (file.bytes.byteLength > MAX_UPLOAD_BYTES) return { error: 'file_too_large' };
    const mime = sniffMime(file.bytes);
    if (!mime) return { error: 'unsupported_type' };
    const id = randomUUID();
    await mkdir(path.join(this.dir, userId), { recursive: true });
    await writeFile(this.filePath(userId, id), file.bytes);
    this.db
      .prepare('INSERT INTO uploads (id, user_id, task_id, filename, mime, size) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, userId, taskId, cleanFilename(file.name), mime, file.bytes.byteLength);
    return this.get(userId, id)!;
  }

  get(userId: string, id: string): Upload | null {
    const row = this.db.prepare('SELECT * FROM uploads WHERE id = ? AND user_id = ?').get(id, userId) as UploadRow | undefined;
    return row ? toUpload(row) : null;
  }

  /** Returns the uploads with these ids that the user owns, in the given order. */
  getMany(userId: string, ids: string[]): Upload[] {
    return ids.map((id) => this.get(userId, id)).filter((u): u is Upload => u !== null);
  }

  list(userId: string, taskId?: string): Upload[] {
    const rows = taskId
      ? this.db.prepare('SELECT * FROM uploads WHERE user_id = ? AND task_id = ? ORDER BY created_at, rowid').all(userId, taskId)
      : this.db.prepare('SELECT * FROM uploads WHERE user_id = ? ORDER BY created_at, rowid').all(userId);
    return (rows as unknown as UploadRow[]).map(toUpload);
  }

  async read(userId: string, id: string): Promise<{ upload: Upload; bytes: Buffer } | null> {
    const upload = this.get(userId, id);
    if (!upload) return null;
    try {
      return { upload, bytes: await readFile(this.filePath(userId, id)) };
    } catch {
      return null;
    }
  }

  async remove(userId: string, id: string): Promise<boolean> {
    const deleted = this.db.prepare('DELETE FROM uploads WHERE id = ? AND user_id = ?').run(id, userId).changes > 0;
    if (deleted) await rm(this.filePath(userId, id), { force: true });
    return deleted;
  }

  /** Unlinks uploads from a deleted task; the files stay available in the student's chats. */
  detachTask(userId: string, taskId: string): void {
    this.db.prepare('UPDATE uploads SET task_id = NULL WHERE user_id = ? AND task_id = ?').run(userId, taskId);
  }

  async removeAll(userId: string): Promise<void> {
    this.db.prepare('DELETE FROM uploads WHERE user_id = ?').run(userId);
    await rm(path.join(this.dir, userId), { recursive: true, force: true });
  }
}
