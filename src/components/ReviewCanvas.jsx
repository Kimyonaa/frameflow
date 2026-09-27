import React, { useState, useEffect } from 'react';
import {
  MoveHorizontal,
  Plus,
  MessageCircle,
  Check,
  ArrowRight,
  ArrowUpRight,
  Upload,
  Link,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  NotebookPen,
} from 'lucide-react';
import AssetView from './AssetView';
export default function ReviewCanvas({
  project,
  versionId,
  onVersion,
  selected,
  onSelect,
  onComment,
  onTask,
  onResolve,
  onUpload,
  onShare,
  onApprove,
  onAssistant,
  busy,
  guest = false,
  token,
}) {
  const [compare, setCompare] = useState(false),
    [otherId, setOtherId] = useState(''),
    [split, setSplit] = useState(50),
    [pinMode, setPinMode] = useState(false),
    [draft, setDraft] = useState(null),
    [text, setText] = useState(''),
    [requirement, setRequirement] = useState(''),
    [page, setPage] = useState(1),
    [pages, setPages] = useState(1),
    [showResolved, setShowResolved] = useState(false);
  const version = project.versions.find((v) => v.id === versionId) || project.versions.at(-1),
    other =
      project.versions.find((v) => v.id === otherId) ||
      project.versions.find((v) => v.id !== version?.id);
  useEffect(() => {
    setPage(1);
    setPages(1);
    setCompare(false);
    setDraft(null);
    setPinMode(false);
  }, [version?.id]);
  const notes = project.annotations.filter(
    (n) =>
      n.version === version?.id &&
      (!n.page || n.page === page) &&
      (showResolved || n.status === 'open'),
  );
  const open = project.annotations.filter(
    (n) => n.version === version?.id && n.status === 'open',
  ).length;
  async function post(e) {
    e.preventDefault();
    const result = await onComment({
      text,
      ...draft,
      page,
      version: version.id,
      requirementId: requirement || null,
    });
    if (result !== false) {
      setText('');
      setDraft(null);
    }
  }
  if (!version)
    return (
      <div className="empty asset-empty">
        <Upload size={36} />
        <h3>Give the conversation a canvas.</h3>
        <p>Upload the first design version. PNG, JPEG, WebP and PDF are supported.</p>
        <button className="primary" onClick={onUpload}>
          Upload your first version
        </button>
      </div>
    );
  function pin(e) {
    if (!pinMode) return;
    const r = e.currentTarget.getBoundingClientRect();
    setDraft({
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
    });
    setPinMode(false);
  }
  return (
    <div className="review-layout">
      <section className="canvas-panel">
        <div className="canvas-toolbar">
          <div>
            <b>{version.name}</b>
            <small>
              {version.mime === 'application/pdf'
                ? 'PDF document'
                : version.template
                  ? 'Desktop exploration'
                  : `${version.width || ''} × ${version.height || ''}`}{' '}
              ·{' '}
              <span className={'version-state ' + version.status}>
                {version.status.replaceAll('_', ' ')}
              </span>
            </small>
          </div>
          <div className="tools">
            {project.versions.length > 1 && (
              <button
                className={'tool ' + (compare ? 'enabled' : '')}
                onClick={() => {
                  setCompare(!compare);
                  setPinMode(false);
                  setDraft(null);
                }}
              >
                <MoveHorizontal size={16} />
                Compare
              </button>
            )}
            <select
              aria-label="Design version"
              value={version.id}
              onChange={(e) => onVersion(e.target.value)}
            >
              {project.versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
            {!guest && (
              <button
                className="tool"
                title="Upload next version"
                aria-label="Upload next version"
                onClick={onUpload}
              >
                <Upload size={15} />
              </button>
            )}
          </div>
        </div>
        {compare && other && (
          <div className="comparison-top">
            <label>
              Compare with{' '}
              <select
                value={other.id}
                aria-label="Earlier design version"
                onChange={(e) => setOtherId(e.target.value)}
              >
                {project.versions
                  .filter((v) => v.id !== version.id)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
              </select>
            </label>
            <span>Move the slider to reveal changes</span>
          </div>
        )}
        <div
          className={'artboard ' + (pinMode ? 'pin-mode' : '')}
          onClick={pin}
          role={pinMode ? 'button' : undefined}
          tabIndex={pinMode ? 0 : undefined}
          aria-label={
            pinMode ? 'Place comment on design. Press Enter to use the centre.' : undefined
          }
          onKeyDown={(e) => {
            if (pinMode && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              setDraft({ x: 50, y: 50 });
              setPinMode(false);
            }
          }}
        >
          <AssetView version={version} page={page} onPages={setPages} token={token} />
          {compare && other && (
            <>
              <div className="compare-overlay" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}>
                <AssetView version={other} token={token} />
              </div>
              <div className="compare-line" style={{ left: split + '%' }}>
                <span>
                  <MoveHorizontal size={16} />
                </span>
              </div>
              <div className="version-label">{other.label.toUpperCase()}</div>
            </>
          )}
          {!compare &&
            notes.map((n, i) => (
              <button
                key={n.id}
                aria-label={'Comment ' + (i + 1) + ': ' + n.text}
                className={
                  'pin ' +
                  (selected === n.id ? 'selected' : '') +
                  (n.status === 'resolved' ? ' resolved' : '')
                }
                style={{ left: n.x + '%', top: n.y + '%' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(n.id);
                }}
              >
                {n.status === 'resolved' ? <Check size={12} /> : i + 1}
              </button>
            ))}
        </div>
        {version.mime === 'application/pdf' && (
          <div className="pdf-controls">
            <button
              className="tool"
              disabled={page === 1}
              aria-label="Previous PDF page"
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            <span>
              Page {page} of {pages}
            </span>
            <button
              className="tool"
              disabled={page >= pages}
              aria-label="Next PDF page"
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
        {compare && (
          <label className="compare-control">
            Reveal changes
            <input
              aria-label="Comparison slider"
              type="range"
              value={split}
              onChange={(e) => setSplit(Number(e.target.value))}
            />
            <span>{split}%</span>
          </label>
        )}
        <div className="canvas-footer">
          <span>
            <span className="live-dot" />
            {compare
              ? 'The same canvas. A different perspective.'
              : 'Click Add a comment, then choose a spot on the design.'}
          </span>
          <button
            className="primary"
            disabled={compare || busy}
            onClick={() => setPinMode(!pinMode)}
          >
            <Plus size={16} />
            {pinMode ? 'Click the design to place a pin' : 'Add a comment'}
          </button>
        </div>
        {draft && (
          <form className="composer" onSubmit={post}>
            <label htmlFor="comment">What should change?</label>
            <textarea
              id="comment"
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              required
              maxLength={2000}
              placeholder="Be specific. Your feedback can become an actionable task."
            />
            <label className="field">
              Connect to a requirement
              <select value={requirement} onChange={(e) => setRequirement(e.target.value)}>
                <option value="">General feedback</option>
                {project.requirements.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <button type="button" onClick={() => setDraft(null)}>
                Cancel
              </button>
              <button className="primary" disabled={busy}>
                Post comment
              </button>
            </div>
          </form>
        )}
        <div className="version-description">
          <span>{version.label}</span>
          <p>{version.description || 'A new iteration, ready for feedback.'}</p>
          {!guest && (
            <button className="text-button" onClick={onShare}>
              <Link size={14} />
              Share this version for review
            </button>
          )}
        </div>
      </section>
      <aside className="feedback-panel">
        <div className="feedback-heading">
          <h3>
            Feedback <span>{open}</span>
          </h3>
          <MessageCircle size={18} />
        </div>
        <p className="feedback-description">Notes on this version.</p>
        <label className="resolved-toggle">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
          />
          Show resolved comments
        </label>
        {notes.length === 0 && (
          <div className="feedback-empty">
            <CheckCircle2 size={25} />
            <b>{open ? 'No comments on this page.' : 'A little breathing room.'}</b>
            <p>
              {open
                ? 'Check other pages for unresolved feedback.'
                : 'No open feedback on this version.'}
            </p>
          </div>
        )}
        {notes.map((n, i) => {
          const req = project.requirements.find((r) => r.id === n.requirementId),
            task = project.tasks.find((t) => t.annotationId === n.id);
          return (
            <article
              className={'comment ' + (selected === n.id ? 'focused' : '')}
              key={n.id}
              onClick={() => onSelect(n.id)}
            >
              <div className="comment-head">
                <div className="avatar small">
                  {n.author
                    .split(' ')
                    .map((x) => x[0])
                    .slice(0, 2)
                    .join('')}
                </div>
                <div>
                  <b>{n.author}</b>
                  <small>
                    {new Date(n.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}{' '}
                    · {version.label}
                  </small>
                </div>
                <span className="comment-number">
                  {n.status === 'resolved' ? <Check size={10} /> : i + 1}
                </span>
              </div>
              <p>{n.text}</p>
              {req && (
                <div className="evidence-chip">
                  <Link size={11} />
                  {req.title}
                </div>
              )}
              <div className="comment-actions">
                {task ? (
                  <div className="linked">
                    <Check size={14} />
                    {task.status === 'done' ? 'Linked task completed' : 'Linked to a task'}
                  </div>
                ) : (
                  !guest && (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={(e) => {
                        e.stopPropagation();
                        onTask(n);
                      }}
                    >
                      Create linked task <ArrowRight size={14} />
                    </button>
                  )
                )}
                {!guest && (
                  <button
                    className="text-button"
                    disabled={busy || (n.status === 'open' && task && task.status !== 'done')}
                    onClick={(e) => {
                      e.stopPropagation();
                      onResolve(n);
                    }}
                  >
                    {n.status === 'resolved' ? 'Reopen' : 'Resolve'}
                  </button>
                )}
              </div>
            </article>
          );
        })}
        <div className="approval-card">
          <div>
            <CheckCircle2 size={18} />
            <b>
              {version.status === 'approved' ? 'Signed off. Ready to go.' : 'Ready for a decision?'}
            </b>
          </div>
          <p>
            {version.status === 'approved'
              ? `Approved by ${version.approvedBy}. This decision belongs to this exact version.`
              : open
                ? `${open} feedback item${open === 1 ? '' : 's'} to resolve before approval.`
                : 'All feedback on this version is resolved. Review the design before approving.'}
          </p>
          <button
            className="tool"
            disabled={busy || open > 0 || version.status === 'approved'}
            onClick={onApprove}
          >
            {version.status === 'approved' ? 'Version approved' : 'Approve this version'}
          </button>
        </div>
        {!guest && (
          <div className="ai-preview">
            <span>
              <NotebookPen size={17} />
              PROJECT ASSISTANT
            </span>
            <b>Need to sort through the notes?</b>
            <p>Turn comments into draft tasks or check what still needs resolving.</p>
            <button className="text-button" onClick={onAssistant}>
              Open assistant <ArrowUpRight size={14} />
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
