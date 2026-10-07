import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CircleAlert, Check } from 'lucide-react';

interface ToastItem {
  id: number;
  kind: 'error' | 'success';
  text: string;
}

interface ToastApi {
  error(text: string): void;
  success(text: string): void;
}

const ToastContext = createContext<ToastApi | null>(null);
let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((kind: ToastItem['kind'], text: string) => {
    const id = nextId++;
    setItems((cur) => [...cur.slice(-2), { id, kind, text }]);
    setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), 4000);
  }, []);
  const api = useMemo(() => ({ error: (t: string) => push('error', t), success: (t: string) => push('success', t) }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.kind === 'error' ? <CircleAlert size={18} /> : <Check size={18} />}
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const t = useContext(ToastContext);
  if (!t) throw new Error('useToast must be used inside ToastProvider');
  return t;
}
