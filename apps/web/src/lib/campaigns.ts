import { api } from './api.js';
import type { CampaignSummary, CampaignRole } from '@tabletop/shared';

export interface CampaignMemberView {
  userId: string;
  role: CampaignRole;
  displayName: string;
  avatarUrl?: string | null;
  joinedAt: string;
}

export interface CampaignDetail {
  id: string;
  name: string;
  description?: string | null;
  system: string;
  ownerId: string;
  activeSceneId?: string | null;
  members: CampaignMemberView[];
}

export interface InviteView {
  id: string;
  code: string;
  role: 'PLAYER' | 'SPECTATOR';
  maxUses: number | null;
  uses: number;
  expiresAt: string | null;
}

export const campaignsApi = {
  list: () => api('/campaigns') as Promise<CampaignSummary[]>,
  create: (name: string, description?: string, system?: string) =>
    api('/campaigns', { method: 'POST', body: JSON.stringify({ name, description, system }) }),
  detail: (id: string) => api(`/campaigns/${id}`) as Promise<CampaignDetail>,
  update: (id: string, data: Partial<{ name: string; description: string; system: string }>) =>
    api(`/campaigns/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => api(`/campaigns/${id}`, { method: 'DELETE' }),
  leave: (id: string) => api(`/campaigns/${id}/leave`, { method: 'POST' }),
  joinByCode: (code: string) =>
    api('/campaigns/join', { method: 'POST', body: JSON.stringify({ code }) }) as Promise<{
      campaignId: string;
      role: CampaignRole;
      alreadyMember: boolean;
    }>,
  createInvite: (id: string, opts: { role?: 'PLAYER' | 'SPECTATOR'; maxUses?: number; expiresInHours?: number }) =>
    api(`/campaigns/${id}/invites`, { method: 'POST', body: JSON.stringify(opts) }) as Promise<InviteView>,
  listInvites: (id: string) => api(`/campaigns/${id}/invites`) as Promise<InviteView[]>,
  revokeInvite: (id: string, inviteId: string) =>
    api(`/campaigns/${id}/invites/${inviteId}`, { method: 'DELETE' }),
  updateMemberRole: (id: string, userId: string, role: CampaignRole) =>
    api(`/campaigns/${id}/members/${userId}`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  removeMember: (id: string, userId: string) =>
    api(`/campaigns/${id}/members/${userId}`, { method: 'DELETE' }),
};
