import React, { useState } from 'react';
import '../styles/LoginPage.css';

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username || !password) {
      setError('Please enter Username and Password');
      return;
    }
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    const ok = onLogin(username, password);
    if (!ok) {
      setError('Invalid Username or Password');
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-bg-blob blob1" />
      <div className="login-bg-blob blob2" />
      <div className="login-bg-blob blob3" />

      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">🏗️</div>
          <div className="login-logo-text"><b>Account Managements</b></div>
        </div>

        <h1 className="login-title">Welcome Back 👋</h1>
        <p className="login-subtitle">Admin Panel — Sign In</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <div className="form-input-wrap">
              <input
                type="text"
                className="form-input"
                // placeholder="admin"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
              />
              <span className="form-input-icon">👨‍💼</span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="form-input-wrap">
              <input
                type={showPass ? 'text' : 'password'}
                className="form-input"
                // placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <span className="form-input-icon">🔐</span>
              <span
                className="form-input-icon"
                style={{ left: 'auto', right: 16, cursor: 'pointer' }}
                onClick={() => setShowPass(!showPass)}
              >
                {showPass ? '🚫' : '👁️'}
              </span>
            </div>
          </div>

          {error && (
            <div className="login-error">
              ⚠️ {error}
            </div>
          )}

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? '⏳ Signing in...' : ' Sign In'}
          </button>
        </form>

       
      </div>
    </div>
  );
}

export default LoginPage;