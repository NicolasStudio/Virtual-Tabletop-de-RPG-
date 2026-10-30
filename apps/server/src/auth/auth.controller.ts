import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { TokenService } from './token.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { CurrentUser } from './current-user.decorator.js';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  FirebaseLoginDto,
} from './dto.js';

const REFRESH_COOKIE = 'tt_refresh';

// Temas da Ficha Ordem Paranormal que o Tabletop sabe mostrar (apps/web/src/theme.css)
const THEMES = ['classico', 'sangue', 'morte', 'conhecimento', 'energia'];

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
  ) {}

  private setRefreshCookie(res: Response, raw: string, expiresAt: Date) {
    res.cookie(REFRESH_COOKIE, raw, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: 'lax',
      domain: process.env.COOKIE_DOMAIN || undefined,
      expires: expiresAt,
      path: '/api/auth',
    });
  }

  private clearRefreshCookie(res: Response) {
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  }

  @Post('register')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refresh, user } = await this.auth.register(
      dto.email,
      dto.displayName,
      dto.password,
    );
    this.setRefreshCookie(res, refresh.raw, refresh.expiresAt);
    return { accessToken, user };
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refresh, user } = await this.auth.login(dto.email, dto.password);
    this.setRefreshCookie(res, refresh.raw, refresh.expiresAt);
    return { accessToken, user };
  }

  /**
   * Login pela Ficha: a página tabletop.html da Ficha envia um formulário com o
   * ID token do Firebase. Abre a sessão (cookie) e redireciona para o app; em
   * erro, volta para /login com a mensagem. Endereços relativos: funciona atrás
   * do proxy do Vite e do túnel (mesma origem do app).
   */
  @Post('firebase')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async firebase(@Body() dto: FirebaseLoginDto, @Res() res: Response) {
    try {
      const { refresh } = await this.auth.loginWithFirebase(dto.idToken, dto.name);
      this.setRefreshCookie(res, refresh.raw, refresh.expiresAt);
      const theme = dto.theme && THEMES.includes(dto.theme) ? `?tema=${dto.theme}` : '';
      res.redirect(303, `/${theme}`);
    } catch (e: any) {
      const message = e?.status && e.status < 500 ? e.message : 'Não foi possível entrar pela Ficha.';
      if (!e?.status || e.status >= 500) console.error('[tabletop] login pela Ficha falhou:', e);
      // Não deixa aberta a sessão de quem usou este navegador antes
      this.clearRefreshCookie(res);
      res.redirect(303, `/login?erro=${encodeURIComponent(message)}`);
    }
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.[REFRESH_COOKIE];
    const { accessToken, refresh, user } = await this.auth.refresh(raw);
    this.setRefreshCookie(res, refresh.raw, refresh.expiresAt);
    return { accessToken, user };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE]);
    this.clearRefreshCookie(res);
    return { ok: true };
  }

  @Post('forgot-password')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async forgot(@Body() dto: ForgotPasswordDto) {
    // Resposta sempre neutra; devToken só aparece fora de produção.
    return this.auth.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async reset(@Body() dto: ResetPasswordDto) {
    await this.auth.resetPassword(dto.token, dto.password);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser('sub') userId: string) {
    return this.auth.me(userId);
  }
}
