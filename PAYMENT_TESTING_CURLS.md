# Comandos cURL para Testing del Sistema de Pagos LIVEX

Este documento contiene todos los comandos cURL necesarios para probar el flujo completo de pagos en LIVEX.

## Variables de Entorno

Primero, configura estas variables para facilitar el testing:

```bash
# Configuración del servidor
export BASE_URL="http://localhost:3000"
export API_BASE="$BASE_URL/api/v1"
export PAYMENTS_BASE="$BASE_URL/v1/payments"

# Tokens de autenticación (obtener del login)
export TOURIST_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
export ADMIN_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# IDs de ejemplo (reemplazar con valores reales)
export USER_ID="550e8400-e29b-41d4-a716-446655440000"
export EXPERIENCE_ID="550e8400-e29b-41d4-a716-446655440001"
export SLOT_ID="550e8400-e29b-41d4-a716-446655440002"
```

## 1. Autenticación

### Login como Tourist
```bash
curl -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "tourist@example.com",
    "password": "password123"
  }'
```

### Login como Admin
```bash
curl -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "admin123"
  }'
```

## 2. Flujo Completo de Booking + Pago

### 2.1 Crear Booking Pending
```bash
curl -X POST "$API_BASE/bookings" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOURIST_TOKEN" \
  -H "Idempotency-Key: booking-$(date +%s)" \
  -d '{
    "experienceId": "'$EXPERIENCE_ID'",
    "slotId": "'$SLOT_ID'",
    "adults": 2,
    "children": 1,
    "customerInfo": {
      "firstName": "Juan",
      "lastName": "Pérez",
      "email": "juan.perez@example.com",
      "phone": "+57300123456",
      "documentType": "CC",
      "documentNumber": "12345678"
    },
    "specialRequests": "Vegetarian meal"
  }'
```

**Respuesta esperada:**
```json
{
  "bookingId": "550e8400-e29b-41d4-a716-446655440003",
  "lockId": "550e8400-e29b-41d4-a716-446655440004",
  "status": "pending",
  "expiresAt": "2025-10-15T21:50:00.000Z",
  "slotId": "550e8400-e29b-41d4-a716-446655440002",
  "experienceId": "550e8400-e29b-41d4-a716-446655440001",
  "totalCents": 150000,
  "subtotalCents": 130435,
  "taxCents": 19565,
  "currency": "COP"
}
```

### 2.2 Crear Pago
```bash
# Usar el bookingId de la respuesta anterior
export BOOKING_ID="550e8400-e29b-41d4-a716-446655440003"

curl -X POST "$PAYMENTS_BASE" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOURIST_TOKEN" \
  -H "Idempotency-Key: payment-$(date +%s)" \
  -d '{
    "bookingId": "'$BOOKING_ID'",
    "provider": "wompi",
    "customerEmail": "juan.perez@example.com",
    "redirectUrl": "https://myapp.com/payment/success",
    "customerData": {
      "fullName": "Juan Pérez",
      "phoneNumber": "+57300123456"
    }
  }'
```

**Respuesta esperada:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440005",
  "bookingId": "550e8400-e29b-41d4-a716-446655440003",
  "provider": "wompi",
  "amount": 150000,
  "currency": "COP",
  "status": "pending",
  "checkoutUrl": "https://checkout.wompi.co/p/abc123def456",
  "expiresAt": "2025-10-15T21:50:00.000Z",
  "createdAt": "2025-10-15T21:35:00.000Z"
}
```

### 2.3 Consultar Estado del Pago
```bash
export PAYMENT_ID="550e8400-e29b-41d4-a716-446655440005"

curl -X GET "$PAYMENTS_BASE/$PAYMENT_ID" \
  -H "Authorization: Bearer $TOURIST_TOKEN"
```

### 2.4 Consultar Pagos por Booking
```bash
curl -X GET "$PAYMENTS_BASE/booking/$BOOKING_ID" \
  -H "Authorization: Bearer $TOURIST_TOKEN"
