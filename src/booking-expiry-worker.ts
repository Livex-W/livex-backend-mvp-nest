import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BookingsService } from './bookings/bookings.service';
import { CustomLoggerService } from './common/services/logger.service';

/**
 * Worker dedicado para expirar bookings pending que han superado su TTL
 * Ejecuta cada 30 segundos para mantener el inventario actualizado
 */
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  const bookingsService = app.get(BookingsService);
  const logger = app.get(CustomLoggerService);

  logger.log('Booking expiry worker iniciado');

  const processExpiredBookings = async () => {
    try {
      const result = await bookingsService.expireStalePendingBookings(100);
      
      if (result.expired > 0) {
        logger.logBusinessEvent('booking_expiry_batch_processed', {
          expiredCount: result.expired,
          batchSize: 100,
        });
      }

      // Cleanup orphan locks (locks sin booking asociado)
      const cleanedLocks = await bookingsService.cleanupOrphanLocks(500);
      
      if (cleanedLocks > 0) {
        logger.logBusinessEvent('inventory_locks_cleanup', {
          cleanedCount: cleanedLocks,
        });
      }
    } catch (error) {
      logger.logError(error as Error, {
        method: 'processExpiredBookings',
        workerType: 'booking-expiry',
      });
    }
  };

  // Ejecutar inmediatamente al iniciar
  await processExpiredBookings();

  // Programar ejecución cada 30 segundos
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  const intervalId = setInterval(processExpiredBookings, 30_000);

  // Graceful shutdown
  const shutdown = async () => {
    logger.log('Booking expiry worker cerrando...');
    clearInterval(intervalId);
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown();
  });
  process.on('SIGTERM', () => {
    void shutdown();
  });
  process.on('uncaughtException', (error) => {
    logger.logError(error, {
      method: 'uncaughtException',
      workerType: 'booking-expiry',
    });
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    logger.logError(reason as Error, {
      method: 'unhandledRejection',
      workerType: 'booking-expiry',
    });
    process.exit(1);
  });

  logger.log('Booking expiry worker configurado - ejecutando cada 30 segundos');
}

main().catch((error) => {
  console.error('Error fatal en booking expiry worker:', error);
  process.exit(1);
});
