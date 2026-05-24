import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AuthPage() {
  const [tab, setTab] = useState('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const { login, register, user } = useAuth();
  const navigate = useNavigate();

  // If already authenticated, redirect
  if (user) {
    navigate('/dashboard', { replace: true });
  }

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password || (tab === 'register' && !username)) {
      setError('Please fill in all fields');
      return;
    }

    setSubmitting(true);
    try {
      if (tab === 'login') {
        await login(email, password);
        showToast('success', 'Welcome back!');
      } else {
        await register(username, email, password);
        showToast('success', 'Account created successfully!');
      }
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Something went wrong';
      setError(msg);
      showToast('error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const switchTab = (newTab) => {
    setTab(newTab);
    setError('');
    setEmail('');
    setUsername('');
    setPassword('');
  };

  return (
    <div className="auth-page">
      <div className="bg-pattern" />

      {/* Toast */}
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span className="toast-icon">
              {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : 'ℹ'}
            </span>
            <span className="toast-message">{toast.message}</span>
            <button className="toast-close" onClick={() => setToast(null)}>
              ×
            </button>
          </div>
        </div>
      )}

      <div className="auth-container">
        <div className="auth-header">
          <h1>CoCode</h1>
          <p>Real-time collaborative development workspace</p>
        </div>

        <div className="auth-card">
          <div className="auth-tabs">
            <button
              className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
              onClick={() => switchTab('login')}
            >
              Sign In
            </button>
            <button
              className={`auth-tab ${tab === 'register' ? 'active' : ''}`}
              onClick={() => switchTab('register')}
            >
              Sign Up
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {tab === 'register' && (
              <div className="input-group">
                <label>Username</label>
                <input
                  type="text"
                  className={`input ${error && !username ? 'input-error' : ''}`}
                  placeholder="Choose a username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                />
              </div>
            )}

            <div className="input-group">
              <label>Email</label>
              <input
                type="email"
                className={`input ${error && !email ? 'input-error' : ''}`}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div className="input-group">
              <label>Password</label>
              <input
                type="password"
                className={`input ${error && !password ? 'input-error' : ''}`}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              />
            </div>

            {error && (
              <p style={{ color: 'var(--accent-red)', fontSize: 'var(--fs-sm)' }}>{error}</p>
            )}

            <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
              {submitting ? (
                <>
                  <span className="spinner spinner-sm" /> Please wait…
                </>
              ) : tab === 'login' ? (
                'Sign In'
              ) : (
                'Create Account'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
