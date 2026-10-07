import { useRef, type ReactNode } from 'react';

export const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,application/pdf';

/** A button that opens the file chooser (camera or gallery on phones) for images and PDFs. */
export default function FilePicker({ onFiles, children, className = 'btn', multiple = true, disabled }: { onFiles(files: File[]): void; children: ReactNode; className?: string; multiple?: boolean; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className={className} onClick={() => ref.current?.click()} disabled={disabled}>
        {children}
      </button>
      <input
        ref={ref}
        type="file"
        accept={ACCEPT}
        multiple={multiple}
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          if (files.length) onFiles(files);
        }}
      />
    </>
  );
}
