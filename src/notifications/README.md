# Sistema de Notificaciones LIVEX

Este módulo implementa un sistema completo de notificaciones por email con plantillas y cola de procesamiento para la plataforma LIVEX.

## Características

- ✅ **Plantillas de Email**: Sistema de plantillas con Handlebars
- ✅ **Cola de Procesamiento**: Manejo asíncrono con RabbitMQ
- ✅ **Prioridades**: Colas separadas para alta, media y baja prioridad
- ✅ **Reintentos**: Sistema de reintentos con backoff exponencial
- ✅ **Eventos Internos**: Integración con EventEmitter para disparar notificaciones
- ✅ **Logging**: Registro completo de envíos y estados
- ✅ **Testing**: Endpoints para pruebas y simulación de eventos

## Arquitectura

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   API/Events    │───▶│   Notification   │───▶│   RabbitMQ      │
│                 │    │   Queue Service  │    │   Queues        │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Email Logs    │◀───│ Notification     │◀───│   Email         │
│   Database      │    │ Worker           │    │   Service       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Tipos de Notificaciones

### Reservas y Pagos
- `BOOKING_CONFIRMATION`: Confirmación de reserva
- `BOOKING_REMINDER`: Recordatorio de experiencia
- `BOOKING_CANCELLED`: Cancelación de reserva
- `PAYMENT_CONFIRMED`: Confirmación de pago
- `PAYMENT_FAILED`: Fallo en el pago
- `REFUND_PROCESSED`: Reembolso procesado

### Usuarios
- `WELCOME`: Bienvenida a nuevos usuarios
- `PASSWORD_RESET`: Restablecimiento de contraseña

### Prestadores
- `RESORT_APPROVED`: Aprobación de prestador
- `RESORT_REJECTED`: Rechazo de prestador
- `EXPERIENCE_APPROVED`: Aprobación de experiencia
- `EXPERIENCE_REJECTED`: Rechazo de experiencia

## Uso

### Envío Directo (Síncrono)
```typescript
await notificationService.sendEmailNotificationSync(
  'user@example.com',
  EmailTemplateType.WELCOME,
  { userName: 'Juan Pérez' }
);
```

### Envío con Cola (Asíncrono)
```typescript
const jobId = await notificationService.sendEmailNotification(
  'user@example.com',
  EmailTemplateType.BOOKING_CONFIRMATION,
  {
    customerName: 'Juan Pérez',
    experienceName: 'Tour en Kayak',
    bookingCode: 'LVX-001'
  },
  {
    priority: 'high',
    scheduledAt: new Date('2024-01-15T10:00:00Z') // Opcional
  }
);
```

### Eventos Internos
```typescript
// Emitir evento que dispara notificación automáticamente
eventEmitter.emit('booking.confirmed', new BookingConfirmedEvent(
  'booking-123',
  'customer@example.com',
  'Juan Pérez',
  'Tour en Kayak',
  '2024-01-15',
  '10:00 AM',
  2,
  150000,
  'LVX-001'
));
```

## Configuración

### Variables de Entorno
```bash
# SMTP Configuration
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@livex.com

# Frontend URL for email links
FRONTEND_URL=https://livex.com
```

### Desarrollo con Mailhog
Para desarrollo, se recomienda usar Mailhog para capturar emails:

```bash
# Instalar Mailhog
go install github.com/mailhog/MailHog@latest

# Ejecutar Mailhog
MailHog

# Configurar variables
SMTP_HOST=localhost
SMTP_PORT=1025
```

Acceder a la interfaz web en: http://localhost:8025

## Colas de RabbitMQ

### Estructura de Colas
- `notifications.email.high`: Prioridad alta (confirmaciones, pagos)
- `notifications.email.medium`: Prioridad media (recordatorios, aprobaciones)
- `notifications.email.low`: Prioridad baja (bienvenidas, notificaciones generales)
- `notifications.email.scheduled`: Emails programados
- `notifications.email.retry`: Reintentos con delay

### Procesamiento
El worker de notificaciones (`notification-worker.ts`) procesa las colas en orden de prioridad:
1. Alta prioridad
2. Media prioridad  
3. Baja prioridad

## Comandos

### Desarrollo
```bash
# Ejecutar API principal
npm run dev

# Ejecutar worker de notificaciones
npm run notification-worker:dev

# Ejecutar worker de webhooks (existente)
npm run worker:dev
```

### Producción
```bash
# Compilar
npm run build

# Ejecutar API
npm run start:prod

# Ejecutar worker de notificaciones
npm run notification-worker

# Ejecutar worker de webhooks
npm run worker
```

## API Endpoints

### Testing
```bash
# Enviar email de prueba
POST /notifications/email/test
{
  "to": "test@example.com",
  "templateType": "welcome"
}

# Simular evento
POST /notifications/events/simulate/booking.confirmed
{
  "customerEmail": "test@example.com",
  "customerName": "Juan Pérez",
  "experienceName": "Tour en Kayak"
}

# Ver estadísticas de colas
GET /notifications/queue/stats

# Listar plantillas disponibles
GET /notifications/templates
```

### Envío Directo
```bash
# Enviar notificación
POST /notifications/email/send
{
  "to": "user@example.com",
  "templateType": "booking_confirmation",
  "templateData": {
    "customerName": "Juan Pérez",
    "experienceName": "Tour en Kayak",
    "bookingCode": "LVX-001"
  },
  "priority": "high"
}
```

## Base de Datos

### Tabla email_logs
Registra todos los envíos de email:
```sql
CREATE TABLE email_logs (
    id SERIAL PRIMARY KEY,
    job_id VARCHAR(255) UNIQUE NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    template_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    attempts INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Plantillas

Las plantillas están en `src/notifications/templates/` en formato Handlebars (.hbs).

### Estructura de Plantilla
```handlebars
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{subject}}</title>
</head>
<body>
    <h1>Hola {{customerName}}</h1>
    <p>Tu reserva {{bookingCode}} ha sido confirmada.</p>
</body>
</html>
```

### Convención de Nombres
- `{template_type}_{language}.hbs`
- Ejemplo: `booking_confirmation_es.hbs`

## Monitoreo

### Logs
Los logs incluyen información detallada sobre:
- Jobs procesados
- Emails enviados/fallidos
- Reintentos
- Errores

### Métricas
- Estadísticas de colas en tiempo real
- Contadores de envíos por tipo
- Tasas de éxito/fallo
- Tiempos de procesamiento

## Troubleshooting

### Problemas Comunes

1. **Emails no se envían**
   - Verificar configuración SMTP
   - Revisar logs del worker
   - Comprobar estado de RabbitMQ

2. **Plantillas no se cargan**
   - Verificar ruta de plantillas
   - Comprobar sintaxis Handlebars
   - Revisar permisos de archivos

3. **Cola se llena**
   - Verificar que el worker esté ejecutándose
   - Revisar logs de errores
   - Comprobar conectividad SMTP

### Comandos de Diagnóstico
```bash
# Ver estado de colas
curl http://localhost:3000/notifications/queue/stats

# Enviar email de prueba
curl -X POST http://localhost:3000/notifications/email/test \
  -H "Content-Type: application/json" \
  -d '{"to":"test@example.com"}'

# Ver logs del worker
docker logs livex-notification-worker
```

## Roadmap

### Próximas Funcionalidades
- [ ] Soporte para SMS
- [ ] Push notifications
- [ ] Plantillas visuales (drag & drop)
- [ ] A/B testing de plantillas
- [ ] Analytics avanzados
- [ ] Integración con servicios externos (SendGrid, Mailgun)
- [ ] Webhooks de estado de entrega
