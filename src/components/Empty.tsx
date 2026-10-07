import type { ReactNode } from 'react';

export default function Empty({ icon, title, children }: { icon?: ReactNode; title?: string; children?: ReactNode }) {
  return (
    <div className="empty">
      {icon && <div className="empty-icon">{icon}</div>}
      {title && <p className="empty-title">{title}</p>}
      {children && <div className="empty-text">{children}</div>}
    </div>
  );
}
