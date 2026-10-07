import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { CalendarDays, ClipboardCheck, GraduationCap, Sparkles } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../lib/store';
import { Field } from '../components/Sheet';
import OdysseyMark from '../components/OdysseyMark';

const FEATURES = [
  { icon: <Sparkles size={20} />, title: 'אודיסאה – מורה AI אישי', text: 'מעלים צילום של הפתרון, ומקבלים הסבר, רמזים ומשוב על הטעויות.' },
  { icon: <CalendarDays size={20} />, title: 'מערכת שעות חכמה', text: 'יודעים בדיוק מתי לצאת מבית הספר לקמפוס.' },
  { icon: <ClipboardCheck size={20} />, title: 'משימות ומבחנים', text: 'אודיסאה ובית הספר במקום אחד, עם התראה על עומס.' },
  { icon: <GraduationCap size={20} />, title: 'מעקב נק״ז', text: 'נקודות זכות, ציונים וממוצע משוקלל לתואר.' },
];

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { signedIn } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const register = mode === 'register';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { user } = register ? await api.register(email, password, name) : await api.login(email, password);
      navigate('/', { replace: true });
      signedIn(user);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <section className="auth-hero">
        <div className="stars" aria-hidden />
        <div className="auth-hero-inner">
          <OdysseyMark size={56} />
          <h1>הלימודים באוניברסיטה, מסודרים.</h1>
          <p>העוזר האישי לתלמידי תוכנית אודיסאה של מדעני העתיד.</p>
          <ul className="feature-list">
            {FEATURES.map((f) => (
              <li key={f.title}>
                <span className="feature-icon">{f.icon}</span>
                <span>
                  <strong>{f.title}</strong>
                  <span className="block">{f.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="auth-panel">
        <form className="auth-card stack" onSubmit={submit}>
          <div>
            <h2>{register ? 'יצירת חשבון' : 'ברוכים השבים'}</h2>
            <p className="muted">{register ? 'לוקח פחות מדקה.' : 'התחברו כדי להמשיך.'}</p>
          </div>
          {register && (
            <Field label="שם">
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" required maxLength={60} />
            </Field>
          )}
          <Field label="אימייל">
            <input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </Field>
          <Field label="סיסמה" hint={register ? 'לפחות 8 תווים.' : undefined}>
            <input
              type="password"
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={register ? 'new-password' : 'current-password'}
              minLength={register ? 8 : undefined}
              required
            />
          </Field>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="btn primary lg" disabled={busy}>
            {busy ? 'רגע…' : register ? 'יצירת חשבון' : 'התחברות'}
          </button>
          <p className="center small">
            {register ? (
              <>
                כבר יש לך חשבון? <Link to="/login">התחברות</Link>
              </>
            ) : (
              <>
                אין לך חשבון? <Link to="/register">הרשמה</Link>
              </>
            )}
          </p>
        </form>
      </section>
    </div>
  );
}
