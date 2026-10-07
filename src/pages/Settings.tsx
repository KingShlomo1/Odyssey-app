import { useRef, useState, type ChangeEvent } from 'react';
import { useStore } from '../lib/store';
import { downloadFile, parseData } from '../lib/storage';
import { toISODate } from '../lib/time';
import ProfileForm from '../components/ProfileForm';

export default function Settings() {
  const { data, setProfile, replaceAll, reset } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');

  const exportBackup = () => {
    downloadFile(`odyssey-backup-${toISODate(new Date())}.json`, JSON.stringify(data, null, 2), 'application/json');
  };

  const importBackup = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = parseData(JSON.parse(await file.text()));
      if (!parsed) throw new Error('invalid');
      if (!confirm('הגיבוי יחליף את כל הנתונים הנוכחיים. להמשיך?')) return;
      replaceAll(parsed);
      setMessage('הגיבוי שוחזר.');
    } catch {
      setMessage('הקובץ אינו גיבוי תקין של האפליקציה.');
    }
  };

  return (
    <div className="stack">
      <header className="page-header">
        <h1>הגדרות</h1>
      </header>

      <section className="card">
        <h2>פרופיל</h2>
        <ProfileForm
          initial={data.profile}
          submitLabel="שמירה"
          onSubmit={(p) => {
            setProfile(p);
            setMessage('הפרופיל נשמר.');
          }}
        />
      </section>

      <section className="card stack">
        <h2>גיבוי</h2>
        <p className="muted small">הנתונים נשמרים רק בדפדפן הזה. כדאי לשמור גיבוי מדי פעם, או כדי לעבור למכשיר אחר.</p>
        <button className="btn" onClick={exportBackup}>
          הורדת גיבוי
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          שחזור מגיבוי
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importBackup} />
        {message && <p className="small" role="status">{message}</p>}
      </section>

      <section className="card stack">
        <h2>איפוס</h2>
        <button
          className="btn danger"
          onClick={() => {
            if (confirm('למחוק את כל הנתונים מהמכשיר? אי אפשר לבטל את זה.')) reset();
          }}
        >
          מחיקת כל הנתונים
        </button>
      </section>
    </div>
  );
}
