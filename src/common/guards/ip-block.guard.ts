import {
    CanActivate,
    ExecutionContext,
    Injectable,
    ForbiddenException,
    Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyRequest } from 'fastify';

@Injectable()
export class IpBlockGuard implements CanActivate {
    private readonly logger = new Logger(IpBlockGuard.name);
    private blockedIps: Set<string>;

    constructor(private readonly configService: ConfigService) {
        // Obtenemos las IPs bloqueadas desde la variable de entorno BLOCKED_IPS
        // Formato esperado: "1.2.3.4,5.6.7.8"
        const blockedIpsString = this.configService.get<string>('BLOCKED_IPS', '');
        this.blockedIps = new Set(
            blockedIpsString.split(',').map((ip) => ip.trim()).filter((ip) => ip.length > 0)
        );

        // Agregar IPs manualmente aquí si es urgente y no quieres reiniciar con variables
        // this.blockedIps.add("IP_ATACANTE");
    }

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<FastifyRequest>();
        const ip = this.extractIp(request);

        if (ip && this.blockedIps.has(ip)) {
            this.logger.warn(`Blocked request from blocked IP: ${ip} asking for ${request.url}`);
            throw new ForbiddenException('Access denied for this IP address');
        }

        return true;
    }

    private extractIp(request: FastifyRequest): string | undefined {
        // Lógica similar a auth.controller para extraer IP real tras proxies
        const xff = request.headers['x-forwarded-for'];

        if (typeof xff === 'string') {
            return xff.split(',')[0].trim();
        }

        if (Array.isArray(xff)) {
            return xff[0];
        }

        return request.ip;
    }
}
