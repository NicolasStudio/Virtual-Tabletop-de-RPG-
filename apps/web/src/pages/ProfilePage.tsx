import { FormEvent, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth.js';
import { api } from '../lib/api.js';
import { THEMES, currentTheme, setTheme } from '../lib/theme.js';

export function ProfilePage() {
  const { user, logout } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [saved, setSaved] = useState(false);
  const [theme, setThemeState] = useState(currentTheme());
  const nav = useNavigate();
  // tela de onde o jogador clicou no nome (menu, campanha, tabuleiro...); sem ela, o menu
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/';

  useEffect(() => {
    setDisplayName(user?.displayName ?? '');
  }, [user]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    await api('/users/me', { method: 'PATCH', body: JSON.stringify({ displayName }) });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <main className="container">
      <button className="btn ghost" type="button" onClick={() => nav(from)} style={{ marginBottom: 16 }}>
        ← Voltar
      </button>

      <div className="card">
        <h1 style={{ marginTop: 0 }}>Olá, {user?.displayName}</h1>
        <p className="muted">{user?.email}</p>

        <form onSubmit={onSave} style={{ maxWidth: 360 }}>
          <label htmlFor="dn">Nome de exibição</label>
          <input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
            <button className="btn" type="submit">
              Salvar
            </button>
            {saved && (
              <span className="badge ok" role="status">
                Salvo
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Tema: o mesmo da Ficha ao entrar por ela; aqui dá para trocar sem voltar lá */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Tema</h3>
        <p className="muted" style={{ margin: 0 }}>
          Ao entrar pela Ficha, o Tabletop usa o tema escolhido lá.
        </p>
        <div className="theme-list">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              className="theme-option"
              aria-pressed={theme === t.id}
              onClick={() => {
                setTheme(t.id);
                setThemeState(t.id);
              }}
            >
              <span className="theme-swatch" data-tema={t.id} aria-hidden="true">
                <span className="theme-swatch-box">
                  <span className="theme-swatch-accent" />
                </span>
              </span>
              <span className="theme-text">
                <strong>{t.name}</strong>
                <small>{t.description}</small>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Sair no fim da página */}
      <div style={{ marginTop: 24 }}>
        <button className="btn danger" type="button" onClick={() => logout()}>
          Sair
        </button>
      </div>
    </main>
  );
}
