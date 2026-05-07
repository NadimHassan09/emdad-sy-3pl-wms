import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { CryptoModule } from '../../common/crypto/crypto.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RolesGuard } from '../../common/auth/roles.guard';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UserActivityService } from './user-activity.service';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') ?? 'dev-only-change-in-production',
        // Per-token `expiresIn` is set in `AuthService.login`; keep module default for any other signers.
        signOptions: { expiresIn: 8 * 60 * 60 },
      }),
    }),
    PrismaModule,
    CryptoModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RolesGuard, UserActivityService],
  exports: [AuthService, JwtModule, RolesGuard, UserActivityService],
})
export class AuthModule {}
