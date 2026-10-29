import { api } from './api.js';
import type { SceneDTO, TokenDTO } from '@tabletop/shared';

export const scenesApi = {
  list: (campaignId: string) =>
    api(`/campaigns/${campaignId}/scenes`) as Promise<SceneDTO[]>,
  create: (campaignId: string, data: Partial<SceneDTO> & { name: string }) =>
    api(`/campaigns/${campaignId}/scenes`, { method: 'POST', body: JSON.stringify(data) }) as Promise<SceneDTO>,
  get: (campaignId: string, sceneId: string) =>
    api(`/campaigns/${campaignId}/scenes/${sceneId}`) as Promise<{ scene: SceneDTO; tokens: TokenDTO[] }>,
  update: (campaignId: string, sceneId: string, data: Partial<SceneDTO>) =>
    api(`/campaigns/${campaignId}/scenes/${sceneId}`, { method: 'PATCH', body: JSON.stringify(data) }) as Promise<SceneDTO>,
  remove: (campaignId: string, sceneId: string) =>
    api(`/campaigns/${campaignId}/scenes/${sceneId}`, { method: 'DELETE' }),

  createToken: (campaignId: string, sceneId: string, data: { name: string } & Partial<TokenDTO>) =>
    api(`/campaigns/${campaignId}/scenes/${sceneId}/tokens`, { method: 'POST', body: JSON.stringify(data) }) as Promise<TokenDTO>,  updateToken: (campaignId: string, sceneId: string, tokenId: string, data: Partial<TokenDTO>) =>
    api(`/campaigns/${campaignId}/scenes/${sceneId}/tokens/${tokenId}`, { method: 'PATCH', body: JSON.stringify(data) }) as Promise<TokenDTO>,
  removeToken: (campaignId: string, sceneId: string, tokenId: string) =>
    api(`/campaigns/${campaignId}/scenes/${sceneId}/tokens/${tokenId}`, { method: 'DELETE' }),
};

// snapping à grade (quadrada). Devolve o canto superior-esquerdo encaixado.
export function snapToGrid(
  x: number,
  y: number,
  gridSize: number,
  enabled: boolean,
): { x: number; y: number } {
  if (!enabled || gridSize <= 0) return { x, y };
  return {
    x: Math.round(x / gridSize) * gridSize,
    y: Math.round(y / gridSize) * gridSize,
  };
}
