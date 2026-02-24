/* eslint-disable @typescript-eslint/no-misused-promises */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SqsService } from './common/services/sqs.service';
import { EmailService } from './notifications/services/email.service';
import { NotificationJob } from './notifications/services/notification-queue.service';
import { ConfigService } from '@nestjs/config';
import { AwsConfig } from './config/aws.config';
import { Pool } from 'pg';

// ---- ENV ----
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://livex:livex@db:5432/livex';

async function main() {
    console.log('[notification-worker] iniciando...');

    // NestJS context para obtener servicios configurados
    const app = await NestFactory.createApplicationContext(AppModule, {
        logger: ['error', 'warn', 'log'],
    });

    const sqsService = app.get(SqsService);
    const configService = app.get(ConfigService);
    const awsConfig = configService.get<AwsConfig>('aws');

    if (!awsConfig) {
        throw new Error('AWS config no disponible');
    }

    // DB
    const db = new Pool({ connectionString: DATABASE_URL });
    await db.query('select 1');
    console.log('[notification-worker] DB conectada');

    // Email Service
    const emailService = new EmailService();
    await emailService.testConnection();
    console.log('[notification-worker] Email service inicializado');

    // Colas SQS por prioridad (se procesan en orden: high → medium → low)
    const queues = [
        { name: 'high', url: awsConfig.sqsNotificationsHighUrl },
        { name: 'medium', url: awsConfig.sqsNotificationsMediumUrl },
        { name: 'low', url: awsConfig.sqsNotificationsLowUrl },
    ].filter(q => !!q.url);

    if (queues.length === 0) {
        throw new Error('No hay colas SQS de notificaciones configuradas');
    }

    console.log(`[notification-worker] listo. Escuchando ${queues.length} colas SQS: [${queues.map(q => q.name).join(', ')}]`);

    let running = true;

    // ----- Polling Loop -----
    const poll = async () => {
        while (running) {
            let processedAny = false;

            for (const queue of queues) {
                if (!running) break;

                if (!queue.url) continue;

                try {

                    // Long polling: espera hasta 20s si no hay mensajes
                    // Recibe hasta 5 mensajes por batch
                    const messages = await sqsService.receiveMessages(
                        queue.url,
                        5,       // maxMessages
                        20,      // waitTimeSeconds (long polling)
                        120,     // visibilityTimeout (2 min para procesar)
                    );

                    for (const message of messages) {
                        if (!running) break;

                        const job = sqsService.parseMessageBody<NotificationJob>(message);

                        if (!job) {
                            console.warn('[notification-worker] mensaje con body inválido → eliminando');
                            if (message.ReceiptHandle && queue.url) {
                                await sqsService.deleteMessage(queue.url, message.ReceiptHandle);
                            }
                            continue;
                        }

                        console.log(`[notification-worker] procesando job ${job.id} desde ${queue.name}`);

                        // Validar tipo
                        if (job.type !== 'email') {
                            console.warn(`[notification-worker] tipo de job no soportado: ${job.type}`);
                            if (message.ReceiptHandle && queue.url) {
                                await sqsService.deleteMessage(queue.url, message.ReceiptHandle);
                            }
                            continue;
                        }

                        try {
                            const success = await emailService.sendEmail(job.payload);

                            if (success) {
                                // Email enviado exitosamente → eliminar mensaje (ack)
                                if (message.ReceiptHandle && queue.url) {
                                    await sqsService.deleteMessage(queue.url, message.ReceiptHandle);
                                    console.log(`[notification-worker] email eliminado de SQS: ${job.id}`);
                                }
                                console.log(`[notification-worker] email enviado exitosamente: ${job.id}`);
                                await logEmailSent(db, job, 'sent');
                                processedAny = true;
                            } else {
                                // Error al enviar email → NO eliminar, SQS reintentará
                                // Después de N reintentos (configurado en la cola), irá a la DLQ
                                console.error(`[notification-worker] error enviando email: ${job.id}`);
                                // El ApproximateReceiveCount de SQS maneja los reintentos automáticamente
                                const receiveCount = parseInt(message.Attributes?.ApproximateReceiveCount || '1');
                                console.warn(`[notification-worker] intento ${receiveCount}/${job.maxAttempts} para job ${job.id}`);
                                await logEmailSent(db, job, receiveCount >= job.maxAttempts ? 'failed' : 'retrying');
                            }
                        } catch (err) {
                            console.error(`[notification-worker] error procesando job ${job.id}:`, err);
                            // No eliminar → SQS reintentará automáticamente
                        }
                    }
                } catch (err) {
                    console.error(`[notification-worker] error polling cola ${queue.name}:`, err);
                    // Esperar un poco antes de reintentar en caso de error de conexión
                    await new Promise(res => setTimeout(res, 5000));
                }
            }

            // Si no se procesó nada en ninguna cola, pequeña pausa antes del siguiente ciclo
            // (el long polling de SQS ya da la espera principal)
            if (!processedAny) {
                await new Promise(res => setTimeout(res, 1000));
            }
        }
    };

    // Iniciar polling
    void poll();

    // Graceful shutdown
    const shutdown = async () => {
        console.log('[notification-worker] apagando...');
        running = false;
        try {
            await db.end();
        } catch { /* empty */ }
        try {
            await app.close();
        } catch { /* empty */ }
        process.exit(0);
    };

    process.on('SIGINT', () => {
        void shutdown();
    });
    process.on('SIGTERM', () => {
        void shutdown();
    });
}

// Función para registrar el estado del envío de email en la DB
async function logEmailSent(
    db: Pool,
    job: NotificationJob,
    status: 'sent' | 'failed' | 'retrying'
): Promise<void> {
    try {
        const client = await db.connect();
        try {
            await client.query(`
                INSERT INTO email_logs (
                    job_id, 
                    recipient, 
                    template_type, 
                    status, 
                    attempts, 
                    created_at,
                    updated_at
                ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
                ON CONFLICT (job_id) 
                DO UPDATE SET 
                    status = EXCLUDED.status,
                    attempts = EXCLUDED.attempts,
                    updated_at = NOW()
            `, [
                job.id,
                job.payload.to,
                job.payload.templateType,
                status,
                job.attempts
            ]);
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('[notification-worker] error logging email status:', error);
        // No lanzar error para no afectar el procesamiento principal
    }
}

main().catch((e) => {
    console.error('[notification-worker] fatal', e);
    process.exit(1);
});
