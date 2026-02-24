import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SqsService } from './common/services/sqs.service';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments/payments.service';
import { AwsConfig } from './config/aws.config';

async function bootstrap() {
    // Creamos un contexto de aplicación de Nest para poder usar sus servicios
    const app = await NestFactory.createApplicationContext(AppModule);
    const configService = app.get(ConfigService);
    const sqsService = app.get(SqsService);
    const paymentsService = app.get(PaymentsService);

    const awsConfig = configService.get<AwsConfig>('aws');
    const webhooksQueueUrl = awsConfig?.sqsWebhooksUrl;

    if (!webhooksQueueUrl) {
        console.error('[worker] SQS_WEBHOOKS_URL no está configurada. Abortando.');
        process.exit(1);
    }

    console.log('[worker] Worker de Webhooks (SQS) iniciado...');

    let running = true;

    const shutdown = async () => {
        console.log('[worker] apagando...');
        running = false;
        await app.close();
        process.exit(0);
    };
    process.on('SIGINT', () => void shutdown());
    process.on('SIGTERM', () => void shutdown());

    // Bucle infinito de polling
    // eslint-disable-next-line no-constant-condition
    while (running) {
        try {
            const messages = await sqsService.receiveMessages(webhooksQueueUrl, 5, 10, 20);
            console.log(`[worker] Mensajes recibidos: ${messages.length}`);


            if (messages.length === 0) {
                // No hay mensajes, esperamos un poco
                continue;
            }

            // Procesar mensajes en paralelo
            await Promise.all(messages.map(async (message) => {
                const messageId = message.MessageId;

                try {
                    const body = JSON.parse(message.Body || '{}');
                    const eventId = body.eventId;

                    if (!eventId) {
                        console.warn(`[worker] Mensaje sin eventId (${messageId}) -> Eliminando`);
                        if (message.ReceiptHandle) {
                            await sqsService.deleteMessage(webhooksQueueUrl, message.ReceiptHandle);
                        }
                        return;
                    }

                    // Ejecutar la lógica de negocio real en el PaymentsService
                    await paymentsService.handleWebhookAsync(eventId);

                    // Si no hubo error, confirmamos el mensaje
                    if (message.ReceiptHandle) {
                        await sqsService.deleteMessage(webhooksQueueUrl, message.ReceiptHandle);
                    }

                } catch (err) {
                    console.error(`[worker] Error procesando mensaje ${messageId}:`, err);
                    // SQS reintentará el mensaje automáticamente después del VisibilityTimeout
                }
            }));
        } catch (error) {
            console.error('[worker] Error crítico en el loop de polling:', error);
            await new Promise(res => setTimeout(res, 5000));
        }
    }
}



bootstrap().catch(err => {
    console.error('[worker] Error fatal en bootstrap:', err);
    process.exit(1);
});
