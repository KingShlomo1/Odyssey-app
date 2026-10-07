import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Camera, ClipboardCheck, Flame, ListChecks, Plus, Sparkles } from 'lucide-react';
import { useStore } from '../lib/store';
import { api, errorMessage } from '../lib/api';
import type { Task, TaskKind, TaskSource, Upload } from '../lib/types';
import { TASK_KINDS, TASK_SOURCES } from '../lib/constants';
import { formatDate, toISODate } from '../lib/time';
import { findCrunch } from '../lib/workload';
import Sheet, { Field } from '../components/Sheet';
import Empty from '../components/Empty';
import TaskRow from '../components/TaskRow';
import FilePicker from '../components/FilePicker';
import Attachment from '../components/Attachment';
import { useToast } from '../components/Toast';

type Draft = Omit<Task, 'id'> & { id?: string };
type Filter = 'open' | 'odyssey' | 'school' | 'done';

const FILTERS: Record<Filter, string> = { open: 'פתוחות', odyssey: 'אודיסאה', school: 'בית ספר', done: 'בוצעו' };

const blank = (): Draft => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return { title: '', kind: 'homework', source: 'odyssey', due: toISODate(tomorrow), done: false, notes: '' };
};

export default function Tasks() {
  const { data } = useStore();
  const [params, setParams] = useSearchParams();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [filter, setFilter] = useState<Filter>('open');
  const now = new Date();

  // Deep link from the home page: /tasks?open=<id>
  useEffect(() => {
    const id = params.get('open');
    if (!id) return;
    const task = data.tasks.find((t) => t.id === id);
    if (task) setDraft({ ...task, notes: task.notes ?? '' });
    setParams({}, { replace: true });
  }, [params, data.tasks, setParams]);

  const visible = data.tasks
    .filter((t) => (filter === 'done' ? t.done : !t.done && (filter === 'open' || t.source === filter)))
    .sort((a, b) => (filter === 'done' ? b.due.localeCompare(a.due) : a.due.localeCompare(b.due)));
  const crunch = findCrunch(data.tasks, now);
  const counts = {
    open: data.tasks.filter((t) => !t.done).length,
    odyssey: data.tasks.filter((t) => !t.done && t.source === 'odyssey').length,
    school: data.tasks.filter((t) => !t.done && t.source === 'school').length,
    done: data.tasks.filter((t) => t.done).length,
  };

  return (
    <div className="page">
      <header className="page-header row-between">
        <div>
          <h1>משימות ומבחנים</h1>
          <p className="muted">אודיסאה ובית הספר, ביחד.</p>
        </div>
        <button className="btn primary" onClick={() => setDraft(blank())}>
          <Plus size={18} /> משימה
        </button>
      </header>

      <div className="segmented" role="tablist">
        {(Object.keys(FILTERS) as Filter[]).map((f) => (
          <button key={f} role="tab" aria-selected={f === filter} className={f === filter ? 'seg active' : 'seg'} onClick={() => setFilter(f)}>
            {FILTERS[f]}
            {counts[f] > 0 && <span className="seg-count">{counts[f]}</span>}
          </button>
        ))}
      </div>

      {crunch && filter !== 'done' && (
        <div className="banner warn">
          <Flame size={18} />
          <span>
            עומס: {crunch.count} משימות ומבחנים בשלושה ימים, החל מ{formatDate(crunch.start)}.
          </span>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="card">
          <Empty icon={<ListChecks size={28} />} title={filter === 'done' ? 'עוד לא סיימת משימות' : 'אין משימות פתוחות'}>
            {filter !== 'done' && 'הוסיפו שיעורי בית, עבודות ומבחנים כדי לא לפספס כלום.'}
          </Empty>
        </div>
      ) : (
        <ul className="list card">
          {visible.map((t) => (
            <TaskRow key={t.id} task={t} onOpen={() => setDraft({ ...t, notes: t.notes ?? '' })} />
          ))}
        </ul>
      )}

      {draft && <TaskSheet draft={draft} setDraft={setDraft} onClose={() => setDraft(null)} />}
    </div>
  );
}