```

## 3. Simulación de Webhooks

### 3.1 Webhook de Pago Exitoso (Wompi)
```bash
# Simular webhook de Wompi para pago exitoso
curl -X POST "$PAYMENTS_BASE/webhooks/wompi" \
  -H "Content-Type: application/json" \
  -H "wompi-signature: t=1697389200,v1=abc123def456..." \
  -d '{
    "event": "transaction.updated",
    "data": {
      "transaction": {
        "id": "wompi-tx-123456",
        "amount_in_cents": 150000,
        "currency": "COP",
        "status": "APPROVED",
        "reference": "'$PAYMENT_ID'",
        "payment_method": {
          "type": "CARD",
          "extra": {
            "bin": "424242",
            "last_four": "4242",
            "brand": "VISA"
          }
        },
        "created_at": "2025-10-15T21:35:00.000Z",
        "finalized_at": "2025-10-15T21:36:30.000Z"
      }
    },
    "sent_at": "2025-10-15T21:36:35.000Z"
  }'
```

### 3.2 Webhook de Pago Fallido
```bash
curl -X POST "$PAYMENTS_BASE/webhooks/wompi" \
  -H "Content-Type: application/json" \
  -H "wompi-signature: t=1697389200,v1=def456abc123..." \
  -d '{
    "event": "transaction.updated",
    "data": {
      "transaction": {
        "id": "wompi-tx-789012",
        "amount_in_cents": 150000,
        "currency": "COP",
        "status": "DECLINED",
        "reference": "'$PAYMENT_ID'",
        "status_message": "Insufficient funds",
        "created_at": "2025-10-15T21:35:00.000Z",
        "finalized_at": "2025-10-15T21:36:30.000Z"
      }
    },
    "sent_at": "2025-10-15T21:36:35.000Z"
  }'
```

## 4. Sistema de Refunds

### 4.1 Crear Refund Total
```bash
curl -X POST "$PAYMENTS_BASE/refunds" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOURIST_TOKEN" \
  -d '{
    "paymentId": "'$PAYMENT_ID'",
    "reason": "Customer requested cancellation"
  }'
```

### 4.2 Crear Refund Parcial
```bash
curl -X POST "$PAYMENTS_BASE/refunds" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOURIST_TOKEN" \
  -d '{
    "paymentId": "'$PAYMENT_ID'",
    "amountCents": 75000,
    "reason": "Partial service cancellation"
  }'
```

## 5. Testing de Idempotencia

### 5.1 Crear Pago Duplicado (debe fallar)
```bash
# Usar la misma Idempotency-Key dos veces
IDEMPOTENCY_KEY="test-idempotency-$(date +%s)"

# Primera llamada
curl -X POST "$PAYMENTS_BASE" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOURIST_TOKEN" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -d '{
    "bookingId": "'$BOOKING_ID'",
    "provider": "wompi",
    "customerEmail": "test@example.com"
  }'

# Segunda llamada (debe retornar el mismo resultado)
curl -X POST "$PAYMENTS_BASE" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOURIST_TOKEN" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -d '{
    "bookingId": "'$BOOKING_ID'",
    "provider": "wompi",
    "customerEmail": "test@example.com"
  }'
```

### 5.2 Webhook Duplicado (debe ser idempotente)
```bash
# Enviar el mismo webhook dos veces
WEBHOOK_PAYLOAD='{
  "event": "transaction.updated",
  "data": {
    "transaction": {
      "id": "wompi-tx-duplicate-test",
      "amount_in_cents": 150000,
      "currency": "COP",
      "status": "APPROVED",
      "reference": "'$PAYMENT_ID'"
    }
  }
}'

# Primera llamada
curl -X POST "$PAYMENTS_BASE/webhooks/wompi" \
  -H "Content-Type: application/json" \
  -H "wompi-signature: t=1697389200,v1=duplicate123..." \
  -d "$WEBHOOK_PAYLOAD"

# Segunda llamada (debe ser ignorada)
curl -X POST "$PAYMENTS_BASE/webhooks/wompi" \
  -H "Content-Type: application/json" \
  -H "wompi-signature: t=1697389200,v1=duplicate123..." \
  -d "$WEBHOOK_PAYLOAD"
```

## 6. Testing de Errores

### 6.1 Pago con Booking Inexistente
```bash
curl -X POST "$PAYMENTS_BASE" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOURIST_TOKEN" \
  -d '{
    "bookingId": "00000000-0000-0000-0000-000000000000",
    "provider": "wompi",
    "customerEmail": "test@example.com"
  }'
```

### 6.2 Pago sin Autenticación
```bash
curl -X POST "$PAYMENTS_BASE" \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "'$BOOKING_ID'",
    "provider": "wompi",
    "customerEmail": "test@example.com"
  }'
```

### 6.3 Refund de Pago No Pagado
```bash
curl -X POST "$PAYMENTS_BASE/refunds" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOURIST_TOKEN" \
  -d '{
    "paymentId": "00000000-0000-0000-0000-000000000000",
    "reason": "Test refund"
  }'
