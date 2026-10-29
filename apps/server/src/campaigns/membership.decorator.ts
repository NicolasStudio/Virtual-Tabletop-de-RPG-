import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { CampaignRole } from '@tabletop/shared';

export interface Membership {
  campaignId: string;
  role: CampaignRole;
}

/** Lê a membership resolvida pelo CampaignRoleGuard e injetada no request. */
export const CampaignMembership = createParamDecorator(
  (data: keyof Membership | undefined, ctx: ExecutionContext): Membership | CampaignRole | string => {
    const req = ctx.switchToHttp().getRequest<{ membership: Membership }>();
    return data ? req.membership[data] : req.membership;
  },
);
