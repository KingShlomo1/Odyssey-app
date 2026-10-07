import { useEffect, useId, type FormEvent, type ReactNode } from 'react';

interface Props {
  title: string;
  onClose(): void;
  onSubmit(): void;
  onDelete?(): void;
  children: ReactNode;
}

/** A bottom sheet holding an edit form. */
export default function Sheet({ title, onClose, onSubmit, onDelete, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <header className="sheet-header">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="סגירה">
            ✕
          </button>
        </header>
        <div className="sheet-body">{children}</div>
        <footer className="sheet-footer">
          <button type="submit" className="btn primary">
            שמירה
          </button>
          {onDelete && (
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                if (confirm('למחוק?')) onDelete();
              }}
            >
              מחיקה
            </button>
          )}
        </footer>
      </form>
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
