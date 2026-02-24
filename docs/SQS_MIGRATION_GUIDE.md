# Migración a AWS SQS y Sistema de Reconciliación

Este documento detalla la migración del sistema de colas de RabbitMQ a **Amazon SQS** y la implementación del **Payment Reconciliation Worker** para garantizar la integridad de los pagos.

## 1. Contexto de la Migración
Originalmente, el sistema utilizaba RabbitMQ para el procesamiento asíncrono. La migración a **AWS SQS** permite:
- **Serverless Nativo**: Eliminamos la necesidad de mantener un cluster de RabbitMQ.
- **Escalabilidad**: SQS maneja picos de tráfico de forma automática.
- **Fiabilidad**: Los mensajes no se pierden y tienen reintentos automáticos mediante *Visibility Timeout* y *DLQ* (Dead Letter Queues).

## 2. Flujo de Procesamiento

### A. Webhooks (Flujo Push)
1. **API**: Recibe el webhook (Wompi/PayPal).
2. **Validación**: Se valida la firma dinámicamente.
3. **Persistencia**: El evento se guarda en `webhook_events` con sus headers originales.
4. **Encolado**: Se envía un mensaje a la cola `livex-webhooks-payments` con el `eventId`.
5. **Worker**: El `livex_worker` hace *Long Polling*, procesa el evento y confirma la reserva.

### B. Reconciliación (Flujo de Seguridad)
Si un webhook falla o nunca llega (ej. caída de red), el **Reconciliador** actúa como salvavidas.

1. **Producer**: Cada 30-60s (configurable) busca en la DB pagos `pending` que no se han actualizado en X tiempo.
2. **Encolado**: Envía estos IDs a la cola `livex-reconciliation`.
3. **Consumer**: Procesa la cola, consulta el estado real en la API del proveedor (Wompi/PayPal) y sincroniza la base de datos.
4. **Auto-Confirmación**: Si el proveedor dice que está pagado, el worker dispara automáticamente la confirmación de la reserva y el envío de correos.

## 3. Mejoras Conseguidas
- **Seguridad de Firma**: Validación dinámica basada en el array `properties` de Wompi.
- **Auditoría Total**: Se almacenan todos los headers (crítico para la API de verificación de PayPal).
- **Resiliencia**: Si el Webhook falla, el Reconciliador recupera la transacción automáticamente en minutos.
- **Cero Mensajes Perdidos**: Uso de `Promise.all` y `while(running)` para asegurar procesamiento constante y paralelo.

## 4. Guía de Pruebas (Entorno Dev)

### Probar el Reconciliador
Para forzar a que el sistema "encuentre" un pago perdido y lo recupere:

1. **Identificar un pago**:
   ```sql
   SELECT id, status, provider_payment_id FROM payments ORDER BY created_at DESC LIMIT 1;
   ```

2. **Simular abandono/falla**:
   ```sql
   UPDATE payments 
   SET status = 'pending', 
       updated_at = NOW() - INTERVAL '5 minutes' 
   WHERE id = 'TU_ID';
   ```

3. **Ver logs**:
   En el contenedor `livex_payment-reconciliation-worker` verás:
   ```text
   Producer: Found 1 payments to verify
   Consumer: Verifying payment ... (wompi)
   Consumer: Updating payment ... status: pending -> paid
   Consumer: Payment ... is PAID. Triggering complete booking confirmation.
   PaymentsService: Booking confirmed and commission created
   NotificationQueueService: Email notification encolada: payment_confirmed
   ```


## 5 Configuracion de Entorno (.env)
Variables clave para SQS:
- `SQS_NOTIFICATIONS_HIGH_URL`= Notificaciones de alta prioridad
- `SQS_NOTIFICATIONS_MEDIUM_URL`= Notificaciones de media prioridad
- `SQS_NOTIFICATIONS_LOW_URL`= Notificaciones de baja prioridad
- `SQS_NOTIFICATIONS_DLQ_URL`= Notificaciones de cola muerta
- `SQS_WEBHOOKS_URL`= Webhooks de pagos
- `SQS_WEBHOOKS_DLQ_URL`= Webhooks de pagos cola muerta
- `SQS_RECONCILIATION_URL`= Reconciliacion de pagos
- `SQS_RECONCILIATION_DLQ_URL`= Reconciliacion de pagos cola muerta
- `RECONCILIATION_INTERVAL_MS`= Frecuencia de escaneo (ej. `30000` para 30s).


