# Integración PayPal - LIVEX

Documentación completa para la integración de PayPal como pasarela de pagos en LIVEX.

## Configuración Inicial

### 1. Crear Aplicación en PayPal Developer

1. **Acceder al Dashboard**
   - Ir a [PayPal Developer](https://developer.paypal.com/)
   - Iniciar sesión con cuenta de PayPal Business

2. **Crear Nueva Aplicación**
   - Clic en "Create App"
   - Nombre: "LIVEX Payment Gateway"
   - Merchant: Seleccionar cuenta business
   - Features: Marcar "Accept Payments"

3. **Obtener Credenciales**
   - **Client ID**: Para autenticación pública
   - **Client Secret**: Para autenticación del servidor
   - **Webhook ID**: Para validación de webhooks

### 2. Variables de Entorno

```bash
# PayPal Sandbox (Desarrollo)
PAYPAL_CLIENT_ID=AeA1QIZXiflr1_-7Lr93-...
PAYPAL_CLIENT_SECRET=EGnHDxD_qRPdaLdHgGlQ...
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
PAYPAL_WEBHOOK_ID=8PT597110X687430LKGECATA

# PayPal Production (Producción)
# PAYPAL_CLIENT_ID=your_production_client_id
# PAYPAL_CLIENT_SECRET=your_production_client_secret
# PAYPAL_BASE_URL=https://api-m.paypal.com
# PAYPAL_WEBHOOK_ID=your_production_webhook_id
```

## Características Implementadas

### Flujo de Pagos

#### 1. **Creación de Orden**
- Crea orden de PayPal con detalles del booking
- Genera URL de checkout para redirección
- Soporte para múltiples monedas (USD, EUR, COP, etc.)
- Configuración de URLs de retorno y cancelación

#### 2. **Estados de Pago**
```typescript
// Mapeo de estados PayPal → LIVEX
'CREATED' | 'SAVED' | 'PAYER_ACTION_REQUIRED' → 'pending'
'APPROVED' → 'authorized'  
'COMPLETED' → 'paid'
'CANCELLED' | 'VOIDED' → 'failed'
```

#### 3. **Gestión de Tokens**
- Autenticación OAuth2 automática
- Renovación automática de tokens
- Cache de tokens con expiración

### Sistema de Refunds

#### Características
- **Refunds Parciales**: Monto específico
- **Refunds Totales**: Monto completo del pago
- **Tracking Completo**: Estados y referencias
- **Integración con Captures**: Obtención automática de capture ID

#### Estados de Refund
```typescript
'COMPLETED' → 'processed'
'PENDING' → 'pending'  
'CANCELLED' | 'FAILED' → 'failed'
```

### Webhooks

#### Eventos Soportados
- `CHECKOUT.ORDER.APPROVED`: Orden aprobada por el usuario
- `PAYMENT.CAPTURE.COMPLETED`: Pago capturado exitosamente
- `PAYMENT.CAPTURE.DENIED`: Pago denegado
- `PAYMENT.CAPTURE.DECLINED`: Pago declinado
- `PAYMENT.CAPTURE.REFUNDED`: Refund procesado

#### Configuración de Webhooks
1. **En PayPal Developer Dashboard**
   - Ir a aplicación → Webhooks
   - Agregar webhook URL: `https://yourdomain.com/v1/payments/webhooks/paypal`
   - Seleccionar eventos requeridos
   - Copiar Webhook ID

## Flujo de Integración

### 1. Crear Pago con PayPal

```bash
curl -X POST "http://localhost:3000/v1/payments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "bookingId": "booking-123",
    "provider": "paypal",
    "customerEmail": "customer@example.com"
  }'
```

**Respuesta:**
```json
{
  "id": "paypal-order-456",
  "bookingId": "booking-123",
  "provider": "paypal",
  "amount": 15000,
  "currency": "USD",
  "status": "pending",
  "checkoutUrl": "https://www.paypal.com/checkoutnow?token=EC-...",
  "expiresAt": "2025-10-15T22:35:00.000Z"
}
```

### 2. Usuario Completa Pago
- Redirección a `checkoutUrl`
- Usuario aprueba pago en PayPal
- PayPal envía webhook `CHECKOUT.ORDER.APPROVED`
- Sistema actualiza estado a `authorized`

### 3. Captura Automática
- PayPal captura el pago automáticamente
- Webhook `PAYMENT.CAPTURE.COMPLETED`
- Sistema actualiza estado a `paid`
- Booking se confirma automáticamente

### 4. Procesamiento de Refund

```bash
curl -X POST "http://localhost:3000/v1/payments/refunds" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "paymentId": "paypal-order-456",
    "amountCents": 7500,
    "reason": "Partial cancellation"
  }'
```

## Diferencias con Wompi

| Aspecto | PayPal | Wompi |
|---------|--------|-------|
| **Autenticación** | OAuth2 con tokens | API Keys estáticas |
| **Flujo** | Orden → Aprobación → Captura | Transacción directa |
| **Monedas** | Multi-moneda global | Principalmente COP |
| **Refunds** | API dedicada con capture ID | API directa con transaction ID |
| **Webhooks** | Eventos granulares | Eventos de transacción |
| **UI** | Checkout hosteado por PayPal | Checkout embebido |

## Configuración de Monedas

### Monedas Soportadas
```typescript
supportedCurrencies = [
  'USD', // Dólar estadounidense
  'EUR', // Euro
  'GBP', // Libra esterlina
  'CAD', // Dólar canadiense
  'AUD', // Dólar australiano
  'JPY', // Yen japonés
  'COP'  // Peso colombiano (limitado)
]
```

### Conversión de Monedas
- **Centavos a Decimal**: PayPal requiere formato decimal (15.00)
- **Wompi vs PayPal**: Wompi usa centavos, PayPal decimales
- **Precisión**: 2 decimales para la mayoría de monedas

## Testing

### Cuentas de Prueba PayPal

#### Comprador (Buyer)
```
Email: buyer@example.com
Password: testpassword123
```

#### Vendedor (Merchant)  
```
Email: merchant@example.com
Password: testpassword123
```

### Tarjetas de Prueba
```
Visa: 4032035728797504
Mastercard: 5425233430109903
Amex: 374245455400001
```

### URLs de Testing
- **Sandbox API**: `https://api-m.sandbox.paypal.com`
- **Sandbox Checkout**: `https://www.sandbox.paypal.com`
- **Developer Dashboard**: `https://developer.paypal.com`

## Monitoreo y Logs

### Eventos Loggeados
```typescript
// Creación de pago
this.logger.log(`PayPal order created: ${order.id}`);

// Procesamiento de webhook
this.logger.log('Processing PayPal webhook');

// Refunds
this.logger.log(`PayPal refund created: ${refund.id}`);

// Errores
this.logger.error('PayPal API error', error);
```

### Métricas Importantes
- **Tasa de Aprobación**: % de órdenes aprobadas vs creadas
- **Tiempo de Procesamiento**: Desde creación hasta captura
- **Errores de API**: Fallos en llamadas a PayPal
- **Webhooks Perdidos**: Eventos no procesados

## Seguridad

### Validación de Webhooks
```typescript
// Implementación pendiente - Validación completa de firmas
private async validateWebhookSignature(payload: any, signature: string): Promise<boolean> {
  // PayPal usa validación de certificados más compleja
  // Requiere verificación con API de PayPal
  return true; // Temporal para desarrollo
}
```

### Mejores Prácticas
- **HTTPS Obligatorio**: Webhooks solo en HTTPS
- **Validación de Firmas**: Implementar validación completa
- **Idempotencia**: PayPal-Request-Id en headers
- **Rate Limiting**: Respetar límites de API
- **Logs Seguros**: No loggear datos sensibles

## Troubleshooting

### Errores Comunes

#### 1. **Token Expirado**
```
Error: PayPal auth error: 401
Solución: Token se renueva automáticamente
```

#### 2. **Webhook No Recibido**
```
Verificar:
- URL webhook correcta en PayPal
- HTTPS habilitado
- Firewall permite conexiones PayPal
```

#### 3. **Capture ID No Encontrado**
```
Error: PayPal capture ID not found for refund
Solución: Verificar que el pago esté completamente procesado
```

#### 4. **Moneda No Soportada**
```
Error: Currency not supported
Solución: Verificar lista de monedas soportadas
```

### Debug Mode
```bash
# Habilitar logs detallados
NODE_ENV=development
LOG_LEVEL=debug
```

## Roadmap

### Próximas Funcionalidades
- [ ] **Validación Completa de Webhooks**: Implementar verificación de certificados
- [ ] **PayPal Subscriptions**: Pagos recurrentes
- [ ] **PayPal Credit**: Financiamiento
- [ ] **Multi-Party Payments**: Pagos a múltiples receptores
- [ ] **Dispute Management**: Gestión de disputas
- [ ] **Advanced Fraud Protection**: Protección anti-fraude

### Optimizaciones
- [ ] **Cache de Tokens**: Redis para tokens compartidos
- [ ] **Retry Logic**: Reintentos automáticos en fallos
- [ ] **Batch Operations**: Operaciones en lote
- [ ] **Webhook Queuing**: Cola de webhooks para alta concurrencia

## Soporte

### Recursos PayPal
- [PayPal Developer Docs](https://developer.paypal.com/docs/)
- [REST API Reference](https://developer.paypal.com/docs/api/)
- [Webhook Events](https://developer.paypal.com/docs/api-basics/notifications/webhooks/event-names/)
- [Testing Guide](https://developer.paypal.com/docs/checkout/standard/test/)

### Contacto Técnico
- **PayPal Developer Support**: Via dashboard
- **Community Forum**: [PayPal Developer Community](https://www.paypal-community.com/)
- **Status Page**: [PayPal Status](https://www.paypal-status.com/)

---

**Nota**: Esta integración está lista para producción una vez configuradas las credenciales reales y implementada la validación completa de webhooks.
