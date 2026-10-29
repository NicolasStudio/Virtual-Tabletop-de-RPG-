import { api } from './api.js';
import type { SceneDTO, TokenDTO, MapOverlayDTO, SceneFogDTO } from '@tabletop/shared';

export const scenesApi = {
  list: (campaignId: string) =>
    api(`/campaigns/${campaignId}/scenes`) as Promise<SceneDTO[]>,
  create: (campaignId: string, data: Partial<SceneDTO> & { name: string }) =>
    api(`/campaigns/${campaignId}/scenes`, { method: 'POST', body: JSON.stringify(data) }) as Promise<SceneDTO>,
  get: (campaignId: string, sceneId: string) =>
    api(`/campaigns/${campaignId}/scenes/${sceneId}`) as Promise<{ scene: SceneDTO; tokens: TokenDTO[]; overlays: MapOverlayDTO[]; fog: SceneFogDTO }>,
  update: (campaignId: string, sceneId: string, data: Partial<SceneDTO>) =>
    api(`/campaigns/${campaignId}/scenes/${sceneId}`, { method: 'PATCH', body: JSON.stringify(data) }) as Promise<SceneDTO>,
  remove: (campaignId: string, sceneId: string) =>
    api(`/campaigns/${campaignId}/scenes/${sceneId}`, { method: 'DELETE' }),

  activate: (campaignId: string, sceneId: string) =>
    api(`/campaigns/${campaignId}/scenes/${sceneId}/activate`, { method: 'POST' }) as Promise<{ ok: boolean; activeSceneId: string }>,

  createToken: (campaignId: string, sceneId: string, data: { name: string } & Partial<TokenDTO>) =>
    api(`/campaigns/${campaignId}/scenes/${sceneId}/tokens`, { method: 'POST', body: JSON.stringify(data) }) as Promise<TokenDTO>,
  updateToken: (campaignId: string, sceneId: string, tokenId: string, data: Partial<TokenDTO>) =>
    api(`/campaigns/${campaignId}/scenes/${sceneId}/tokens/${tokenId}`, { method: 'PATCH', body: JSON.stringify(data) }) as Promise<TokenDTO>,
  removeToken: (campaignId: string, sceneId: string, tokenId: string) =>
    api(`/campaigns/${campaignId}/scenes/${sceneId}/tokens/${tokenId}`, { method: 'DELETE' }),

  // mapas-overlay (manipulados só pelo GM)
  createOverlay: (campaignId: string, sceneId: string, data: Partial<MapOverlayDTO>) =>
    api(`/campaigns/${campaignId}/scenes/${sceneId}/overlays`, { method: 'POST', body: JSON.stringify(data) }) as Promise<MapOverlayDTO>,
  updateOverlay: (campaignId: string, sceneId: string, overlayId: string, data: Partial<MapOverlayDTO>) =>
    api(`/campaigns/${campaignId}/scenes/${sceneId}/overlays/${overlayId}`, { method: 'PATCH', body: JSON.stringify(data) }) as Promise<MapOverlayDTO>,
  removeOverlay: (campaignId: string, sceneId: string, overlayId: string) =>
    api(`/campaigns/${campaignId}/scenes/${sceneId}/overlays/${overlayId}`, { method: 'DELETE' }),

  // névoa de guerra (modelo A, por células) — só GM muta
  getFog: (campaignId: string, sceneId: string) =>
    api(`/campaigns/${campaignId}/scenes/${sceneId}/fog`) as Promise<SceneFogDTO>,
  setFogEnabled: (campaignId: string, sceneId: string, enabled: boolean) =>
    api(`/campaigns/${campaignId}/scenes/${sceneId}/fog/enabled`, { method: 'POST', body: JSON.stringify({ enabled }) }) as Promise<SceneFogDTO>,
  paintFog: (campaignId: string, sceneId: string, cells: string[], mode: 'reveal' | 'hide') =>
    api(`/campaigns/${campaignId}/scenes/${sceneId}/fog/paint`, { method: 'POST', body: JSON.stringify({ cells, mode }) }) as Promise<SceneFogDTO>,
  brushFog: (campaignId: string, sceneId: string, dots: { x: number; y: number; r: number }[], mode: 'reveal' | 'hide') =>
    api(`/campaigns/${campaignId}/scenes/${sceneId}/fog/brush`, { method: 'POST', body: JSON.stringify({ dots, mode }) }) as Promise<SceneFogDTO>,
  resetFog: (campaignId: string, sceneId: string, revealAll: boolean) =>
    api(`/campaigns/${campaignId}/scenes/${sceneId}/fog/reset`, { method: 'POST', body: JSON.stringify({ revealAll }) }) as Promise<SceneFogDTO>,
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
