import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { SceneDTO, TokenDTO, FolderKind, TokenKind } from '@tabletop/shared';
import { scenesApi } from '../lib/scenes.js';
import { campaignsApi } from '../lib/campaigns.js';
import { uploadAsset, assetUrl, nameFromFileName } from '../lib/assets.js';
import { useAuth } from '../store/auth.js';
import { MapEditor } from '../components/MapEditor.js';
import { DicePanel } from '../components/DicePanel.js';
import { CombatTracker } from '../components/CombatTracker.js';
import { LibraryPanel } from '../components/LibraryPanel.js';
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

  async function createScene(folderId: string | null = null) {
    const name = prompt('Nome da cena:', 'Nova cena');
    if (!name) return;
    const scene = await scenesApi.create(campaignId, {
      name,
      gridType: 'SQUARE',
      gridSize: 70,
      ...(folderId ? { folderId } : {}),
    });
    setScenes((s) => [...s, scene]);
    await loadScene(scene.id);
  }

  async function addToken(folderId: string | null = null) {
    if (!current) return;
    const name = prompt('Nome do token:', 'Token');
    if (!name) return;
    const token = await scenesApi.createToken(campaignId, current.scene.id, {
      name,
      x: 70,
      y: 70,
      width: 70,
      height: 70,
      ...(folderId ? { folderId } : {}),
    });
    setCurrent((c) => (c ? { ...c, tokens: [...c.tokens, token] } : c));
  }

  async function deleteScene(sceneId: string) {
    if (!confirm('Excluir esta cena e tudo nela?')) return;
    await scenesApi.remove(campaignId, sceneId);
    setScenes((s) => s.filter((x) => x.id !== sceneId));
    setCurrent((c) => (c && c.scene.id === sceneId ? null : c));
  }

  async function deleteToken(tokenId: string) {
    if (!current) return;
    await scenesApi.removeToken(campaignId, current.scene.id, tokenId);
    setCurrent((c) => (c ? { ...c, tokens: c.tokens.filter((t) => t.id !== tokenId) } : c));
  }

  // --- upload de imagens ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingImport = useRef<{ kind: FolderKind; folderId: string | null } | null>(null);
  const [uploading, setUploading] = useState(false);

  // o botão ⬆ da biblioteca pede para importar: guardamos o destino e abrimos
  // o seletor de arquivo nativo. O upload real acontece em onFilePicked.
  function importImage(kind: FolderKind, folderId: string | null) {
    pendingImport.current = { kind, folderId };
    fileInputRef.current?.click();
  }

  const FOLDER_TO_TOKEN_KIND: Record<string, TokenKind> = {
    TOKEN: 'CHARACTER',
    ITEM: 'ITEM',
  };

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite re-selecionar o mesmo arquivo depois
    const dest = pendingImport.current;
    pendingImport.current = null;
    if (!file || !dest) return;

    setUploading(true);
    try {
      const asset = await uploadAsset(campaignId, file);
      const url = assetUrl(asset.url);
      const niceName = nameFromFileName(file.name); // orc.png -> "Orc"

      if (dest.kind === 'SCENE' || dest.kind === 'MAP') {
        // cria uma cena nova usando a imagem como fundo (cenário)
        const scene = await scenesApi.create(campaignId, {
          name: niceName || 'Nova cena',
          gridType: 'SQUARE',
          gridSize: 70,
          backgroundAssetId: asset.id,
          ...(dest.folderId ? { folderId: dest.folderId } : {}),
        } as any);
        setScenes((s) => [...s, scene]);
        await loadScene(scene.id);
      } else {
        // TOKEN / ITEM: cria um token com a imagem e nome derivado do arquivo
        if (!current) {
          setError('Abra uma cena antes de importar tokens.');
          return;
        }
        const token = await scenesApi.createToken(campaignId, current.scene.id, {
          name: niceName || 'Token',
          x: 70,
          y: 70,
          width: 70,
          height: 70,
          imageAssetId: asset.id,
          imageUrl: url,
          kind: FOLDER_TO_TOKEN_KIND[dest.kind] ?? 'CHARACTER',
          ...(dest.folderId ? { folderId: dest.folderId } : {}),
        });
        setCurrent((c) => (c ? { ...c, tokens: [...c.tokens, token] } : c));
      }
    } catch (err: any) {
      setError(err?.message ?? 'Falha no upload da imagem.');
    } finally {
      setUploading(false);
    }
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
    <main className="container" style={{ maxWidth: 1280 }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        style={{ display: 'none' }}
        onChange={onFilePicked}
      />
      {uploading && <div className="badge" style={{ marginBottom: 8 }}>Enviando imagem…</div>}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Link to={`/campaigns/${campaignId}`} className="badge">← Campanha</Link>
        <strong style={{ fontSize: 15 }}>{current?.scene.name ?? 'Sem cena'}</strong>
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

      <div className="scene-workspace">
        <LibraryPanel
          campaignId={campaignId}
          isGm={isGm}
          scenes={scenes}
          tokens={current?.tokens ?? []}
          currentSceneId={current?.scene.id}
          onOpenScene={loadScene}
          onCreateScene={createScene}
          onDeleteScene={deleteScene}
          onCreateToken={addToken}
          onDeleteToken={deleteToken}
          onImport={importImage}
        />

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
                {isGm ? 'Nenhuma cena aberta. Use a biblioteca à esquerda para criar ou abrir uma cena.' : 'O mestre ainda não criou uma cena.'}
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
