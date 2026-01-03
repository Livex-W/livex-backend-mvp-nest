import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy) {
    constructor(configService: ConfigService) {
        const secret = configService.get<string>('JWT_SECRET');

        super({

             
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: secret ?? 'dev-secret-change-me',
        });
    }

    validate(payload: JwtPayload): JwtPayload & { id: string } {
        if (payload.tokenType !== 'access') {
            throw new UnauthorizedException('Invalid access token');
        }

        // Map 'sub' to 'id' for easier access in controllers
        return {
            ...payload,
            id: payload.sub,
        };
    }
}
