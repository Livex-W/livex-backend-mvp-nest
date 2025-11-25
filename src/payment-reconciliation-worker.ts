/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-misused-promises */
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { DatabaseClient } from './database/database.client';
import { PaymentProviderFactory } from './payments/providers/payment-provider.factory';
import { ConfigService } from '@nestjs/config';

interface PaymentSummary {
  provider: string;
  date: string;
  total_payments: number;
  total_amount_cents: number;
  reconciled_payments: number;
  reconciled_amount_cents: number;
  discrepancies_count: number;
}

class PaymentReconciliationWorker {
  private readonly logger = new Logger(PaymentReconciliationWorker.name);
  private isRunning = false;

  constructor(
    private readonly db: DatabaseClient,
    private readonly paymentProviderFactory: PaymentProviderFactory,
    private readonly configService: ConfigService,
  ) { }

  async start(): Promise<void> {
    this.logger.log('Starting Payment Reconciliation Worker');
    this.isRunning = true;

    // Ejecutar inmediatamente y luego cada 24 horas
    await this.runReconciliation();

    const intervalMs = this.configService.get<number>('RECONCILIATION_INTERVAL_MS', 24 * 60 * 60 * 1000); // 24 horas

    setInterval(async () => {
      if (this.isRunning) {
        await this.runReconciliation();
      }
    }, intervalMs);
  }

  stop(): void {
    this.logger.log('Stopping Payment Reconciliation Worker');
    this.isRunning = false;
  }

  private async runReconciliation(): Promise<void> {
    try {
      this.logger.log('Starting payment reconciliation process');

      // Reconciliar para ayer (para asegurar que todos los pagos del día están completos)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const reconciliationDate = yesterday.toISOString().split('T')[0];

      const providers = this.paymentProviderFactory.getAvailableProviders();

      for (const providerType of providers) {
        await this.reconcileProvider(providerType, reconciliationDate);
      }

      this.logger.log('Payment reconciliation process completed');
    } catch (error) {
      this.logger.error('Error in payment reconciliation process', error);
    }
  }

