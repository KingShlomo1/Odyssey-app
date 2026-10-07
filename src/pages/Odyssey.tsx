import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { BookOpen, Camera, ChevronRight, ClipboardList, Lightbulb, MessageCircle, Plus, Target, Trash2 } from 'lucide-react';
import { api, errorMessage, sendToOdyssey } from '../lib/api';
import { useStore } from '../lib/store';
import type { ChatMessage, Conversation, Upload } from '../lib/types';
import Composer from '../components/Composer';
import Markdown from '../components/Markdown';
import Attachment from '../components/Attachment';
import OdysseyMark from '../components/OdysseyMark';
import Empty from '../components/Empty';
import { useToast } from '../components/Toast';

const CHECK_PROMPT = 'תבדוק את הפתרון שלי ותגיד לי איפה טעיתי, בלי לתת לי את הפתרון המלא.';

const SUGGESTIONS = [
  { icon: <Camera size={18} />, title: 'בדיקת שיעורי בית', text: 'צלמו את הפתרון ואודיסאה יראה איפה הטעות', prompt: '', attach: true },
  { icon: <Lightbulb size={18} />, title: 'רמז לשאלה', text: 'בלי לקבל את הפתרון', prompt: 'אני תקוע בשאלה. אני אכתוב אותה, ותן לי רמז אחד בכל פעם.' },
  { icon: <BookOpen size={18} />, title: 'הסבר מושג', text: 'מההרצאה או מהתרגול', prompt: 'תסביר לי בפשטות, עם דוגמה: ' },
  { icon: <Target size={18} />, title: 'הכנה למבחן', text: 'שאלות תרגול עם משוב', prompt: 'תכין אותי למבחן. תשאל אותי שאלות תרגול אחת אחרי השנייה ותן משוב על כל תשובה. הנושא: ' },
];

/** Pending first message, passed through navigation state to a newly created conversation. */
interface PendingSend {
  text: string;
  uploadIds: string[];
  uploads: Upload[];
}

export default function Odyssey() {
  const { id } = useParams();
  const { odysseyAvailable } = useStore();
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const toast = useToast();

  const refresh = useCallback(() => {
    api.conversations().then(setConversations, (err) => toast.error(errorMessage(err)));
  }, [toast]);

  useEffect(refresh, [refresh]);

  if (!odysseyAvailable) {
    return (
      <div className="page">
        <div className="card">
          <Empty icon={<OdysseyMark size={48} />} title="אודיסאה עוד לא הופעל">
            כדי להפעיל את המורה, מנהל/ת השרת צריך/ה להגדיר מפתח API של Claude (ANTHROPIC_API_KEY).
          </Empty>
        </div>
      </div>
    );
  }

  return (
    <div className={id ? 'odyssey-page has-chat' : 'odyssey-page'}>
      <aside className="conv-list">
        <div className="conv-list-header">
          <h2>השיחות שלי</h2>
          <Link to="/odyssey" className="icon-btn" aria-label="שיחה חדשה">
            <Plus size={20} />
          </Link>
        </div>
        {conversations === null ? null : conversations.length === 0 ? (
          <p className="muted small conv-empty">עוד אין שיחות.</p>
        ) : (
          <nav>
            {conversations.map((c) => (
              <NavLink key={c.id} to={`/odyssey/${c.id}`} className={({ isActive }) => (isActive ? 'conv-item active' : 'conv-item')}>
                {c.taskId ? <ClipboardList size={16} /> : <MessageCircle size={16} />}
                <span className="conv-title">{c.title}</span>
              </NavLink>
            ))}
          </nav>
        )}
      </aside>
      <section className="conv-main">
        {id ? <Chat key={id} id={id} onChanged={refresh} /> : <NewChat onCreated={refresh} recent={conversations ?? []} />}
      </section>
    </div>
  );
}

