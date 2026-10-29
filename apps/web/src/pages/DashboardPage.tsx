import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { CampaignSummary } from '@tabletop/shared';
import { campaignsApi } from '../lib/campaigns.js';

export function DashboardPage() {
  const [campaigns, setCampaigns] = useState<CampaignSummary[] | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const nav = useNavigate();

  async function reload() {
    setCampaigns(await campaignsApi.list());
  }
  useEffect(() => {
    void reload();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const c = await campaignsApi.create(name);
      setName('');
      await reload();
      nav(`/campaigns/${c.id}`);
    } catch (err: any) {
      setError(err?.message ?? 'Falha ao criar campanha.');
    }
  }

  async function onJoin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const r = await campaignsApi.joinByCode(code.trim().toUpperCase());
      setCode('');
      nav(`/campaigns/${r.campaignId}`);
    } catch (err: any) {
      setError(err?.message ?? 'Código inválido.');
    }
  }

  return (
    <main className="container">
      <div className="grid-2">
        <form className="card" onSubmit={onCreate}>
          <h3 style={{ marginTop: 0 }}>Nova campanha</h3>
          <label htmlFor="cn">Nome</label>
          <input id="cn" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn" type="submit" style={{ marginTop: 12 }}>
            Criar
          </button>
        </form>
        <form className="card" onSubmit={onJoin}>
          <h3 style={{ marginTop: 0 }}>Entrar por código</h3>
          <label htmlFor="jc">Código de convite</label>
          <input
            id="jc"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={{ textTransform: 'uppercase' }}
          />
          <button className="btn" type="submit" style={{ marginTop: 12 }}>
            Entrar
          </button>
        </form>
      </div>

      {error && (
        <p className="badge err" role="alert" style={{ marginTop: 16 }}>
          {error}
        </p>
      )}

      <h2 style={{ marginTop: 28 }}>Suas campanhas</h2>
      {campaigns === null ? (
        <p className="muted">Carregando…</p>
      ) : campaigns.length === 0 ? (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            Você ainda não participa de nenhuma campanha. Crie uma acima ou entre
            por código.
          </p>
        </div>
      ) : (
        <div className="campaign-grid">
          {campaigns.map((c) => (
            <Link key={c.id} to={`/campaigns/${c.id}`} className="card campaign-card">
              <div className="campaign-title">{c.name}</div>
              <div className="muted" style={{ fontSize: 13 }}>{c.system}</div>
              <span className={`badge role-${c.role.toLowerCase()}`}>{c.role}</span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
