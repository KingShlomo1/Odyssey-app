import { useState } from 'react';
import { GraduationCap, Plus } from 'lucide-react';
import { useStore } from '../lib/store';
import type { Course, CourseStatus, GradeLevel, TrackId } from '../lib/types';
import { COURSE_STATUSES, GRADE_NAMES, TRACKS } from '../lib/constants';
import { countsForCredit, summarizeCredits } from '../lib/credits';
import Sheet, { Field } from '../components/Sheet';
import Empty from '../components/Empty';

type Draft = Omit<Course, 'id' | 'finalGrade'> & { id?: string; finalGrade: string };

const TRACK_COLORS: Record<TrackId, string> = { math: '#6366f1', physics: '#0ea5e9', cs: '#10b981', chem: '#f59e0b', other: '#a855f7' };

/** A ring showing the weighted average out of 100. */
function AverageRing({ value }: { value: number | null }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const pct = value == null ? 0 : value / 100;
  return (
    <svg viewBox="0 0 100 100" className="ring" role="img" aria-label={value == null ? 'אין ממוצע עדיין' : `ממוצע ${value}`}>
      <circle cx="50" cy="50" r={r} className="ring-track" />
      <circle cx="50" cy="50" r={r} className="ring-value" strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 50 50)" />
      <text x="50" y="47" className="ring-number">{value ?? '–'}</text>
      <text x="50" y="64" className="ring-label">ממוצע</text>
    </svg>
  );
}

export default function Courses() {
  const { data, upsertCourse, removeCourse } = useStore();
  const profile = data.profile!;
  const [draft, setDraft] = useState<Draft | null>(null);
  const summary = summarizeCredits(data.courses);

  const blank = (): Draft => ({
    name: '',
    track: profile.tracks[0] ?? 'math',
    gradeLevel: profile.grade,
    credits: profile.grade === 9 ? 0 : 3,
    status: 'active',
    finalGrade: '',
  });

  const save = async () => {
    if (!draft) return;
    const grade = draft.finalGrade.trim() === '' ? undefined : Math.min(100, Math.max(0, Number(draft.finalGrade)));
    await upsertCourse({ ...draft, name: draft.name.trim(), credits: draft.gradeLevel === 9 ? 0 : Math.max(0, draft.credits), finalGrade: grade });
    setDraft(null);
  };

  const levels = ([12, 11, 10, 9] as GradeLevel[]).filter((g) => data.courses.some((c) => c.gradeLevel === g));
  const trackEntries = Object.entries(summary.byTrack) as [TrackId, number][];
  const trackTotal = trackEntries.reduce((s, [, n]) => s + n, 0);

  return (
    <div className="page">
      <header className="page-header row-between">
        <div>
          <h1>קורסים ונק״ז</h1>
          <p className="muted">נקודות הזכות נשמרות לזכותך עד 10 שנים מסיום הקורס.</p>
        </div>
        <button className="btn primary" onClick={() => setDraft(blank())}>
          <Plus size={18} /> קורס
        </button>
      </header>

      <section className="hero-card credits-hero">
        <div className="stars" aria-hidden />
        <AverageRing value={summary.average} />
        <div className="grow">
          <div className="credit-stats">
            <div>
              <div className="stat">{summary.earned}</div>
              <div className="small">נק״ז שנצברו</div>
            </div>
            <div>
              <div className="stat">{summary.inProgress}</div>
              <div className="small">בלימודים</div>
            </div>
            <div>
              <div className="stat">{summary.planned}</div>
              <div className="small">מתוכננות</div>
            </div>
          </div>
          {trackTotal > 0 && (
            <>
              <div className="track-bar" aria-hidden>
                {trackEntries.map(([t, n]) => (
                  <span key={t} style={{ flex: n, background: TRACK_COLORS[t] }} />
                ))}
              </div>
              <div className="track-legend small">
                {trackEntries.map(([t, n]) => (
                  <span key={t}>
                    <span className="dot" style={{ background: TRACK_COLORS[t] }} /> {TRACKS[t]} {n}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {data.courses.length === 0 && (
        <div className="card">
          <Empty icon={<GraduationCap size={28} />} title="עוד אין קורסים">
            הוסיפו את הקורסים שלך כדי לעקוב אחרי נקודות הזכות והציונים.
          </Empty>
        </div>
      )}

      {levels.map((g) => (
        <section key={g} className="card">
          <h2>כיתה {GRADE_NAMES[g]}</h2>
          {g === 9 && <p className="muted small">קורסי כיתה ט׳ הם קורסי קדם ואינם מקנים נק״ז.</p>}
          <ul className="list">
            {data.courses
              .filter((c) => c.gradeLevel === g)
              .map((c) => (
                <li key={c.id}>
                  <button className="course" onClick={() => setDraft({ ...c, finalGrade: c.finalGrade?.toString() ?? '' })}>
                    <span className="course-bar" style={{ background: TRACK_COLORS[c.track] }} aria-hidden />
                    <span className="grow">
                      <span className="course-name">{c.name}</span>
                      <span className="muted small block">
                        {TRACKS[c.track]}
                        {countsForCredit(c) && ` · ${c.credits} נק״ז`}
                      </span>
                    </span>
                    {c.finalGrade != null && <span className="grade">{c.finalGrade}</span>}
                    <span className={`pill status-${c.status}`}>{COURSE_STATUSES[c.status]}</span>
                  </button>
                </li>
              ))}
          </ul>
        </section>
      ))}

      {draft && (
        <Sheet
          title={draft.id ? 'עריכת קורס' : 'קורס חדש'}
          onClose={() => setDraft(null)}
          onSubmit={save}
          onDelete={draft.id ? async () => { await removeCourse(draft.id!); setDraft(null); } : undefined}
        >
          <Field label="שם הקורס">
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required maxLength={120} />
          </Field>
          <div className="row">
            <Field label="תחום">
              <select value={draft.track} onChange={(e) => setDraft({ ...draft, track: e.target.value as TrackId })}>
                {Object.entries(TRACKS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="כיתה">
              <select value={draft.gradeLevel} onChange={(e) => setDraft({ ...draft, gradeLevel: Number(e.target.value) as GradeLevel })}>
                {[9, 10, 11, 12].map((g) => (
                  <option key={g} value={g}>{GRADE_NAMES[g]}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="row">
            <Field label="נק״ז">
              <input
                type="number"
                min={0}
                max={20}
                step={0.5}
                inputMode="decimal"
                value={draft.gradeLevel === 9 ? 0 : draft.credits}
                disabled={draft.gradeLevel === 9}
                onChange={(e) => setDraft({ ...draft, credits: Number(e.target.value) })}
              />
            </Field>
            <Field label="סטטוס">
              <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as CourseStatus })}>
                {Object.entries(COURSE_STATUSES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="ציון סופי" hint="אפשר להשאיר ריק עד שהציון מתפרסם.">
            <input type="number" min={0} max={100} inputMode="numeric" value={draft.finalGrade} onChange={(e) => setDraft({ ...draft, finalGrade: e.target.value })} />
          </Field>
        </Sheet>
      )}
    </div>
  );
}
