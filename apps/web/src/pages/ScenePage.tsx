import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { SceneDTO, TokenDTO } from '@tabletop/shared';
import { scenesApi } from '../lib/scenes.js';
import { campaignsApi } from '../lib/campaigns.js';
import { useAuth } from '../store/auth.js';
import { MapEditor } from '../components/MapEditor.js';
import { DicePanel } from '../components/DicePanel.js';
import { CombatTracker } from '../components/CombatTracker.js';
import { useRealtimeScene } from '../hooks/useRealtimeScene.js';

export function ScenePage() {
  const { campaignId = '' } = useParams();
  const { user } = useAuth();
  const [scenes, setScenes] = useState<SceneDTO[]>([]);
  const [current, setCurrent] = useState<{ scene: SceneDTO; tokens: TokenDTO[] } | null>(null);
  const [role, setRole] = useState<string>('PLAYER');
  const [diceOpen, setDiceOpen] = useState(false);
  const [combatOpen, setCombatOpen] = useState(false);
  const [snap, setSnap] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isGm = role === 'GM';

  const loadScene = useCallback(
    async (sceneId: string) => {
      setCurrent(await scenesApi.get(campaignId, sceneId));
    },
    [campaignId],
  );

  // aplica um token autoritativo vindo do servidor (socket)
  const applyAuthoritativeToken = useCallback((token: TokenDTO) => {
    setCurrent((c) => {
      if (!c || c.scene.id !== token.sceneId) return c;
      const exists = c.tokens.some((t) => t.id === token.id);
      return {
        ...c,
        tokens: exists
          ? c.tokens.map((t) => (t.id === token.id ? token : t))
          : [...c.tokens, token],
      };
    });
  }, []);

  const resync = useCallback(() => {
    setCurrent((c) => {
      if (c) void loadScene(c.scene.id);
      return c;
    });
  }, [loadScene]);

  const { online, connected, sendMove, sendUpdate } = useRealtimeScene(
    campaignId,
    applyAuthoritativeToken,
    resync,
    (msg) => setError(msg),
  );

  useEffect(() => {
    (async () => {
      try {
        const detail = await campaignsApi.detail(campaignId);
        setRole(detail.members.find((m) => m.userId === user?.id)?.role ?? 'PLAYER');
        const list = await scenesApi.list(campaignId);
        setScenes(list);
        if (list[0]) await loadScene(list[0].id);
      } catch (e: any) {
        setError(e?.message ?? 'Falha ao carregar cenas.');
      }
    })();
  }, [campaignId, user?.id, loadScene]);

  async function createScene() {
    const name = prompt('Nome da cena:', 'Nova cena');
    if (!name) return;
    const scene = await scenesApi.create(campaignId, { name, gridType: 'SQUARE', gridSize: 70 });
    setScenes((s) => [...s, scene]);
    await loadScene(scene.id);
  }

  async function addToken() {
    if (!current) return;
    const name = prompt('Nome do token:', 'Token');
    if (!name) return;
    const token = await scenesApi.createToken(campaignId, current.scene.id, {
      name,
      x: 70,
      y: 70,
      width: 70,
      height: 70,
    });
    setCurrent((c) => (c ? { ...c, tokens: [...c.tokens, token] } : c));
  }

  // Movimento/transform agora vão pelo SOCKET: o servidor valida e re-emite o
  // estado autoritativo para todos (incluindo nós). Aplicamos localmente um
  // preview otimista; a confirmação do servidor chega por applyAuthoritativeToken.
  function onTokenChange(tokenId: string, data: Partial<TokenDTO>) {
    setCurrent((c) =>
      c ? { ...c, tokens: c.tokens.map((t) => (t.id === tokenId ? { ...t, ...data } : t)) } : c,
    );
    const { x, y, rotation, ...rest } = data;
    if (x !== undefined && y !== undefined) {
      sendMove(tokenId, x, y, rotation);
    }
    if (Object.keys(rest).length > 0 || (rotation !== undefined && x === undefined)) {
      sendUpdate(tokenId, data);
    }
  }

  const canEditToken = (t: TokenDTO) => isGm || t.ownerUserId === user?.id;

  if (error) {
    return (
      <main className="container">
        <p className="badge err" role="alert">{error}</p>
        <Link to={`/campaigns/${campaignId}`}>Voltar à campanha</Link>
      </main>
    );
  }

  return (
    <main className="container" style={{ maxWidth: 1200 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Link to={`/campaigns/${campaignId}`} className="badge">← Campanha</Link>
        <div style={{ display: 'flex', gap: 6 }}>
          {scenes.map((s) => (
            <button
              key={s.id}
              className={`btn ${current?.scene.id === s.id ? '' : 'ghost'}`}
              onClick={() => loadScene(s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>
        {isGm && (
          <>
            <button className="btn ghost" onClick={createScene}>+ Cena</button>
            {current && <button className="btn ghost" onClick={addToken}>+ Token</button>}
          </>
        )}
        <label style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} />
          <span className="muted">snapping à grade</span>
        </label>
        <button className="btn" onClick={() => setDiceOpen((v) => !v)} aria-expanded={diceOpen}>
          🎲 Dados
        </button>
        <button className="btn" onClick={() => setCombatOpen((v) => !v)} aria-expanded={combatOpen}>
          ⚔ Combate
        </button>
        <span className={`badge ${connected ? 'ok' : 'err'}`} title="Sincronização em tempo real">
          {connected ? `● ao vivo (${online.length})` : '○ reconectando'}
        </span>
      </div>

      {online.length > 0 && (
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          Online: {online.map((o) => `${o.displayName} (${o.role})`).join(' · ')}
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        <div className="scene-map">
          {current ? (
            <MapEditor
              scene={current.scene}
              tokens={current.tokens}
              canEditToken={canEditToken}
              snap={snap}
              onTokenChange={onTokenChange}
            />
          ) : (
            <div className="card">
              <p className="muted" style={{ margin: 0 }}>
                {isGm ? 'Nenhuma cena ainda. Clique em “+ Cena”.' : 'O mestre ainda não criou uma cena.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {diceOpen && (
        <>
          <div className="drawer-backdrop" onClick={() => setDiceOpen(false)} />
          <aside className="dice-drawer card" role="dialog" aria-label="Dados">
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>🎲 Dados</h3>
              <button
                className="link-btn"
                style={{ color: 'var(--text-dim)' }}
                onClick={() => setDiceOpen(false)}
                aria-label="Fechar"
              >
                fechar ✕
              </button>
            </div>
            <DicePanel campaignId={campaignId} canSeeGmVisibility={isGm} />
          </aside>
        </>
      )}

      {combatOpen && (
        <>
          <div className="drawer-backdrop" onClick={() => setCombatOpen(false)} />
          <aside className="dice-drawer card" role="dialog" aria-label="Combate">
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>⚔ Combate</h3>
              <button
                className="link-btn"
                style={{ color: 'var(--text-dim)' }}
                onClick={() => setCombatOpen(false)}
                aria-label="Fechar"
              >
                fechar ✕
              </button>
            </div>
            <CombatTracker campaignId={campaignId} isGm={isGm} />
          </aside>
        </>
      )}
    </main>
  );
}
