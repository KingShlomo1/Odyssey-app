import { useStore } from '../lib/store';
import ProfileForm from '../components/ProfileForm';

export default function Onboarding() {
  const { setProfile } = useStore();
  return (
    <div className="onboarding">
      <img src="/icon.svg" alt="" width={72} height={72} />
      <h1>ברוכים הבאים לאודיסאה</h1>
      <p className="muted">מערכת שעות, נקודות זכות, משימות ומבחנים, הכול במקום אחד. הנתונים נשמרים רק במכשיר שלך.</p>
      <div className="card">
        <ProfileForm submitLabel="יאללה, מתחילים" onSubmit={setProfile} />
      </div>
    </div>
  );
}
