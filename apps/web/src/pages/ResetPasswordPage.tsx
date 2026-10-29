import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../lib/api.js';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const [token, setToken] = useState(params.get('token') ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const nav = useNavigate();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await authApi.reset(token, password);
      setDone(true);
      setTimeout(() => nav('/login'), 1500);
    } catch (err: any) {
      setError(err?.message ?? 'Falha ao redefinir a senha.');
    }
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={onSubmit} aria-labelledby="rp-h">
        <h1 id="rp-h">Nova senha</h1>
        {error && (
          <p className="badge err" role="alert">
            {error}
          </p>
        )}
        {done ? (
          <p className="badge ok" role="status">
            Senha redefinida. Redirecionando ao login…
          </p>
        ) : (
          <>
            <label htmlFor="token">Token de recuperação</label>
            <input id="token" required value={token} onChange={(e) => setToken(e.target.value)} />
            <label htmlFor="pw">Nova senha (mín. 8)</label>
            <input
              id="pw"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button className="btn" type="submit">
              Redefinir
            </button>
          </>
        )}
        <p className="muted">
          <Link to="/login">Voltar ao login</Link>
        </p>
      </form>
    </div>
  );
}
