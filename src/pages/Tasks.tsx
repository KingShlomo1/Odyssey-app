import { useState } from 'react';
import { useStore } from '../lib/store';
import type { Task, TaskKind, TaskSource } from '../lib/types';
import { TASK_KINDS, TASK_SOURCES } from '../lib/constants';
import { formatDate, relativeDay, toISODate } from '../lib/time';
import { findCrunch, isOverdue } from '../lib/workload';
import Sheet, { Field } from '../components/Sheet';
import Empty from '../components/Empty';

type Draft = Omit<Task, 'id'> & { id?: string };
type Filter = 'open' | 'odyssey' | 'school' | 'done';

const FILTERS: Record<Filter, string> = { open: 'פתוחות', odyssey: 'אודיסאה', school: 'בית ספר', done: 'בוצעו' };

export default function Tasks() {
  const { data, upsertTask, removeTask, toggleTask } = useStore();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [filter, setFilter] = useState<Filter>('open');
  const now = new Date();

  const blank = (): Draft => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return { title: '', kind: 'homework', source: 'odyssey', due: toISODate(tomorrow), done: false, notes: '' };
  };

  const visible = data.tasks
    .filter((t) => (filter === 'done' ? t.done : !t.done && (filter === 'open' || t.source === filter)))
    .sort((a, b) => (filter === 'done' ? b.due.localeCompare(a.due) : a.due.localeCompare(b.due)));

  const crunch = findCrunch(data.tasks, now);
  const courseName = (id?: string) => data.courses.find((c) => c.id === id)?.name;

  const save = () => {
    if (!draft) return;
    upsertTask({ ...draft, title: draft.title.trim(), courseId: draft.courseId || undefined });
    setDraft(null);
  };

  return (
    <div className="stack">
      <header className="page-header row-between">
        <h1>משימות ומבחנים</h1>
        <button className="btn primary" onClick={() => setDraft(blank())}>
          + משימה
        </button>
      </header>

      <div className="segmented" role="tablist">
        {(Object.keys(FILTERS) as Filter[]).map((f) => (
          <button key={f} role="tab" aria-selected={f === filter} className={f === filter ? 'seg active' : 'seg'} onClick={() => setFilter(f)}>
            {FILTERS[f]}
          </button>
        ))}
      </div>

      {crunch && filter !== 'done' && (
        <div className="banner warn">
          עומס: {crunch.count} משימות ומבחנים בשלושה ימים החל מ{formatDate(crunch.start)}.
        </div>
      )}

      {visible.length === 0 ? (
        <Empty>{filter === 'done' ? 'עוד לא סימנת משימות כבוצעו.' : 'אין משימות פתוחות.'}</Empty>
      ) : (
        <ul className="list card">
          {visible.map((t) => (
            <li key={t.id} className={`list-item ${t.done ? 'done' : ''}`}>
              <input type="checkbox" checked={t.done} onChange={() => toggleTask(t.id)} aria-label={`סימון ${t.title} כבוצע`} />
              <button className="grow text-btn" onClick={() => setDraft({ ...t, notes: t.notes ?? '' })}>
                <span>{t.title}</span>
                <span className="muted small block">
                  {TASK_KINDS[t.kind]} · {TASK_SOURCES[t.source]}
                  {courseName(t.courseId) && ` · ${courseName(t.courseId)}`}
                </span>
              </button>
              <span className={isOverdue(t, now) ? 'pill overdue' : t.kind === 'exam' || t.kind === 'quiz' ? 'pill exam' : 'pill'}>
                {t.done ? formatDate(t.due) : relativeDay(t.due, now)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {draft && (
        <Sheet
          title={draft.id ? 'עריכת משימה' : 'משימה חדשה'}
          onClose={() => setDraft(null)}
          onSubmit={save}
          onDelete={draft.id ? () => { removeTask(draft.id!); setDraft(null); } : undefined}
        >
          <Field label="כותרת">
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} required placeholder="למשל: גיליון תרגילים 4" />
          </Field>
          <div className="row">
            <Field label="סוג">
              <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as TaskKind })}>
                {Object.entries(TASK_KINDS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="מקור">
              <select value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value as TaskSource })}>
                {Object.entries(TASK_SOURCES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="תאריך יעד">
            <input type="date" value={draft.due} onChange={(e) => setDraft({ ...draft, due: e.target.value })} required />
          </Field>
          {draft.source === 'odyssey' && data.courses.length > 0 && (
            <Field label="קורס">
              <select value={draft.courseId ?? ''} onChange={(e) => setDraft({ ...draft, courseId: e.target.value })}>
                <option value="">ללא</option>
                {data.courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
          )}
          <Field label="הערות">
            <textarea rows={3} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          </Field>
        </Sheet>
      )}
    </div>
  );
}
