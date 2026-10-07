import { describe, expect, it, beforeEach } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openDb } from '../db';
import { createApp } from '../app';
import type { AIClient } from '../odyssey';

const PNG: Uint8Array<ArrayBuffer> = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const PDF = new Uint8Array(new TextEncoder().encode('%PDF-1.4 test'));

/** A stand-in for the Anthropic SDK that streams a fixed reply and records each request. */
function fakeAI(reply = 'בוא נחשוב יחד: מה הנגזרת של $x^2$?') {
  const calls: any[] = [];
  const client = {
    beta: {
      messages: {
        stream: (params: any) => {
          calls.push(params);
          const chunks = [reply.slice(0, 5), reply.slice(5)];
          return {
            async *[Symbol.asyncIterator]() {
              for (const text of chunks) yield { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } };
            },
            finalMessage: async () => ({ stop_reason: 'end_turn' }),
          };
        },
      },
    },
  } as unknown as AIClient;
  return { client, calls };
}

function setup(ai: AIClient | null = fakeAI().client, dailyMessageLimit = 60) {
  const dir = mkdtempSync(path.join(tmpdir(), 'odyssey-test-'));
  const db = openDb(path.join(dir, 'test.db'));
  const app = createApp({ db, uploadDir: path.join(dir, 'uploads'), ai, secureCookies: false, dailyMessageLimit });

  /** A tiny cookie-keeping client, one per simulated browser. */
  const browser = () => {
    let cookie = '';
    const request = async (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) => {
      const init: RequestInit = { method, headers: { ...headers, ...(cookie ? { cookie } : {}) } };
      if (body instanceof FormData) init.body = body;
      else if (body !== undefined) {
        init.body = JSON.stringify(body);
        (init.headers as Record<string, string>)['content-type'] = 'application/json';
      }
      const res = await app.request(`http://localhost${url}`, init);
      const set = res.headers.get('set-cookie');
      if (set) cookie = set.split(';')[0];
      return res;
    };
    return { request, json: async (method: string, url: string, body?: unknown) => (await request(method, url, body)).json() as Promise<any> };
  };
  return { app, browser };
}

const profile = { name: 'נועה', institution: 'technion', grade: 10, tracks: ['physics'], travelMinutes: 40, remindersEnabled: false };

async function signedIn(env: ReturnType<typeof setup>, email = 'noa@example.com') {
  const b = env.browser();
  const res = await b.request('POST', '/api/auth/register', { email, password: 'correct-horse', name: 'נועה' });
  expect(res.status).toBe(201);
  return b;
}

describe('auth', () => {
  let env: ReturnType<typeof setup>;
  beforeEach(() => (env = setup()));

  it('registers, reads the session, logs out and back in', async () => {
    const b = await signedIn(env);
    expect((await b.json('GET', '/api/auth/me')).user.email).toBe('noa@example.com');
    await b.request('POST', '/api/auth/logout');
    expect((await b.json('GET', '/api/auth/me')).user).toBeNull();
    expect((await b.request('GET', '/api/data')).status).toBe(401);
    const login = await b.request('POST', '/api/auth/login', { email: 'NOA@example.com ', password: 'correct-horse' });
    expect(login.status).toBe(200);
    expect((await b.request('GET', '/api/data')).status).toBe(200);
  });

  it('sets an httpOnly, SameSite cookie', async () => {
    const res = await env.browser().request('POST', '/api/auth/register', { email: 'a@b.co', password: 'password1', name: 'א' });
    expect(res.headers.get('set-cookie')).toMatch(/HttpOnly/i);
    expect(res.headers.get('set-cookie')).toMatch(/SameSite=Lax/i);
  });

  it('rejects wrong passwords, duplicate emails and short passwords', async () => {
    await signedIn(env);
    const b = env.browser();
    expect((await b.request('POST', '/api/auth/login', { email: 'noa@example.com', password: 'nope-nope' })).status).toBe(401);
    expect((await b.request('POST', '/api/auth/register', { email: 'noa@example.com', password: 'whatever1', name: 'x' })).status).toBe(409);
    expect((await b.request('POST', '/api/auth/register', { email: 'new@example.com', password: 'short', name: 'x' })).status).toBe(400);
  });

  it('rate-limits repeated failed logins', async () => {
    const b = env.browser();
    let last = 0;
    for (let i = 0; i < 11; i++) last = (await b.request('POST', '/api/auth/login', { email: 'x@y.co', password: 'bad' })).status;
    expect(last).toBe(429);
  });

  it('blocks cross-site state changes', async () => {
    const b = await signedIn(env);
    const res = await b.request('PUT', '/api/profile', profile, { origin: 'https://evil.example' });
    expect(res.status).toBe(403);
  });
});