function NewChat({ onCreated, recent }: { onCreated(): void; recent: Conversation[] }) {
  const { data } = useStore();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const [prefill, setPrefill] = useState({ text: '', key: 0 });
  const [highlightAttach, setHighlightAttach] = useState(false);
  const started = useRef(false);

  const start = useCallback(
    async (text: string, uploads: Upload[], taskId?: string) => {
      try {
        const conv = await api.newConversation(taskId);
        onCreated();
        const pending: PendingSend = { text, uploadIds: uploads.map((u) => u.id), uploads };
        navigate(`/odyssey/${conv.id}`, { state: { pending } });
      } catch (err) {
        toast.error(errorMessage(err));
      }
    },
    [navigate, onCreated, toast],
  );

  // Links from elsewhere in the app: ?q=<question>, ?check=1, ?task=<id>&check=1
  useEffect(() => {
    if (started.current) return;
    const q = params.get('q');
    const taskId = params.get('task');
    const check = params.get('check') === '1';
    if (!q && !taskId && !check) return;
    started.current = true;
    setParams({}, { replace: true });
    if (taskId) {
      api.uploads(taskId).then(
        (uploads) => {
          const task = data.tasks.find((t) => t.id === taskId);
          const text = uploads.length ? CHECK_PROMPT : `אני עובד/ת על "${task?.title ?? 'משימה'}". תעזור לי להתחיל?`;
          void start(text, uploads, taskId);
        },
        (err) => toast.error(errorMessage(err)),
      );
    } else if (q) {
      void start(q, []);
    } else {
      setHighlightAttach(true);
      setPrefill({ text: CHECK_PROMPT, key: Date.now() });
    }
  }, [params, setParams, start, data.tasks, toast]);

  const name = data.profile?.name;

  return (
    <div className="chat new-chat">
      <div className="chat-scroll">
        <div className="new-chat-hero">
          <OdysseyMark size={72} />
          <h1>{name ? `היי ${name}, איך אפשר לעזור?` : 'איך אפשר לעזור?'}</h1>
          <p className="muted">
            אודיסאה הוא מורה, לא מכונת פתרונות: הוא יסביר, ייתן רמזים ויבדוק את הפתרון שלך, כדי שתביני/תבין את החומר באמת.
          </p>
          <div className="suggestions">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.title}
                className="suggestion"
                onClick={() => {
                  setPrefill({ text: s.attach ? CHECK_PROMPT : s.prompt, key: Date.now() });
                  setHighlightAttach(Boolean(s.attach));
                }}
              >
                <span className="suggestion-icon">{s.icon}</span>
                <span>
                  <strong>{s.title}</strong>
                  <span className="block muted small">{s.text}</span>
                </span>
              </button>
            ))}
          </div>
          {recent.length > 0 && (
            <div className="recent mobile-only">
              <h2>שיחות אחרונות</h2>
              {recent.slice(0, 5).map((c) => (
                <Link key={c.id} to={`/odyssey/${c.id}`} className="conv-item">
                  {c.taskId ? <ClipboardList size={16} /> : <MessageCircle size={16} />}
                  <span className="conv-title">{c.title}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="chat-footer">
        <Composer key={prefill.key} initialText={prefill.text} highlightAttach={highlightAttach} autoFocus onSend={(t, u) => void start(t, u)} placeholder="שאלה, נושא, או צילום של הפתרון…" />
        <p className="disclaimer">אודיסאה יכול לטעות. כדאי לבדוק דברים חשובים מול חומרי הקורס.</p>
      </div>
    </div>
  );
}

function Chat({ id, onChanged }: { id: string; onChanged(): void }) {
  const { data } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamText, setStreamText] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [lastSend, setLastSend] = useState<PendingSend | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingHandled = useRef(false);
  const stickToBottom = useRef(true);

  const send = useCallback(
    async (p: PendingSend) => {
      setError('');
      setLastSend(p);
      const optimistic: ChatMessage = { id: `local-${Date.now()}`, role: 'user', text: p.text, uploads: p.uploads, createdAt: new Date().toISOString() };
      setMessages((m) => [...m, optimistic]);
      setStreamText('');
      stickToBottom.current = true;
      const abort = new AbortController();
      abortRef.current = abort;
      let reply = '';
      try {
        await sendToOdyssey(id, p.text, p.uploadIds, (delta) => {
          reply += delta;
          setStreamText(reply);
        }, abort.signal);
      } catch (err) {
        if (!abort.signal.aborted) setError(errorMessage(err));
        // With no reply, the server didn't keep the question either; take it back out of the list.
        if (!reply) setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      } finally {
        abortRef.current = null;
        setStreamText(null);
        if (reply) setMessages((m) => [...m, { id: `local-a-${Date.now()}`, role: 'assistant', text: reply, uploads: [], createdAt: new Date().toISOString() }]);
        onChanged();
      }
    },
    [id, onChanged],
  );

  useEffect(() => {
    api.conversation(id).then(
      (res) => {
        setConversation(res.conversation);
        setMessages(res.messages);
        const pending = (location.state as { pending?: PendingSend } | null)?.pending;
        if (pending && !pendingHandled.current && res.messages.length === 0) {
          pendingHandled.current = true;
          navigate(location.pathname, { replace: true, state: null });
          void send(pending);
        }
      },
      () => navigate('/odyssey', { replace: true }),
    );
    return () => abortRef.current?.abort();
    // Only on first load of this conversation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Keep the newest text in view while streaming, unless the student scrolled up to read.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, streamText]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const task = conversation?.taskId ? data.tasks.find((t) => t.id === conversation.taskId) : undefined;

  const remove = async () => {
    if (!confirm('למחוק את השיחה?')) return;
    try {
      await api.deleteConversation(id);
      onChanged();
      navigate('/odyssey', { replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="chat">
      <header className="chat-header">
        <Link to="/odyssey" className="icon-btn back" aria-label="חזרה לשיחות">
          <ChevronRight size={22} />
        </Link>
        <OdysseyMark size={34} />
        <div className="grow chat-header-text">
          <div className="chat-title">{conversation?.title ?? ''}</div>
          {task ? (
            <Link to={`/tasks?open=${task.id}`} className="chat-sub link">
              משימה: {task.title}
            </Link>
          ) : (
            <div className="chat-sub muted">המורה האישי שלך</div>
          )}
        </div>
        <button className="icon-btn" onClick={() => void remove()} aria-label="מחיקת השיחה">
          <Trash2 size={18} />
        </button>
      </header>

      <div className="chat-scroll" ref={scrollRef} onScroll={onScroll}>
        <div className="messages">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          {streamText !== null && (
            <div className="msg assistant streaming">
              <OdysseyMark size={30} animated={!streamText} />
              <div className="bubble">{streamText ? <Markdown text={streamText} /> : <TypingDots />}</div>
            </div>
          )}
          {error && (
            <div className="chat-error" role="alert">
              <span>{error}</span>
              {lastSend && (
                <button
                  className="btn sm"
                  onClick={() => void send(lastSend)}
                >
                  ניסיון חוזר
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="chat-footer">
        <Composer streaming={streamText !== null} onStop={() => abortRef.current?.abort()} onSend={(text, uploads) => void send({ text, uploads, uploadIds: uploads.map((u) => u.id) })} />
        <p className="disclaimer">אודיסאה יכול לטעות. כדאי לבדוק דברים חשובים מול חומרי הקורס.</p>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <div className="msg user">
        <div className="bubble">
          {message.uploads.length > 0 && (
            <div className="bubble-attachments">
              {message.uploads.map((u) => (
                <Attachment key={u.id} upload={u} />
              ))}
            </div>
          )}
          {message.text && <p dir="auto">{message.text}</p>}
        </div>
      </div>
    );
  }
  return (
    <div className="msg assistant">
      <OdysseyMark size={30} />
      <div className="bubble">
        <Markdown text={message.text} />
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span className="typing" aria-label="אודיסאה חושב">
      <span />
      <span />
      <span />
    </span>
  );
}
