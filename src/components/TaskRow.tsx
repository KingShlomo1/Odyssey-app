import { Check } from 'lucide-react';
import { useStore } from '../lib/store';
import type { Task } from '../lib/types';
import { TASK_KINDS, TASK_SOURCES } from '../lib/constants';
import { formatDate, relativeDay } from '../lib/time';
import { isOverdue } from '../lib/workload';

export default function TaskRow({ task, onOpen }: { task: Task; onOpen(): void }) {
  const { data, toggleTask } = useStore();
  const now = new Date();
  const course = data.courses.find((c) => c.id === task.courseId)?.name;
  const test = task.kind === 'exam' || task.kind === 'quiz';
  const pill = isOverdue(task, now) ? 'pill overdue' : test ? 'pill exam' : 'pill';

  return (
    <li className={task.done ? 'task-row done' : 'task-row'}>
      <button
        className={task.done ? 'check checked' : 'check'}
        onClick={() => void toggleTask(task.id)}
        role="checkbox"
        aria-checked={task.done}
        aria-label={`${task.title} בוצע`}
      >
        {task.done && <Check size={14} strokeWidth={3} />}
      </button>
      <button className="task-main" onClick={onOpen}>
        <span className="task-title">{task.title}</span>
        <span className="task-meta">
          <span className={`source-dot ${task.source}`} aria-hidden />
          {TASK_KINDS[task.kind]} · {TASK_SOURCES[task.source]}
          {course && ` · ${course}`}
        </span>
      </button>
      <span className={pill}>{task.done ? formatDate(task.due) : relativeDay(task.due, now)}</span>
    </li>
  );
}
