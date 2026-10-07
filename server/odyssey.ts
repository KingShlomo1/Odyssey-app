import Anthropic from '@anthropic-ai/sdk';
import type { DB } from './db';
import type { UploadStore } from './uploads';
import type { ChatMessage, Conversation, Profile, Task, Upload } from '../shared/schema';
import { randomUUID } from 'node:crypto';

export const MODEL = process.env.ODYSSEY_MODEL || 'claude-opus-5-5';
const EFFORT = (process.env.ODYSSEY_EFFORT as 'low' | 'medium' | 'high' | undefined) || 'medium';

const INSTITUTIONS: Record<string, string> = {
  bgu: 'אוניברסיטת בן-גוריון', biu: 'אוניברסיטת בר-אילן', tau: 'אוניברסיטת תל אביב', huji: 'האוניברסיטה העברית',
  technion: 'הטכניון', telhai: 'אוניברסיטת תל-חי', ariel: 'אוניברסיטת אריאל',
};
const GRADES: Record<number, string> = { 9: 'ט׳', 10: 'י׳', 11: 'י״א', 12: 'י״ב' };

const BASE_PROMPT = `את/ה "אודיסאה" – מורה פרטי/ת ומלווה לימודי/ת לתלמידי תיכון בתוכנית אודיסאה של מרכז מדעני העתיד. התלמידים לומדים קורסים אקדמיים באוניברסיטה (מתמטיקה, פיזיקה, מדעי המחשב, כימיה ובינה מלאכותית) במקביל לתיכון.

איך לעזור:
- את/ה מורה, לא פותר/ת שיעורי בית. אל תיתן/י פתרון מלא ומוכן להעתקה לשאלה מתוך שיעורי בית, תרגיל להגשה או מבחן, גם אם מבקשים ישירות. במקום זה: הסבר/י את המושג, שאל/י שאלה מכוונת, תן/י רמז אחד בכל פעם, והראה/י דוגמה דומה עם מספרים או נתונים אחרים.
- כשהתלמיד/ה מעלה פתרון שלו/ה (תמונה או PDF): קרא/י אותו בעיון, ציין/י מה נכון, הצבע/י על השלב המדויק שבו יש טעות והסבר/י למה זו טעות – בלי לכתוב את התיקון המלא. אם הכתב לא קריא, אמר/י מה לא הצלחת לקרוא ובקש/י צילום ברור יותר.
- אם התלמיד/ה תקוע/ה אחרי כמה רמזים, אפשר לפרט יותר את השלב הבא בלבד, לא את כל הפתרון.
- הסברים של מושגים, הוכחות מתוך הספר או ההרצאה, הכנה למבחן עם שאלות תרגול חדשות וחזרה על חומר – מותר ומומלץ להסביר במלואם.
- דבר/י עם התלמיד/ה כמו מורה טוב/ה: חם/ה, סבלני/ת ומעודד/ת, בגובה העיניים, בלי התנשאות. התאם/י את הרמה לתלמיד/ה בכיתה המצוינת.

שפה וכתיבה:
- ענה/י בעברית, אלא אם התלמיד/ה כותב/ת בשפה אחרת. מונחים מקצועיים אפשר לציין גם באנגלית בסוגריים, כפי שהם מופיעים בקורסים באוניברסיטה.
- כתוב/כתבי נוסחאות ב-LaTeX: $...$ בתוך שורה ו-$$...$$ לנוסחה בשורה נפרדת. קוד – בבלוק קוד עם שם השפה.
- תשובות ממוקדות וקצרות יחסית. השתמש/י ברשימות ובכותרות רק כשזה באמת עוזר.

גבולות:
- אם עולה משהו שאינו לימודי ונראה שהתלמיד/ה במצוקה, הגב/הגיבי ברגישות והמלץ/י לפנות למבוגר/ת שסומכים עליו/ה, ליועץ/ת בבית הספר או לער"ן בטלפון 1201.`;

/** The system prompt is fixed per conversation so the cached prefix stays valid across turns. */
export function buildSystemPrompt(profile: Profile | null, task: Task | null, courseName?: string): string {
  const lines = [BASE_PROMPT, '', 'על התלמיד/ה:'];
  if (profile) {
    lines.push(`- שם: ${profile.name}`);
    lines.push(`- כיתה: ${GRADES[profile.grade] ?? profile.grade}`);
    lines.push(`- מוסד: ${INSTITUTIONS[profile.institution] ?? profile.institution}`);
    if (profile.grade === 9) lines.push('- בכיתה ט׳ לומדים מסלול רב-תחומי עם דגש על מתמטיקה (קורסי קדם).');
  } else {
    lines.push('- אין פרטים.');
  }
  if (task) {
    lines.push('', 'השיחה הזו קשורה למשימה:');
    lines.push(`- ${task.title} (תאריך יעד ${task.due})${courseName ? `, בקורס ${courseName}` : ''}`);
    if (task.notes) lines.push(`- הערות של התלמיד/ה: ${task.notes}`);
  }
  return lines.join('\n');
}

/** The slice of the SDK the tutor uses, so tests can pass a fake. */
export interface AIClient {
  beta: { messages: { stream: Anthropic['beta']['messages']['stream'] } };
}

