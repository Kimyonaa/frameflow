import React, { useState } from 'react';
import { Layers, ArrowUpRight, Check, LoaderCircle } from 'lucide-react';
import Design from './Design';
import { request, setCsrf } from '../api';
export default function Welcome({ onEnter }) {
  const [mode, setMode] = useState('welcome'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function auth(kind, body = {}) {
    setBusy(true);
    setError('');
    try {
      const data = await request('auth/' + kind, body);
      setCsrf(data.csrf);
      await onEnter(data.user);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="welcome">
      <header>
        <a className="brand" href="/">
          <span>
            <Layers size={23} />
          </span>
          frameflow<span className="brand-dot">.</span>
        </a>
        <button
          className="subtle-button"
          onClick={() => setMode(mode === 'login' ? 'welcome' : 'login')}
        >
          Sign in <ArrowUpRight size={15} />
        </button>
      </header>
      <div className="welcome-grid">
        <section>
          <div className="welcome-kicker">
            <span />
            THE WORK BETWEEN FIRST DRAFT & FINAL YES
          </div>
          <h1>
            Good feedback.
            <br />
            Less <em>back & forth.</em>
          </h1>
          <p className="welcome-copy">
            A place for the messy middle. Pin a thought to a design, turn it into a task, and get
            everyone to the same final version.
          </p>
          {mode === 'welcome' ? (
            <>
              <div className="welcome-actions">
                <button className="primary large" disabled={busy} onClick={() => auth('demo')}>
                  {busy ? (
                    <LoaderCircle className="spin" size={18} />
                  ) : (
                    <>
                      Explore the live demo <ArrowUpRight size={18} />
                    </>
                  )}
                </button>
                <button className="subtle-button" onClick={() => setMode('register')}>
                  Create your workspace
                </button>
              </div>
              <div className="welcome-benefits">
                <span>
                  <Check size={14} />
                  No signup to explore
                </span>
                <span>
                  <Check size={14} />
                  Your own private demo
                </span>
              </div>
            </>
          ) : (
            <form
              className="auth-form"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                auth(mode, Object.fromEntries(f));
              }}
            >
              <h3>{mode === 'register' ? 'Make room for your next project.' : 'Welcome back.'}</h3>
              {mode === 'register' && (
                <label className="field">
                  Name
                  <input name="name" autoComplete="name" required maxLength={80} />
                </label>
              )}
              <label className="field">
                Email
                <input name="email" type="email" autoComplete="email" required />
              </label>
              <label className="field">
                Password
                <input
                  name="password"
                  type="password"
                  minLength={10}
                  maxLength={128}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  required
                />
              </label>
              <button className="primary" disabled={busy}>
                {busy ? 'Opening…' : mode === 'register' ? 'Create workspace' : 'Sign in'}
              </button>
              <button type="button" className="text-button" onClick={() => setMode('welcome')}>
                Back to demo
              </button>
            </form>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </section>
        <div className="welcome-preview">
          <div className="specimen-label">
            FIG. 01 / A WORK IN PROGRESS <span>↙</span>
          </div>
          <div className="preview-top">
            <span className="preview-dots">● ● ●</span>
            <span>Forma · Website review</span>
            <span>V2</span>
          </div>
          <Design version="v2" />
          <div className="floating-feedback">
            <span className="avatar peach">MC</span>
            <div>
              <b>Maya left a comment</b>
              <p>Could we show the starting price here?</p>
              <small>
                <Check size={12} />
                Linked to a requirement
              </small>
            </div>
          </div>
          <div className="floating-status">
            <Check size={15} />
            NOTED. LINKED. MOVING FORWARD.
          </div>
        </div>
      </div>
      <div className="studio-process" aria-label="How FrameFlow works">
        <div>
          <small>01 / COLLECT</small>
          <h2>Start with the why.</h2>
          <p>A brief worth coming back to. Requirements that stay attached to the work.</p>
        </div>
        <div>
          <small>02 / MAKE NOTES</small>
          <h2>Right here. Not in a thread.</h2>
          <p>Pin feedback exactly where it belongs, across every version of the design.</p>
        </div>
        <div>
          <small>03 / CLOSE THE LOOP</small>
          <h2>Give good work a green light.</h2>
          <p>Follow each note through to a finished task and a clear approval.</p>
        </div>
      </div>
      <footer>
        <span>BRIEF → REVIEW → REFINE → APPROVE</span>
        <span>Thoughtful work deserves a thoughtful workflow.</span>
      </footer>
    </div>
  );
}
