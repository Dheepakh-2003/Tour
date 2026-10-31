import { useState } from 'react';
import { authApi } from '../services/api.js';

export default function LoginForm({ onSuccess }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await authApi.login(password);
      onSuccess();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <span className="brand">Tour</span>
        <h1>Admin sign in</h1>
        <p className="muted">Enter the admin password to manage banners.</p>
        <label className="field">
          <span>Password</span>
          <div className="password-wrap">
            <input
              type={visible ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus
              required
            />
            <button
              type="button"
              className="eye-btn"
              aria-label={visible ? 'Hide password' : 'Show password'}
              aria-pressed={visible}
              onClick={() => setVisible((v) => !v)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
                <circle cx="12" cy="12" r="3" />
                {visible && <path d="M3 3l18 18" />}
              </svg>
            </button>
          </div>
        </label>
        {error && <p className="field-error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy || !password}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
