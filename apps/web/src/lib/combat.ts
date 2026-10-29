import { api } from './api.js';

export interface Combatant {
  id: string;
  name: string;
  tokenId: string | null;
  characterId: string | null;
  initiative: number;
  order: number;
  hp: number;
  maxHp: number;
  conditions: string[];
  isNpc: boolean;
}

export interface Encounter {
  id: string;
  campaignId: string;
  sceneId: string | null;
  name: string;
  round: number;
  turnIndex: number;
  isActive: boolean;
  combatants: Combatant[];
  currentCombatantId: string | null;
}

const base = (c: string) => `/campaigns/${c}/combat`;

export const combatApi = {
  get: (c: string) => api(base(c)) as Promise<Encounter | null>,
  create: (c: string, body: { name?: string; sceneId?: string; combatants?: any[] }) =>
    api(base(c), { method: 'POST', body: JSON.stringify(body) }) as Promise<Encounter>,
  addCombatant: (c: string, body: { name: string; initiative?: number; hp?: number; maxHp?: number; isNpc?: boolean }) =>
    api(`${base(c)}/combatants`, { method: 'POST', body: JSON.stringify(body) }) as Promise<Encounter>,
  nextTurn: (c: string) => api(`${base(c)}/next-turn`, { method: 'POST' }) as Promise<Encounter>,
  damage: (c: string, id: string, amount: number) =>
    api(`${base(c)}/combatants/${id}/damage`, { method: 'POST', body: JSON.stringify({ amount }) }) as Promise<Encounter>,
  update: (c: string, id: string, body: Partial<{ initiative: number; hp: number; maxHp: number; conditions: string[] }>) =>
    api(`${base(c)}/combatants/${id}`, { method: 'POST', body: JSON.stringify(body) }) as Promise<Encounter>,
  remove: (c: string, id: string) =>
    api(`${base(c)}/combatants/${id}`, { method: 'DELETE' }) as Promise<Encounter>,
  end: (c: string) => api(base(c), { method: 'DELETE' }),
};
