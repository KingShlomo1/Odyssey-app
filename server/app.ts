import { Hono, type Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { bodyLimit } from 'hono/body-limit';
import { secureHeaders } from 'hono/secure-headers';
import { streamSSE } from 'hono/streaming';
import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'node:crypto';
import type { z } from 'zod';
import type { DB } from './db';
import {
  RateLimiter, SESSION_COOKIE, SESSION_TTL_MS, createSession, deleteSession, hashPassword, userForToken, verifyPassword,
} from './auth';
import {
  createItem, deleteItem, getItem, loadAppData, replaceAppData, resetAppData, saveProfile, unlinkCourse, updateItem, type Collection,
} from './repo';
import { UploadStore } from './uploads';
import { ConversationStore, buildSystemPrompt, streamTutorReply, titleFrom, toApiMessages, type AIClient } from './odyssey';
import {
  AppDataSchema, CourseSchema, LoginSchema, MAX_UPLOAD_BYTES, NewConversationSchema, ProfileSchema, RegisterSchema, SendMessageSchema,
  SessionSchema, TaskSchema, type Course, type Task, type User,
} from '../shared/schema';

export interface AppOptions {
  db: DB;
  uploadDir: string;
  /** null when no API key is configured; Odyssey then reports it is unavailable. */
  ai: AIClient | null;
  secureCookies: boolean;
  dailyMessageLimit: number;
  /** Extra origins allowed to make state-changing requests (the app's own origin is always allowed). */
  allowedOrigins?: string[];
}

type Env = { Variables: { user: User } };

const DUMMY_HASH = 'scrypt$AAAAAAAAAAAAAAAAAAAAAA==$' + 'A'.repeat(86) + '==';

export function createApp(opts: AppOptions) {
  const { db } = opts;
  const uploads = new UploadStore(db, opts.uploadDir);
  const conversations = new ConversationStore(db, uploads);
  const loginLimiter = new RateLimiter(10, 15 * 60_000);
  const registerLimiter = new RateLimiter(5, 60 * 60_000);
  /** Conversations with a reply in progress, so a student can't run two at once in the same chat. */
  const busy = new Set<string>();

  const app = new Hono<Env>();
  const api = new Hono<Env>();

  app.use('*', secureHeaders({ crossOriginResourcePolicy: 'same-origin' }));

  // Reject cross-site state changes (defense in depth on top of SameSite=Lax cookies).
  api.use('*', async (c, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
      const origin = c.req.header('origin');
      const self = new URL(c.req.url).origin;
      if (origin && origin !== self && !opts.allowedOrigins?.includes(origin)) return c.json({ error: 'bad_origin' }, 403);
    }
    await next();
  });

  const clientIp = (c: Context) => c.req.header('x-forwarded-for')?.split(',')[0].trim() || 'local';

  async function parse<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T> | Response> {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalid_json' }, 400);
    }
    const result = schema.safeParse(body);
    if (!result.success) return c.json({ error: 'invalid_input', issues: result.error.issues.map((i) => ({ path: i.path, message: i.message })) }, 400);
    return result.data;
  }

  function startSession(c: Context, userId: string) {
    setCookie(c, SESSION_COOKIE, createSession(db, userId), {
      httpOnly: true,
      secure: opts.secureCookies,
      sameSite: 'Lax',
      path: '/',
      maxAge: SESSION_TTL_MS / 1000,
    });
  }

  // ---- Auth ----

  api.post('/auth/register', async (c) => {
    if (!registerLimiter.take(clientIp(c))) return c.json({ error: 'rate_limited' }, 429);
    const input = await parse(c, RegisterSchema);
    if (input instanceof Response) return input;
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(input.email)) return c.json({ error: 'email_taken' }, 409);
    const user: User = { id: randomUUID(), email: input.email, name: input.name };
    db.prepare('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)').run(
      user.id, user.email, await hashPassword(input.password), user.name,
    );
    startSession(c, user.id);
    return c.json({ user }, 201);
  });

  api.post('/auth/login', async (c) => {
    const input = await parse(c, LoginSchema);
    if (input instanceof Response) return input;
    if (!loginLimiter.take(`${clientIp(c)}|${input.email}`)) return c.json({ error: 'rate_limited' }, 429);
    const row = db.prepare('SELECT id, email, name, password_hash FROM users WHERE email = ?').get(input.email) as
      | { id: string; email: string; name: string; password_hash: string }
      | undefined;
    // Verify against a dummy hash for unknown emails so response time doesn't reveal which emails exist.
    const ok = await verifyPassword(input.password, row?.password_hash ?? DUMMY_HASH);
    if (!row || !ok) return c.json({ error: 'invalid_credentials' }, 401);
    startSession(c, row.id);
    return c.json({ user: { id: row.id, email: row.email, name: row.name } });
  });

  api.post('/auth/logout', (c) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (token) deleteSession(db, token);
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return c.json({ ok: true });
  });

  api.get('/auth/me', (c) => {
    const user = userForToken(db, getCookie(c, SESSION_COOKIE));
    return c.json({ user, odysseyAvailable: opts.ai !== null });
  });

  // Everything below requires a signed-in student.
  api.use('*', async (c, next) => {
    const user = userForToken(db, getCookie(c, SESSION_COOKIE));
    if (!user) return c.json({ error: 'unauthorized' }, 401);
    c.set('user', user);
    await next();
  });

  api.delete('/auth/account', async (c) => {
    const user = c.get('user');
    await uploads.removeAll(user.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return c.json({ ok: true });
  });

  // ---- Planner data ----

  api.get('/data', (c) => c.json(loadAppData(db, c.get('user').id)));

  api.put('/profile', async (c) => {
    const profile = await parse(c, ProfileSchema);
    if (profile instanceof Response) return profile;
    saveProfile(db, c.get('user').id, profile);
    return c.json(profile);
  });

  api.post('/import', async (c) => {
    const data = await parse(c, AppDataSchema);
    if (data instanceof Response) return data;
    return c.json(replaceAppData(db, c.get('user').id, data));
  });

  api.delete('/data', async (c) => {
    const userId = c.get('user').id;
    resetAppData(db, userId);
    await uploads.removeAll(userId);
    return c.json({ ok: true });
  });

  function crud(route: string, table: Collection, schema: z.ZodType<{ id: string }>, onDelete?: (userId: string, id: string) => void) {
    api.post(`/${route}`, async (c) => {
      // Clients send a placeholder id for new records; the server assigns the real one.
      const body = await parse(c, schema);
      if (body instanceof Response) return body;
      const { id: _ignored, ...rest } = body;
      return c.json(createItem(db, table, c.get('user').id, rest as never), 201);
    });
    api.put(`/${route}/:id`, async (c) => {
      const body = await parse(c, schema);
      if (body instanceof Response) return body;
      const item = { ...body, id: c.req.param('id') };
      if (!updateItem(db, table, c.get('user').id, item as never)) return c.json({ error: 'not_found' }, 404);
      return c.json(item);
    });
    api.delete(`/${route}/:id`, (c) => {
      const userId = c.get('user').id;
      const id = c.req.param('id');
      if (!deleteItem(db, table, userId, id)) return c.json({ error: 'not_found' }, 404);
      onDelete?.(userId, id);
      return c.json({ ok: true });
    });
  }

  crud('sessions', 'class_sessions', SessionSchema);
  crud('courses', 'courses', CourseSchema, (userId, id) => unlinkCourse(db, userId, id));
  crud('tasks', 'tasks', TaskSchema, (userId, id) => uploads.detachTask(userId, id));

  // ---- Uploads ----

  api.post(
    '/uploads',
    bodyLimit({ maxSize: MAX_UPLOAD_BYTES + 64 * 1024, onError: (c) => c.json({ error: 'file_too_large' }, 413) }),
    async (c) => {
      const userId = c.get('user').id;
      let form: Record<string, string | File>;
      try {
        form = (await c.req.parseBody()) as Record<string, string | File>;
      } catch {
        return c.json({ error: 'invalid_form' }, 400);
      }
      const file = form.file;
      if (!(file instanceof File)) return c.json({ error: 'missing_file' }, 400);
      const taskId = typeof form.taskId === 'string' && form.taskId ? form.taskId : null;
      if (taskId && !getItem(db, 'tasks', userId, taskId)) return c.json({ error: 'task_not_found' }, 404);
      const result = await uploads.save(userId, { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }, taskId);
      if ('error' in result) return c.json(result, result.error === 'file_too_large' ? 413 : 415);
      return c.json(result, 201);
    },
  );

  api.get('/uploads', (c) => c.json(uploads.list(c.get('user').id, c.req.query('taskId') || undefined)));

  api.get('/uploads/:id', async (c) => {
    const file = await uploads.read(c.get('user').id, c.req.param('id'));
    if (!file) return c.json({ error: 'not_found' }, 404);
    const disposition = c.req.query('download') ? 'attachment' : 'inline';
    return c.body(new Uint8Array(file.bytes), 200, {
      'Content-Type': file.upload.mime,
      'Content-Length': String(file.bytes.byteLength),
      'Content-Disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(file.upload.filename)}`,
      'Cache-Control': 'private, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    });
  });

  api.delete('/uploads/:id', async (c) => {
    if (!(await uploads.remove(c.get('user').id, c.req.param('id')))) return c.json({ error: 'not_found' }, 404);
    return c.json({ ok: true });
  });

  // ---- Odyssey (AI tutor) ----

  api.get('/odyssey/conversations', (c) => c.json(conversations.list(c.get('user').id)));

  api.post('/odyssey/conversations', async (c) => {
    const input = await parse(c, NewConversationSchema);
    if (input instanceof Response) return input;
    const userId = c.get('user').id;
    const task = input.taskId ? getItem<Task>(db, 'tasks', userId, input.taskId) : null;
    if (input.taskId && !task) return c.json({ error: 'task_not_found' }, 404);
    return c.json(conversations.create(userId, task?.id ?? null, task ? task.title : 'שיחה חדשה'), 201);
  });

  api.get('/odyssey/conversations/:id', (c) => {
    const userId = c.get('user').id;
    const conversation = conversations.get(userId, c.req.param('id'));
    if (!conversation) return c.json({ error: 'not_found' }, 404);
    return c.json({ conversation, messages: conversations.messages(userId, conversation.id) });
  });

  api.delete('/odyssey/conversations/:id', (c) => {
    if (!conversations.remove(c.get('user').id, c.req.param('id'))) return c.json({ error: 'not_found' }, 404);
    return c.json({ ok: true });
  });

  api.post('/odyssey/conversations/:id/messages', async (c) => {
    const userId = c.get('user').id;
    const conversation = conversations.get(userId, c.req.param('id'));
    if (!conversation) return c.json({ error: 'not_found' }, 404);
    if (!opts.ai) return c.json({ error: 'ai_not_configured' }, 503);
    const input = await parse(c, SendMessageSchema);
    if (input instanceof Response) return input;
    const attached = uploads.getMany(userId, input.uploadIds);
    if (attached.length !== input.uploadIds.length) return c.json({ error: 'upload_not_found' }, 404);
    if (!input.text && attached.length === 0) return c.json({ error: 'empty_message' }, 400);
    if (conversations.countUserMessagesToday(userId) >= opts.dailyMessageLimit) return c.json({ error: 'daily_limit' }, 429);
    if (busy.has(conversation.id)) return c.json({ error: 'reply_in_progress' }, 409);

    const isFirst = conversations.messages(userId, conversation.id).length === 0;
    const userMessageId = conversations.addMessage(conversation.id, 'user', input.text, attached.map((u) => u.id));
    if (isFirst && !conversation.taskId) conversations.setTitle(conversation.id, titleFrom(input.text, attached[0]?.filename ?? 'שיחה חדשה'));

    const appData = loadAppData(db, userId);
    const task = conversation.taskId ? appData.tasks.find((t) => t.id === conversation.taskId) ?? null : null;
    const courseName = task?.courseId ? appData.courses.find((x: Course) => x.id === task.courseId)?.name : undefined;
    const system = buildSystemPrompt(appData.profile, task, courseName);
    const history = await toApiMessages(conversations.messages(userId, conversation.id), async (u) => (await uploads.read(userId, u.id))?.bytes ?? null);

    busy.add(conversation.id);
    return streamSSE(c, async (sse) => {
      const abort = new AbortController();
      sse.onAbort(() => abort.abort());
      let text = '';
      try {
        for await (const ev of streamTutorReply(opts.ai!, system, history, abort.signal)) {
          if (ev.type === 'delta') {
            text += ev.text;
            await sse.writeSSE({ event: 'delta', data: JSON.stringify({ text: ev.text }) });
          } else if (ev.stopReason === 'refusal' && !ev.text) {
            text = 'אני לא יכול/ה לעזור בזה. נסה/י לנסח את השאלה אחרת, או לשאול על נושא אחר מהחומר.';
            await sse.writeSSE({ event: 'delta', data: JSON.stringify({ text }) });
          }
        }
        const messageId = conversations.addMessage(conversation.id, 'assistant', text);
        await sse.writeSSE({ event: 'done', data: JSON.stringify({ messageId }) });
      } catch (err) {
        // Keep a partial reply; with no reply at all, drop the question so a retry doesn't duplicate it.
        if (text) conversations.addMessage(conversation.id, 'assistant', text);
        else conversations.deleteMessage(userMessageId);
        if (!abort.signal.aborted) {
          console.error('Odyssey reply failed:', err instanceof Error ? err.message : err);
          const code = err instanceof Anthropic.RateLimitError ? 'ai_busy' : err instanceof Anthropic.APIError && (err.status ?? 0) >= 500 ? 'ai_unavailable' : 'ai_error';
          await sse.writeSSE({ event: 'error', data: JSON.stringify({ error: code }) });
        }
      } finally {
        busy.delete(conversation.id);
      }
    });
  });

  api.notFound((c) => c.json({ error: 'not_found' }, 404));

  app.route('/api', api);
  return app;
}