  private async reconcileProvider(providerType: string, date: string): Promise<void> {
    return await this.db.transaction(async (client) => {

      this.logger.log(`Reconciling payments for provider: ${providerType}, date: ${date}`);

      // Verificar si ya existe una reconciliación para esta fecha y proveedor
      const existingReconciliation = await client.query(
        'SELECT id FROM payment_reconciliations WHERE provider = $1 AND reconciliation_date = $2',
        [providerType, date]
      );

      if (existingReconciliation.rows.length > 0) {
        this.logger.log(`Reconciliation already exists for ${providerType} on ${date}`);
        return;
      }

      // Obtener resumen de pagos del día
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const paymentSummary = await this.getPaymentSummary(client, providerType, date);

      // Verificar estados de pagos con el proveedor
      await this.verifyPaymentStatuses(client, providerType, date);

      // Recalcular resumen después de la verificación
      const updatedSummary = await this.getPaymentSummary(client, providerType, date);

      // Crear registro de reconciliación
      await client.query(
        `INSERT INTO payment_reconciliations (
          reconciliation_date, provider, total_payments, total_amount_cents,
          reconciled_payments, reconciled_amount_cents, discrepancies_count,
          status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
        [
          date,
          providerType,
          updatedSummary.total_payments,
          updatedSummary.total_amount_cents,
          updatedSummary.reconciled_payments,
          updatedSummary.reconciled_amount_cents,
          updatedSummary.discrepancies_count,
          updatedSummary.discrepancies_count === 0 ? 'completed' : 'failed',
        ]
      );

      this.logger.log(`Reconciliation completed for ${providerType} on ${date}: ${updatedSummary.reconciled_payments}/${updatedSummary.total_payments} payments reconciled`);

      if (updatedSummary.discrepancies_count > 0) {
        this.logger.warn(`Found ${updatedSummary.discrepancies_count} discrepancies for ${providerType} on ${date}`);
      }
    });
  }

  private async getPaymentSummary(client: any, provider: string, date: string): Promise<PaymentSummary> {
    const result = await client.query(
      `SELECT 
        COUNT(*) as total_payments,
        COALESCE(SUM(amount_cents), 0) as total_amount_cents,
        COUNT(CASE WHEN status IN ('paid', 'authorized') THEN 1 END) as reconciled_payments,
        COALESCE(SUM(CASE WHEN status IN ('paid', 'authorized') THEN amount_cents ELSE 0 END), 0) as reconciled_amount_cents,
        COUNT(CASE WHEN status IN ('pending', 'failed') AND created_at < NOW() - INTERVAL '1 hour' THEN 1 END) as discrepancies_count
       FROM payments 
       WHERE provider = $1 
         AND DATE(created_at) = $2`,
      [provider, date]
    );

    const row = result.rows[0];
    return {
      provider,
      date,
      total_payments: parseInt(row.total_payments),
      total_amount_cents: parseInt(row.total_amount_cents),
      reconciled_payments: parseInt(row.reconciled_payments),
      reconciled_amount_cents: parseInt(row.reconciled_amount_cents),
      discrepancies_count: parseInt(row.discrepancies_count),
    };
  }

  private async verifyPaymentStatuses(client: any, providerType: string, date: string): Promise<void> {
    // Obtener pagos pendientes o con estados inconsistentes
    const paymentsToVerify = await client.query(
      `SELECT id, provider_payment_id, status 
       FROM payments 
       WHERE provider = $1 
         AND DATE(created_at) = $2
         AND provider_payment_id IS NOT NULL
         AND (
           status IN ('pending', 'authorized') 
           OR (status = 'failed' AND failed_at IS NULL)
         )`,
      [providerType, date]
    );

    if (paymentsToVerify.rows.length === 0) {
      return;
    }

    this.logger.log(`Verifying ${paymentsToVerify.rows.length} payments with provider ${providerType}`);

    const provider = this.paymentProviderFactory.getProvider(providerType as any);

    for (const payment of paymentsToVerify.rows) {
      try {
        const providerStatus = await provider.getPaymentStatus(payment.provider_payment_id);

        if (providerStatus.status !== payment.status) {
          this.logger.log(`Updating payment ${payment.id} status from ${payment.status} to ${providerStatus.status}`);

          const updateFields: string[] = [];
          const updateValues: any[] = [];
          let paramIndex = 1;

          updateFields.push(`status = $${paramIndex++}`);
          updateValues.push(providerStatus.status);

          updateFields.push(`provider_metadata = $${paramIndex++}`);
          updateValues.push(JSON.stringify(providerStatus.metadata));

          updateFields.push(`updated_at = NOW()`);

          // Actualizar timestamps según el estado
          if (providerStatus.status === 'authorized') {
            updateFields.push(`authorized_at = NOW()`);
          } else if (providerStatus.status === 'paid') {
            updateFields.push(`paid_at = NOW()`);
          } else if (providerStatus.status === 'failed') {
            updateFields.push(`failed_at = NOW()`);
            updateFields.push(`failure_reason = $${paramIndex++}`);
            updateValues.push(providerStatus.metadata?.error || 'Payment failed');
          }

          updateValues.push(payment.id);

          await client.query(
            `UPDATE payments SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
            updateValues
          );

          // Si el pago fue exitoso, confirmar el booking
          if (providerStatus.status === 'paid') {
            await this.confirmBookingPayment(client, payment.id);
          }
        }
      } catch (error) {
        this.logger.error(`Error verifying payment ${payment.id} with provider`, error);
      }
    }
  }

  private async confirmBookingPayment(client: any, paymentId: string): Promise<void> {
    // Obtener booking_id del pago
    const paymentResult = await client.query(
      'SELECT booking_id FROM payments WHERE id = $1',
      [paymentId]
    );

    if (paymentResult.rows.length === 0) {
      return;
    }

    const bookingId = paymentResult.rows[0].booking_id;

    // Confirmar booking si aún está pending
    await client.query(
      'UPDATE bookings SET status = $1, updated_at = NOW() WHERE id = $2 AND status = $3',
      ['confirmed', bookingId, 'pending']
    );

    // Consumir inventory lock
    await client.query(
      'UPDATE inventory_locks SET consumed_at = NOW() WHERE booking_id = $1 AND consumed_at IS NULL',
      [bookingId]
    );

    this.logger.log(`Booking ${bookingId} confirmed via reconciliation`);
  }
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const db = DatabaseClient.getInstance();
  const paymentProviderFactory = app.get(PaymentProviderFactory);
  const configService = app.get(ConfigService);

  const worker = new PaymentReconciliationWorker(db, paymentProviderFactory, configService);

  // Manejar señales de terminación
  process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down gracefully');
    worker.stop();
    await app.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully');
    worker.stop();
    await app.close();
    process.exit(0);
  });

  await worker.start();
}

if (require.main === module) {
  bootstrap().catch(console.error);
}
