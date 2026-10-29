import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { UsersService } from './users.service.js';
import { UpdateProfileDto, UpdatePreferencesDto } from './dto.js';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser('sub') userId: string) {
    return this.users.getProfile(userId);
  }

  @Patch('me')
  updateProfile(@CurrentUser('sub') userId: string, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(userId, dto);
  }

  @Patch('me/preferences')
  updatePreferences(@CurrentUser('sub') userId: string, @Body() dto: UpdatePreferencesDto) {
    return this.users.updatePreferences(userId, dto.preferences ?? {});
  }
}
