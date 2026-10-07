import { useState, type FormEvent } from 'react';
import type { GradeLevel, InstitutionId, Profile, TrackId } from '../lib/types';
import { GRADE_NAMES, INSTITUTIONS, TRACKS } from '../lib/constants';
import { Field } from './Sheet';

interface Props {
  initial?: Profile | null;
  submitLabel: string;
  onSubmit(p: Profile): void;
}

export default function ProfileForm({ initial, submitLabel, onSubmit }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [institution, setInstitution] = useState<InstitutionId>(initial?.institution ?? 'tau');
  const [grade, setGrade] = useState<GradeLevel>(initial?.grade ?? 9);
  const [tracks, setTracks] = useState<TrackId[]>(initial?.tracks ?? ['math']);
  const [travelMinutes, setTravel] = useState(initial?.travelMinutes ?? 45);

  const toggleTrack = (t: TrackId) => setTracks((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: name.trim(),
      institution,
      grade,
      tracks,
      travelMinutes: Math.max(0, travelMinutes),
      remindersEnabled: initial?.remindersEnabled ?? false,
    });
  };

  return (
    <form className="stack" onSubmit={submit}>
      <Field label="שם">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="איך לקרוא לך?" required />
      </Field>
      <Field label="מוסד אקדמי">
        <select value={institution} onChange={(e) => setInstitution(e.target.value as InstitutionId)}>
          {Object.entries(INSTITUTIONS).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="כיתה" group>
        <div className="segmented">
          {([9, 10, 11, 12] as GradeLevel[]).map((g) => (
            <button type="button" key={g} className={g === grade ? 'seg active' : 'seg'} onClick={() => setGrade(g)}>
              {GRADE_NAMES[g]}
            </button>
          ))}
        </div>
      </Field>
      <Field label="מסלולים" group hint={grade === 9 ? 'בכיתה ט׳ לומדים מסלול רב-תחומי. אפשר לעדכן בהמשך.' : undefined}>
        <div className="chips">
          {(Object.keys(TRACKS) as TrackId[]).map((t) => (
            <button type="button" key={t} className={tracks.includes(t) ? 'chip active' : 'chip'} aria-pressed={tracks.includes(t)} onClick={() => toggleTrack(t)}>
              {TRACKS[t]}
            </button>
          ))}
        </div>
      </Field>
      <Field label="זמן נסיעה מבית הספר לקמפוס (דקות)" hint="משמש לחישוב מתי לצאת.">
        <input type="number" min={0} max={300} inputMode="numeric" value={travelMinutes} onChange={(e) => setTravel(Number(e.target.value))} />
      </Field>
      <button type="submit" className="btn primary">
        {submitLabel}
      </button>
    </form>
  );
}
