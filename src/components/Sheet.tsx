import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface Props {
  title: string;
  onClose(): void;
  /** When set, the sheet is a form with save (and optional delete) buttons. */
  onSubmit?(): void | Promise<void>;
  onDelete?(): void | Promise<void>;
  submitLabel?: string;
  children: ReactNode;
}

/** A bottom sheet on phones and a centered dialog on larger screens. */
export default function Sheet({ title, onClose, onSubmit, onDelete, submitLabel = 'שמירה', children }: Props) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const guard = async (fn: () => void | Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch {
      // The store already showed an error toast; keep the sheet open.
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (onSubmit) void guard(onSubmit);
  };

  const Body = onSubmit ? 'form' : 'div';

  return (
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <Body className="sheet" role="dialog" aria-modal="true" aria-label={title} onSubmit={onSubmit ? submit : undefined}>
        <div className="sheet-grip" aria-hidden />
        <header className="sheet-header">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="סגירה">
            <X size={20} />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
        {onSubmit && (
          <footer className="sheet-footer">
            <button type="submit" className="btn primary" disabled={busy}>
              {submitLabel}
            </button>
            {onDelete && (
              <button
                type="button"
                className="btn ghost danger"
                disabled={busy}
                onClick={() => {
                  if (confirm('למחוק?')) void guard(onDelete);
                }}
              >
                מחיקה
              </button>
            )}
          </footer>
        )}
      </Body>
    </div>
  );
}

export function Field({ label, children, hint, group }: { label: string; children: ReactNode; hint?: string; group?: boolean }) {
  const id = useId();
  const content = (
    <>
      <span className="field-label" id={id}>
        {label}
      </span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </>
  );
  // A <label> may only wrap one control, so button groups get role="group" instead.
  return group ? (
    <div className="field" role="group" aria-labelledby={id}>
      {content}
    </div>
  ) : (
    <label className="field">{content}</label>
  );
}
