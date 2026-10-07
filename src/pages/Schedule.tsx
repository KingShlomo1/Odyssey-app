import { useState } from 'react';
import { Bell, BellOff, CalendarDays, CalendarPlus, Clock, MapPin, Plus } from 'lucide-react';
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
  const today = new Date().getDay();

  const byDay = DAYS.map((_, day) => data.sessions.filter((s) => s.day === day).sort((a, b) => a.start.localeCompare(b.start)));
  const campusDays = byDay.filter((s) => s.length > 0).length;
  const weeklyMinutes = data.sessions.reduce((sum, s) => sum + minutesOfDay(s.end) - minutesOfDay(s.start), 0);

  const open = (d: Draft) => {
    setError('');
    setDraft(d);
  };

  const save = async () => {
    if (!draft) return;
    if (minutesOfDay(draft.end) <= minutesOfDay(draft.start)) {
      setError('שעת הסיום צריכה להיות אחרי שעת ההתחלה');
      return;
    }
    await upsertSession({ ...draft, title: draft.title.trim(), location: draft.location.trim() });
    setDraft(null);
  };

  const exportCalendar = () => {
    downloadFile('odyssey.ics', buildIcs(data.sessions, data.tasks, { travelMinutes: profile.travelMinutes }), 'text/calendar;charset=utf-8');
  };

  const enableReminders = async () => {
    const permission = await Notification.requestPermission();
    await setProfile({ ...profile, remindersEnabled: permission === 'granted' }).catch(() => undefined);
  };

  return (
    <div className="page">
      <header className="page-header row-between">
        <div>
          <h1>מערכת שעות</h1>
          <p className="muted">
            {data.sessions.length > 0
              ? `${campusDays} ימים בקמפוס · ${Math.round((weeklyMinutes / 60) * 10) / 10} שעות בשבוע`
              : 'השיעורים הקבועים שלך בקמפוס.'}
          </p>
        </div>
        <button className="btn primary" onClick={() => open(blank())}>
          <Plus size={18} /> שיעור
        </button>
      </header>

      {data.sessions.length === 0 ? (
        <div className="card">
          <Empty icon={<CalendarDays size={28} />} title="עוד אין שיעורים">
            הוסיפו את ההרצאות והתרגולים הקבועים, ונחשב בשבילך מתי לצאת מבית הספר.
          </Empty>
        </div>
      ) : (
        <div className="week">
          {byDay.map((sessions, day) =>
            sessions.length === 0 ? null : (
              <section key={day} className={day === today ? 'card day today' : 'card day'}>
                <div className="row-between">
                  <h2>
                    יום {DAYS[day]}
                    {day === today && <span className="today-badge">היום</span>}
                  </h2>
                  <span className="leave-chip">
                    <Clock size={14} /> לצאת עד {formatMinutes(minutesOfDay(sessions[0].start) - profile.travelMinutes)}
                  </span>
                </div>
                <ul className="list">
                  {sessions.map((s) => (
                    <li key={s.id}>
                      <button className={`session kind-${s.kind}`} onClick={() => open(s)}>
                        <span className="session-time">
                          <span>{s.start}</span>
                          <span className="muted">{s.end}</span>
                        </span>
                        <span className="grow">
                          <span className="session-title">{s.title}</span>
                          <span className="muted small block">
                            {SESSION_KINDS[s.kind]}
                            {s.location && (
                              <>
                                {' · '}
                                <MapPin size={12} className="inline-icon" /> {s.location}
                              </>
                            )}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ),
          )}
        </div>
      )}

      <section className="card">
        <h2>תזכורות</h2>
        <p className="muted small">
          הדרך האמינה ביותר: הוספה ליומן בטלפון. השיעורים נכנסים כאירועים שבועיים עם תזכורת לצאת {profile.travelMinutes} דקות לפני, והמשימות
          נכנסות עם תזכורת בערב שלפני.
        </p>
        <div className="row-wrap">
          <button className="btn" onClick={exportCalendar} disabled={data.sessions.length === 0 && data.tasks.length === 0}>
            <CalendarPlus size={18} /> הוספה ליומן (‎.ics)
          </button>
          {notificationsSupported() &&
            (profile.remindersEnabled ? (
              <button className="btn" onClick={() => void setProfile({ ...profile, remindersEnabled: false }).catch(() => undefined)}>
                <BellOff size={18} /> כיבוי התראות באפליקציה
              </button>
            ) : (
              <button className="btn" onClick={() => void enableReminders()}>
                <Bell size={18} /> התראה כשצריך לצאת
              </button>
            ))}
        </div>
        {notificationsSupported() && <p className="muted small">התראות מהאפליקציה עובדות רק כשהיא פתוחה.</p>}
      </section>

      {draft && (
        <Sheet
          title={draft.id ? 'עריכת שיעור' : 'שיעור חדש'}
          onClose={() => setDraft(null)}
          onSubmit={save}
          onDelete={draft.id ? async () => { await removeSession(draft.id!); setDraft(null); } : undefined}
        >
          <Field label="שם הקורס">
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} required maxLength={120} placeholder="למשל: חשבון אינפיניטסימלי 1" />
          </Field>
          <Field label="סוג" group>
            <div className="segmented">
              {(Object.keys(SESSION_KINDS) as SessionKind[]).map((k) => (
                <button type="button" key={k} className={draft.kind === k ? 'seg active' : 'seg'} aria-pressed={draft.kind === k} onClick={() => setDraft({ ...draft, kind: k })}>
                  {SESSION_KINDS[k]}
                </button>
              ))}
            </div>
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
            <input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} maxLength={120} placeholder="בניין וחדר" />
          </Field>
          {error && <p className="form-error">{error}</p>}
        </Sheet>
      )}
    </div>
  );
}