describe('planner data', () => {
  it('saves profile and CRUDs records, isolated per student', async () => {
    const env = setup();
    const noa = await signedIn(env);
    const dan = await signedIn(env, 'dan@example.com');

    expect((await noa.request('PUT', '/api/profile', profile)).status).toBe(200);
    const course = await noa.json('POST', '/api/courses', { id: 'tmp', name: 'מכניקה', track: 'physics', gradeLevel: 10, credits: 3.5, status: 'active' });
    expect(course.id).not.toBe('tmp');
    const task = await noa.json('POST', '/api/tasks', { id: 'tmp', title: 'גיליון 3', kind: 'homework', source: 'odyssey', due: '2026-10-10', done: false, courseId: course.id });
    await noa.json('POST', '/api/sessions', { id: 'tmp', title: 'מכניקה', day: 3, start: '15:00', end: '18:00', location: '', kind: 'lecture' });

    const data = await noa.json('GET', '/api/data');
    expect(data.profile.name).toBe('נועה');
    expect(data.courses).toHaveLength(1);
    expect(data.sessions).toHaveLength(1);

    // Another student can neither see nor change Noa's records.
    expect((await dan.json('GET', '/api/data')).tasks).toHaveLength(0);
    expect((await dan.request('PUT', `/api/tasks/${task.id}`, { ...task, done: true })).status).toBe(404);
    expect((await dan.request('DELETE', `/api/tasks/${task.id}`)).status).toBe(404);

    expect((await noa.request('PUT', `/api/tasks/${task.id}`, { ...task, done: true })).status).toBe(200);
    // Deleting the course unlinks it from the task.
    await noa.request('DELETE', `/api/courses/${course.id}`);
    const after = await noa.json('GET', '/api/data');
    expect(after.tasks[0]).toMatchObject({ done: true });
    expect(after.tasks[0].courseId).toBeUndefined();
  });

  it('validates input', async () => {
    const env = setup();
    const b = await signedIn(env);
    const bad = await b.request('POST', '/api/sessions', { id: 'x', title: 'a', day: 1, start: '15:00', end: '14:00', location: '', kind: 'lecture' });
    expect(bad.status).toBe(400);
    expect((await b.request('PUT', '/api/profile', { ...profile, grade: 13 })).status).toBe(400);
  });

  it('imports an offline backup with fresh ids and remapped links', async () => {
    const env = setup();
    const b = await signedIn(env);
    const backup = {
      version: 1,
      profile,
      sessions: [],
      courses: [{ id: 'c1', name: 'חדו״א', track: 'math', gradeLevel: 10, credits: 5, status: 'passed', finalGrade: 92 }],
      tasks: [{ id: 't1', title: 'גיליון', kind: 'homework', source: 'odyssey', due: '2026-10-10', done: false, courseId: 'c1' }],
    };
    const data = await b.json('POST', '/api/import', backup);
    expect(data.courses[0].id).not.toBe('c1');
    expect(data.tasks[0].courseId).toBe(data.courses[0].id);
  });
});

describe('uploads', () => {
  it('accepts images and PDFs by content, rejects other files', async () => {
    const env = setup();
    const b = await signedIn(env);
    const form = (bytes: Uint8Array<ArrayBuffer>, name: string, type: string) => {
      const f = new FormData();
      f.append('file', new File([bytes], name, { type }));
      return f;
    };
    const png = await b.json('POST', '/api/uploads', form(PNG, '../../etc/פתרון.png', 'image/png'));
    expect(png).toMatchObject({ mime: 'image/png', filename: 'פתרון.png' });
    const pdf = await b.request('POST', '/api/uploads', form(PDF, 'hw.pdf', 'application/pdf'));
    expect(pdf.status).toBe(201);
    // An HTML file claiming to be an image is rejected.
    const fake = await b.request('POST', '/api/uploads', form(new Uint8Array(new TextEncoder().encode('<script>')), 'x.png', 'image/png'));
    expect(fake.status).toBe(415);

    const file = await b.request('GET', `/api/uploads/${png.id}`);
    expect(file.headers.get('content-type')).toBe('image/png');
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(PNG);

    const other = await signedIn(env, 'other@example.com');
    expect((await other.request('GET', `/api/uploads/${png.id}`)).status).toBe(404);
  });
});

