import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ArrowUp, Paperclip, Square } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import type { Upload } from '../lib/types';
import Attachment from './Attachment';
import FilePicker from './FilePicker';
import { useToast } from './Toast';

interface Props {
  onSend(text: string, uploads: Upload[]): void;
  /** While a reply streams, the send button becomes a stop button. */
  streaming?: boolean;
  onStop?(): void;
  placeholder?: string;
  autoFocus?: boolean;
  highlightAttach?: boolean;
  initialText?: string;
}

export default function Composer({ onSend, streaming, onStop, placeholder = 'כתבו לאודיסאה…', autoFocus, highlightAttach, initialText = '' }: Props) {
  const [text, setText] = useState(initialText);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [uploading, setUploading] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);
  const toast = useToast();

  // Grow the text box with its content, up to a limit.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [text]);

  useEffect(() => {
    if (autoFocus && window.matchMedia('(pointer: fine)').matches) ref.current?.focus();
  }, [autoFocus]);

  const addFiles = async (files: File[]) => {
    setUploading((n) => n + files.length);
    for (const f of files) {
      try {
        const u = await api.upload(f);
        setUploads((cur) => [...cur, u]);
      } catch (err) {
        toast.error(`${f.name}: ${errorMessage(err)}`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const canSend = !streaming && uploading === 0 && (text.trim().length > 0 || uploads.length > 0);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!canSend) return;
    onSend(text.trim(), uploads);
    setText('');
    setUploads([]);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends on a keyboard; on phones Enter adds a new line and the button sends.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia('(pointer: fine)').matches) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <form className="composer" onSubmit={submit}>
      {(uploads.length > 0 || uploading > 0) && (
        <div className="composer-attachments">
          {uploads.map((u) => (
            <Attachment key={u.id} upload={u} compact onRemove={() => setUploads((cur) => cur.filter((x) => x.id !== u.id))} />
          ))}
          {Array.from({ length: uploading }, (_, i) => (
            <div key={i} className="attachment compact loading" aria-label="מעלה קובץ" />
          ))}
        </div>
      )}
      <div className="composer-row">
        <FilePicker className={highlightAttach && uploads.length === 0 ? 'icon-btn attach pulse' : 'icon-btn attach'} onFiles={(f) => void addFiles(f)}>
          <Paperclip size={20} />
          <span className="sr-only">צירוף צילום או PDF</span>
        </FilePicker>
        <textarea
          ref={ref}
          rows={1}
          dir="auto"
          value={text}
          maxLength={8000}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          aria-label="הודעה לאודיסאה"
        />
        {streaming ? (
          <button type="button" className="send-btn stop" onClick={onStop} aria-label="עצירה">
            <Square size={14} fill="currentColor" />
          </button>
        ) : (
          <button type="submit" className="send-btn" disabled={!canSend} aria-label="שליחה">
            <ArrowUp size={18} />
          </button>
        )}
      </div>
    </form>
  );
}