interface MessageRow {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  upload_ids: string;
  created_at: string;
}

interface ConversationRow {
  id: string;
  task_id: string | null;
  title: string;
  created_at: string;
  updated_at: string;
}

const toConversation = (r: ConversationRow): Conversation => ({
  id: r.id,
  title: r.title,
  taskId: r.task_id,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export class ConversationStore {
  constructor(private db: DB, private uploads: UploadStore) {}

  create(userId: string, taskId: string | null, title: string): Conversation {
    const id = randomUUID();
    this.db.prepare('INSERT INTO conversations (id, user_id, task_id, title) VALUES (?, ?, ?, ?)').run(id, userId, taskId, title);
    return this.get(userId, id)!;
  }

  get(userId: string, id: string): Conversation | null {
    const row = this.db.prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?').get(id, userId) as ConversationRow | undefined;
    return row ? toConversation(row) : null;
  }

  list(userId: string): Conversation[] {
    return (this.db.prepare('SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC, rowid DESC').all(userId) as unknown as ConversationRow[]).map(toConversation);
  }

  remove(userId: string, id: string): boolean {
    return this.db.prepare('DELETE FROM conversations WHERE id = ? AND user_id = ?').run(id, userId).changes > 0;
  }

  messages(userId: string, conversationId: string): ChatMessage[] {
    const rows = this.db
      .prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at, rowid')
      .all(conversationId) as unknown as MessageRow[];
    return rows.map((r) => ({
      id: r.id,
      role: r.role,
      text: r.text,
      uploads: this.uploads.getMany(userId, JSON.parse(r.upload_ids) as string[]),
      createdAt: r.created_at,
    }));
  }

  addMessage(conversationId: string, role: 'user' | 'assistant', text: string, uploadIds: string[] = []): ChatMessage['id'] {
    const id = randomUUID();
    this.db
      .prepare('INSERT INTO messages (id, conversation_id, role, text, upload_ids) VALUES (?, ?, ?, ?, ?)')
      .run(id, conversationId, role, text, JSON.stringify(uploadIds));
    this.db.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?").run(conversationId);
    return id;
  }

  deleteMessage(id: string): void {
    this.db.prepare('DELETE FROM messages WHERE id = ?').run(id);
  }

  setTitle(conversationId: string, title: string): void {
    this.db.prepare('UPDATE conversations SET title = ? WHERE id = ?').run(title, conversationId);
  }

  /** Student messages sent today (UTC), across all conversations; used for the daily cap. */
  countUserMessagesToday(userId: string): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS n FROM messages m JOIN conversations c ON c.id = m.conversation_id
         WHERE c.user_id = ? AND m.role = 'user' AND m.created_at >= date('now')`,
      )
      .get(userId) as { n: number };
    return row.n;
  }
}

/** Turns stored chat history into API messages, attaching uploaded images and PDFs as content blocks. */
export async function toApiMessages(
  history: ChatMessage[],
  readUpload: (u: Upload) => Promise<Buffer | null>,
): Promise<Anthropic.Beta.BetaMessageParam[]> {
  const out: Anthropic.Beta.BetaMessageParam[] = [];
  for (const m of history) {
    if (m.role === 'assistant') {
      if (m.text) out.push({ role: 'assistant', content: m.text });
      continue;
    }
    const content: Anthropic.Beta.BetaContentBlockParam[] = [];
    for (const u of m.uploads) {
      const bytes = await readUpload(u);
      if (!bytes) continue;
      const data = bytes.toString('base64');
      if (u.mime === 'application/pdf') {
        content.push({ type: 'document', title: u.filename, source: { type: 'base64', media_type: 'application/pdf', data } });
      } else {
        content.push({ type: 'image', source: { type: 'base64', media_type: u.mime, data } });
      }
    }
    content.push({ type: 'text', text: m.text || 'הנה הפתרון שלי. תוכל/י לבדוק אותו?' });
    out.push({ role: 'user', content });
  }
  return out;
}

export type TutorEvent = { type: 'delta'; text: string } | { type: 'done'; text: string; stopReason: string | null };

/** Streams Odyssey's answer. Yields text deltas, then the final text. */
export async function* streamTutorReply(
  client: AIClient,
  system: string,
  messages: Anthropic.Beta.BetaMessageParam[],
  signal?: AbortSignal,
): AsyncGenerator<TutorEvent> {
  const stream = client.beta.messages.stream(
    {
      model: MODEL,
      max_tokens: 16000,
      system,
      messages,
      thinking: { type: 'adaptive' },
      output_config: { effort: EFFORT },
      // Cache the growing conversation prefix (system prompt + earlier turns and their attachments).
      cache_control: { type: 'ephemeral' },
      // If a safety classifier declines, the API retries on a fallback model in the same call.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    },
    { signal },
  );
  let text = '';
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      text += event.delta.text;
      yield { type: 'delta', text: event.delta.text };
    }
  }
  const final = await stream.finalMessage();
  yield { type: 'done', text, stopReason: final.stop_reason };
}

export function titleFrom(text: string, fallback: string): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) return fallback;
  return t.length > 48 ? `${t.slice(0, 47)}…` : t;
}