/** Reads an SSE response into its events. */
async function readSSE(res: Response) {
  const text = await res.text();
  return text
    .split('\n\n')
    .filter(Boolean)
    .map((block) => {
      const event = /event: (.*)/.exec(block)?.[1];
      const data = /data: (.*)/.exec(block)?.[1];
      return { event, data: data ? JSON.parse(data) : null };
    });
}

describe('odyssey', () => {
  it('streams a tutor reply with attachments and student context, and saves the chat', async () => {
    const ai = fakeAI();
    const env = setup(ai.client);
    const b = await signedIn(env);
    await b.request('PUT', '/api/profile', profile);
    const task = await b.json('POST', '/api/tasks', { id: 'tmp', title: 'גיליון 4 בחדו״א', kind: 'homework', source: 'odyssey', due: '2026-10-10', done: false });
    const f = new FormData();
    f.append('file', new File([PNG], 'solution.png'));
    f.append('taskId', task.id);
    const upload = await b.json('POST', '/api/uploads', f);

    const conv = await b.json('POST', '/api/odyssey/conversations', { taskId: task.id });
    expect(conv.title).toBe('גיליון 4 בחדו״א');
    const res = await b.request('POST', `/api/odyssey/conversations/${conv.id}/messages`, { text: 'תבדוק לי', uploadIds: [upload.id] });
    expect(res.headers.get('content-type')).toMatch(/text\/event-stream/);
    const events = await readSSE(res);
    expect(events.filter((e) => e.event === 'delta').map((e) => e.data.text).join('')).toBe('בוא נחשוב יחד: מה הנגזרת של $x^2$?');
    expect(events.at(-1)?.event).toBe('done');

    const req = ai.calls[0];
    expect(req.model).toBe('claude-opus-5-5');
    expect(req.thinking).toEqual({ type: 'adaptive' });
    expect(req.system).toContain('גיליון 4 בחדו״א');
    expect(req.system).toContain('הטכניון');
    expect(req.messages[0].content[0]).toMatchObject({ type: 'image', source: { type: 'base64', media_type: 'image/png' } });
    expect(req.messages[0].content.at(-1)).toEqual({ type: 'text', text: 'תבדוק לי' });

    const saved = await b.json('GET', `/api/odyssey/conversations/${conv.id}`);
    expect(saved.messages.map((m: any) => m.role)).toEqual(['user', 'assistant']);
    expect(saved.messages[0].uploads[0].id).toBe(upload.id);

    // Follow-up turns resend the history, attachments included.
    await readSSE(await b.request('POST', `/api/odyssey/conversations/${conv.id}/messages`, { text: 'ומה הלאה?' }));
    expect(ai.calls[1].messages.map((m: any) => m.role)).toEqual(['user', 'assistant', 'user']);
  });

  it("won't attach another student's upload", async () => {
    const env = setup();
    const a = await signedIn(env);
    const f = new FormData();
    f.append('file', new File([PNG], 'x.png'));
    const upload = await a.json('POST', '/api/uploads', f);
    const b = await signedIn(env, 'b@example.com');
    const conv = await b.json('POST', '/api/odyssey/conversations', {});
    const res = await b.request('POST', `/api/odyssey/conversations/${conv.id}/messages`, { text: 'hi', uploadIds: [upload.id] });
    expect(res.status).toBe(404);
  });

  it('enforces the daily message cap', async () => {
    const env = setup(fakeAI().client, 1);
    const b = await signedIn(env);
    const conv = await b.json('POST', '/api/odyssey/conversations', {});
    await readSSE(await b.request('POST', `/api/odyssey/conversations/${conv.id}/messages`, { text: 'שאלה' }));
    expect((await b.request('POST', `/api/odyssey/conversations/${conv.id}/messages`, { text: 'עוד' })).status).toBe(429);
  });

  it('reports when no API key is configured', async () => {
    const env = setup(null);
    const b = await signedIn(env);
    expect((await b.json('GET', '/api/auth/me')).odysseyAvailable).toBe(false);
    const conv = await b.json('POST', '/api/odyssey/conversations', {});
    expect((await b.request('POST', `/api/odyssey/conversations/${conv.id}/messages`, { text: 'hi' })).status).toBe(503);
  });
});
