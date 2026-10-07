import { useState } from 'react';
import { useStore } from '../lib/store';
import type { Course, CourseStatus, GradeLevel, TrackId } from '../lib/types';
import { COURSE_STATUSES, GRADE_NAMES, TRACKS } from '../lib/constants';
import { countsForCredit, summarizeCredits } from '../lib/credits';
import Sheet, { Field } from '../components/Sheet';
import Empty from '../components/Empty';

type Draft = Omit<Course, 'id' | 'finalGrade'> & { id?: string; finalGrade: string };

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

  const edit = (c: Course) => setDraft({ ...c, finalGrade: c.finalGrade?.toString() ?? '' });

  const save = () => {
    if (!draft) return;
    const grade = draft.finalGrade.trim() === '' ? undefined : Math.min(100, Math.max(0, Number(draft.finalGrade)));
    upsertCourse({
      ...draft,
      name: draft.name.trim(),
      credits: draft.gradeLevel === 9 ? 0 : Math.max(0, draft.credits),
      finalGrade: grade,
    });
    setDraft(null);
  };

  const levels = ([12, 11, 10, 9] as GradeLevel[]).filter((g) => data.courses.some((c) => c.gradeLevel === g));
  const trackEntries = Object.entries(summary.byTrack) as [TrackId, number][];

  return (
    <div className="stack">
      <header className="page-header row-between">
        <h1>קורסים ונק״ז</h1>
        <button className="btn primary" onClick={() => setDraft(blank())}>
          + קורס
        </button>
      </header>

      <section className="card accent">
        <div className="stats">
          <div>
            <div className="stat">{summary.earned}</div>
            <div className="small">נק״ז שנצברו</div>
          </div>
          <div>
            <div className="stat">{summary.inProgress}</div>
            <div className="small">בלימודים</div>
          </div>
          <div>
            <div className="stat">{summary.average ?? '–'}</div>
            <div className="small">ממוצע משוקלל</div>
          </div>
        </div>
        {trackEntries.length > 0 && (
          <p className="small">
            {trackEntries.map(([t, n]) => `${TRACKS[t]}: ${n}`).join(' · ')}
          </p>
        )}
        <p className="small">נקודות הזכות נשמרות לזכותך עד 10 שנים מסיום הקורס.</p>
      </section>

      {data.courses.length === 0 && <Empty>הוסיפו את הקורסים שאתם לומדים כדי לעקוב אחרי נקודות הזכות והציונים.</Empty>}

      {levels.map((g) => (
        <section key={g} className="card">
          <h2>כיתה {GRADE_NAMES[g]}</h2>
          {g === 9 && <p className="muted small">קורסי כיתה ט׳ הם קורסי קדם ואינם מקנים נק״ז.</p>}
          <ul className="list">
            {data.courses
              .filter((c) => c.gradeLevel === g)
              .map((c) => (
                <li key={c.id}>
                  <button className="list-item clickable" onClick={() => edit(c)}>
                    <span className="grow">
                      <span>{c.name}</span>
                      <span className="muted small block">
                        {TRACKS[c.track]}
                        {countsForCredit(c) && ` · ${c.credits} נק״ז`}
                        {c.finalGrade != null && ` · ציון ${c.finalGrade}`}
                      </span>
                    </span>
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
          onDelete={draft.id ? () => { removeCourse(draft.id!); setDraft(null); } : undefined}
        >
          <Field label="שם הקורס">
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
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
