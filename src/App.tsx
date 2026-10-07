import { useState } from 'react';
import { useStore } from './lib/store';
import { useLeaveReminder } from './lib/reminders';
import Onboarding from './pages/Onboarding';
import Home from './pages/Home';
import Schedule from './pages/Schedule';
import Courses from './pages/Courses';
import Tasks from './pages/Tasks';
import Settings from './pages/Settings';

export type Tab = 'home' | 'schedule' | 'courses' | 'tasks' | 'settings';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'בית', icon: '⌂' },
  { id: 'schedule', label: 'מערכת', icon: '🗓' },
  { id: 'tasks', label: 'משימות', icon: '✓' },
  { id: 'courses', label: 'נק״ז', icon: '🎓' },
  { id: 'settings', label: 'הגדרות', icon: '⚙' },
];

export default function App() {
  const { data, saveFailed } = useStore();
  const [tab, setTab] = useState<Tab>('home');
  useLeaveReminder(data);

  if (!data.profile) return <Onboarding />;

  return (
    <div className="app">
      {saveFailed && <div className="banner warn">לא ניתן לשמור נתונים במכשיר. ייתכן שהדפדפן במצב פרטי.</div>}
      <main className="content">
        {tab === 'home' && <Home goTo={setTab} />}
        {tab === 'schedule' && <Schedule />}
        {tab === 'tasks' && <Tasks />}
        {tab === 'courses' && <Courses />}
        {tab === 'settings' && <Settings />}
      </main>
      <nav className="tabbar" aria-label="ניווט ראשי">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={t.id === tab ? 'tab active' : 'tab'}
            aria-current={t.id === tab ? 'page' : undefined}
            onClick={() => setTab(t.id)}
          >
            <span className="tab-icon" aria-hidden>
              {t.icon}
            </span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
