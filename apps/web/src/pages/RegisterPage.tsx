import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth.js';

export function RegisterPage() {
  const { register, error, status, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const nav = useNavigate();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    clearError();
    try {
      await register(email, displayName, password);
      nav('/');
    } catch {
      /* erro já no store */
    }
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={onSubmit} aria-labelledby="reg-h">
        <h1 id="reg-h">Criar conta</h1>
        {error && (
          <p className="badge err" role="alert">
            {error}
          </p>
        )}
        <label htmlFor="name">Nome de exibição</label>
        <input
          id="name"
          required
          minLength={2}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label htmlFor="pw">Senha (mín. 8)</label>
        <input
          id="pw"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="btn" type="submit" disabled={status === 'loading'}>
          {status === 'loading' ? 'Criando…' : 'Cadastrar'}
        </button>
        <p className="muted">
          Já tem conta? <Link to="/login">Entrar</Link>
        </p>
      </form>
    </div>
  );
}
