import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthedRequest } from './jwt-auth.guard.js';
import type { AccessPayload } from './token.service.js';

/** Injeta o payload do usuário autenticado (ou um campo dele) no handler. */
export const CurrentUser = createParamDecorator(
  (data: keyof AccessPayload | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    return data ? req.user?.[data] : req.user;
  },
);
