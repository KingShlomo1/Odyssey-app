import { useRef, type ChangeEvent } from 'react';
import { Download, LogOut, Trash2, Upload as UploadIcon, UserX } from 'lucide-react';
import { useStore } from '../lib/store';
import { downloadFile, parseData } from '../lib/storage';
import { toISODate } from '../lib/time';
import ProfileForm from '../components/ProfileForm';
import { useToast } from '../components/Toast';

export default function Settings() {
  const { user, data, setProfile, replaceAll, reset, logout, deleteAccount } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const exportBackup = () => {
    downloadFile(`odyssey-backup-${toISODate(new Date())}.json`, JSON.stringify(data, null, 2), 'application/json');
  };

  const importBackup = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    let parsed;
    try {
      parsed = parseData(JSON.parse(await file.text()));
    } catch {
      parsed = null;
    }
    if (!parsed) {
      toast.error('הקובץ אינו גיבוי תקין של האפליקציה.');
      return;
    }
    if (!confirm('הגיבוי יחליף את המערכת, הקורסים והמשימות. להמשיך?')) return;
    await replaceAll(parsed).then(() => toast.success('הגיבוי שוחזר.'), () => undefined);
  };

  return (
    <div className="page narrow">
      <header className="page-header">
        <h1>הגדרות</h1>
        <p className="muted" dir="ltr" style={{ textAlign: 'right' }}>
          {user.email}
        </p>
      </header>

      <section className="card">
        <h2>פרופיל</h2>
        <ProfileForm initial={data.profile} submitLabel="שמירה" onSubmit={async (p) => { await setProfile(p); toast.success('הפרופיל נשמר.'); }} />
      </section>

      <section className="card stack">
        <h2>גיבוי</h2>
        <p className="muted small">הנתונים שמורים בחשבון שלך. אפשר גם להוריד עותק, או לשחזר מגיבוי של הגרסה הקודמת.</p>
        <div className="row-wrap">
          <button className="btn" onClick={exportBackup}>
            <Download size={18} /> הורדת גיבוי
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            <UploadIcon size={18} /> שחזור מגיבוי
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importBackup} />
      </section>

      <section className="card stack">
        <h2>חשבון</h2>
        <div className="row-wrap">
          <button className="btn" onClick={() => void logout()}>
            <LogOut size={18} /> התנתקות
          </button>
          <button
            className="btn ghost danger"
            onClick={() => {
              if (confirm('למחוק את כל הנתונים (מערכת, קורסים, משימות, קבצים ושיחות)? אי אפשר לבטל את זה.')) void reset().catch(() => undefined);
            }}
          >
            <Trash2 size={18} /> מחיקת כל הנתונים
          </button>
          <button
            className="btn ghost danger"
            onClick={() => {
              if (confirm('למחוק את החשבון לצמיתות, כולל כל הנתונים? אי אפשר לבטל את זה.')) void deleteAccount().catch(() => undefined);
            }}
          >
            <UserX size={18} /> מחיקת החשבון
          </button>
        </div>
      </section>
    </div>
  );
}
