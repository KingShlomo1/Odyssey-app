import { FileText, X } from 'lucide-react';
import { api } from '../lib/api';
import type { Upload } from '../lib/types';

export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

/** A thumbnail for an uploaded image or PDF; opens the file in a new tab. */
export default function Attachment({ upload, onRemove, compact }: { upload: Upload; onRemove?(): void; compact?: boolean }) {
  const isImage = upload.mime.startsWith('image/');
  return (
    <div className={compact ? 'attachment compact' : 'attachment'}>
      <a href={api.uploadUrl(upload.id)} target="_blank" rel="noopener noreferrer" className="attachment-link" title={upload.filename}>
        {isImage ? (
          <img src={api.uploadUrl(upload.id)} alt={upload.filename} loading="lazy" />
        ) : (
          <span className="attachment-pdf">
            <FileText size={compact ? 18 : 22} />
          </span>
        )}
        {!compact && (
          <span className="attachment-meta">
            <span className="attachment-name">{upload.filename}</span>
            <span className="muted small">{formatSize(upload.size)}</span>
          </span>
        )}
      </a>
      {onRemove && (
        <button type="button" className="attachment-remove" onClick={onRemove} aria-label={`הסרת ${upload.filename}`}>
          <X size={14} />
        </button>
      )}
    </div>
  );
}
