import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PasswordHashService } from './services/password-hash.service';
import { UsersModule } from '../users/users.module';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import { DatabaseModule } from '../database/database.module';
import { CommonModule } from '../common/common.module';

import { FirebaseAdminService } from './services/firebase-admin.service';

@Module({
  imports: [
    ConfigModule,
    UsersModule,
    DatabaseModule,
    CommonModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'dev-secret-change-me'),
        signOptions: {
          algorithm: 'HS256',
        },
      }),
    }),
    EventEmitterModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordHashService, JwtAccessStrategy, FirebaseAdminService], // Added FirebaseAdminService
  exports: [AuthService],
})
export class AuthModule { }
