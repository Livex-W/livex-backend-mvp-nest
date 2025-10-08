#!/bin/bash

# Script para probar el sistema de notificaciones de LIVEX
# Asegúrate de que la API esté ejecutándose en localhost:3000

BASE_URL="http://localhost:3000"
EMAIL="test@example.com"

if command -v jq >/dev/null 2>&1; then
    format_json() {
        jq '.'
    }
else
    echo "⚠️  'jq' no encontrado. Mostrando respuestas sin formatear. Instala con: sudo apt-get install jq"
    format_json() {
        cat
    }
fi

echo "🚀 Probando Sistema de Notificaciones LIVEX"
echo "============================================="

# Función para hacer requests
make_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    
    echo "📡 $method $endpoint"
    
    if [ -n "$data" ]; then
        curl -s -X $method \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$endpoint" | format_json
    else
        curl -s -X $method "$BASE_URL$endpoint" | format_json
    fi
    
    echo ""
}

echo "1. 📊 Verificando estadísticas de colas..."
make_request "GET" "/notifications/queue/stats"

echo "2. 📋 Listando plantillas disponibles..."
make_request "GET" "/notifications/templates"

echo "3. ✉️ Enviando email de bienvenida de prueba..."
make_request "POST" "/notifications/email/test" "{
    \"to\": \"$EMAIL\",
    \"templateType\": \"welcome\"
}"

echo "4. 🎯 Simulando evento de registro de usuario..."
make_request "POST" "/notifications/events/simulate/user.registered" "{
    \"userEmail\": \"$EMAIL\",
    \"userName\": \"Usuario de Prueba\"
}"

echo "5. 📅 Simulando confirmación de reserva..."
make_request "POST" "/notifications/events/simulate/booking.confirmed" "{
    \"customerEmail\": \"$EMAIL\",
    \"customerName\": \"Juan Pérez\",
    \"experienceName\": \"Tour en Kayak por la Bahía\",
    \"bookingDate\": \"2024-01-15\",
    \"bookingTime\": \"10:00 AM\",
    \"guestCount\": 2,
    \"totalAmount\": 150000,
    \"bookingCode\": \"LVX-TEST-001\"
}"

echo "6. 💳 Simulando confirmación de pago..."
make_request "POST" "/notifications/events/simulate/payment.confirmed" "{
    \"customerEmail\": \"$EMAIL\",
    \"customerName\": \"Juan Pérez\",
    \"amount\": 150000,
    \"bookingCode\": \"LVX-TEST-001\"
}"

echo "7. 🏨 Simulando aprobación de prestador..."
make_request "POST" "/notifications/events/simulate/resort.approved" "{
    \"resortEmail\": \"$EMAIL\",
    \"resortName\": \"Resort de Prueba\"
}"

echo "8. 📧 Enviando notificación directa con plantilla personalizada..."
make_request "POST" "/notifications/email/send" "{
    \"to\": \"$EMAIL\",
    \"templateType\": \"booking_confirmation\",
    \"templateData\": {
        \"customerName\": \"María García\",
        \"experienceName\": \"Caminata Ecológica\",
        \"bookingDate\": \"2024-01-20\",
        \"bookingTime\": \"8:00 AM\",
        \"guestCount\": 4,
        \"totalAmount\": 200000,
        \"bookingCode\": \"LVX-TEST-002\"
    },
    \"priority\": \"high\"
}"

echo "9. ⏰ Enviando notificación programada..."
FUTURE_DATE=$(date -d "+1 hour" -Iseconds)
make_request "POST" "/notifications/email/send" "{
    \"to\": \"$EMAIL\",
    \"templateType\": \"booking_reminder\",
    \"templateData\": {
        \"customerName\": \"Carlos López\",
        \"experienceName\": \"Buceo en Arrecife\",
        \"bookingDate\": \"2024-01-25\",
        \"bookingTime\": \"9:00 AM\",
        \"location\": \"Parque Nacional Tayrona\",
        \"bookingCode\": \"LVX-TEST-003\"
    },
    \"priority\": \"medium\",
    \"scheduledAt\": \"$FUTURE_DATE\"
}"

echo "10. 📊 Verificando estadísticas finales..."
make_request "GET" "/notifications/queue/stats"

echo ""
echo "✅ Pruebas completadas!"
echo ""
echo "📧 Revisa tu cliente de email o Mailhog (http://localhost:8025) para ver los emails enviados."
echo ""
echo "🔧 Para ejecutar el worker de notificaciones:"
echo "   npm run notification-worker:dev"
echo ""
echo "🐰 Para verificar RabbitMQ Management:"
echo "   http://localhost:15672 (guest/guest)"

