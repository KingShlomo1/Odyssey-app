import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowUp, Camera, ChevronLeft, Clock, Flame, Lightbulb, MapPin, Target } from 'lucide-react';
import { useStore } from '../lib/store';
import { daysUntil, formatClock, formatDate, leaveBy, relativeDay, toISODate, upcomingCampusDays } from '../lib/time';
import { summarizeCredits } from '../lib/credits';
import { findCrunch, isOverdue, openTasks } from '../lib/workload';
import { DAYS, INSTITUTIONS } from '../lib/constants';
import Empty from '../components/Empty';
import OdysseyMark from '../components/OdysseyMark';
import TaskRow from '../components/TaskRow';

export default function Home() {
  const { data, odysseyAvailable } = useStore();
  const navigate = useNavigate();
  const [question, setQuestion] = useState('');
  const profile = data.profile!;
  const now = new Date();

  const nextDay = upcomingCampusDays(data.sessions, now)[0];
  const leave = nextDay && leaveBy(nextDay, profile.travelMinutes);
  const credits = summarizeCredits(data.courses);
  const open = openTasks(data.tasks);
  const overdue = open.filter((t) => isOverdue(t, now));
  const week = open.filter((t) => {
    const d = daysUntil(t.due, now);
    return d >= 0 && d <= 7;
  });
  const crunch = findCrunch(data.tasks, now);

  const hour = now.getHours();
  const greeting = hour < 5 ? 'לילה טוב' : hour < 12 ? 'בוקר טוב' : hour < 17 ? 'צהריים טובים' : 'ערב טוב';
  const today = now.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });

  const ask = (e: FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (q) navigate(`/odyssey?q=${encodeURIComponent(q)}`);
  };

  let leaveText = '';
  if (nextDay && leave) {
    if (now >= nextDay.start) leaveText = 'השיעור כבר התחיל';
    else if (now >= leave) leaveText = 'הגיע הזמן לצאת!';
    else leaveText = `לצאת עד ${formatClock(leave)}`;
  }

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">{today}</p>
        <h1>
          {greeting}, {profile.name} 👋
        </h1>
      </header>

      <div className="home-grid">
        <section className="hero-card">
          <div className="stars" aria-hidden />
          <p className="hero-label">היום הבא בקמפוס · {INSTITUTIONS[profile.institution]}</p>
          {nextDay ? (
            <>
              <p className="hero-title">
                יום {DAYS[nextDay.start.getDay()]}
                <span className="hero-rel">{relativeDay(toISODate(nextDay.start), now)}</span>
              </p>
              <p className="hero-detail">
                <Clock size={16} /> {nextDay.session.title} · {formatClock(nextDay.start)}
              </p>
              {nextDay.session.location && (
                <p className="hero-detail">
                  <MapPin size={16} /> {nextDay.session.location}
                </p>
              )}
              <span className="hero-pill">{leaveText}</span>
            </>
          ) : (
            <>
              <p className="hero-title">עוד אין מערכת שעות</p>
              <Link to="/schedule" className="hero-pill link-pill">
                להוספת השיעורים <ChevronLeft size={16} />
              </Link>
            </>
          )}
        </section>

        <section className="card odyssey-card">
          <div className="row-start">
            <OdysseyMark size={44} />
            <div>
              <h2>שאלו את אודיסאה</h2>
              <p className="muted small">המורה האישי שלך, זמין 24/7. מסביר, נותן רמזים ובודק פתרונות.</p>
            </div>
          </div>
          {odysseyAvailable ? (
            <>
              <form className="ask-box" onSubmit={ask}>
                <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="למשל: למה הנגזרת של sin היא cos?" aria-label="שאלה לאודיסאה" />
                <button className="send-btn" aria-label="שליחה" disabled={!question.trim()}>
                  <ArrowUp size={18} />
                </button>
              </form>
              <div className="quick-actions">
                <button className="quick" onClick={() => navigate('/odyssey?check=1')}>
                  <Camera size={16} /> בדיקת שיעורי בית
                </button>
                <button className="quick" onClick={() => navigate(`/odyssey?q=${encodeURIComponent('תכין אותי למבחן: תן לי שאלות תרגול אחת אחרי השנייה')}`)}>
                  <Target size={16} /> הכנה למבחן
                </button>
                <button className="quick" onClick={() => navigate(`/odyssey?q=${encodeURIComponent('יש לי שאלה שאני תקוע בה. תעזור לי עם רמז?')}`)}>
                  <Lightbulb size={16} /> רמז לשאלה
                </button>
              </div>
            </>
          ) : (
            <p className="muted small">אודיסאה עוד לא הופעל בשרת הזה.</p>
          )}
        </section>

        <section className="card tasks-card">
          <div className="row-between">
            <h2>השבוע הקרוב</h2>
            <Link to="/tasks" className="link">
              כל המשימות
            </Link>
          </div>
          {crunch && (
            <div className="banner warn">
              <Flame size={18} />
              <span>
                שבוע עמוס: {crunch.count} משימות ומבחנים בשלושה ימים, החל מ{formatDate(crunch.start)}. כדאי להתחיל מוקדם.
              </span>
            </div>
          )}
          {overdue.length > 0 && (
            <Link to="/tasks" className="banner danger">
              {overdue.length === 1 ? 'משימה אחת באיחור' : `${overdue.length} משימות באיחור`}
            </Link>
          )}
          {week.length === 0 ? (
            <Empty title="אין משימות לשבוע הקרוב 🎉">זמן מצוין לחזור על החומר עם אודיסאה.</Empty>
          ) : (
            <ul className="list">
              {week.slice(0, 6).map((t) => (
                <TaskRow key={t.id} task={t} onOpen={() => navigate(`/tasks?open=${t.id}`)} />
              ))}
            </ul>
          )}
        </section>

        <Link to="/credits" className="card credits-card">
          <div className="row-between">
            <h2>נקודות זכות</h2>
            <ChevronLeft size={18} className="muted" />
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
        </Link>
      </div>
    </div>
  );
}
