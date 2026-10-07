import type { ReactNode } from 'react';

export default function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}
