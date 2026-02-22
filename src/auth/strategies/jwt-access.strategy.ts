import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy) {
    constructor(
        configService: ConfigService,
        private readonly usersService: UsersService,
    ) {
        const secret = configService.get<string>('JWT_SECRET');

        super({


            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: secret ?? 'dev-secret-change-me',
        });
    }

    async validate(payload: JwtPayload): Promise<JwtPayload & { id: string }> {
        if (payload.tokenType !== 'access') {
            throw new UnauthorizedException('Invalid access token');
        }

        const user = await this.usersService.findById(payload.sub);
        if (!user || user.isActive === false) {
            throw new UnauthorizedException('Su cuenta fue inactivada porque infringe las politicas y condiciones');
        }

        // Map 'sub' to 'id' for easier access in controllers
        return {
            ...payload,
            id: payload.sub,
        };
    }
}
