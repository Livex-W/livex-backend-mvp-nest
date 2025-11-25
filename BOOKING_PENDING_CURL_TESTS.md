# Comandos cURL para Probar el Sistema de Booking Pending

## Variables de Entorno

```bash
# Configurar variables base
export API_BASE="http://localhost:3000/api/v1"
export AUTH_TOKEN="your-jwt-token-here"
export EXPERIENCE_ID="550e8400-e29b-41d4-a716-446655440000"
export SLOT_ID="550e8400-e29b-41d4-a716-446655440001"
export IDEMPOTENCY_KEY="booking-$(date +%s)-$(uuidgen | cut -d'-' -f1)"
```

## 1. Autenticación (Obtener JWT Token)

```bash
# Login para obtener token
curl -X POST "${API_BASE}/auth/login" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }' | jq -r '.access_token'

# Guardar token en variable
export AUTH_TOKEN=$(curl -s -X POST "${API_BASE}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}' \
  | jq -r '.access_token')
```

## 2. Verificar Disponibilidad del Slot

```bash
# Consultar disponibilidad de la experiencia
curl -X GET "${API_BASE}/experiences/${EXPERIENCE_ID}/availability?from=2024-01-15&to=2024-01-20" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Accept: application/json" \
  | jq '.'

# Verificar capacidad específica del slot
curl -X GET "${API_BASE}/availability/slots/${SLOT_ID}/remaining" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Accept: application/json" \
  | jq '.'
```

## 3. Crear Booking Pending

```bash
# Crear booking pending con lock de inventario
curl -X POST "${API_BASE}/bookings" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Idempotency-Key: ${IDEMPOTENCY_KEY}" \
  -H "X-Request-Id: req-$(uuidgen)" \
  -H "Accept-Language: es-CO" \
  -H "Time-Zone: America/Bogota" \
  -d '{
    "slotId": "'${SLOT_ID}'",
    "experienceId": "'${EXPERIENCE_ID}'",
    "adults": 2,
    "children": 1,
    "subtotalCents": 150000,
    "taxCents": 28500,
    "currency": "COP"
  }' \
  | jq '.'

# Guardar booking ID para siguientes pasos
export BOOKING_ID=$(curl -s -X POST "${API_BASE}/bookings" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Idempotency-Key: ${IDEMPOTENCY_KEY}" \
  -d '{
    "slotId": "'${SLOT_ID}'",
    "experienceId": "'${EXPERIENCE_ID}'",
    "adults": 2,
    "children": 1,
    "subtotalCents": 150000,
    "taxCents": 28500,
    "currency": "COP"
  }' | jq -r '.bookingId')

echo "Booking ID: ${BOOKING_ID}"
```

## 4. Verificar Que el Inventario Está Bloqueado

```bash
# Verificar que la capacidad disponible se redujo
curl -X GET "${API_BASE}/availability/slots/${SLOT_ID}/remaining" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Accept: application/json" \
  | jq '.'

# Intentar crear otra reserva con la misma capacidad (debería fallar)
curl -X POST "${API_BASE}/bookings" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Idempotency-Key: booking-test-conflict-$(date +%s)" \
  -d '{
    "slotId": "'${SLOT_ID}'",
    "experienceId": "'${EXPERIENCE_ID}'",
    "adults": 10,
    "children": 0,
    "subtotalCents": 500000,
    "taxCents": 95000,
    "currency": "COP"
  }' \
  | jq '.'
```

## 5. Probar Idempotencia

```bash
# Intentar crear el mismo booking con la misma idempotency key (debería fallar)
curl -X POST "${API_BASE}/bookings" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Idempotency-Key: ${IDEMPOTENCY_KEY}" \
  -d '{
    "slotId": "'${SLOT_ID}'",
    "experienceId": "'${EXPERIENCE_ID}'",
    "adults": 2,
    "children": 1,
    "subtotalCents": 150000,
    "taxCents": 28500,
    "currency": "COP"
  }' \
  | jq '.'
```

