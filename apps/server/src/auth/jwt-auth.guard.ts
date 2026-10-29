import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { TokenService, type AccessPayload } from './token.service.js';

export interface AuthedRequest extends Request {
  user: AccessPayload;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Autenticação necessária.');
    }
    const token = header.slice('Bearer '.length).trim();
    req.user = this.tokens.verifyAccess(token);
    return true;
  }
}