function TaskSheet({ draft, setDraft, onClose }: { draft: Draft; setDraft(d: Draft): void; onClose(): void }) {
  const { data, upsertTask, removeTask, odysseyAvailable } = useStore();
  const navigate = useNavigate();
  const toast = useToast();
  const [uploads, setUploads] = useState<Upload[]>([]);
  /** Files picked for a task that isn't saved yet; uploaded right after saving. */
  const [pending, setPending] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (draft.id) api.uploads(draft.id).then(setUploads, () => undefined);
  }, [draft.id]);

  const uploadFiles = async (taskId: string, files: File[]) => {
    setUploading(true);
    const done: Upload[] = [];
    for (const f of files) {
      try {
        done.push(await api.upload(f, taskId));
      } catch (err) {
        toast.error(`${f.name}: ${errorMessage(err)}`);
      }
    }
    setUploads((cur) => [...cur, ...done]);
    setUploading(false);
    return done;
  };

  const save = async () => {
    const saved = await upsertTask({ ...draft, title: draft.title.trim(), courseId: draft.courseId || undefined, notes: draft.notes?.trim() || undefined });
    if (saved && pending.length) await uploadFiles(saved.id, pending);
    onClose();
  };

  const checkWithOdyssey = async () => {
    let id = draft.id;
    if (!id) {
      const saved = await upsertTask({ ...draft, title: draft.title.trim() || 'שיעורי בית' });
      if (!saved) return;
      id = saved.id;
      if (pending.length) await uploadFiles(id, pending);
    }
    navigate(`/odyssey?task=${id}&check=1`);
  };

  return (
    <Sheet
      title={draft.id ? 'עריכת משימה' : 'משימה חדשה'}
      onClose={onClose}
      onSubmit={save}
      onDelete={draft.id ? async () => { await removeTask(draft.id!); onClose(); } : undefined}
    >
      <Field label="כותרת">
        <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} required maxLength={160} placeholder="למשל: גיליון תרגילים 4" />
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
      <div className="row">
        <Field label="תאריך יעד">
          <input type="date" value={draft.due} onChange={(e) => setDraft({ ...draft, due: e.target.value })} required />
        </Field>
        {draft.source === 'odyssey' && data.courses.length > 0 && (
          <Field label="קורס">
            <select value={draft.courseId ?? ''} onChange={(e) => setDraft({ ...draft, courseId: e.target.value || undefined })}>
              <option value="">ללא</option>
              {data.courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
        )}
      </div>
      <Field label="הערות">
        <textarea rows={2} value={draft.notes ?? ''} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} maxLength={2000} />
      </Field>

      <div className="field" role="group" aria-label="קבצים">
        <span className="field-label">הפתרון שלי</span>
        <div className="attachments">
          {uploads.map((u) => (
            <Attachment
              key={u.id}
              upload={u}
              onRemove={async () => {
                try {
                  await api.deleteUpload(u.id);
                  setUploads((cur) => cur.filter((x) => x.id !== u.id));
                } catch (err) {
                  toast.error(errorMessage(err));
                }
              }}
            />
          ))}
          {pending.map((f, i) => (
            <div key={i} className="attachment pending">
              <span className="attachment-name">{f.name}</span>
              <button type="button" className="attachment-remove" aria-label={`הסרת ${f.name}`} onClick={() => setPending((p) => p.filter((_, j) => j !== i))}>
                ×
              </button>
            </div>
          ))}
        </div>
        <FilePicker
          className="btn upload-btn"
          disabled={uploading}
          onFiles={(files) => (draft.id ? void uploadFiles(draft.id, files) : setPending((p) => [...p, ...files]))}
        >
          <Camera size={18} /> {uploading ? 'מעלה…' : 'צילום או קובץ'}
        </FilePicker>
        <span className="field-hint">תמונות או PDF, עד 10MB לקובץ.</span>
      </div>

      {odysseyAvailable && (
        <button type="button" className="btn odyssey-btn" onClick={() => void checkWithOdyssey()} disabled={uploading || !draft.title.trim()}>
          {uploads.length + pending.length > 0 ? <ClipboardCheck size={18} /> : <Sparkles size={18} />}
          {uploads.length + pending.length > 0 ? 'בדיקת הפתרון עם אודיסאה' : 'עזרה מאודיסאה במשימה'}
        </button>
      )}
    </Sheet>
  );
}