## 6. Confirmar Booking (Simular Pago Exitoso)

```bash
# Confirmar el booking pending
curl -X PATCH "${API_BASE}/bookings/${BOOKING_ID}/confirm" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Accept: application/json" \
  -v

# Verificar que el booking cambió a confirmed
curl -X GET "${API_BASE}/bookings/${BOOKING_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Accept: application/json" \
  | jq '.'
```

## 7. Flujo Alternativo: Cancelar Booking

```bash
# Crear otro booking para cancelar
export IDEMPOTENCY_KEY_2="booking-cancel-$(date +%s)-$(uuidgen | cut -d'-' -f1)"

export BOOKING_ID_2=$(curl -s -X POST "${API_BASE}/bookings" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Idempotency-Key: ${IDEMPOTENCY_KEY_2}" \
  -d '{
    "slotId": "'${SLOT_ID}'",
    "experienceId": "'${EXPERIENCE_ID}'",
    "adults": 1,
    "children": 0,
    "subtotalCents": 75000,
    "taxCents": 14250,
    "currency": "COP"
  }' | jq -r '.bookingId')

# Cancelar el booking
curl -X PATCH "${API_BASE}/bookings/${BOOKING_ID_2}/cancel" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "reason": "Usuario cambió de opinión"
  }' \
  -v

# Verificar que el inventario se liberó
curl -X GET "${API_BASE}/availability/slots/${SLOT_ID}/remaining" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Accept: application/json" \
  | jq '.'
```

## 8. Probar Expiración de TTL

```bash
# Crear booking y esperar a que expire (solo para testing con TTL corto)
export IDEMPOTENCY_KEY_3="booking-expire-$(date +%s)-$(uuidgen | cut -d'-' -f1)"

export BOOKING_ID_3=$(curl -s -X POST "${API_BASE}/bookings" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Idempotency-Key: ${IDEMPOTENCY_KEY_3}" \
  -d '{
    "slotId": "'${SLOT_ID}'",
    "experienceId": "'${EXPERIENCE_ID}'",
    "adults": 1,
    "children": 0,
    "subtotalCents": 75000,
    "taxCents": 14250,
    "currency": "COP"
  }' | jq -r '.bookingId')

echo "Booking ID para expiración: ${BOOKING_ID_3}"
echo "Esperando expiración... (15 minutos por defecto)"

# Verificar estado después de TTL
sleep 900  # Esperar 15 minutos (solo para testing)

curl -X GET "${API_BASE}/bookings/${BOOKING_ID_3}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Accept: application/json" \
  | jq '.status'
```

## 9. Consultas de Diagnóstico

```bash
# Ver todos los bookings del usuario
curl -X GET "${API_BASE}/bookings" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Accept: application/json" \
  | jq '.'

# Ver locks activos (endpoint de admin si existe)
curl -X GET "${API_BASE}/admin/inventory-locks/active" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Accept: application/json" \
  | jq '.'

# Ver métricas del sistema
curl -X GET "${API_BASE}/admin/metrics/bookings" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Accept: application/json" \
  | jq '.'
```

## 10. Script de Prueba Completo

