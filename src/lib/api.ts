import type { AppData, ChatMessage, Conversation, Course, Profile, Session, Task, Upload, User } from './types';

export class ApiError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, credentials: 'same-origin', headers: {} };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)['content-type'] = 'application/json';
  }
  let res: Response;
  try {
    res = await fetch(`/api${url}`, init);
  } catch {
    throw new ApiError(0, 'network');
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, data.error ?? 'error');
  }
  return res.json() as Promise<T>;
}

type New<T> = Omit<T, 'id'>;

export const api = {
  me: () => request<{ user: User | null; odysseyAvailable: boolean }>('GET', '/auth/me'),
  register: (email: string, password: string, name: string) => request<{ user: User }>('POST', '/auth/register', { email, password, name }),
  login: (email: string, password: string) => request<{ user: User }>('POST', '/auth/login', { email, password }),
  logout: () => request('POST', '/auth/logout'),
  deleteAccount: () => request('DELETE', '/auth/account'),

  data: () => request<AppData>('GET', '/data'),
  saveProfile: (p: Profile) => request<Profile>('PUT', '/profile', p),
  importData: (d: AppData) => request<AppData>('POST', '/import', d),
  resetData: () => request('DELETE', '/data'),

  createSession: (s: New<Session>) => request<Session>('POST', '/sessions', { ...s, id: 'new' }),
  updateSession: (s: Session) => request<Session>('PUT', `/sessions/${s.id}`, s),
  deleteSession: (id: string) => request('DELETE', `/sessions/${id}`),
  createCourse: (c: New<Course>) => request<Course>('POST', '/courses', { ...c, id: 'new' }),
  updateCourse: (c: Course) => request<Course>('PUT', `/courses/${c.id}`, c),
  deleteCourse: (id: string) => request('DELETE', `/courses/${id}`),
  createTask: (t: New<Task>) => request<Task>('POST', '/tasks', { ...t, id: 'new' }),
  updateTask: (t: Task) => request<Task>('PUT', `/tasks/${t.id}`, t),
  deleteTask: (id: string) => request('DELETE', `/tasks/${id}`),

  uploads: (taskId?: string) => request<Upload[]>('GET', `/uploads${taskId ? `?taskId=${encodeURIComponent(taskId)}` : ''}`),
  upload: (file: File, taskId?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (taskId) form.append('taskId', taskId);
    return request<Upload>('POST', '/uploads', form);
  },
  deleteUpload: (id: string) => request('DELETE', `/uploads/${id}`),
  uploadUrl: (id: string) => `/api/uploads/${id}`,

  conversations: () => request<Conversation[]>('GET', '/odyssey/conversations'),
  conversation: (id: string) => request<{ conversation: Conversation; messages: ChatMessage[] }>('GET', `/odyssey/conversations/${id}`),
  newConversation: (taskId?: string) => request<Conversation>('POST', '/odyssey/conversations', { taskId }),
  deleteConversation: (id: string) => request('DELETE', `/odyssey/conversations/${id}`),
};

/**
 * Sends a message to Odyssey and calls `onDelta` with each piece of the streamed reply.
 * Resolves when the reply is complete; rejects with an ApiError on failure.
 */
export async function sendToOdyssey(
  conversationId: string,
  text: string,
  uploadIds: string[],
  onDelta: (text: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`/api/odyssey/conversations/${conversationId}/messages`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, uploadIds }),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new ApiError(0, 'network');
  }
  if (!res.ok || !res.body) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, data.error ?? 'error');
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let idx;
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const event = /^event: (.*)$/m.exec(block)?.[1];
      const data = /^data: (.*)$/m.exec(block)?.[1];
      if (!data) continue;
      const payload = JSON.parse(data) as { text?: string; error?: string };
      if (event === 'delta' && payload.text) onDelta(payload.text);
      if (event === 'error') throw new ApiError(500, payload.error ?? 'ai_error');
    }
  }
}

const ERRORS: Record<string, string> = {
  network: 'אין חיבור לשרת. בדקו את החיבור לאינטרנט ונסו שוב.',
  invalid_credentials: 'האימייל או הסיסמה שגויים.',
  email_taken: 'כבר קיים חשבון עם האימייל הזה.',
  rate_limited: 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.',
  invalid_input: 'חלק מהפרטים לא תקינים.',
  file_too_large: 'הקובץ גדול מדי (עד 10MB).',
  unsupported_type: 'אפשר להעלות רק תמונות (JPG, PNG, WebP, GIF) או PDF.',
  empty_file: 'הקובץ ריק.',
  daily_limit: 'הגעת למכסת ההודעות היומית לאודיסאה. אפשר להמשיך מחר.',
  ai_not_configured: 'אודיסאה עוד לא הופעל בשרת הזה.',
  ai_busy: 'אודיסאה עמוס כרגע. נסו שוב בעוד רגע.',
  ai_unavailable: 'אודיסאה לא זמין כרגע. נסו שוב בעוד כמה דקות.',
  ai_error: 'משהו השתבש בתשובה. נסו שוב.',
  reply_in_progress: 'אודיסאה עוד עונה בשיחה הזו.',
  unauthorized: 'צריך להתחבר מחדש.',
};

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return ERRORS[err.code] ?? 'משהו השתבש. נסו שוב.';
  return 'משהו השתבש. נסו שוב.';
}
