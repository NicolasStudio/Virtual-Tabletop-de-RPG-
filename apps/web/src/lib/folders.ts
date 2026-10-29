import { api } from './api.js';
import type { AssetFolderDTO, FolderKind } from '@tabletop/shared';

export const foldersApi = {
  list: (campaignId: string, kind?: FolderKind) =>
    api(`/campaigns/${campaignId}/folders${kind ? `?kind=${kind}` : ''}`) as Promise<AssetFolderDTO[]>,

  create: (campaignId: string, data: { kind: FolderKind; name: string; parentId?: string | null }) =>
    api(`/campaigns/${campaignId}/folders`, {
      method: 'POST',
      body: JSON.stringify(data),
    }) as Promise<AssetFolderDTO>,

  update: (campaignId: string, folderId: string, data: Partial<{ name: string; parentId: string | null; order: number }>) =>
    api(`/campaigns/${campaignId}/folders/${folderId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }) as Promise<AssetFolderDTO>,

  remove: (campaignId: string, folderId: string) =>
    api(`/campaigns/${campaignId}/folders/${folderId}`, { method: 'DELETE' }),
};

// Monta a árvore (pastas-raiz + filhas) a partir da lista plana.
export interface FolderNode extends AssetFolderDTO {
  children: FolderNode[];
}

export function buildFolderTree(folders: AssetFolderDTO[]): FolderNode[] {
  const byId = new Map<string, FolderNode>();
  folders.forEach((f) => byId.set(f.id, { ...f, children: [] }));
  const roots: FolderNode[] = [];
  byId.forEach((node) => {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}
