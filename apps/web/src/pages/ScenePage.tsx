import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { SceneDTO, TokenDTO, FolderKind, TokenKind, MapOverlayDTO, SceneFogDTO } from '@tabletop/shared';
import { scenesApi } from '../lib/scenes.js';
import { campaignsApi } from '../lib/campaigns.js';
import { uploadAsset, assetUrl, nameFromFileName } from '../lib/assets.js';
import { useAuth } from '../store/auth.js';
import { MapEditor } from '../components/MapEditor.js';
import { DicePanel } from '../components/DicePanel.js';
import { CombatTracker } from '../components/CombatTracker.js';
import { LibraryPanel } from '../components/LibraryPanel.js';
import { useRealtimeScene } from '../hooks/useRealtimeScene.js';

// Acrescenta ou atualiza pelo id. O mesmo token/mapa chega duas vezes ao ser criado:
// pela resposta da API e pelo aviso em tempo real (socket), em qualquer ordem.
function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  return list.some((x) => x.id === item.id)
    ? list.map((x) => (x.id === item.id ? { ...x, ...item } : x))
    : [...list, item];
}

export function ScenePage() {
  const { campaignId = '' } = useParams();
  const { user } = useAuth();
  const [scenes, setScenes] = useState<SceneDTO[]>([]);
  const [current, setCurrent] = useState<{ scene: SceneDTO; tokens: TokenDTO[]; overlays: MapOverlayDTO[]; fog: SceneFogDTO } | null>(null);
  const [role, setRole] = useState<string>('PLAYER');
  const [diceOpen, setDiceOpen] = useState(false);
  const [combatOpen, setCombatOpen] = useState(false);
  const [libOpen, setLibOpen] = useState(true);
  const [snap, setSnap] = useState(true);
  const [fogMode, setFogMode] = useState<'reveal' | 'hide' | null>(null);
  const [fogBrush, setFogBrush] = useState(true); // true = pincel livre; false = por célula
  const [brushSize, setBrushSize] = useState(60);
  const [fogMenu, setFogMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isGm = role === 'GM';

  const loadScene = useCallback(
    async (sceneId: string) => {
      setCurrent(await scenesApi.get(campaignId, sceneId));
      // GM que abre uma cena a torna a cena ATIVA que os jogadores acompanham
      if (role === 'GM') {
        void scenesApi.activate(campaignId, sceneId).catch(() => {});
      }
    },
    [campaignId, role],
  );

  // aplica um token autoritativo vindo do servidor (socket)
  const applyAuthoritativeToken = useCallback((token: TokenDTO) => {
    setCurrent((c) => {
      if (!c || c.scene.id !== token.sceneId) return c;
      return { ...c, tokens: upsertById(c.tokens, token) };
    });
  }, []);

  const resync = useCallback(() => {
    setCurrent((c) => {
      if (c) void loadScene(c.scene.id);
      return c;
    });
  }, [loadScene]);

  // jogador segue a cena indicada pelo mestre (carrega sem re-ativar)
  const followScene = useCallback(
    async (sceneId: string) => {
      setCurrent((c) => {
        if (c?.scene.id === sceneId) return c; // já estou nela
        void scenesApi.get(campaignId, sceneId).then(setCurrent).catch(() => {});
        return c;
      });
    },
    [campaignId],
  );

  const { online, connected, sendMove, sendUpdate } = useRealtimeScene(
    campaignId,
    applyAuthoritativeToken,
    resync,
    (msg) => setError(msg),
    {
      // o jogador NÃO escolhe cena: segue a que o mestre ativar
      onSceneActivate: (sceneId) => {
        if (role !== 'GM') void followScene(sceneId);
      },
      onTokenCreate: (token) => applyAuthoritativeToken(token),
      onTokenDelete: (tokenId) =>
        setCurrent((c) => (c ? { ...c, tokens: c.tokens.filter((t) => t.id !== tokenId) } : c)),
      onOverlay: (action, overlay) =>
        setCurrent((c) => {
          if (!c) return c;
          if (action === 'delete') return { ...c, overlays: c.overlays.filter((o) => o.id !== overlay.id) };
          return { ...c, overlays: upsertById(c.overlays, overlay) };
        }),
      onFog: (sceneId, fog) =>
        setCurrent((c) => (c && c.scene.id === sceneId ? { ...c, fog } : c)),
    },
  );

  useEffect(() => {
    (async () => {
      try {
        const detail = await campaignsApi.detail(campaignId);
        const myRole = detail.members.find((m) => m.userId === user?.id)?.role ?? 'PLAYER';
        setRole(myRole);
        const list = await scenesApi.list(campaignId);
        setScenes(list);
        // GM abre a 1ª cena (e a ativa); jogador abre a cena ATIVA da campanha
        const activeId = detail.activeSceneId;
        if (myRole !== 'GM' && activeId) {
          setCurrent(await scenesApi.get(campaignId, activeId));
        } else if (list[0]) {
          await loadScene(list[0].id);
        }
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

  async function addToken(folderId: string | null = null, kind: TokenKind = 'CHARACTER') {
    if (!current) return;
    const name = prompt(kind === 'ITEM' ? 'Nome do item:' : 'Nome do token:', kind === 'ITEM' ? 'Item' : 'Token');
    if (!name) return;
    const token = await scenesApi.createToken(campaignId, current.scene.id, {
      name,
      x: 70,
      y: 70,
      width: 70,
      height: 70,
      kind,
      ...(folderId ? { folderId } : {}),
    });
    setCurrent((c) => (c ? { ...c, tokens: upsertById(c.tokens, token) } : c));
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

      if (dest.kind === 'SCENE') {
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
      } else if (dest.kind === 'MAP') {
        // MAPA: adiciona um overlay sobre a cena atual (o GM estica/posiciona)
        if (!current) {
          setError('Abra uma cena antes de carregar um mapa.');
          return;
        }
        const overlay = await scenesApi.createOverlay(campaignId, current.scene.id, {
          name: niceName || 'Mapa',
          assetId: asset.id,
          imageUrl: url,
          ...(dest.folderId ? { folderId: dest.folderId } : {}),
        });
        setCurrent((c) => (c ? { ...c, overlays: upsertById(c.overlays ?? [], overlay) } : c));
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
        setCurrent((c) => (c ? { ...c, tokens: upsertById(c.tokens, token) } : c));
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

  // jogador pode mover qualquer token não bloqueado; GM move tudo. Excluir é só GM.
  const canEditToken = (t: TokenDTO) => isGm || !t.isLocked;

  // mover/esticar mapa-overlay: só GM. Atualização otimista + PATCH no servidor.
  function onOverlayChange(overlayId: string, data: Partial<MapOverlayDTO>) {
    if (!current || !isGm) return;
    setCurrent((c) =>
      c ? { ...c, overlays: c.overlays.map((o) => (o.id === overlayId ? { ...o, ...data } : o)) } : c,
    );
    void scenesApi.updateOverlay(campaignId, current.scene.id, overlayId, data).catch((e: any) =>
      setError(e?.message ?? 'Falha ao atualizar o mapa.'),
    );
  }

  async function deleteOverlay(overlayId: string) {
    if (!current) return;
    await scenesApi.removeOverlay(campaignId, current.scene.id, overlayId);
    setCurrent((c) => (c ? { ...c, overlays: c.overlays.filter((o) => o.id !== overlayId) } : c));
  }

  // --- névoa de guerra (só GM) ---
  function onFogPaint(cells: string[], mode: 'reveal' | 'hide') {
    if (!current || !isGm) return;
    // update otimista
    setCurrent((c) => {
      if (!c) return c;
      const set = new Set(c.fog.revealedCells);
      for (const cell of cells) mode === 'reveal' ? set.add(cell) : set.delete(cell);
      return { ...c, fog: { ...c.fog, enabled: true, revealedCells: [...set] } };
    });
    void scenesApi.paintFog(campaignId, current.scene.id, cells, mode).catch((e: any) =>
      setError(e?.message ?? 'Falha ao pintar a névoa.'),
    );
  }

  function onFogBrush(dots: { x: number; y: number; r: number }[], mode: 'reveal' | 'hide') {
    if (!current || !isGm) return;
    setCurrent((c) => {
      if (!c) return c;
      const fog = { ...c.fog, enabled: true };
      if (mode === 'reveal') fog.brushReveal = [...c.fog.brushReveal, ...dots];
      else fog.brushHide = [...c.fog.brushHide, ...dots];
      return { ...c, fog };
    });
    void scenesApi.brushFog(campaignId, current.scene.id, dots, mode).catch((e: any) =>
      setError(e?.message ?? 'Falha ao pintar a névoa.'),
    );
  }

  async function resetFog(revealAll: boolean) {
    if (!current || !isGm) return;
    const fog = await scenesApi.resetFog(campaignId, current.scene.id, revealAll);
    setCurrent((c) => (c ? { ...c, fog } : c));
  }

  // ESC cancela a ferramenta de névoa ativa (solta o pincel/célula)
  useEffect(() => {
    if (!fogMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFogMode(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fogMode]);

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
      <header className="scene-toolbar">
        <Link to={`/campaigns/${campaignId}`} className="stb-back" title="Voltar à campanha">
          <span aria-hidden>←</span> Campanha
        </Link>
        <h1 className="stb-title" title={current?.scene.name ?? ''}>
          {current?.scene.name ?? 'Sem cena'}
        </h1>

        <span className={`stb-live ${connected ? 'on' : 'off'}`} title="Sincronização em tempo real">
          <span className="stb-dot" />
          {connected ? `ao vivo · ${online.length}` : 'reconectando'}
        </span>

        <div className="stb-actions">
          <label className="stb-snap" title="Encaixar tokens na grade">
            <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} />
            <span>snap à grade</span>
          </label>
          {isGm && (
            <button className="btn ghost" onClick={() => setLibOpen((v) => !v)} aria-expanded={libOpen} title="Biblioteca de cenas, mapas, tokens e itens">
              📚 Biblioteca
            </button>
          )}
          <button className="btn ghost" onClick={() => setDiceOpen((v) => !v)} aria-expanded={diceOpen}>
            🎲 Dados
          </button>
          <button className="btn ghost" onClick={() => setCombatOpen((v) => !v)} aria-expanded={combatOpen}>
            ⚔ Combate
          </button>
          {isGm && current && (
            <div className="fog-wrap">
              <button
                className={`btn ghost ${fogMode ? 'fog-on' : ''}`}
                onClick={() => setFogMenu((v) => !v)}
                aria-expanded={fogMenu}
                title="Ferramentas de névoa de guerra"
              >
                ☁ Névoa
              </button>
              {fogMenu && (
                <div className="fog-menu card">
                  <div className="fog-group">
                    <span className="fog-group-label">Desenhar névoa (esconder)</span>
                    <div className="fog-row">
                      <button
                        className={`btn sm ${fogMode === 'hide' && fogBrush ? '' : 'ghost'}`}
                        onClick={() =>
                          fogMode === 'hide' && fogBrush ? setFogMode(null) : (setFogMode('hide'), setFogBrush(true))
                        }
                      >Pincel</button>
                      <button
                        className={`btn sm ${fogMode === 'hide' && !fogBrush ? '' : 'ghost'}`}
                        onClick={() =>
                          fogMode === 'hide' && !fogBrush ? setFogMode(null) : (setFogMode('hide'), setFogBrush(false))
                        }
                      >Célula</button>
                    </div>
                  </div>

                  <div className="fog-group">
                    <span className="fog-group-label">Revelar</span>
                    <div className="fog-row">
                      <button
                        className={`btn sm ${fogMode === 'reveal' && fogBrush ? '' : 'ghost'}`}
                        onClick={() =>
                          fogMode === 'reveal' && fogBrush ? setFogMode(null) : (setFogMode('reveal'), setFogBrush(true))
                        }
                      >Pincel</button>
                      <button
                        className={`btn sm ${fogMode === 'reveal' && !fogBrush ? '' : 'ghost'}`}
                        onClick={() =>
                          fogMode === 'reveal' && !fogBrush ? setFogMode(null) : (setFogMode('reveal'), setFogBrush(false))
                        }
                      >Célula</button>
                    </div>
                  </div>

                  {fogMode && fogBrush && (
                    <div className="fog-group">
                      <span className="fog-group-label">Espessura do pincel: {brushSize}px</span>
                      <input
                        type="range" min={20} max={160} value={brushSize}
                        onChange={(e) => setBrushSize(Number(e.target.value))}
                      />
                    </div>
                  )}

                  <div className="fog-row fog-reset">
                    <button className="btn ghost sm" onClick={() => resetFog(false)}>Ocultar tudo</button>
                    <button className="btn ghost sm" onClick={() => resetFog(true)}>Revelar tudo</button>
                  </div>

                  {fogMode && (
                    <button className="btn sm fog-stop" onClick={() => setFogMode(null)}>
                      Parar de pintar
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {online.length > 0 && (
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          Online: {online.map((o) => `${o.displayName} (${o.role})`).join(' · ')}
        </div>
      )}

      <div className={`scene-workspace ${libOpen ? 'lib-open' : 'lib-collapsed'}`}>
        {libOpen && isGm && (
          <LibraryPanel
            campaignId={campaignId}
            isGm={isGm}
            scenes={scenes}
            tokens={current?.tokens ?? []}
            overlays={current?.overlays ?? []}
            currentSceneId={current?.scene.id}
            onOpenScene={loadScene}
            onCreateScene={createScene}
            onDeleteScene={deleteScene}
            onCreateToken={addToken}
            onDeleteToken={deleteToken}
            onDeleteOverlay={deleteOverlay}
            onPlaceOverlay={(overlayId) => onOverlayChange(overlayId, { isOnMap: true })}
            onPlaceToken={(tokenId) => onTokenChange(tokenId, { isOnMap: true })}
            onImport={importImage}
          />
        )}

        <div className="scene-map">
          {current ? (
            <MapEditor
              scene={current.scene}
              tokens={current.tokens}
              overlays={current.overlays ?? []}
              isGm={isGm}
              canEditToken={canEditToken}
              snap={snap}
              onTokenChange={onTokenChange}
              onOverlayChange={onOverlayChange}
              fog={current.fog}
              fogPaintMode={isGm ? fogMode : null}
              fogBrush={fogBrush}
              brushSize={brushSize}
              onFogPaint={onFogPaint}
              onFogBrush={onFogBrush}
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
            <div className="drawer-head">
              <h3>🎲 Dados</h3>
              <button className="drawer-close" onClick={() => setDiceOpen(false)} aria-label="Fechar" title="Fechar">
                ✕
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
            <div className="drawer-head">
              <h3>⚔ Combate</h3>
              <button className="drawer-close" onClick={() => setCombatOpen(false)} aria-label="Fechar" title="Fechar">
                ✕
              </button>
            </div>
            <CombatTracker campaignId={campaignId} isGm={isGm} tokens={current?.tokens ?? []} />
          </aside>
        </>
      )}
    </main>
  );
}
