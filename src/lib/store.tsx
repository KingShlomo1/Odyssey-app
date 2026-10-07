import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AppData, Course, Profile, Session, Task, User } from './types';
import { ApiError, api, errorMessage } from './api';
import { useToast } from '../components/Toast';

type New<T> = Omit<T, 'id'> & { id?: string };

interface Store {
  user: User;
  data: AppData;
  odysseyAvailable: boolean;
  setProfile(p: Profile): Promise<void>;
  upsertSession(s: New<Session>): Promise<void>;
  removeSession(id: string): Promise<void>;
  upsertCourse(c: New<Course>): Promise<void>;
  removeCourse(id: string): Promise<void>;
  upsertTask(t: New<Task>): Promise<Task | undefined>;
  removeTask(id: string): Promise<void>;
  toggleTask(id: string): Promise<void>;
  replaceAll(d: AppData): Promise<void>;
  reset(): Promise<void>;
  logout(): Promise<void>;
  deleteAccount(): Promise<void>;
}

const StoreContext = createContext<Store | null>(null);

interface AuthState {
  status: 'loading' | 'signed-out' | 'signed-in' | 'offline';
  user: User | null;
  odysseyAvailable: boolean;
}

const AuthContext = createContext<{ auth: AuthState; signedIn(user: User): void } | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ status: 'loading', user: null, odysseyAvailable: false });

  const check = useCallback(() => {
    api
      .me()
      .then(({ user, odysseyAvailable }) => setAuth({ status: user ? 'signed-in' : 'signed-out', user, odysseyAvailable }))
      .catch(() => setAuth((a) => ({ ...a, status: 'offline' })));
  }, []);

  useEffect(check, [check]);

  const value = useMemo(
    () => ({
      auth,
      signedIn: (user: User) => {
        setAuth((a) => ({ ...a, status: 'signed-in', user }));
        check();
      },
    }),
    [auth, check],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const a = useContext(AuthContext);
  if (!a) throw new Error('useAuth must be used inside AuthProvider');
  return a;
}

const upsert = <T extends { id: string }>(list: T[], item: T) =>
  list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];

/** Loads the signed-in student's data from the server and keeps it in sync with every change. */
export function DataProvider({ user, odysseyAvailable, children, fallback }: { user: User; odysseyAvailable: boolean; children: ReactNode; fallback: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.data().then(setData, () => setLoadError(true));
  }, [user.id]);

  const store = useMemo<Store | null>(() => {
    if (!data) return null;
    /** Runs a server call; on failure shows a toast and rethrows so callers can keep a form open. */
    const run = async <T,>(fn: () => Promise<T>): Promise<T> => {
      try {
        return await fn();
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) location.reload();
        toast.error(errorMessage(err));
        throw err;
      }
    };
    return {
      user,
      data,
      odysseyAvailable,
      setProfile: async (profile) => {
        const saved = await run(() => api.saveProfile(profile));
        setData((d) => d && { ...d, profile: saved });
      },
      upsertSession: async (s) => {
        const saved = await run(() => (s.id ? api.updateSession(s as Session) : api.createSession(s)));
        setData((d) => d && { ...d, sessions: upsert(d.sessions, saved) });
      },
      removeSession: async (id) => {
        await run(() => api.deleteSession(id));
        setData((d) => d && { ...d, sessions: d.sessions.filter((x) => x.id !== id) });
      },
      upsertCourse: async (c) => {
        const saved = await run(() => (c.id ? api.updateCourse(c as Course) : api.createCourse(c)));
        setData((d) => d && { ...d, courses: upsert(d.courses, saved) });
      },
      removeCourse: async (id) => {
        await run(() => api.deleteCourse(id));
        setData(
          (d) =>
            d && {
              ...d,
              courses: d.courses.filter((x) => x.id !== id),
              tasks: d.tasks.map((t) => (t.courseId === id ? { ...t, courseId: undefined } : t)),
            },
        );
      },
      upsertTask: async (t) => {
        const saved = await run(() => (t.id ? api.updateTask(t as Task) : api.createTask(t)));
        setData((d) => d && { ...d, tasks: upsert(d.tasks, saved) });
        return saved;
      },
      removeTask: async (id) => {
        await run(() => api.deleteTask(id));
        setData((d) => d && { ...d, tasks: d.tasks.filter((x) => x.id !== id) });
      },
      toggleTask: async (id) => {
        const task = data.tasks.find((t) => t.id === id);
        if (!task) return;
        const next = { ...task, done: !task.done };
        // Optimistic: checkboxes should feel instant.
        setData((d) => d && { ...d, tasks: upsert(d.tasks, next) });
        try {
          await run(() => api.updateTask(next));
        } catch {
          setData((d) => d && { ...d, tasks: upsert(d.tasks, task) });
        }
      },
      replaceAll: async (d) => setData(await run(() => api.importData(d))),
      reset: async () => {
        await run(() => api.resetData());
        setData({ version: 1, profile: null, sessions: [], courses: [], tasks: [] });
      },
      logout: async () => {
        await api.logout().catch(() => undefined);
        location.assign('/');
      },
      deleteAccount: async () => {
        await run(() => api.deleteAccount());
        location.assign('/');
      },
    };
  }, [data, user, odysseyAvailable, toast]);

  if (loadError) return <>{fallback}</>;
  if (!store) return null;
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStore must be used inside DataProvider');
  return s;
}
