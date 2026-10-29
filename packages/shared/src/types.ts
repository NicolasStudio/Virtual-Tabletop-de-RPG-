// Tipos de domínio compartilhados entre web e server.
// Fonte única de verdade dos contratos. NÃO importa nada de runtime do servidor.

export type CampaignRole = 'GM' | 'PLAYER' | 'SPECTATOR';
export type GridType = 'SQUARE' | 'HEX' | 'NONE';
export type RollVisibility = 'PUBLIC' | 'GM' | 'PRIVATE';

// Organização em pastas (biblioteca da campanha)
export type FolderKind = 'SCENE' | 'MAP' | 'TOKEN' | 'ITEM';
export type TokenKind = 'CHARACTER' | 'MONSTER' | 'NPC' | 'ITEM';

export interface AssetFolderDTO {
  id: string;
  campaignId: string;
  kind: FolderKind;
  name: string;
  parentId?: string | null;
  order: number;
}

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  isAdmin: boolean;
}

export interface CampaignSummary {
  id: string;
  name: string;
  description?: string | null;
  system: string;
  role: CampaignRole; // papel do usuário atual nesta campanha
  activeSceneId?: string | null;
}

export interface SceneDTO {
  id: string;
  campaignId: string;
  folderId?: string | null;
  name: string;
  backgroundAssetId?: string | null;
  backgroundUrl?: string | null; // URL resolvida do asset de fundo (cenário)
  width: number;
  height: number;
  gridType: GridType;
  gridSize: number;
  gridColor: string;
  scale: number;
}

export interface TokenDTO {
  id: string;
  sceneId: string;
  folderId?: string | null;
  kind?: TokenKind;
  characterId?: string | null;
  ownerUserId?: string | null;
  name: string;
  imageAssetId?: string | null;
  imageUrl?: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  layer: string;
  isLocked: boolean;
  isHidden: boolean; // o servidor remove tokens ocultos do payload de jogadores
  groupId?: string | null;
  stats: Record<string, unknown>;
}

// Ficha genérica, multi-sistema. `attributes` é livre por sistema; os campos
// comuns (hp/mana/defesa) são opcionais para a barra rápida de token e combate.
export interface CharacterSheet {
  hp?: { current: number; max: number };
  mana?: { current: number; max: number };
  defense?: number;
  attributes?: Record<string, number | string>;
  skills?: Record<string, number>;
  inventory?: InventoryItem[];
  conditions?: string[];
  notes?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  weight?: number;
  equipped?: boolean;
  data?: Record<string, unknown>;
}

export interface DiceRollDTO {
  id: string;
  campaignId: string;
  userId: string;
  userDisplayName?: string;
  formula: string;
  result: number;
  breakdown: RollBreakdown;
  visibility: RollVisibility;
  createdAt: string;
}

export interface RollBreakdown {
  dice: { sides: number; rolls: number[]; kept: number[] }[];
  modifier: number;
  total: number;
  notation: string;
}

export interface ChatMessageDTO {
  id: string;
  campaignId: string;
  userId: string;
  userDisplayName?: string;
  body: string;
  toUserId?: string | null;
  rollId?: string | null;
  createdAt: string;
}