```

### 6.4 Webhook con Firma Inválida
```bash
curl -X POST "$PAYMENTS_BASE/webhooks/wompi" \
  -H "Content-Type: application/json" \
  -H "wompi-signature: invalid-signature" \
  -d '{
    "event": "transaction.updated",
    "data": {
      "transaction": {
        "id": "wompi-tx-invalid",
        "status": "APPROVED"
      }
    }
  }'
```

## 7. Testing con Diferentes Proveedores

### 7.1 Pago con PayPal
```bash
curl -X POST "$PAYMENTS_BASE" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOURIST_TOKEN" \
  -d '{
    "bookingId": "'$BOOKING_ID'",
    "provider": "paypal",
    "customerEmail": "test@example.com"
  }'
```

### 7.2 Webhook de PayPal - Pago Aprobado
```bash
curl -X POST "$PAYMENTS_BASE/webhooks/paypal" \
  -H "Content-Type: application/json" \
  -H "paypal-transmission-id: 12345-67890" \
  -d '{
    "id": "WH-2WR32451HC0233532-67976317FL4543714",
    "event_version": "1.0",
    "create_time": "2025-10-15T21:41:28Z",
    "resource_type": "checkout-order",
    "event_type": "CHECKOUT.ORDER.APPROVED",
    "summary": "An order has been approved by buyer",
    "resource": {
      "id": "'$PAYMENT_ID'",
      "status": "APPROVED",
      "intent": "CAPTURE",
      "purchase_units": [{
        "reference_id": "'$PAYMENT_ID'",
        "amount": {
          "currency_code": "USD",
          "value": "15.00"
        }
      }]
    }
  }'
```

### 7.3 Webhook de PayPal - Pago Capturado
```bash
curl -X POST "$PAYMENTS_BASE/webhooks/paypal" \
  -H "Content-Type: application/json" \
  -H "paypal-transmission-id: 12345-67891" \
  -d '{
    "id": "WH-2WR32451HC0233533-67976317FL4543715",
    "event_version": "1.0",
    "create_time": "2025-10-15T21:42:15Z",
    "resource_type": "capture",
    "event_type": "PAYMENT.CAPTURE.COMPLETED",
    "summary": "Payment completed for $ 15.00 USD",
    "resource": {
      "id": "8MC585209K746392H",
      "status": "COMPLETED",
      "amount": {
        "currency_code": "USD",
        "value": "15.00"
      },
      "supplementary_data": {
        "related_ids": {
          "order_id": "'$PAYMENT_ID'"
        }
      }
    }
  }'
```

### 7.4 Pago con ePayco (futuro)
```bash
curl -X POST "$PAYMENTS_BASE" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOURIST_TOKEN" \
  -d '{
    "bookingId": "'$BOOKING_ID'",
    "provider": "epayco",
    "customerEmail": "test@example.com"
  }'
```

## 8. Consultas de Admin

### 8.1 Ver Cualquier Pago (Admin)
```bash
curl -X GET "$PAYMENTS_BASE/$PAYMENT_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### 8.2 Ver Pagos de Cualquier Booking (Admin)
```bash
curl -X GET "$PAYMENTS_BASE/booking/$BOOKING_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## 9. Scripts de Testing Automatizado

### 9.1 Flujo Completo Exitoso
```bash
#!/bin/bash
# test_payment_flow.sh

set -e

echo "🚀 Iniciando test de flujo completo de pagos..."

# 1. Crear booking
echo "📝 Creando booking pending..."
BOOKING_RESPONSE=$(curl -s -X POST "$API_BASE/bookings" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOURIST_TOKEN" \
  -H "Idempotency-Key: booking-$(date +%s)" \
  -d '{
    "experienceId": "'$EXPERIENCE_ID'",
    "slotId": "'$SLOT_ID'",
    "adults": 2,
    "children": 0,
    "customerInfo": {
      "firstName": "Test",
      "lastName": "User",
      "email": "test@example.com",
      "phone": "+57300123456"
    }
  }')

BOOKING_ID=$(echo $BOOKING_RESPONSE | jq -r '.bookingId')
echo "✅ Booking creado: $BOOKING_ID"

# 2. Crear pago
echo "💳 Creando pago..."
PAYMENT_RESPONSE=$(curl -s -X POST "$PAYMENTS_BASE" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOURIST_TOKEN" \
  -H "Idempotency-Key: payment-$(date +%s)" \
  -d '{
    "bookingId": "'$BOOKING_ID'",
    "provider": "wompi",
    "customerEmail": "test@example.com"
  }')

