# Sistema de Booking Pending con Locks de Inventario

## Descripción General

El sistema de booking pending implementa un mecanismo robusto para prevenir sobreventa mediante locks temporales de inventario. Cuando un usuario inicia el proceso de reserva, se crea un booking en estado "pending" que bloquea temporalmente la capacidad del slot hasta que se confirme el pago o expire el TTL.

## Arquitectura del Sistema

### 1. Estados de Booking

```
pending → confirmed → completed
   ↓         ↓
cancelled  refunded
   ↓
expired
```

- **pending**: Reserva creada, inventario bloqueado temporalmente
- **confirmed**: Pago confirmado, inventario consumido permanentemente  
- **cancelled**: Reserva cancelada manualmente, inventario liberado
- **expired**: Reserva expirada por TTL, inventario liberado automáticamente
- **completed**: Experiencia completada
- **refunded**: Reembolso procesado

### 2. Componentes Principales

#### BookingsService
- `createPendingBooking()`: Crea booking + lock de inventario
- `confirmPendingBooking()`: Confirma booking y consume lock
- `cancelPendingBooking()`: Cancela booking y libera lock
- `expireStalePendingBookings()`: Expira bookings vencidos (job)

#### Inventory Locks
- Tabla `inventory_locks` para bloqueos temporales
- TTL configurable (default: 15 minutos)
- Cleanup automático de locks huérfanos

#### Vista v_slot_remaining
Calcula capacidad disponible en tiempo real:
```sql
SELECT
  s.id AS slot_id,
  s.capacity
    - COALESCE(SUM(bookings_confirmed_and_pending), 0)
    - COALESCE(SUM(active_locks), 0) AS remaining
FROM availability_slots s
```

## Flujo de Reserva

### 1. Crear Booking Pending

```http
POST /api/v1/bookings
Content-Type: application/json
Idempotency-Key: unique-key-123

{
  "slotId": "uuid",
  "experienceId": "uuid", 
  "adults": 2,
  "children": 1,
  "subtotalCents": 50000,
  "taxCents": 9500,
  "currency": "COP"
}
```

**Proceso interno:**
1. Validar idempotencia
2. Verificar capacidad disponible con `FOR UPDATE`
3. Crear booking en estado "pending"
4. Crear lock de inventario con TTL
5. Retornar booking con `expiresAt`

### 2. Confirmar Booking

```http
PATCH /api/v1/bookings/{bookingId}/confirm
```

**Proceso interno:**
1. Verificar que booking esté en estado "pending"
2. Cambiar estado a "confirmed"
3. Marcar lock como consumido (`consumed_at`)
4. Remover `expires_at` del booking

### 3. Cancelar Booking

```http
PATCH /api/v1/bookings/{bookingId}/cancel
Content-Type: application/json

{
  "reason": "Usuario canceló"
}
```

## Prevención de Sobreventa

### Mecanismos Anti-Sobreventa

1. **Locks Pesimistas**: `FOR UPDATE` en consultas de capacidad
2. **Vista Calculada**: `v_slot_remaining` considera todos los bloqueos
3. **Transacciones Atómicas**: Booking + Lock en una sola transacción
4. **Idempotencia**: Previene duplicados con `Idempotency-Key`

### Validaciones de Capacidad

```typescript
// En lockSlotCapacity()
const remaining = slotResult.rows[0].remaining - totalRequested;
if (remaining < 0) {
  throw new BadRequestException('Insufficient capacity');
}
```

## Worker de Expiración

### Booking Expiry Worker

Ejecuta cada 30 segundos para:
- Expirar bookings pending vencidos
- Liberar locks de inventario
- Limpiar locks huérfanos

```bash
# Desarrollo
npm run booking-expiry-worker:dev

# Producción  
npm run booking-expiry-worker
```

### Configuración

```env
# TTL para bookings pending (minutos)
BOOKING_PENDING_TTL_MINUTES=15
```

## Estructura de Base de Datos

### Tabla bookings
```sql
CREATE TABLE bookings (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  experience_id uuid NOT NULL,
  slot_id uuid NOT NULL,
  adults integer NOT NULL,
  children integer DEFAULT 0,
  subtotal_cents integer NOT NULL,
  tax_cents integer NOT NULL,
  total_cents integer NOT NULL,
  currency text DEFAULT 'COP',
  status booking_status DEFAULT 'pending',
  expires_at timestamptz,
  cancel_reason text,
  idempotency_key text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### Tabla inventory_locks
```sql
CREATE TABLE inventory_locks (
  id uuid PRIMARY KEY,
  slot_id uuid NOT NULL,
  user_id uuid,
  booking_id uuid,
  quantity integer NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz DEFAULT now()
);
```

## Monitoreo y Observabilidad

### Eventos de Negocio Loggeados

- `booking_create_pending_request`
- `booking_create_pending_response`  
- `booking_confirmed`
- `booking_cancelled`
- `booking_expiry_batch_processed`
- `inventory_locks_cleanup`

### Métricas Importantes

- Tiempo de respuesta de creación de bookings
- Tasa de expiración de bookings pending
- Locks huérfanos limpiados
- Capacidad disponible por slot

## Casos de Uso y Ejemplos

### Escenario: Concurrencia Alta

Dos usuarios intentan reservar el último cupo disponible:

1. **Usuario A** inicia reserva → Lock creado, capacidad = 0
2. **Usuario B** intenta reservar → Error "Insufficient capacity"
3. **Usuario A** confirma pago → Lock consumido
4. **Usuario B** puede intentar nuevamente si hay cancelaciones

### Escenario: Abandono de Carrito

1. Usuario crea booking pending → Lock por 15 minutos
2. Usuario abandona sin pagar
3. Worker expira booking automáticamente
4. Inventario liberado para otros usuarios

## Configuración de Producción

### Docker Compose

```yaml
services:
  booking-expiry-worker:
    build: .
    command: npm run booking-expiry-worker
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - BOOKING_PENDING_TTL_MINUTES=15
    depends_on:
      - db
    restart: unless-stopped
```

### Escalabilidad

- Worker puede ejecutarse en múltiples instancias
- Usa `FOR UPDATE SKIP LOCKED` para evitar conflictos
- Procesamiento por lotes configurable

## Troubleshooting

### Problemas Comunes

1. **Locks no se liberan**: Verificar que el worker esté ejecutándose
2. **Sobreventa**: Revisar vista `v_slot_remaining` y transacciones
3. **Performance**: Optimizar índices en `expires_at` y `slot_id`

### Queries de Diagnóstico

```sql
-- Bookings pending por expirar
SELECT * FROM bookings 
WHERE status = 'pending' 
  AND expires_at < NOW() + INTERVAL '5 minutes';

-- Locks activos por slot
SELECT slot_id, COUNT(*), SUM(quantity)
FROM inventory_locks 
WHERE consumed_at IS NULL 
  AND expires_at > NOW()
GROUP BY slot_id;

-- Capacidad disponible
SELECT * FROM v_slot_remaining 
WHERE remaining < 5;
```

## Consideraciones de Seguridad

- Validación de entrada en todos los DTOs
- Rate limiting en endpoints de booking
- Logs de auditoría para todas las operaciones
- Idempotencia obligatoria para operaciones críticas

## Roadmap

- [ ] Notificaciones push para expiración de bookings
- [ ] Dashboard de monitoreo en tiempo real
- [ ] Métricas de conversión de pending → confirmed
- [ ] Optimización de locks para alta concurrencia
