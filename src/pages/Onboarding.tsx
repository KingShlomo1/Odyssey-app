import { useState } from 'react';
import { useStore } from '../lib/store';
import { clearLegacyData, legacyData } from '../lib/storage';
import ProfileForm from '../components/ProfileForm';
import OdysseyMark from '../components/OdysseyMark';

export default function Onboarding() {
  const { user, setProfile, replaceAll } = useStore();
  const [legacy] = useState(legacyData);
  const [busy, setBusy] = useState(false);

  const importLegacy = async () => {
    if (!legacy) return;
    setBusy(true);
    try {
      await replaceAll(legacy);
      clearLegacyData();
    } catch {
      setBusy(false);
    }
  };

  return (
    <div className="onboarding">
      <div className="stars" aria-hidden />
      <div className="onboarding-card">
        <OdysseyMark size={64} />
        <h1>נעים להכיר, {user.name}!</h1>
        <p className="muted">עוד כמה פרטים, ואודיסאה יתאים את עצמו אליך.</p>
        {legacy && (
          <div className="banner info">
            <p>מצאנו במכשיר הזה נתונים מהגרסה הקודמת של האפליקציה ({legacy.tasks.length} משימות, {legacy.courses.length} קורסים).</p>
            <button className="btn primary" onClick={importLegacy} disabled={busy}>
              ייבוא לחשבון
            </button>
          </div>
        )}
        <div className="card">
          <ProfileForm defaultName={user.name} submitLabel="יאללה, מתחילים" onSubmit={setProfile} />
        </div>
      </div>
    </div>
  );
}
