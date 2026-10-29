import { useEffect, useState } from 'react';
import type { SceneDTO, TokenDTO, AssetFolderDTO, FolderKind } from '@tabletop/shared';
import { foldersApi, buildFolderTree, type FolderNode } from '../lib/folders.js';

interface Props {
  campaignId: string;
  isGm: boolean;
  scenes: SceneDTO[];
  tokens: TokenDTO[];
  currentSceneId?: string;
  onOpenScene: (sceneId: string) => void;
  onCreateScene: (folderId: string | null) => void;
  onDeleteScene: (sceneId: string) => void;
  onCreateToken: (folderId: string | null) => void;
  onDeleteToken: (tokenId: string) => void;
  // disparado quando o usuário pede para importar/subir uma imagem (ligado ao upload no próximo bloco)
  onImport?: (kind: FolderKind, folderId: string | null) => void;
}

const SECTION_META: { kind: FolderKind; icon: string; label: string }[] = [
  { kind: 'SCENE', icon: '🗺️', label: 'Cenas' },
  { kind: 'TOKEN', icon: '🎭', label: 'Tokens' },
];

export function LibraryPanel(props: Props) {
  const { campaignId, isGm } = props;
  const [folders, setFolders] = useState<AssetFolderDTO[]>([]);
  const [loading, setLoading] = useState(true);

  async function reloadFolders() {
    const all = await foldersApi.list(campaignId);
    setFolders(all);
    setLoading(false);
  }

  useEffect(() => {
    reloadFolders().catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  async function addFolder(kind: FolderKind, parentId: string | null) {
    const name = prompt(parentId ? 'Nome da subpasta:' : `Nova pasta de ${kind === 'SCENE' ? 'cenas' : 'tokens'}:`);
    if (!name?.trim()) return;
    await foldersApi.create(campaignId, { kind, name: name.trim(), parentId });
    reloadFolders();
  }

  async function renameFolder(f: AssetFolderDTO) {
    const name = prompt('Renomear pasta:', f.name);
    if (!name?.trim() || name.trim() === f.name) return;
    await foldersApi.update(campaignId, f.id, { name: name.trim() });
    reloadFolders();
  }

  async function deleteFolder(f: AssetFolderDTO) {
    if (!confirm(`Excluir a pasta "${f.name}"? Os itens dentro dela não são apagados — voltam para "Sem pasta".`)) return;
    await foldersApi.remove(campaignId, f.id);
    reloadFolders();
  }

  if (loading) {
    return <aside className="library"><p className="muted" style={{ padding: 10 }}>Carregando biblioteca…</p></aside>;
  }

  return (
    <aside className="library" aria-label="Biblioteca da campanha">
      {SECTION_META.map((meta) => (
        <LibrarySection
          key={meta.kind}
          meta={meta}
          isGm={isGm}
          folderTree={buildFolderTree(folders.filter((f) => f.kind === meta.kind))}
          scenes={props.scenes}
          tokens={props.tokens}
          currentSceneId={props.currentSceneId}
          onOpenScene={props.onOpenScene}
          onCreateScene={props.onCreateScene}
          onDeleteScene={props.onDeleteScene}
          onCreateToken={props.onCreateToken}
          onDeleteToken={props.onDeleteToken}
          onImport={props.onImport}
          onAddFolder={addFolder}
          onRenameFolder={renameFolder}
          onDeleteFolder={deleteFolder}
        />
      ))}
    </aside>
  );
}

function LibrarySection({
  meta,
  isGm,
  folderTree,
  scenes,
  tokens,
  currentSceneId,
  onOpenScene,
  onCreateScene,
  onDeleteScene,
  onCreateToken,
  onDeleteToken,
  onImport,
  onAddFolder,
  onRenameFolder,
  onDeleteFolder,
}: {
  meta: { kind: FolderKind; icon: string; label: string };
  isGm: boolean;
  folderTree: FolderNode[];
  scenes: SceneDTO[];
  tokens: TokenDTO[];
  currentSceneId?: string;
  onOpenScene: (id: string) => void;
  onCreateScene: (folderId: string | null) => void;
  onDeleteScene: (id: string) => void;
  onCreateToken: (folderId: string | null) => void;
  onDeleteToken: (id: string) => void;
  onImport?: (kind: FolderKind, folderId: string | null) => void;
  onAddFolder: (kind: FolderKind, parentId: string | null) => void;
  onRenameFolder: (f: AssetFolderDTO) => void;
  onDeleteFolder: (f: AssetFolderDTO) => void;
}) {
  const [open, setOpen] = useState(true);
  const isScene = meta.kind === 'SCENE';

  // itens sem pasta (folderId null) do tipo desta seção
  const looseScenes = isScene ? scenes.filter((s) => !s.folderId) : [];
  const looseTokens = !isScene ? tokens.filter((t) => !t.folderId) : [];

  return (
    <section className="lib-section">
      <header className="lib-section-head" onClick={() => setOpen((v) => !v)}>
        <span className="lib-chevron">{open ? '▾' : '▸'}</span>
        <span className="lib-icon">{meta.icon}</span>
        <span className="lib-title">{meta.label}</span>
        {isGm && (
          <span className="lib-head-actions" onClick={(e) => e.stopPropagation()}>
            <button className="lib-mini" title="Nova pasta" onClick={() => onAddFolder(meta.kind, null)}>📁+</button>
            <button
              className="lib-mini"
              title={isScene ? 'Nova cena' : 'Novo token'}
              onClick={() => (isScene ? onCreateScene(null) : onCreateToken(null))}
            >
              ＋
            </button>
          </span>
        )}
      </header>

      {open && (
        <div className="lib-section-body">
          {folderTree.map((folder) => (
            <LibraryFolder
              key={folder.id}
              folder={folder}
              depth={0}
              isGm={isGm}
              kind={meta.kind}
              scenes={scenes}
              tokens={tokens}
              currentSceneId={currentSceneId}
              onOpenScene={onOpenScene}
              onCreateScene={onCreateScene}
              onDeleteScene={onDeleteScene}
              onCreateToken={onCreateToken}
              onDeleteToken={onDeleteToken}
              onImport={onImport}
              onAddFolder={onAddFolder}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
            />
          ))}

          {/* itens soltos (sem pasta) */}
          {isScene
            ? looseScenes.map((s) => (
                <SceneRow
                  key={s.id}
                  scene={s}
                  active={s.id === currentSceneId}
                  isGm={isGm}
                  onOpen={() => onOpenScene(s.id)}
                  onDelete={() => onDeleteScene(s.id)}
                />
              ))
            : looseTokens.map((t) => (
                <TokenRow key={t.id} token={t} isGm={isGm} onDelete={() => onDeleteToken(t.id)} />
              ))}

          {folderTree.length === 0 && looseScenes.length === 0 && looseTokens.length === 0 && (
            <p className="muted lib-empty">
              {isScene ? 'Nenhuma cena ainda.' : 'Nenhum token ainda.'}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function LibraryFolder({
  folder,
  depth,
  isGm,
  kind,
  scenes,
  tokens,
  currentSceneId,
  onOpenScene,
  onCreateScene,
  onDeleteScene,
  onCreateToken,
  onDeleteToken,
  onImport,
  onAddFolder,
  onRenameFolder,
  onDeleteFolder,
}: {
  folder: FolderNode;
  depth: number;
  isGm: boolean;
  kind: FolderKind;
  scenes: SceneDTO[];
  tokens: TokenDTO[];
  currentSceneId?: string;
  onOpenScene: (id: string) => void;
  onCreateScene: (folderId: string | null) => void;
  onDeleteScene: (id: string) => void;
  onCreateToken: (folderId: string | null) => void;
  onDeleteToken: (id: string) => void;
  onImport?: (kind: FolderKind, folderId: string | null) => void;
  onAddFolder: (kind: FolderKind, parentId: string | null) => void;
  onRenameFolder: (f: AssetFolderDTO) => void;
  onDeleteFolder: (f: AssetFolderDTO) => void;
}) {
  const [open, setOpen] = useState(true);
  const isScene = kind === 'SCENE';
  const childScenes = isScene ? scenes.filter((s) => s.folderId === folder.id) : [];
  const childTokens = !isScene ? tokens.filter((t) => t.folderId === folder.id) : [];

  return (
    <div className="lib-folder" style={{ marginLeft: depth * 12 }}>
      <div className="lib-folder-head">
        <button className="lib-folder-toggle" onClick={() => setOpen((v) => !v)}>
          {open ? '📂' : '📁'} {folder.name}
        </button>
        {isGm && (
          <span className="lib-folder-actions">
            <button className="lib-mini" title="Subpasta" onClick={() => onAddFolder(kind, folder.id)}>📁+</button>
            <button
              className="lib-mini"
              title={isScene ? 'Nova cena aqui' : 'Novo token aqui'}
              onClick={() => (isScene ? onCreateScene(folder.id) : onCreateToken(folder.id))}
            >
              ＋
            </button>
            {onImport && (
              <button className="lib-mini" title="Importar imagem" onClick={() => onImport(kind, folder.id)}>⬆</button>
            )}
            <button className="lib-mini" title="Renomear" onClick={() => onRenameFolder(folder)}>✎</button>
            <button className="lib-mini danger" title="Excluir pasta" onClick={() => onDeleteFolder(folder)}>🗑</button>
          </span>
        )}
      </div>

      {open && (
        <div className="lib-folder-body">
          {folder.children.map((child) => (
            <LibraryFolder
              key={child.id}
              folder={child}
              depth={depth + 1}
              isGm={isGm}
              kind={kind}
              scenes={scenes}
              tokens={tokens}
              currentSceneId={currentSceneId}
              onOpenScene={onOpenScene}
              onCreateScene={onCreateScene}
              onDeleteScene={onDeleteScene}
              onCreateToken={onCreateToken}
              onDeleteToken={onDeleteToken}
              onImport={onImport}
              onAddFolder={onAddFolder}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
            />
          ))}

          {isScene
            ? childScenes.map((s) => (
                <SceneRow
                  key={s.id}
                  scene={s}
                  active={s.id === currentSceneId}
                  isGm={isGm}
                  onOpen={() => onOpenScene(s.id)}
                  onDelete={() => onDeleteScene(s.id)}
                />
              ))
            : childTokens.map((t) => (
                <TokenRow key={t.id} token={t} isGm={isGm} onDelete={() => onDeleteToken(t.id)} />
              ))}
        </div>
      )}
    </div>
  );
}

function SceneRow({
  scene,
  active,
  isGm,
  onOpen,
  onDelete,
}: {
  scene: SceneDTO;
  active: boolean;
  isGm: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={`lib-item ${active ? 'active' : ''}`}>
      <button className="lib-item-name" onClick={onOpen} title="Abrir cena">
        🗺️ {scene.name}
      </button>
      {isGm && (
        <button className="lib-mini danger" title="Excluir cena" onClick={onDelete}>🗑</button>
      )}
    </div>
  );
}

function TokenRow({ token, isGm, onDelete }: { token: TokenDTO; isGm: boolean; onDelete: () => void }) {
  const kindIcon =
    token.kind === 'MONSTER' ? '👹' : token.kind === 'NPC' ? '🧑' : token.kind === 'ITEM' ? '💎' : '🛡️';
  return (
    <div className="lib-item">
      <span className="lib-item-name" title={token.name}>
        {token.imageUrl ? <img src={token.imageUrl} alt="" className="lib-thumb" /> : kindIcon} {token.name}
      </span>
      {isGm && (
        <button className="lib-mini danger" title="Remover token" onClick={onDelete}>🗑</button>
      )}
    </div>
  );
}
