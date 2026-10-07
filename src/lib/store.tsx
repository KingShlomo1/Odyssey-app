import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AppData, Course, Profile, Session, Task } from './types';
import { emptyData, loadData, newId, saveData } from './storage';

type WithoutId<T> = Omit<T, 'id'>;

interface Store {
  data: AppData;
  saveFailed: boolean;
  setProfile(p: Profile): void;
  upsertSession(s: WithoutId<Session> & { id?: string }): void;
  removeSession(id: string): void;
  upsertCourse(c: WithoutId<Course> & { id?: string }): void;
  removeCourse(id: string): void;
  upsertTask(t: WithoutId<Task> & { id?: string }): void;
  removeTask(id: string): void;
  toggleTask(id: string): void;
  replaceAll(d: AppData): void;
  reset(): void;
}

const StoreContext = createContext<Store | null>(null);

function upsert<T extends { id: string }>(list: T[], item: WithoutId<T> & { id?: string }): T[] {
  if (item.id && list.some((x) => x.id === item.id)) {
    return list.map((x) => (x.id === item.id ? ({ ...item, id: item.id } as T) : x));
  }
  return [...list, { ...item, id: item.id ?? newId() } as T];
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(loadData);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    setSaveFailed(!saveData(data));
  }, [data]);

  const store = useMemo<Store>(
    () => ({
      data,
      saveFailed,
      setProfile: (profile) => setData((d) => ({ ...d, profile })),
      upsertSession: (s) => setData((d) => ({ ...d, sessions: upsert(d.sessions, s) })),
      removeSession: (id) => setData((d) => ({ ...d, sessions: d.sessions.filter((x) => x.id !== id) })),
      upsertCourse: (c) => setData((d) => ({ ...d, courses: upsert(d.courses, c) })),
      removeCourse: (id) =>
        setData((d) => ({
          ...d,
          courses: d.courses.filter((x) => x.id !== id),
          tasks: d.tasks.map((t) => (t.courseId === id ? { ...t, courseId: undefined } : t)),
        })),
      upsertTask: (t) => setData((d) => ({ ...d, tasks: upsert(d.tasks, t) })),
      removeTask: (id) => setData((d) => ({ ...d, tasks: d.tasks.filter((x) => x.id !== id) })),
      toggleTask: (id) =>
        setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) })),
      replaceAll: (next) => setData(next),
      reset: () => setData(emptyData()),
    }),
    [data, saveFailed],
  );

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}