PAYMENT_ID=$(echo $PAYMENT_RESPONSE | jq -r '.id')
echo "✅ Pago creado: $PAYMENT_ID"

# 3. Simular webhook exitoso
echo "🔔 Simulando webhook de pago exitoso..."
curl -s -X POST "$PAYMENTS_BASE/webhooks/wompi" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "transaction.updated",
    "data": {
      "transaction": {
        "id": "test-tx-'$(date +%s)'",
        "amount_in_cents": 150000,
        "currency": "COP",
        "status": "APPROVED",
        "reference": "'$PAYMENT_ID'"
      }
    }
  }' > /dev/null

echo "✅ Webhook procesado"

# 4. Verificar estado final
echo "🔍 Verificando estado final..."
FINAL_STATE=$(curl -s -X GET "$PAYMENTS_BASE/$PAYMENT_ID" \
  -H "Authorization: Bearer $TOURIST_TOKEN")

STATUS=$(echo $FINAL_STATE | jq -r '.status')
echo "✅ Estado final del pago: $STATUS"

if [ "$STATUS" = "paid" ]; then
  echo "🎉 ¡Flujo completado exitosamente!"
else
  echo "❌ Error: Estado esperado 'paid', obtenido '$STATUS'"
  exit 1
fi
```

### 9.2 Test de Carga
```bash
#!/bin/bash
# load_test.sh

echo "🔥 Iniciando test de carga..."

for i in {1..10}; do
  echo "Procesando pago $i/10..."
  
  # Crear booking único
  BOOKING_RESPONSE=$(curl -s -X POST "$API_BASE/bookings" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOURIST_TOKEN" \
    -H "Idempotency-Key: load-booking-$i-$(date +%s)" \
    -d '{
      "experienceId": "'$EXPERIENCE_ID'",
      "slotId": "'$SLOT_ID'",
      "adults": 1,
      "children": 0,
      "customerInfo": {
        "firstName": "Load",
        "lastName": "Test'$i'",
        "email": "load'$i'@example.com",
        "phone": "+5730012345'$i'"
      }
    }')
  
  BOOKING_ID=$(echo $BOOKING_RESPONSE | jq -r '.bookingId')
  
  # Crear pago
  curl -s -X POST "$PAYMENTS_BASE" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOURIST_TOKEN" \
    -H "Idempotency-Key: load-payment-$i-$(date +%s)" \
    -d '{
      "bookingId": "'$BOOKING_ID'",
      "provider": "wompi",
      "customerEmail": "load'$i'@example.com"
    }' > /dev/null
  
  echo "✅ Pago $i completado"
done

echo "🎉 Test de carga completado"
```

## 10. Validaciones de Respuesta

### Verificar Estructura de Respuesta de Pago
```bash
# Crear pago y validar estructura
RESPONSE=$(curl -s -X POST "$PAYMENTS_BASE" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOURIST_TOKEN" \
  -d '{
    "bookingId": "'$BOOKING_ID'",
    "provider": "wompi",
    "customerEmail": "test@example.com"
  }')

# Validar campos requeridos
echo $RESPONSE | jq -e '.id' > /dev/null && echo "✅ ID presente"
echo $RESPONSE | jq -e '.checkoutUrl' > /dev/null && echo "✅ Checkout URL presente"
echo $RESPONSE | jq -e '.status' > /dev/null && echo "✅ Status presente"
echo $RESPONSE | jq -e '.amount' > /dev/null && echo "✅ Amount presente"
```

## Notas Importantes

1. **Reemplazar Variables**: Asegúrate de reemplazar todas las variables de ejemplo con valores reales de tu entorno.

2. **Tokens de Autenticación**: Los tokens JWT expiran, necesitarás renovarlos periódicamente.

3. **Webhooks en Desarrollo**: Para testing local de webhooks, considera usar herramientas como ngrok para exponer tu servidor local.

4. **Firmas de Webhook**: En producción, las firmas de webhook deben ser válidas. Para testing, puedes desactivar temporalmente la validación.

5. **Base de Datos**: Asegúrate de que la base de datos tenga datos de prueba (experiencias, slots, usuarios) antes de ejecutar los tests.

6. **Logs**: Revisa los logs del servidor para debugging en caso de errores.

7. **Wompi Sandbox**: Usa las credenciales de sandbox de Wompi para testing seguro.
