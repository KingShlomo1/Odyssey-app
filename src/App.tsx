import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { DataProvider, useAuth, useStore } from './lib/store';
import { useLeaveReminder } from './lib/reminders';
import Layout from './components/Layout';
import AuthPage from './pages/Auth';
import Onboarding from './pages/Onboarding';
import Home from './pages/Home';
import Schedule from './pages/Schedule';
import Tasks from './pages/Tasks';
import Courses from './pages/Courses';
import Settings from './pages/Settings';
import OdysseyMark from './components/OdysseyMark';

// The tutor pulls in Markdown and KaTeX; load it only when opened.
const Odyssey = lazy(() => import('./pages/Odyssey'));

function Splash({ text }: { text?: string }) {
  return (
    <div className="splash">
      <OdysseyMark size={64} animated />
      {text && <p className="muted">{text}</p>}
    </div>
  );
}

function Offline() {
  return (
    <div className="splash">
      <OdysseyMark size={64} />
      <h1>אין חיבור לשרת</h1>
      <p className="muted">בדקו את החיבור לאינטרנט ונסו שוב.</p>
      <button className="btn primary" onClick={() => location.reload()}>
        ניסיון חוזר
      </button>
    </div>
  );
}

function SignedInApp() {
  const { data } = useStore();
  useLeaveReminder(data);
  if (!data.profile) return <Onboarding />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="schedule" element={<Schedule />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="credits" element={<Courses />} />
        <Route path="odyssey" element={<Suspense fallback={null}><Odyssey /></Suspense>} />
        <Route path="odyssey/:id" element={<Suspense fallback={null}><Odyssey /></Suspense>} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  const { auth } = useAuth();
  if (auth.status === 'loading') return <Splash />;
  if (auth.status === 'offline') return <Offline />;
  return (
    <BrowserRouter>
      {auth.status === 'signed-in' && auth.user ? (
        <DataProvider user={auth.user} odysseyAvailable={auth.odysseyAvailable} fallback={<Offline />}>
          <SignedInApp />
        </DataProvider>
      ) : (
        <Routes>
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route path="*" element={<AuthPage mode="login" />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}
