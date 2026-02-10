import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../../database/database.module';
import { REFRESH_TOKEN_REPOSITORY, PASSWORD_RESET_TOKEN_REPOSITORY } from './domain/repositories/index';
import { RefreshTokenRepository, PasswordResetTokenRepository } from './infrastructure/persistence/index';
import { AuthApplicationService } from './application/auth-application.service';
import { USER_REPOSITORY } from '../identity/domain/repositories/user.repository.interface';
import { UserRepository } from '../identity/infrastructure/persistence/user.repository';
import { UserMapper } from '../identity/infrastructure/persistence/user.mapper';
import { PasswordHashService } from '../../auth/services/password-hash.service';
import { FirebaseAdminService } from '../../auth/services/firebase-admin.service';
import { CustomLoggerService } from '../../common/services/logger.service';
import { JwtAccessStrategy } from '../../auth/strategies/jwt-access.strategy';

@Module({
    imports: [
        DatabaseModule,
        ConfigModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                secret: configService.get<string>('JWT_SECRET', 'dev-secret-change-me'),
                signOptions: { expiresIn: '15m' },
            }),
        }),
    ],
    providers: [
        JwtAccessStrategy,
        {
            provide: REFRESH_TOKEN_REPOSITORY,
            useClass: RefreshTokenRepository,
        },
        {
            provide: PASSWORD_RESET_TOKEN_REPOSITORY,
            useClass: PasswordResetTokenRepository,
        },
        {
            provide: USER_REPOSITORY,
            useClass: UserRepository,
        },
        AuthApplicationService,
        PasswordHashService,
        FirebaseAdminService,
        CustomLoggerService,
        UserMapper,
    ],
    exports: [
        REFRESH_TOKEN_REPOSITORY,
        PASSWORD_RESET_TOKEN_REPOSITORY,
        AuthApplicationService,
    ],
})
export class AuthDddModule { }
