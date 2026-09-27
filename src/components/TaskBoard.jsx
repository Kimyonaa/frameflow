import React, { useState } from 'react';
import { Plus, ArrowUpRight, CalendarDays, Columns3, List, Link, CheckSquare } from 'lucide-react';
export default function TaskBoard({ project, onUpdate, onCreate, onEvidence, busy }) {
  const [view, setView] = useState('board'),
    [filter, setFilter] = useState('');
  const tasks = project.tasks.filter((t) =>
    (t.title + ' ' + t.assignee).toLowerCase().includes(filter.toLowerCase()),
  );
  function card(t) {
    return (
      <article
        key={t.id}
        className={'task-card ' + (t.status === 'done' ? 'finished' : '')}
        draggable
        onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)}
      >
        <div className="task-priority">
          {t.requirementId ? 'REQUIREMENT LINKED' : 'GENERAL TASK'}
          <span>{t.status === 'done' ? '✓' : '•'}</span>
        </div>
        <h3>{t.title}</h3>
        {t.description && <p>{t.description}</p>}
        <div className="task-meta">
          <span>{t.assignee || 'Unassigned'}</span>
          {t.due && (
            <span>
              <CalendarDays size={12} />
              {new Date(t.due + 'T12:00:00').toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}
            </span>
          )}
        </div>
        <div className="task-card-footer">
          <select
            aria-label={'Status for ' + t.title}
            value={t.status}
            disabled={busy}
            onChange={(e) => onUpdate(t.id, { status: e.target.value })}
          >
            <option value="todo">To do</option>
            <option value="doing">In progress</option>
            <option value="done">Done</option>
          </select>
          {t.annotationId && (
            <button className="text-button" onClick={() => onEvidence(t.annotationId)}>
              <Link size={12} />
              Evidence
            </button>
          )}
        </div>
      </article>
    );
  }
  return (
    <section className="content-view task-view">
      <div className="section-heading">
        <div>
          <h2>From feedback to follow-through.</h2>
          <p className="muted">A clear next step. An unbroken connection to why it matters.</p>
        </div>
        <button className="primary" onClick={onCreate}>
          <Plus size={15} />
          New task
        </button>
      </div>
      <div className="task-filters">
        <input
          aria-label="Filter tasks"
          placeholder="Find a task or assignee…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div className="segmented">
          {[
            ['board', Columns3],
            ['list', List],
            ['timeline', CalendarDays],
          ].map(([k, I]) => (
            <button key={k} className={view === k ? 'active' : ''} onClick={() => setView(k)}>
              <I size={15} />
              {k}
            </button>
          ))}
        </div>
      </div>
      {view === 'board' ? (
        <div className="board">
          {[
            ['todo', 'To do'],
            ['doing', 'In progress'],
            ['done', 'Done'],
          ].map(([status, label]) => (
            <section
              key={status}
              className={'board-column ' + status}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData('text/plain');
                if (project.tasks.some((t) => t.id === id)) onUpdate(id, { status });
              }}
            >
              <header>
                <span />
                <h3>{label}</h3>
                <small>{tasks.filter((t) => t.status === status).length}</small>
              </header>
              {tasks.filter((t) => t.status === status).map(card)}
              {!tasks.some((t) => t.status === status) && (
                <div className="column-empty">
                  {status === 'todo'
                    ? 'Every good change starts somewhere.'
                    : 'Drop a task here, or change its status.'}
                </div>
              )}
            </section>
          ))}
        </div>
      ) : view === 'list' ? (
        <div className="task-list">
          {tasks.map(card)}
          {!tasks.length && (
            <p className="empty">No matching tasks. Create one or turn feedback into a task.</p>
          )}
        </div>
      ) : (
        <div className="timeline">
          {[...tasks]
            .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'))
            .map((t) => (
              <div className="timeline-item" key={t.id}>
                <time>
                  {t.due
                    ? new Date(t.due + 'T12:00:00').toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })
                    : 'Unscheduled'}
                </time>
                <span className={'timeline-dot ' + t.status} />
                {card(t)}
              </div>
            ))}
          {!tasks.length && (
            <p className="empty">Add a due date to a new task to start the project timeline.</p>
          )}
        </div>
      )}
    </section>
  );
}
