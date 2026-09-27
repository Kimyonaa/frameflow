import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/800.css';
import React, { useEffect, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import {
  Layers,
  LayoutGrid,
  CheckSquare,
  Folder,
  ChevronDown,
  Plus,
  MessageCircle,
  ArrowUpRight,
  ArrowRight,
  Check,
  Command,
  NotebookPen,
  LogOut,
  Search,
  Upload,
  Link,
  Download,
  CheckCircle2,
  CalendarDays,
  LoaderCircle,
  FileText,
  Trash2,
} from 'lucide-react';
import { request, setCsrf, csrf } from './api';
import Welcome from './components/Welcome';
import Modal from './components/Modal';
import ReviewCanvas from './components/ReviewCanvas';
import TaskBoard from './components/TaskBoard';
import Assistant from './components/Assistant';
import './style.css';
import './product.css';
import './studio.css';
const date = (d) =>
  d
    ? new Date(d + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : 'No due date';
function ReviewLink() {
  const token = location.pathname.split('/')[2],
    [data, setData] = useState(null),
    [error, setError] = useState(''),
    [name, setName] = useState(sessionStorage.getItem('ff-reviewer') || ''),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState(null);
  const load = () =>
    request('review/' + token)
      .then(setData)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);
  async function action(fn) {
    if (!name.trim()) {
      setError('Enter your name so the team knows who is reviewing.');
      return false;
    }
    setBusy(true);
    setError('');
    sessionStorage.setItem('ff-reviewer', name);
    try {
      await fn();
      await load();
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="client-review">
      <header>
        <a className="brand" href="/">
          <span>
            <Layers size={21} />
          </span>
          frameflow<span className="brand-dot">.</span>
        </a>
        <span className="review-badge">CLIENT REVIEW · VERSION-SCOPED LINK</span>
      </header>
      {!data ? (
        <div className="empty">{error || 'Opening your review…'}</div>
      ) : (
        <>
          <div className="client-title">
            <div>
              <small>{data.project.client}</small>
              <h1>{data.project.name}</h1>
              <p>
                You’re reviewing {data.version.label}. Comments and approval stay attached to this
                version.
              </p>
            </div>
            <label className="field">
              Your name
              <input
                aria-label="Reviewer name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                placeholder="How should we credit your feedback?"
              />
            </label>
          </div>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <ReviewCanvas
            project={data.project}
            versionId={data.version.id}
            onVersion={() => {}}
            selected={selected}
            onSelect={setSelected}
            guest
            token={token}
            busy={busy}
            onComment={(input) =>
              action(() => request(`review/${token}/comments`, { ...input, name: name.trim() }))
            }
            onApprove={() =>
              action(() =>
                request(`review/${token}/approve`, {
                  name: name.trim(),
                  revision: data.version.revision || 0,
                }),
              )
            }
          />
          <footer className="app-footer">
            This link expires {new Date(data.expiresAt).toLocaleDateString()}.{' '}
            <span>Only this version is shared with you.</span>
          </footer>
        </>
      )}
    </div>
  );
}
function App() {
  const [ready, setReady] = useState(false),
    [user, setUser] = useState(null),
    [data, setData] = useState(null),
    [projectId, setProjectId] = useState(localStorage.getItem('ff-project') || ''),
    [tab, setTab] = useState('Review'),
    [overview, setOverview] = useState(false),
    [versionId, setVersionId] = useState(''),
    [selected, setSelected] = useState(null),
    [modal, setModal] = useState(null),
    [error, setError] = useState(''),
    [toast, setToast] = useState(''),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState(''),
    [shares, setShares] = useState([]),
    [newShare, setNewShare] = useState(null),
    [uploadProgress, setUploadProgress] = useState('');
  const load = useCallback(async () => {
    const workspace = await request('workspace');
    setData(workspace);
    return workspace;
  }, []);
  useEffect(() => {
    request('auth/me')
      .then(async (session) => {
        setCsrf(session.csrf);
        setUser(session.user);
        await load();
      })
      .catch((e) => {
        if (e.status !== 401) setError(e.message);
      })
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    if (!user) return;
    const socket = io({ auth: { csrf }, transports: ['websocket'], withCredentials: true });
    socket.on('workspace:changed', () => load().catch(() => {}));
    return () => socket.disconnect();
  }, [user?.id]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    function shortcut(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setModal('search');
      }
    }
    document.addEventListener('keydown', shortcut);
    return () => document.removeEventListener('keydown', shortcut);
  }, []);
  const project = data?.projects.find((p) => p.id === projectId) || data?.projects[0],
    version = project?.versions.find((v) => v.id === versionId) || project?.versions.at(-1);
  function choose(id) {
    setProjectId(id);
    localStorage.setItem('ff-project', id);
    setVersionId('');
    setOverview(false);
    setTab('Review');
    setSelected(null);
  }
  async function action(fn, message) {
    setBusy(true);
    setError('');
    try {
      const value = await fn();
      await load();
      if (message) setToast(message);
      return value ?? true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function evidence(id) {
    setModal(null);
    if (id === 'brief' || project.requirements.some((r) => r.id === id)) {
      setTab('Brief');
      return;
    }
    const note = project.annotations.find((n) => n.id === id);
    if (note) {
      setVersionId(note.version);
      setSelected(id);
      setTab('Review');
      return;
    }
    setTab('Tasks');
  }
  async function share() {
    setNewShare(null);
    setModal('share');
    try {
      setShares(await request(`projects/${project.id}/shares`));
    } catch (e) {
      setError(e.message);
    }
  }
  async function createProject(e) {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.currentTarget));
    const result = await action(() => request('projects', payload), 'Project created.');
    if (result) {
      choose(result.id);
      setTab('Brief');
      setModal(null);
    }
  }
  async function upload(e) {
    e.preventDefault();
    setUploadProgress('Validating and storing your version…');
    const result = await action(
      () => request(`projects/${project.id}/versions`, new FormData(e.currentTarget)),
      'New version uploaded.',
    );
    setUploadProgress('');
    if (result) {
      setVersionId(result.id);
      setModal(null);
      setTab('Review');
    }
  }
  async function addTask(e) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    f.requirementId = f.requirementId || null;
    f.due = f.due || null;
    const result = await action(() => request(`projects/${project.id}/tasks`, f), 'Task added.');
    if (result) setModal(null);
  }
  const closeModal = useCallback(() => setModal(null), []);
  if (!ready)
    return (
      <div className="loading">
        <Layers size={26} />
        Opening FrameFlow…
      </div>
    );
  if (!user)
    return (
      <Welcome
        onEnter={async (u) => {
          setUser(u);
          await load();
        }}
      />
    );
  if (!data || !project)
    return (
      <div className="loading">
        {error || 'Loading your workspace…'}
        <button onClick={() => load().catch((e) => setError(e.message))}>Retry</button>
      </div>
    );
  const openNotes = project.annotations.filter((n) => n.status === 'open').length,
    done = project.tasks.filter((t) => t.status === 'done').length;
  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          <span>
            <Layers size={22} />
          </span>
          frameflow<span className="brand-dot">.</span>
        </a>
        <button className="workspace-icon" onClick={() => setOverview(true)}>
          <div className="avatar coral">{user.name[0]}</div>
          <div>
            Studio workspace
            <small>{user.demo ? 'Private demo workspace' : 'Your creative workspace'}</small>
          </div>
          <ChevronDown size={14} />
        </button>
        <div className="nav-caption">WORKSPACE</div>
        {[
          [LayoutGrid, 'Overview'],
          [Folder, 'Projects'],
          [CheckSquare, 'My tasks'],
        ].map(([Icon, t]) => (
          <button
            key={t}
            className={
              'nav ' +
              ((t === 'Projects' && !overview && tab !== 'Tasks') ||
              (t === 'Overview' && overview) ||
              (t === 'My tasks' && !overview && tab === 'Tasks')
                ? 'chosen'
                : '')
            }
            onClick={() => {
              if (t === 'Overview') setOverview(true);
              else {
                setOverview(false);
                setTab(t === 'My tasks' ? 'Tasks' : 'Review');
              }
            }}
          >
            <Icon size={18} />
            {t}
            {t === 'Projects' && <span className="count">{data.projects.length}</span>}
          </button>
        ))}
        <button className="nav search-nav" onClick={() => setModal('search')}>
          <Search size={18} />
          Quick search <kbd>⌘ K</kbd>
        </button>
        <div className="nav-caption project-caption">
          YOUR PROJECTS{' '}
          <button aria-label="Create project" onClick={() => setModal('project')}>
            <Plus size={12} />
          </button>
        </div>
        <div className="project-list">
          {data.projects.map((p) => (
            <button
              key={p.id}
              className={'project-link ' + (p.id === project.id && !overview ? 'current' : '')}
              onClick={() => choose(p.id)}
            >
              <span className="project-dot" />
              {p.name}
            </button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="demo-label">
            <NotebookPen size={16} />
            <b>A useful shortcut</b>
            <p>
              Press ⌘ / Ctrl + K to find
              <br />a project or task.
            </p>
          </div>
          <div className="profile">
            <div className="avatar">
              {user.name
                .split(' ')
                .map((x) => x[0])
                .slice(0, 2)
                .join('')}
            </div>
            <div>
              {user.name}
              <small>{user.demo ? 'Demo workspace owner' : 'Workspace owner'}</small>
            </div>
            <button
              aria-label="Sign out"
              title="Sign out"
              onClick={async () => {
                await request('auth/logout', {});
                setUser(null);
                setData(null);
                setCsrf('');
              }}
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span>
            Projects <span className="slash">/</span>
            <b>{overview ? 'Your workspace' : project.name}</b>
          </span>
          <div className="topbar-actions">
            <span className="session">
              <span />
              Saved
            </span>
            <button className="tool" onClick={() => setModal('project')}>
              <Plus size={14} />
              New project
            </button>
          </div>
        </header>
        {overview ? (
          <>
            <div className="overview-hero">
              <div className="breadcrumb">YOUR CREATIVE SPACE</div>
              <h1>Make room for good work.</h1>
              <p>Your projects, open reviews and upcoming deadlines.</p>
              <div className="overview-stats">
                <div>
                  <b>{data.projects.length}</b>
                  <span>Active projects</span>
                </div>
                <div>
                  <b>
                    {
                      data.projects.flatMap((p) => p.annotations).filter((n) => n.status === 'open')
                        .length
                    }
                  </b>
                  <span>Open feedback</span>
                </div>
                <div>
                  <b>
                    {
                      data.projects
                        .flatMap((p) => p.versions)
                        .filter((v) => v.status === 'approved').length
                    }
                  </b>
                  <span>Approved versions</span>
                </div>
              </div>
            </div>
            <div className="project-cards">
              {data.projects.map((p) => (
                <button className="project-card" key={p.id} onClick={() => choose(p.id)}>
                  <div className="project-card-art">
                    <span>{p.client.slice(0, 1)}</span>
                    <div />
                    <small>{p.versions.length} VERSIONS</small>
                  </div>
                  <div className="project-card-info">
                    <small>{p.client}</small>
                    <h3>{p.name}</h3>
                    <p>{p.description || 'A new project, full of possibility.'}</p>
                    <div>
                      <span>Due {date(p.due)}</span>
                      <ArrowUpRight size={16} />
                    </div>
                  </div>
                </button>
              ))}
              <button className="new-project-card" onClick={() => setModal('project')}>
                <Plus size={28} />
                <b>Your next good idea.</b>
                <span>Create a project</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="page-title">
              <div className="breadcrumb">
                CLIENT PROJECT <span> {project.client.toUpperCase()}</span>
              </div>
              <div className="title-row">
                <div>
                  <h1>{project.name}</h1>
                  <p>{project.description || 'A shared space for thoughtful work.'}</p>
                </div>
                <div className="title-actions">
                  <button className="tool" onClick={() => setModal('assistant')}>
                    <NotebookPen size={15} />
                    Assistant
                  </button>
                  {version && (
                    <button className="primary" onClick={share}>
                      <Link size={14} />
                      Share for review
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="tabs">
              <div>
                {['Brief', 'Review', 'Tasks', 'Activity'].map((t) => (
                  <button className={tab === t ? 'active' : ''} onClick={() => setTab(t)} key={t}>
                    {t}
                    {t === 'Review' && <span>{project.versions.length}</span>}
                    {t === 'Tasks' && <span>{project.tasks.length}</span>}
                  </button>
                ))}
              </div>
              <span className="due">
                In progress <span>·</span> Due {date(project.due)}
              </span>
            </div>
            {tab === 'Review' ? (
              <ReviewCanvas
                project={project}
                versionId={version?.id}
                onVersion={setVersionId}
                selected={selected}
                onSelect={setSelected}
                busy={busy}
                onUpload={() => setModal('upload')}
                onShare={share}
                onAssistant={() => setModal('assistant')}
                onComment={(input) =>
                  action(
                    () => request(`projects/${project.id}/annotations`, input),
                    'Comment added.',
                  )
                }
                onTask={(n) =>
                  action(
                    () =>
                      request(`projects/${project.id}/tasks`, {
                        title: n.text.slice(0, 180),
                        description: n.text,
                        annotationId: n.id,
                        requirementId: n.requirementId || null,
                      }),
                    'Task linked to this comment.',
                  )
                }
                onResolve={(n) =>
                  action(
                    () =>
                      request(
                        `projects/${project.id}/annotations/${n.id}`,
                        { status: n.status === 'resolved' ? 'open' : 'resolved' },
                        'PATCH',
                      ),
                    'Feedback updated.',
                  )
                }
                onApprove={() => setModal('approve')}
              />
            ) : tab === 'Tasks' ? (
              <TaskBoard
                project={project}
                busy={busy}
                onUpdate={(id, body) =>
                  action(() => request(`projects/${project.id}/tasks/${id}`, body, 'PATCH'))
                }
                onCreate={() => setModal('task')}
                onEvidence={evidence}
              />
            ) : tab === 'Brief' ? (
              <section className="content-view brief-view">
                <div className="section-heading">
                  <div>
                    <div className="eyebrow">THE NORTH STAR</div>
                    <h2>
                      {project.client === 'Forma Studio' ? (
                        <>
                          Make thoughtful design
                          <br />
                          feel immediately accessible.
                        </>
                      ) : (
                        project.name
                      )}
                    </h2>
                  </div>
                  <div className="tools">
                    <button className="tool" onClick={() => setModal('edit')}>
                      Edit brief
                    </button>
                    <button className="primary" onClick={() => setModal('assistant')}>
                      <NotebookPen size={15} />
                      Plan with assistant
                    </button>
                  </div>
                </div>
                <p className="brief-intro">{project.brief}</p>
                <div className="coverage-bar">
                  <span>
                    <CheckCircle2 size={16} />
                    {done} of {project.tasks.length} tasks completed
                  </span>
                  <span>
                    <MessageCircle size={16} />
                    {openNotes} open comments
                  </span>
                  <span>
                    <CalendarDays size={16} />
                    Due {date(project.due)}
                  </span>
                </div>
                <div className="section-heading requirements-heading">
                  <h3>What success looks like</h3>
                  <button className="text-button" onClick={() => setModal('requirement')}>
                    <Plus size={14} />
                    Add requirement
                  </button>
                </div>
                <div className="requirements">
                  {project.requirements.map((r, i) => {
                    const tasks = project.tasks.filter((t) => t.requirementId === r.id),
                      notes = project.annotations.filter((n) => n.requirementId === r.id);
                    return (
                      <article key={r.id}>
                        <small>0{i + 1} / REQUIREMENT</small>
                        <h3>{r.title}</h3>
                        <p>{r.description}</p>
                        <div className="requirement-metrics">
                          <span>{notes.length} linked comments</span>
                          <span>
                            {tasks.filter((t) => t.status === 'done').length}/{tasks.length} tasks
                            done
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>
                {!project.requirements.length && (
                  <div className="empty">
                    <FileText size={28} />
                    <h3>Give the team a shared definition of done.</h3>
                    <p>Add requirements, or draft them from your brief with the assistant.</p>
                  </div>
                )}
                <div className="traceability">
                  <div>
                    <h3>The thread that ties it together.</h3>
                    <p>Follow a requirement through its comments, tasks and approved version.</p>
                  </div>
                  <button className="text-button" onClick={() => setTab('Review')}>
                    Follow the feedback <ArrowRight size={15} />
                  </button>
                </div>
              </section>
            ) : (
              <section className="content-view">
                <div className="section-heading">
                  <div>
                    <h2>The story behind the work.</h2>
                    <p className="muted">A record of the decisions that shaped this project.</p>
                  </div>
                  <a className="tool" href={`/api/projects/${project.id}/export`} download>
                    <Download size={15} />
                    Export project
                  </a>
                </div>
                {project.activity.map((a) => (
                  <div className="activity" key={a.id}>
                    <div className="activity-icon">
                      {a.kind.includes('approved') ? (
                        <CheckCircle2 size={18} />
                      ) : a.kind.includes('task') ? (
                        <CheckSquare size={18} />
                      ) : a.kind.includes('version') ? (
                        <Upload size={18} />
                      ) : (
                        <MessageCircle size={18} />
                      )}
                    </div>
                    <div>
                      <b>{a.text}</b>
                      <p>
                        {a.author} · {new Date(a.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </section>
            )}
          </>
        )}
        <footer className="app-footer">
          FrameFlow / Studio workspace{' '}
          <span>
            {data.assistant === 'openai'
              ? 'AI assistant connected'
              : 'Local evidence assistant · AI provider optional'}
          </span>
        </footer>
      </main>
      {error && (
        <div className="toast error-toast" role="alert">
          {error}
          <button aria-label="Dismiss error" onClick={() => setError('')}>
            ×
          </button>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
      {modal === 'assistant' && (
        <Modal title="Project assistant" onClose={closeModal} wide>
          <Assistant
            project={project}
            mode={data.assistant}
            onApplied={load}
            onEvidence={evidence}
          />
        </Modal>
      )}
      {(modal === 'project' || modal === 'edit') && (
        <Modal
          title={modal === 'project' ? 'Start something good.' : 'Refine the project brief.'}
          onClose={closeModal}
          wide
        >
          <form
            onSubmit={
              modal === 'project'
                ? createProject
                : async (e) => {
                    e.preventDefault();
                    if (
                      await action(
                        () =>
                          request(
                            `projects/${project.id}`,
                            Object.fromEntries(new FormData(e.currentTarget)),
                            'PATCH',
                          ),
                        'Brief updated.',
                      )
                    )
                      setModal(null);
                  }
            }
          >
            <div className="form-grid">
              <label className="field">
                Project name
                <input
                  name="name"
                  required
                  maxLength={100}
                  defaultValue={modal === 'edit' ? project.name : ''}
                  placeholder="e.g. Studio website redesign"
                />
              </label>
              <label className="field">
                Client / team
                <input
                  name="client"
                  required
                  maxLength={100}
                  defaultValue={modal === 'edit' ? project.client : ''}
                  placeholder="Who are we building for?"
                />
              </label>
            </div>
            <label className="field">
              One-line description
              <input
                name="description"
                maxLength={200}
                defaultValue={modal === 'edit' ? project.description : ''}
                placeholder="The ambition, in a sentence."
              />
            </label>
            <label className="field">
              Client brief
              <textarea
                name="brief"
                required
                maxLength={12000}
                rows={6}
                defaultValue={modal === 'edit' ? project.brief : ''}
                placeholder="Goals, deliverables, audience, constraints… start with what you know."
              />
            </label>
            <label className="field">
              Target delivery date
              <input
                name="due"
                type="date"
                required
                defaultValue={
                  modal === 'edit'
                    ? project.due
                    : new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
                }
              />
            </label>
            <div className="modal-actions">
              <button type="button" onClick={closeModal}>
                Cancel
              </button>
              <button className="primary" disabled={busy}>
                {busy ? 'Saving…' : modal === 'project' ? 'Create project' : 'Save changes'}
                <ArrowRight size={15} />
              </button>
            </div>
          </form>
        </Modal>
      )}
      {modal === 'upload' && (
        <Modal title="A new iteration. A fresh perspective." onClose={closeModal}>
          <form onSubmit={upload}>
            <label className="field">
              Design name
              <input
                name="name"
                required
                maxLength={100}
                defaultValue={version?.name || 'Homepage exploration'}
              />
            </label>
            <label className="upload-zone">
              <Upload size={28} />
              <b>Choose a design to review</b>
              <span>PNG, JPEG, WebP or PDF · up to 10 MB</span>
              <input
                name="file"
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                required
              />
            </label>
            <label className="field">
              What changed?
              <textarea
                name="description"
                maxLength={1000}
                placeholder="Help reviewers focus on the changes that matter."
              />
            </label>
            <p className="muted">
              {uploadProgress || 'A new version preserves all feedback on earlier iterations.'}
            </p>
            <button className="primary" disabled={busy}>
              {busy ? <LoaderCircle className="spin" size={16} /> : <Upload size={16} />}Upload
              version
            </button>
          </form>
        </Modal>
      )}
      {modal === 'task' && (
        <Modal title="Create a task" onClose={closeModal}>
          <form onSubmit={addTask}>
            <label className="field">
              Task title
              <input name="title" required maxLength={200} />
            </label>
            <label className="field">
              Details
              <textarea name="description" maxLength={3000} />
            </label>
            <label className="field">
              Connected requirement
              <select name="requirementId">
                <option value="">General task</option>
                {project.requirements.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-grid">
              <label className="field">
                Assignee
                <input name="assignee" maxLength={80} defaultValue={user.name} />
              </label>
              <label className="field">
                Due date
                <input name="due" type="date" />
              </label>
            </div>
            <button className="primary" disabled={busy}>
              Create task
            </button>
          </form>
        </Modal>
      )}
      {modal === 'requirement' && (
        <Modal title="Define what good looks like." onClose={closeModal}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await action(
                  () =>
                    request(
                      `projects/${project.id}/requirements`,
                      Object.fromEntries(new FormData(e.currentTarget)),
                    ),
                  'Requirement added.',
                )
              )
                setModal(null);
            }}
          >
            <label className="field">
              Requirement
              <input name="title" required maxLength={160} />
            </label>
            <label className="field">
              Acceptance criteria
              <textarea
                name="description"
                required
                maxLength={2000}
                placeholder="How will the team know this is complete?"
              />
            </label>
            <button className="primary" disabled={busy}>
              Add requirement
            </button>
          </form>
        </Modal>
      )}
      {modal === 'approve' && (
        <Modal title="Ready to call this version done?" onClose={closeModal}>
          <div className="approval-confirm">
            <CheckCircle2 size={36} />
            <h3>
              {version?.label} · {version?.name}
            </h3>
            <p>
              Your approval will be recorded against this version. Adding new feedback or reopening
              a linked task will return it to review.
            </p>
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                if (
                  await action(
                    () =>
                      request(`projects/${project.id}/versions/${version.id}/approve`, {
                        revision: version.revision || 0,
                      }),
                    'Version approved.',
                  )
                )
                  setModal(null);
              }}
            >
              Approve this version
            </button>
          </div>
        </Modal>
      )}
      {modal === 'share' && (
        <Modal title="Bring your client into the conversation." onClose={closeModal}>
          <p className="muted">
            Create a link to {version?.label}. Reviewers can comment and approve this version. Other
            projects and versions stay private. Links expire after seven days.
          </p>
          <button
            className="primary"
            disabled={busy}
            onClick={async () => {
              const link = await action(() =>
                request(`projects/${project.id}/versions/${version.id}/share`, {}),
              );
              if (link) {
                setNewShare(location.origin + link.path);
                setShares(await request(`projects/${project.id}/shares`));
              }
            }}
          >
            <Link size={15} />
            Create review link
          </button>
          {newShare && (
            <div className="share-result">
              <input aria-label="Review link" value={newShare} readOnly />
              <button
                className="tool"
                onClick={() =>
                  navigator.clipboard
                    .writeText(newShare)
                    .then(() => setToast('Review link copied.'))
                    .catch(() => setError('Select and copy the link manually.'))
                }
              >
                Copy
              </button>
              <a className="text-button" href={newShare} target="_blank" rel="noopener">
                Preview <ArrowUpRight size={14} />
              </a>
            </div>
          )}
          <h4>Active review links</h4>
          {shares.length ? (
            shares.map((s) => (
              <div className="share-item" key={s._id}>
                <div>
                  <b>{project.versions.find((v) => v.id === s.versionId)?.label}</b>
                  <small>Expires {new Date(s.expiresAt).toLocaleDateString()}</small>
                </div>
                <button
                  aria-label="Revoke review link"
                  className="text-button"
                  onClick={async () => {
                    if (
                      await action(
                        () => request('shares/' + s._id, {}, 'DELETE'),
                        'Review link revoked.',
                      )
                    )
                      setShares(await request(`projects/${project.id}/shares`));
                  }}
                >
                  <Trash2 size={14} />
                  Revoke
                </button>
              </div>
            ))
          ) : (
            <p className="muted">No active review links yet.</p>
          )}
        </Modal>
      )}
      {modal === 'search' && (
        <Modal title="Where would you like to go?" onClose={closeModal}>
          <label className="field">
            Search projects and tasks
            <input
              autoFocus
              placeholder="Start typing…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="search-results">
            {data.projects
              .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
              .map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    choose(p.id);
                    setModal(null);
                  }}
                >
                  <Folder size={17} />
                  <span>
                    {p.name}
                    <small>Project · {p.client}</small>
                  </span>
                  <ArrowRight size={15} />
                </button>
              ))}
            {data.projects.flatMap((p) =>
              p.tasks
                .filter((t) => t.title.toLowerCase().includes(query.toLowerCase()))
                .map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      choose(p.id);
                      setTab('Tasks');
                      setModal(null);
                    }}
                  >
                    <CheckSquare size={17} />
                    <span>
                      {t.title}
                      <small>Task · {p.name}</small>
                    </span>
                  </button>
                )),
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
createRoot(document.getElementById('root')).render(
  location.pathname.startsWith('/review/') ? <ReviewLink /> : <App />,
);
