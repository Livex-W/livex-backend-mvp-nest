# Sistema de Pagos LIVEX

Sistema completo de pagos con webhooks, conciliación y refunds para la plataforma LIVEX.

## Características Principales

### Arquitectura Extensible

- **Patrón Factory**: Sistema de proveedores de pago extensible
- **Wompi**: Implementación inicial para Colombia
- **PayPal**: Implementación completa para pagos internacionales
- **Preparado para**: ePayco, Stripe

### Confirmación Idempotente

- **Idempotency Keys**: Prevención de pagos duplicados
- **Transacciones Atómicas**: Consistencia de datos garantizada
- **Lock Consumption**: Integración con sistema de inventario

### Sistema de Webhooks

- **Validación de Firmas**: Seguridad en webhooks entrantes
- **Procesamiento Idempotente**: Manejo de reintentos
- **Estados Sincronizados**: Actualización automática de pagos

### Conciliación Automática

- **Worker Diario**: Reconciliación automática con proveedores
- **Detección de Discrepancias**: Identificación de inconsistencias
- **Reportes**: Métricas de reconciliación

### Refunds Completos

- **Refunds Parciales/Totales**: Flexibilidad en reembolsos
- **Políticas Automáticas**: Refunds basados en reglas de negocio
- **Tracking Completo**: Seguimiento de estado de refunds

## Componentes Implementados

### Servicios Core

- `PaymentsService`: Servicio principal de pagos
- `PaymentProviderFactory`: Factory de proveedores
- `WompiProvider`: Implementación de Wompi

### Base de Datos

- `payments`: Tabla principal de pagos mejorada
- `refunds`: Tabla de reembolsos con estados
- `payment_reconciliations`: Tabla de conciliación diaria
- `webhook_events`: Registro de webhooks procesados

### Workers

- `payment-reconciliation-worker`: Conciliación automática diaria
- Integración con `booking-expiry-worker` existente

### Endpoints REST

- `POST /v1/payments`: Crear pago
- `GET /v1/payments/:id`: Obtener pago
- `GET /v1/payments/booking/:bookingId`: Pagos por booking
- `POST /v1/payments/refunds`: Crear refund
- `POST /v1/payments/webhooks/:provider`: Webhook de proveedor

### DTOs y Validación

- `CreatePaymentDto`: Validación de creación de pagos
- `CreateRefundDto`: Validación de refunds
- `WebhookPayloadDto`: Validación de webhooks

## Flujo de Pagos

### 1. Creación de Pago

```
Usuario → POST /v1/payments
├── Validar booking pending
├── Verificar idempotencia
├── Crear registro en BD
├── Llamar proveedor (Wompi)
└── Retornar checkout URL
```

### 2. Procesamiento de Webhook

```
Proveedor → POST /v1/payments/webhooks/wompi
├── Validar firma
├── Registrar evento
├── Actualizar estado pago
├── Confirmar booking (si paid)
└── Consumir inventory lock
```

### 3. Conciliación Diaria

```
Worker (24h) → Reconciliación
├── Obtener pagos del día
├── Verificar estados con proveedor
├── Detectar discrepancias
├── Actualizar estados
└── Generar reporte
```

### 4. Refunds

```
Usuario/Admin → POST /v1/payments/refunds
├── Validar pago elegible
├── Calcular monto disponible
├── Crear registro refund
├── Procesar con proveedor
└── Actualizar estados
```

## Estados de Pago

### Payment Status

- `pending`: Pago creado, esperando procesamiento
- `authorized`: Pago autorizado por proveedor
- `paid`: Pago completado exitosamente
- `failed`: Pago falló
- `expired`: Pago expiró sin completarse

### Refund Status

- `pending`: Refund solicitado
- `processed`: Refund procesado exitosamente
- `failed`: Refund falló
- `cancelled`: Refund cancelado

## Configuración

### Variables de Entorno

```bash
# Wompi
WOMPI_PUBLIC_KEY=pub_test_...
WOMPI_PRIVATE_KEY=prv_test_...
WOMPI_BASE_URL=https://sandbox.wompi.co
WOMPI_WEBHOOK_SECRET=secret...

# Sistema
COMMISSION_RATE_BPS=1000
PAYMENT_EXPIRY_MINUTES=15
RECONCILIATION_INTERVAL_MS=86400000
```

### Docker Compose

```yaml
payment-reconciliation-worker:
  container_name: livex_payment-reconciliation-worker
  command: npm run payment-reconciliation-worker:dev
  environment:
    RECONCILIATION_INTERVAL_MS: 86400000
```

## Seguridad

### Validaciones

- **Firmas de Webhook**: Validación criptográfica
- **Idempotencia**: Prevención de duplicados
- **Autorización**: Control de acceso por roles
- **Sanitización**: Validación de entrada con DTOs

### Transacciones

- **Atomicidad**: Operaciones todo-o-nada
- **Consistencia**: Estados sincronizados
- **Aislamiento**: Locks pesimistas
- **Durabilidad**: Persistencia garantizada

## Monitoreo

### Métricas

- Pagos creados/completados por día
- Tasa de éxito de pagos
- Tiempo promedio de procesamiento
- Discrepancias en conciliación

### Logs

- Creación de pagos con request ID
- Procesamiento de webhooks
- Errores de conciliación
- Estados de refunds

## Extensibilidad

### Agregar Nuevo Proveedor

1. Implementar `PaymentProvider` interface
2. Registrar en `PaymentProviderFactory`
3. Agregar configuración de entorno
4. Actualizar enums de base de datos

### Ejemplo ePayco

```typescript
@Injectable()
export class EPaycoProvider implements PaymentProvider {
  readonly name = 'epayco';
  readonly supportedCurrencies = ['COP', 'USD'];
  
  async createPayment(intent: PaymentIntent): Promise<PaymentResult> {
    // Implementación específica de ePayco
  }
}
```

## Migración

### Aplicar Cambios

```bash
# Ejecutar migración
psql -d livex_db -f db/migrations/007_create_payments_tables.sql

# Verificar cambios
\d payments
\d refunds
\d payment_reconciliations
```

### Rollback (si necesario)

```sql
-- Revertir cambios si es necesario
ALTER TABLE payments DROP COLUMN IF EXISTS provider_payment_id;
-- ... otros rollbacks
```

## Testing

### Wompi Sandbox

- Usar `https://sandbox.wompi.co`
- Tarjetas de prueba disponibles en documentación
- Webhooks de prueba configurables

### Casos de Prueba

- Pago exitoso completo
- Pago fallido por fondos insuficientes
- Webhook duplicado (idempotencia)
- Refund parcial y total
- Conciliación con discrepancias

## Integración con Booking System

El sistema de pagos se integra perfectamente con el sistema de booking pending existente:

1. **Booking Pending** → Usuario crea reserva temporal con lock de inventario
2. **Payment Creation** → Usuario inicia pago, se mantiene el lock
3. **Payment Success** → Webhook confirma pago, booking se confirma, lock se consume
4. **Payment Failure** → Booking expira automáticamente, lock se libera

Esta integración garantiza que no haya sobreventa y que el inventario esté siempre sincronizado con los pagos reales.
