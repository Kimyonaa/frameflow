import React, { useState } from 'react';
import { Sparkles, ArrowRight, Check, Quote, LoaderCircle } from 'lucide-react';
import { request } from '../api';
export default function Assistant({ project, mode, onApplied, onEvidence }) {
  const [kind, setKind] = useState('ask'),
    [question, setQuestion] = useState('What is blocking approval?'),
    [proposal, setProposal] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const sources = [
    { id: 'brief', title: 'Project brief' },
    ...project.requirements,
    ...project.annotations.map((n) => ({ id: n.id, title: n.text })),
    ...project.tasks,
  ];
  async function generate(type = kind) {
    setBusy(true);
    setError('');
    try {
      setProposal(await request(`projects/${project.id}/assistant`, { kind: type, question }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function apply() {
    setBusy(true);
    setError('');
    try {
      await request(`projects/${project.id}/proposals/${proposal.id}/apply`, {
        requirements: proposal.requirements,
        tasks: proposal.tasks,
      });
      setProposal({ ...proposal, status: 'applied' });
      await onApplied();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function edit(collection, index, key, value) {
    setProposal((p) => ({
      ...p,
      [collection]: p[collection].map((x, i) => (i === index ? { ...x, [key]: value } : x)),
    }));
  }
  return (
    <div className="assistant-body">
      <div className="assistant-intro">
        <span className="assistant-orb">
          <Sparkles size={25} />
        </span>
        <div>
          <h3>A second pair of eyes.</h3>
          <p>
            {mode === 'openai'
              ? 'AI suggestions grounded in your project.'
              : 'Local evidence assistant · no model connected.'}
          </p>
        </div>
      </div>
      <div className="segmented">
        {[
          ['ask', 'Ask the project'],
          ['plan', 'Plan from brief'],
          ['tasks', 'Triage feedback'],
        ].map(([k, label]) => (
          <button
            key={k}
            className={kind === k ? 'active' : ''}
            onClick={() => {
              setKind(k);
              setProposal(null);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {kind === 'ask' ? (
        <label className="field">
          Your question
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={1500}
            placeholder="What changed? Which feedback is unresolved?"
          />
        </label>
      ) : (
        <p className="assistant-hint">
          {kind === 'plan'
            ? 'Extract a reviewable set of requirements from the project brief.'
            : 'Turn open comments into proposed tasks, preserving the original evidence.'}{' '}
          Nothing changes until you apply the proposal.
        </p>
      )}
      <button
        className="primary"
        disabled={busy || (kind === 'ask' && !question.trim())}
        onClick={() => generate()}
      >
        {busy ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}{' '}
        {busy ? 'Working…' : kind === 'ask' ? 'Find an answer' : 'Draft a proposal'}
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {proposal && (
        <div className="proposal">
          <div className="proposal-label">
            {proposal.mode === 'local' ? 'LOCAL EVIDENCE' : 'AI-GENERATED'} · REVIEW BEFORE APPLYING
          </div>
          <p className="assistant-answer">{proposal.summary}</p>
          {['requirements', 'tasks'].map((collection) =>
            proposal[collection].map((item, i) => (
              <div className="proposal-item" key={collection + i}>
                <label className="field">
                  {collection === 'tasks' ? 'Task' : 'Requirement'} {i + 1}
                  <input
                    value={item.title}
                    maxLength={160}
                    onChange={(e) => edit(collection, i, 'title', e.target.value)}
                    disabled={proposal.status === 'applied'}
                  />
                </label>
                <label className="field">
                  Details
                  <textarea
                    value={item.description}
                    maxLength={1200}
                    onChange={(e) => edit(collection, i, 'description', e.target.value)}
                    disabled={proposal.status === 'applied'}
                  />
                </label>
                <div className="citation-list">
                  {item.evidenceIds.map((id) => (
                    <button key={id} onClick={() => onEvidence(id)}>
                      <Quote size={11} />
                      {sources.find((x) => x.id === id)?.title?.slice(0, 70) || id}
                    </button>
                  ))}
                </div>
              </div>
            )),
          )}
          <div className="citation-list">
            {proposal.evidenceIds.map((id) => (
              <button key={id} onClick={() => onEvidence(id)}>
                <Quote size={11} />
                {sources.find((x) => x.id === id)?.title?.slice(0, 70) || id}
              </button>
            ))}
          </div>
          {proposal.requirements.length + proposal.tasks.length > 0 && (
            <button
              className="primary"
              disabled={busy || proposal.status === 'applied'}
              onClick={apply}
            >
              {proposal.status === 'applied' ? (
                <>
                  <Check size={16} />
                  Applied to project
                </>
              ) : (
                <>
                  Apply reviewed proposal <ArrowRight size={16} />
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
