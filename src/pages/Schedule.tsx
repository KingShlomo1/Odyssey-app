import { useState } from 'react';
import { useStore } from '../lib/store';
import type { Session, SessionKind, Weekday } from '../lib/types';
import { DAYS, SESSION_KINDS } from '../lib/constants';
import { formatMinutes, minutesOfDay } from '../lib/time';
import { buildIcs } from '../lib/ics';
import { downloadFile } from '../lib/storage';
import { notificationsSupported } from '../lib/reminders';
import Sheet, { Field } from '../components/Sheet';
import Empty from '../components/Empty';

type Draft = Omit<Session, 'id'> & { id?: string };

const blank = (): Draft => ({ title: '', day: 0, start: '15:00', end: '17:00', location: '', kind: 'lecture' });

export default function Schedule() {
  const { data, upsertSession, removeSession, setProfile } = useStore();
  const profile = data.profile!;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');

  const byDay = DAYS.map((_, day) =>
    data.sessions.filter((s) => s.day === day).sort((a, b) => a.start.localeCompare(b.start)),
  );

  const save = () => {
    if (!draft) return;
    if (minutesOfDay(draft.end) <= minutesOfDay(draft.start)) {
      setError('שעת הסיום צריכה להיות אחרי שעת ההתחלה');
      return;
    }
    upsertSession({ ...draft, title: draft.title.trim() });
    setDraft(null);
  };

  const exportCalendar = () => {
    downloadFile('odyssey.ics', buildIcs(data.sessions, data.tasks, { travelMinutes: profile.travelMinutes }), 'text/calendar;charset=utf-8');
  };

  const enableReminders = async () => {
    if (!notificationsSupported()) return;
    const permission = await Notification.requestPermission();
    setProfile({ ...profile, remindersEnabled: permission === 'granted' });
  };

  return (
    <div className="stack">
      <header className="page-header row-between">
        <h1>מערכת שעות</h1>
        <button className="btn primary" onClick={() => { setError(''); setDraft(blank()); }}>
          + שיעור
        </button>
      </header>

      {data.sessions.length === 0 && <Empty>הוסיפו את השיעורים הקבועים בקמפוס, למשל הרצאה ותרגול בכל אחד משני הימים.</Empty>}

      {byDay.map((sessions, day) =>
        sessions.length === 0 ? null : (
          <section key={day} className="card">
            <h2>יום {DAYS[day]}</h2>
            <ul className="list">
              {sessions.map((s) => (
                <li key={s.id}>
                  <button className="list-item clickable" onClick={() => { setError(''); setDraft(s); }}>
                    <span className="time">
                      {s.start}–{s.end}
                    </span>
                    <span className="grow">
                      <span>{s.title}</span>
                      <span className="muted small block">
                        {SESSION_KINDS[s.kind]}
                        {s.location && ` · ${s.location}`}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="muted small">
              לצאת מבית הספר עד {formatMinutes(minutesOfDay(sessions[0].start) - profile.travelMinutes)}
            </p>
          </section>
        ),
      )}

      <section className="card">
        <h2>תזכורות</h2>
        <p className="muted small">
          הדרך האמינה: ייצוא ליומן בטלפון. השיעורים נכנסים כאירועים שבועיים עם תזכורת לצאת {profile.travelMinutes} דקות לפני, והמשימות
          נכנסות עם תזכורת בערב שלפני.
        </p>
        <button className="btn" onClick={exportCalendar} disabled={data.sessions.length === 0 && data.tasks.length === 0}>
          ייצוא ליומן (‎.ics)
        </button>
        {notificationsSupported() && (
          <>
            <p className="muted small">אפשר גם לקבל התראה מהאפליקציה כשהגיע הזמן לצאת. זה עובד רק כשהאפליקציה פתוחה.</p>
            {profile.remindersEnabled ? (
              <button className="btn" onClick={() => setProfile({ ...profile, remindersEnabled: false })}>
                כיבוי התראות באפליקציה
              </button>
            ) : (
              <button className="btn" onClick={enableReminders}>
                הפעלת התראות באפליקציה
              </button>
            )}
          </>
        )}
      </section>

      {draft && (
        <Sheet
          title={draft.id ? 'עריכת שיעור' : 'שיעור חדש'}
          onClose={() => setDraft(null)}
          onSubmit={save}
          onDelete={draft.id ? () => { removeSession(draft.id!); setDraft(null); } : undefined}
        >
          <Field label="שם הקורס">
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} required placeholder="למשל: חשבון אינפיניטסימלי 1" />
          </Field>
          <Field label="סוג">
            <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as SessionKind })}>
              {Object.entries(SESSION_KINDS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="יום">
            <select value={draft.day} onChange={(e) => setDraft({ ...draft, day: Number(e.target.value) as Weekday })}>
              {DAYS.map((d, i) => (
                <option key={i} value={i}>{d}</option>
              ))}
            </select>
          </Field>
          <div className="row">
            <Field label="התחלה">
              <input type="time" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} required />
            </Field>
            <Field label="סיום">
              <input type="time" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} required />
            </Field>
          </div>
          <Field label="מיקום">
            <input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} placeholder="בניין וחדר" />
          </Field>
          {error && <p className="danger-text">{error}</p>}
        </Sheet>
      )}
    </div>
  );
}
