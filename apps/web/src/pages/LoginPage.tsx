import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth.js';

export function LoginPage() {
  const { login, error, status, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const nav = useNavigate();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    clearError();
    try {
      await login(email, password);
      nav('/');
    } catch {
      /* erro já no store */
    }
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={onSubmit} aria-labelledby="login-h">
        <h1 id="login-h">Entrar</h1>
        {error && (
          <p className="badge err" role="alert">
            {error}
          </p>
        )}
        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label htmlFor="pw">Senha</label>
        <input
          id="pw"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="btn" type="submit" disabled={status === 'loading'}>
          {status === 'loading' ? 'Entrando…' : 'Entrar'}
        </button>
        <p className="muted">
          Sem conta? <Link to="/register">Cadastre-se</Link> ·{' '}
          <Link to="/forgot">Esqueci a senha</Link>
        </p>
      </form>
    </div>
  );
}
