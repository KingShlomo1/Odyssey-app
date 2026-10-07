import { useEffect } from 'react';
import type { AppData } from './types';
import { formatClock, leaveBy, upcomingCampusDays } from './time';

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

async function notify(title: string, body: string): Promise<void> {
  const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
  if (reg) await reg.showNotification(title, { body, icon: '/icon.svg', lang: 'he', dir: 'rtl' });
  else new Notification(title, { body, icon: '/icon.svg', lang: 'he', dir: 'rtl' });
}

/**
 * While the app is open, fires a "time to leave" notification before the next campus day.
 * Browsers can't run timers for a closed web app, so the calendar export is the reliable path.
 */
export function useLeaveReminder(data: AppData): void {
  const profile = data.profile;
  useEffect(() => {
    if (!profile?.remindersEnabled || !notificationsSupported() || Notification.permission !== 'granted') return;
    const next = upcomingCampusDays(data.sessions)[0];
    if (!next) return;
    const at = leaveBy(next, profile.travelMinutes);
    const delay = at.getTime() - Date.now();
    // setTimeout is unreliable for very long delays; re-run on next app open instead.
    if (delay < 0 || delay > 12 * 3600_000) return;
    const timer = setTimeout(() => {
      void notify('הגיע הזמן לצאת לקמפוס', `${next.session.title} מתחיל ב-${formatClock(next.start)}`);
    }, delay);
    return () => clearTimeout(timer);
  }, [data.sessions, profile]);
}
