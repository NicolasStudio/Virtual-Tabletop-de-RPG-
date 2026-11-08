import type { FolderKind } from '@tabletop/shared';

// Tipo de arraste dos itens da biblioteca, um por seção: uma pasta só aceita itens
// da própria seção, e o mapa aceita tokens e itens (LibraryPanel e MapEditor).
export const libraryDragType = (kind: FolderKind) => `application/x-tabletop-${kind.toLowerCase()}`;

/** Seções que podem ser soltas no mapa (cria o token lá, ou uma cópia). */
export const MAP_DROP_KINDS: FolderKind[] = ['TOKEN', 'ITEM'];
