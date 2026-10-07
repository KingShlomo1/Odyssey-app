import { useStore } from '../lib/store';
import type { Tab } from '../App';
import { daysUntil, formatClock, formatDate, leaveBy, relativeDay, toISODate, upcomingCampusDays } from '../lib/time';
import { summarizeCredits } from '../lib/credits';
import { findCrunch, isOverdue, openTasks } from '../lib/workload';
import { DAYS, INSTITUTIONS, TASK_KINDS, TASK_SOURCES } from '../lib/constants';
import Empty from '../components/Empty';

export default function Home({ goTo }: { goTo(t: Tab): void }) {
  const { data, toggleTask } = useStore();
  const profile = data.profile!;
  const now = new Date();

  const nextDay = upcomingCampusDays(data.sessions, now)[0];
  const leave = nextDay && leaveBy(nextDay, profile.travelMinutes);
  const credits = summarizeCredits(data.courses);
  const open = openTasks(data.tasks);
  const overdue = open.filter((t) => isOverdue(t, now));
  const soon = open.filter((t) => {
    const d = daysUntil(t.due, now);
    return d >= 0 && d <= 7;
  });
  const crunch = findCrunch(data.tasks, now);

  const hour = now.getHours();
  const greeting = hour < 12 ? 'בוקר טוב' : hour < 18 ? 'צהריים טובים' : 'ערב טוב';

  return (
    <div className="stack">
      <header className="page-header">
        <h1>
          {greeting}, {profile.name}
        </h1>
        <p className="muted">{INSTITUTIONS[profile.institution]}</p>
      </header>

      <section className="card accent">
        <h2>היום הבא בקמפוס</h2>
        {nextDay ? (
          <>
            <p className="big">
              יום {DAYS[nextDay.start.getDay()]} · {relativeDay(toISODate(nextDay.start), now)}
            </p>
            <p>
              {nextDay.session.title} ב-{formatClock(nextDay.start)}
              {nextDay.session.location && ` · ${nextDay.session.location}`}
            </p>
            <p className="leave">
              {leave! <= now && now < nextDay.start ? 'הגיע הזמן לצאת!' : now >= nextDay.start ? 'השיעור כבר התחיל' : `לצאת עד ${formatClock(leave!)}`}
            </p>
          </>
        ) : (
          <Empty>
            עוד לא הוספת שיעורים.{' '}
            <button className="link" onClick={() => goTo('schedule')}>
              להוספת מערכת שעות
            </button>
          </Empty>
        )}
      </section>

      {crunch && (
        <div className="banner warn">
          עומס: {crunch.count} משימות ומבחנים בשלושה ימים החל מ{formatDate(crunch.start)}. כדאי להתחיל מוקדם.
        </div>
      )}

      <section className="card">
        <div className="row-between">
          <h2>השבוע הקרוב</h2>
          <button className="link" onClick={() => goTo('tasks')}>
            הכול
          </button>
        </div>
        {overdue.length > 0 && <p className="danger-text">{overdue.length} משימות באיחור</p>}
        {soon.length === 0 ? (
          <Empty>אין משימות לשבוע הקרוב 🎉</Empty>
        ) : (
          <ul className="list">
            {soon.slice(0, 6).map((t) => (
              <li key={t.id} className="list-item">
                <input type="checkbox" checked={t.done} onChange={() => toggleTask(t.id)} aria-label={`סימון ${t.title} כבוצע`} />
                <div className="grow">
                  <div>{t.title}</div>
                  <div className="muted small">
                    {TASK_KINDS[t.kind]} · {TASK_SOURCES[t.source]}
                  </div>
                </div>
                <span className={t.kind === 'exam' || t.kind === 'quiz' ? 'pill exam' : 'pill'}>{relativeDay(t.due, now)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <div className="row-between">
          <h2>נקודות זכות</h2>
          <button className="link" onClick={() => goTo('courses')}>
            פירוט
          </button>
        </div>
        <div className="stats">
          <div>
            <div className="stat">{credits.earned}</div>
            <div className="muted small">נצברו</div>
          </div>
          <div>
            <div className="stat">{credits.inProgress}</div>
            <div className="muted small">בלימודים</div>
          </div>
          <div>
            <div className="stat">{credits.average ?? '–'}</div>
            <div className="muted small">ממוצע</div>
          </div>
        </div>
      </section>
    </div>
  );
}
