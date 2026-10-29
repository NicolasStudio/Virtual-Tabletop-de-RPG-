import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { campaignsApi, type CampaignDetail, type InviteView } from '../lib/campaigns.js';
import { useAuth } from '../store/auth.js';

export function CampaignPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [invites, setInvites] = useState<InviteView[]>([]);
  const [error, setError] = useState<string | null>(null);

  const isGm = detail?.members.find((m) => m.userId === user?.id)?.role === 'GM';
  const isOwner = detail?.ownerId === user?.id;

  async function reload() {
    setError(null);
    try {
      const d = await campaignsApi.detail(id);
      setDetail(d);
      if (d.members.find((m) => m.userId === user?.id)?.role === 'GM') {
        setInvites(await campaignsApi.listInvites(id));
      }
    } catch (err: any) {
      setError(err?.message ?? 'Não foi possível carregar a campanha.');
    }
  }
  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function createInvite() {
    const inv = await campaignsApi.createInvite(id, { role: 'PLAYER', maxUses: 10 });
    setInvites((prev) => [inv, ...prev]);
  }

  async function revoke(inviteId: string) {
    await campaignsApi.revokeInvite(id, inviteId);
    setInvites((prev) => prev.filter((i) => i.id !== inviteId));
  }

  async function removeCampaign() {
    if (!confirm('Excluir esta campanha? Esta ação é irreversível.')) return;
    await campaignsApi.remove(id);
    nav('/');
  }

  async function leave() {
    if (!confirm('Sair desta campanha?')) return;
    await campaignsApi.leave(id);
    nav('/');
  }

  if (error) {
    return (
      <main className="container">
        <p className="badge err" role="alert">{error}</p>
        <p><Link to="/">Voltar ao dashboard</Link></p>
      </main>
    );
  }
  if (!detail) return <main className="container">Carregando…</main>;

  return (
    <main className="container">
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h1 style={{ margin: 0 }}>{detail.name}</h1>
          <span className="muted">{detail.system}</span>
          <span style={{ marginLeft: 'auto' }}>
            {isOwner ? (
              <button className="btn danger" onClick={removeCampaign}>Excluir campanha</button>
            ) : (
              <button className="btn" onClick={leave}>Sair</button>
            )}
          </span>
        </div>
        {detail.description && <p className="muted">{detail.description}</p>}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Participantes ({detail.members.length})</h3>
        <ul className="member-list">
          {detail.members.map((m) => (
            <li key={m.userId}>
              <span>{m.displayName}{m.userId === user?.id ? ' (você)' : ''}</span>
              <span className={`badge role-${m.role.toLowerCase()}`}>{m.role}</span>
              {isGm && m.userId !== detail.ownerId && (
                <button
                  className="link-btn"
                  onClick={async () => {
                    if (confirm(`Remover ${m.displayName}?`)) {
                      await campaignsApi.removeMember(id, m.userId);
                      void reload();
                    }
                  }}
                >
                  remover
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {isGm && (
        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Convites</h3>
            <button className="btn" style={{ marginLeft: 'auto' }} onClick={createInvite}>
              Gerar código
            </button>
          </div>
          {invites.length === 0 ? (
            <p className="muted">Nenhum convite ativo.</p>
          ) : (
            <ul className="member-list">
              {invites.map((i) => (
                <li key={i.id}>
                  <code>{i.code}</code>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {i.role} · {i.uses}/{i.maxUses ?? '∞'} usos
                  </span>
                  <button className="link-btn" onClick={() => revoke(i.id)}>revogar</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <strong>Mapa e tokens</strong>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              Abra a cena para manipular o mapa, a grade e os tokens.
            </p>
          </div>
          <Link to={`/campaigns/${id}/scene`} className="btn" style={{ marginLeft: 'auto' }}>
            Abrir mapa
          </Link>
        </div>
      </div>
    </main>
  );
}
