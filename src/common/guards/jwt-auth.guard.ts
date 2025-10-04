import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    constructor(private readonly reflector: Reflector) {
        super();
    }

    canActivate(context: ExecutionContext) {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (isPublic) {
            return true;
        }

        return super.canActivate(context);
    }

    handleRequest<TUser = JwtPayload>(
        err: unknown,
        user: TUser | false | null | undefined,
        info?: unknown,
    ): TUser {
        if (err) {
            if (err instanceof Error) {
                throw err;
            }

            throw new UnauthorizedException();
        }

        if (!user) {
            const message = typeof info === 'string' ? info : undefined;
            throw new UnauthorizedException(message);
        }

        return user;
    }
}
