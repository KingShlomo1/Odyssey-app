import { NavLink, Outlet, useLocation } from 'react-router';
import { CalendarDays, GraduationCap, House, ListChecks, Settings } from 'lucide-react';
import type { ReactNode } from 'react';
import { useStore } from '../lib/store';
import OdysseyMark from './OdysseyMark';

const NAV: { to: string; label: string; icon: ReactNode; end?: boolean }[] = [
  { to: '/', label: 'בית', icon: <House size={22} />, end: true },
  { to: '/schedule', label: 'מערכת', icon: <CalendarDays size={22} /> },
  { to: '/odyssey', label: 'אודיסאה', icon: <OdysseyMark size={26} /> },
  { to: '/tasks', label: 'משימות', icon: <ListChecks size={22} /> },
  { to: '/credits', label: 'נק״ז', icon: <GraduationCap size={22} /> },
];

export default function Layout() {
  const { data } = useStore();
  const { pathname } = useLocation();
  const inChat = pathname.startsWith('/odyssey/');
  const initial = data.profile?.name.trim().charAt(0) ?? '?';

  return (
    <div className={inChat ? 'shell in-chat' : 'shell'}>
      <aside className="sidebar">
        <div className="brand">
          <OdysseyMark size={36} />
          <div>
            <div className="brand-name">אודיסאה</div>
            <div className="brand-sub">מדעני העתיד</div>
          </div>
        </div>
        <nav aria-label="ניווט ראשי">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'side-link active' : 'side-link')}>
              {n.icon}
              <span>{n.to === '/odyssey' ? 'אודיסאה – מורה AI' : n.label}</span>
            </NavLink>
          ))}
        </nav>
        <NavLink to="/settings" className={({ isActive }) => (isActive ? 'side-link me active' : 'side-link me')}>
          <span className="avatar">{initial}</span>
          <span className="grow">{data.profile?.name}</span>
          <Settings size={18} />
        </NavLink>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="brand">
            <OdysseyMark size={30} />
            <span className="brand-name">אודיסאה</span>
          </div>
          <NavLink to="/settings" className="avatar" aria-label="הגדרות">
            {initial}
          </NavLink>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>

      <nav className="tabbar" aria-label="ניווט ראשי">
        {NAV.map((n) =>
          n.to === '/odyssey' ? (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? 'tab tab-odyssey active' : 'tab tab-odyssey')}>
              <span className="tab-odyssey-btn">
                <OdysseyMark size={34} />
              </span>
              {n.label}
            </NavLink>
          ) : (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'tab active' : 'tab')}>
              {n.icon}
              {n.label}
            </NavLink>
          ),
        )}
      </nav>
    </div>
  );
}
