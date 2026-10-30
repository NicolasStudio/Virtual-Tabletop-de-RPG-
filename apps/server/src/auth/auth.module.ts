import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { TokenService } from './token.service.js';
import { FirebaseTokenService } from './firebase-token.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { UsersController } from '../users/users.controller.js';
import { UsersService } from '../users/users.service.js';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController, UsersController],
  providers: [AuthService, TokenService, FirebaseTokenService, JwtAuthGuard, UsersService],
  exports: [TokenService, JwtAuthGuard],
})
export class AuthModule {}