```bash
#!/bin/bash

# Script para probar todo el flujo automáticamente
set -e

echo "🚀 Iniciando pruebas del sistema de booking pending..."

# Configurar variables
API_BASE="http://localhost:3000/api/v1"
EXPERIENCE_ID="550e8400-e29b-41d4-a716-446655440000"
SLOT_ID="550e8400-e29b-41d4-a716-446655440001"

# 1. Login
echo "📝 1. Obteniendo token de autenticación..."
AUTH_TOKEN=$(curl -s -X POST "${API_BASE}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}' \
  | jq -r '.access_token')

if [ "$AUTH_TOKEN" = "null" ]; then
  echo "❌ Error: No se pudo obtener el token de autenticación"
  exit 1
fi

echo "✅ Token obtenido: ${AUTH_TOKEN:0:20}..."

# 2. Verificar disponibilidad
echo "📊 2. Verificando disponibilidad inicial..."
INITIAL_CAPACITY=$(curl -s -X GET "${API_BASE}/availability/slots/${SLOT_ID}/remaining" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  | jq -r '.remaining')

echo "✅ Capacidad inicial: ${INITIAL_CAPACITY}"

# 3. Crear booking pending
echo "🎫 3. Creando booking pending..."
IDEMPOTENCY_KEY="test-$(date +%s)-$(uuidgen | cut -d'-' -f1)"

BOOKING_RESPONSE=$(curl -s -X POST "${API_BASE}/bookings" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Idempotency-Key: ${IDEMPOTENCY_KEY}" \
  -d '{
    "slotId": "'${SLOT_ID}'",
    "experienceId": "'${EXPERIENCE_ID}'",
    "adults": 2,
    "children": 1,
    "subtotalCents": 150000,
    "taxCents": 28500,
    "currency": "COP"
  }')

BOOKING_ID=$(echo $BOOKING_RESPONSE | jq -r '.bookingId')
EXPIRES_AT=$(echo $BOOKING_RESPONSE | jq -r '.expiresAt')

echo "✅ Booking creado: ${BOOKING_ID}"
echo "⏰ Expira en: ${EXPIRES_AT}"

# 4. Verificar que el inventario se bloqueó
echo "🔒 4. Verificando bloqueo de inventario..."
NEW_CAPACITY=$(curl -s -X GET "${API_BASE}/availability/slots/${SLOT_ID}/remaining" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  | jq -r '.remaining')

BLOCKED_CAPACITY=$((INITIAL_CAPACITY - NEW_CAPACITY))
echo "✅ Capacidad bloqueada: ${BLOCKED_CAPACITY} (de ${INITIAL_CAPACITY} a ${NEW_CAPACITY})"

# 5. Confirmar booking
echo "💳 5. Confirmando booking (simulando pago exitoso)..."
curl -s -X PATCH "${API_BASE}/bookings/${BOOKING_ID}/confirm" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  > /dev/null

echo "✅ Booking confirmado exitosamente"

# 6. Verificar estado final
echo "📋 6. Verificando estado final..."
FINAL_STATUS=$(curl -s -X GET "${API_BASE}/bookings/${BOOKING_ID}" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  | jq -r '.status')

echo "✅ Estado final del booking: ${FINAL_STATUS}"

echo ""
echo "🎉 ¡Todas las pruebas completadas exitosamente!"
echo "📊 Resumen:"
echo "   - Booking ID: ${BOOKING_ID}"
echo "   - Capacidad inicial: ${INITIAL_CAPACITY}"
echo "   - Capacidad bloqueada: ${BLOCKED_CAPACITY}"
echo "   - Estado final: ${FINAL_STATUS}"
```

## Notas Importantes

### Variables a Personalizar

- `API_BASE`: URL base de tu API
- `EXPERIENCE_ID`: ID de una experiencia existente
- `SLOT_ID`: ID de un slot con capacidad disponible
- Credenciales de login válidas

### Códigos de Respuesta Esperados

- **201**: Booking pending creado exitosamente
- **204**: Booking confirmado/cancelado exitosamente
- **400**: Error de validación o capacidad insuficiente
- **409**: Conflicto de idempotencia o estado inválido

### Troubleshooting

```bash
# Si hay errores de autenticación
curl -X POST "${API_BASE}/auth/refresh" \
  -H "Authorization: Bearer ${REFRESH_TOKEN}"

# Si hay problemas de capacidad
curl -X GET "${API_BASE}/experiences/${EXPERIENCE_ID}/availability" \
  -H "Authorization: Bearer ${AUTH_TOKEN}"

# Para debug del worker
docker logs livex_booking-expiry-worker
```
