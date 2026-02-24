/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-misused-promises */
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { DatabaseClient } from './database/database.client';
import { PaymentProviderFactory } from './payments/providers/payment-provider.factory';
import { ConfigService } from '@nestjs/config';
import { SqsService } from './common/services/sqs.service';
import { PaymentsService } from './payments/payments.service';
import { AwsConfig } from './config/aws.config';
import { EPaymentProvider } from './payments/providers/payment-provider.factory';

class PaymentReconciliationWorker {
  private readonly logger = new Logger(PaymentReconciliationWorker.name);
  private isRunning = false;

  constructor(
    private readonly db: DatabaseClient,
    private readonly sqsService: SqsService,
    private readonly paymentsService: PaymentsService,
    private readonly paymentProviderFactory: PaymentProviderFactory,
    private readonly configService: ConfigService,
  ) { }

  async start(): Promise<void> {
    this.logger.log('Starting Payment Reconciliation Worker (Producer & Consumer)');
    this.isRunning = true;

    // Iniciar el Productor: Busca pagos pendientes periódicamente y los encola
    void this.startProducer();

    // Iniciar el Consumidor: Procesa la cola de reconciliación
    void this.startConsumer();
  }

  stop(): void {
    this.logger.log('Stopping Payment Reconciliation Worker');
    this.isRunning = false;
  }

  /**
   * PRODUCER: Busca pagos pendientes y los envía a SQS
   */
  private async startProducer(): Promise<void> {
    const intervalMs = this.configService.get<number>('RECONCILIATION_INTERVAL_MS', 24 * 60 * 60 * 1000);

    while (this.isRunning) {
      try {
        this.logger.log('Producer: Sweeping for pending payments to reconcile...');

        // Buscamos pagos en estado 'pending' o 'authorized' de las últimas 24 horas
        // que no hayan sido actualizados en la última hora.
        // con unintervalo de 24 horas
        // y que no hayan sido actualizados en la última hora
        // en desarrollo se probrara en intervalos de 1 hora 'INTERVAL '1 hour'' y actualizacion de 1 minuto 'INTERVAL '1 minute''
        const pendingPayments = await this.db.query(`
          SELECT id, provider 
          FROM payments 
          WHERE status IN ('pending', 'authorized')
            AND created_at > NOW() - INTERVAL '24 hours'
            AND updated_at < NOW() - INTERVAL '1 hour'
        `);


        this.logger.log(`Producer: Found ${pendingPayments.rows.length} payments to verify`);

        const awsConfig = this.configService.get<AwsConfig>('aws');
        const queueUrl = awsConfig?.sqsReconciliationUrl;

        if (!queueUrl) {
          this.logger.error('Producer: SQS_RECONCILIATION_URL not configured');
        } else {
          for (const payment of pendingPayments.rows) {
            await this.sqsService.sendMessage(queueUrl, {
              paymentId: payment.id,
              provider: payment.provider,
              timestamp: new Date().toISOString()
            });
          }
          this.logger.log(`Producer: Enqueued ${pendingPayments.rows.length} messages to ${queueUrl}`);
        }

      } catch (error) {
        this.logger.error('Producer error:', error);
      }

      // Esperar hasta el próximo ciclo
      await new Promise(res => setTimeout(res, intervalMs));
    }
  }

  /**
   * CONSUMER: Lee de SQS y procesa cada verificación de pago
   */
  private async startConsumer(): Promise<void> {
    const awsConfig = this.configService.get<AwsConfig>('aws');
    const queueUrl = awsConfig?.sqsReconciliationUrl;

    if (!queueUrl) {
      this.logger.error('Consumer: SQS_RECONCILIATION_URL not configured. Polling skipped.');
      return;
    }

    this.logger.log(`Consumer: Polling from ${queueUrl}...`);

    while (this.isRunning) {
      try {
        const messages = await this.sqsService.receiveMessages(queueUrl, 5, 20);

        for (const message of messages) {
          if (!this.isRunning) break;

          const job = this.sqsService.parseMessageBody<{ paymentId: string; provider: string }>(message);

          if (job && job.paymentId) {
            await this.processReconciliationJob(job.paymentId, job.provider);
          }

          // Eliminar mensaje después de procesar
          if (message.ReceiptHandle) {
            await this.sqsService.deleteMessage(queueUrl, message.ReceiptHandle);
          }
        }
      } catch (error) {
        this.logger.error('Consumer polling error:', error);
        await new Promise(res => setTimeout(res, 5000));
      }
    }
  }

  private async processReconciliationJob(paymentId: string, providerType: string): Promise<void> {
    try {
      this.logger.log(`Consumer: Verifying payment ${paymentId} (${providerType})`);

      await this.db.transaction(async (client) => {
        // 1. Obtener datos actuales del pago
        const paymentRes = await client.query(
          'SELECT id, provider_payment_id, status, booking_id FROM payments WHERE id = $1',
          [paymentId]
        );

        if (paymentRes.rows.length === 0) return;
        const payment = paymentRes.rows[0];

        // 2. Preguntar al proveedor (Wompi/PayPal)
        const provider = this.paymentProviderFactory.getProvider(providerType as EPaymentProvider);
        const providerStatus = await provider.getPaymentStatus(payment.provider_payment_id);

        // 3. Si el estado cambió, actualizar
        if (providerStatus.status !== payment.status) {
          this.logger.log(`Consumer: Updating payment ${paymentId} status: ${payment.status} -> ${providerStatus.status}`);

          await client.query(`
            UPDATE payments 
            SET status = $1::payment_status, 
                provider_metadata = $2, 
                updated_at = NOW(),
                paid_at = CASE WHEN $1::payment_status = 'paid' THEN NOW() ELSE paid_at END,
                authorized_at = CASE WHEN $1::payment_status = 'authorized' THEN NOW() ELSE authorized_at END,
                failed_at = CASE WHEN $1::payment_status = 'failed' THEN NOW() ELSE failed_at END
            WHERE id = $3
          `, [providerStatus.status, JSON.stringify(providerStatus.metadata), paymentId]);

          // 4. USAR LA LÓGICA CENTRALIZADA SI ESTÁ PAGADO
          if (providerStatus.status === 'paid') {
            this.logger.log(`Consumer: Payment ${paymentId} is PAID. Triggering complete booking confirmation.`);
            await this.paymentsService.confirmBookingPayment(client, payment.booking_id);
          }
        } else {
          this.logger.log(`Consumer: Payment ${paymentId} status remains ${payment.status}`);
        }
      });
    } catch (error) {
      this.logger.error(`Error processing job for payment ${paymentId}:`, error);
    }
  }
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const db = DatabaseClient.getInstance();
  const sqsService = app.get(SqsService);
  const paymentsService = app.get(PaymentsService);
  const paymentProviderFactory = app.get(PaymentProviderFactory);
  const configService = app.get(ConfigService);

  const worker = new PaymentReconciliationWorker(
    db,
    sqsService,
    paymentsService,
    paymentProviderFactory,
    configService
  );

  // Manejar señales de terminación
  process.on('SIGINT', async () => {
    worker.stop();
    await app.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    worker.stop();
    await app.close();
    process.exit(0);
  });

  await worker.start();
}

bootstrap().catch(console.error);
