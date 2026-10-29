import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../lib/api.js';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const res = await authApi.forgot(email).catch(() => ({ devToken: undefined }));
    setSent(true);
    setDevToken(res?.devToken ?? null);
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={onSubmit} aria-labelledby="fp-h">
        <h1 id="fp-h">Recuperar senha</h1>
        {sent ? (
          <>
            <p className="muted" role="status">
              Se o e-mail existir, enviaremos instruções de recuperação.
            </p>
            {devToken && (
              <p className="badge">
                DEV: use este token em <Link to={`/reset?token=${devToken}`}>/reset</Link>
              </p>
            )}
          </>
        ) : (
          <>
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="btn" type="submit">
              Enviar
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
