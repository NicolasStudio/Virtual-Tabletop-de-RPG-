import { SetMetadata } from '@nestjs/common';
import type { CampaignRole } from '@tabletop/shared';

export const ROLES_KEY = 'campaign_roles';

/**
 * Exige que o usuário seja membro da campanha com um dos papéis listados.
 * Ex.: @RequireRole('GM') ou @RequireRole('GM', 'PLAYER').
 * A campanha é resolvida pelo parâmetro de rota :campaignId (ou :id).
 */
export const RequireRole = (...roles: CampaignRole[]) => SetMetadata(ROLES_KEY, roles);
