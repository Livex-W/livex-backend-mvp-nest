# 🧪 Sistema de Agentes v2 - Pruebas de Integración CURL

Este documento contiene todos los comandos `curl` para probar el sistema completo de agentes con funcionalidades avanzadas.

---

## 📚 Tabla de Contenidos
1. [Gestión de Agentes](#gestión-de-agentes)
2. [Panel del Agente](#panel-del-agente)
3. [Códigos de Referido Básicos](#códigos-de-referido-básicos)
4. [Restricciones de Códigos](#restricciones-de-códigos)
5. [A/B Testing con Variantes](#ab-testing-con-variantes)
6. [Analytics y Métricas](#analytics-y-métricas)
7. [Casos de Uso Avanzados](#casos-de-uso-avanzados)

---

## 🏨 Gestión de Agentes

### 1. Registrar Nuevo Agente
```bash
curl -X POST http://localhost:3000/agents/resorts/{{RESORT_ID}} \
  -H "Authorization: Bearer {{TOKEN}}" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "{{AGENT_USER_ID}}",
    "commissionBps": 1500
  }'
```

### 2. Listar Agentes del Resort
```bash
curl -X GET http://localhost:3000/agents/resorts/{{RESORT_ID}} \
  -H "Authorization: Bearer {{TOKEN}}"
```

### 3. Actualizar Comisión
```bash
curl -X PATCH http://localhost:3000/agents/resorts/{{RESORT_ID}}/users/{{AGENT_USER_ID}} \
  -H "Authorization: Bearer {{TOKEN}}" \
  -H "Content-Type: application/json" \
  -d '{
    "commissionBps": 2000
  }'
```

---

## 💼 Panel del Agente

### 4. Ver Mis Comisiones
```bash
curl -X GET http://localhost:3000/agents/commissions \
  -H "Authorization: Bearer {{TOKEN_DEL_AGENTE}}"
```

### 5. Ver Mis Estadísticas
```bash
curl -X GET http://localhost:3000/agents/stats \
  -H "Authorization: Bearer {{TOKEN_DEL_AGENTE}}"
```

### 6. Ver/Actualizar Mi Perfil
```bash
# Ver perfil
curl -X GET http://localhost:3000/agents/profile \
  -H "Authorization: Bearer {{TOKEN_DEL_AGENTE}}"

# Actualizar datos bancarios
curl -X POST http://localhost:3000/agents/profile \
  -H "Authorization: Bearer {{TOKEN_DEL_AGENTE}}" \
  -H "Content-Type: application/json" \
  -d '{
    "bankName": "Bancolombia",
    "accountNumber": "1234567890",
    "accountType": "savings",
    "accountHolderName": "Carlos Vendedor",
    "taxId": "1234567890"
  }'
```

---

## 🎁 Códigos de Referido Básicos

### 7. Crear Código Simple (Solo Tracking)
```bash
curl -X POST http://localhost:3000/agents/referral-codes \
  -H "Authorization: Bearer {{TOKEN_DEL_AGENTE}}" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "CARLOSVIP",
    "codeType": "commission",
    "description": "Mi código personal"
  }'
```

### 8. Crear Código con Descuento Porcentual
```bash
curl -X POST http://localhost:3000/agents/referral-codes \
  -H "Authorization: Bearer {{TOKEN_DEL_AGENTE}}" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "VERANO2025",
    "codeType": "both",
    "discountType": "percentage",
    "discountValue": 1500,
    "description": "Promo de verano - 15% OFF"
  }'
```

### 9. Crear Código con Descuento Fijo y Límites
```bash
curl -X POST http://localhost:3000/agents/referral-codes \
  -H "Authorization: Bearer {{TOKEN_DEL_AGENTE}}" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "PRIMERACOMPRA",
    "codeType": "both",
    "discountType": "fixed",
    "discountValue": 2000000,
    "usageLimit": 50,
    "expiresAt": "2025-12-31T23:59:59Z",
    "minPurchaseCents": 10000000,
    "maxDiscountCents": 5000000,
    "description": "$20,000 OFF (mín $100K, máx $50K descuento)"
  }'
```

### 10. Crear Código Combinable (Stacking)
```bash
curl -X POST http://localhost:3000/agents/referral-codes \
  -H "Authorization: Bearer {{TOKEN_DEL_AGENTE}}" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "EXTRA10",
    "codeType": "discount",
    "discountType": "percentage",
    "discountValue": 1000,
    "allowStacking": true,
    "minPurchaseCents": 5000000,
    "description": "Extra 10% OFF - Combinable!"
  }'
```

### 11. Listar Mis Códigos
```bash
curl -X GET http://localhost:3000/agents/referral-codes \
  -H "Authorization: Bearer {{TOKEN_DEL_AGENTE}}"
```

### 12. Activar/Desactivar Código
```bash
curl -X POST http://localhost:3000/agents/referral-codes/{{CODE_ID}}/toggle \
  -H "Authorization: Bearer {{TOKEN_DEL_AGENTE}}" \
  -H "Content-Type: application/json" \
  -d '{
    "isActive": false
  }'
```

---

## 🔒 Restricciones de Códigos

### 13. Código Solo para una Experiencia Específica
```bash
curl -X POST http://localhost:3000/agents/referral-codes/{{CODE_ID}}/restrictions \
  -H "Authorization: Bearer {{TOKEN_DEL_AGENTE}}" \
  -H "Content-Type: application/json" \
  -d '{
    "restrictionType": "experience",
    "experienceId": "{{EXPERIENCE_UUID}}"
  }'
```

### 14. Código Solo para una Categoría
```bash
# Ejemplo: Solo tours náuticos
curl -X POST http://localhost:3000/agents/referral-codes/{{CODE_ID}}/restrictions \
  -H "Authorization: Bearer {{TOKEN_DEL_AGENTE}}" \
  -H "Content-Type: application/json" \
  -d '{
    "restrictionType": "category",
    "categorySlug": "nautical"
  }'
```

### 15. Código Solo para un Resort
```bash
curl -X POST http://localhost:3000/agents/referral-codes/{{CODE_ID}}/restrictions \
  -H "Authorization: Bearer {{TOKEN_DEL_AGENTE}}" \
  -H "Content-Type: application/json" \
  -d '{
    "restrictionType": "resort",
    "resortId": "{{RESORT_UUID}}"
  }'
```

### 16. Ver Restricciones de un Código
```bash
curl -X GET http://localhost:3000/agents/referral-codes/{{CODE_ID}}/restrictions \
  -H "Authorization: Bearer {{TOKEN_DEL_AGENTE}}"
```

### 17. Eliminar Restricción
```bash
curl -X DELETE http://localhost:3000/agents/restrictions/{{RESTRICTION_ID}} \
  -H "Authorization: Bearer {{TOKEN_DEL_AGENTE}}"
```

---

## 🧪 A/B Testing con Variantes

### 18. Crear Variante A (15% descuento)
```bash
curl -X POST http://localhost:3000/agents/referral-codes/{{PARENT_CODE_ID}}/variants \
  -H "Authorization: Bearer {{TOKEN_DEL_AGENTE}}" \
  -H "Content-Type: application/json" \
  -d '{
    "variantName": "Variant A - 15%",
    "code": "VERANO2025A",
    "discountValue": 1500
  }'
```

### 19. Crear Variante B (5% descuento)
```bash
curl -X POST http://localhost:3000/agents/referral-codes/{{PARENT_CODE_ID}}/variants \
  -H "Authorization: Bearer {{TOKEN_DEL_AGENTE}}" \
  -H "Content-Type: application/json" \
  -d '{
    "variantName": "Variant B - 5%",
    "code": "VERANO2025B",
    "discountValue": 500,
    "commissionOverrideBps": 750
  }'
```

### 20. Listar Variantes de un Código
```bash
curl -X GET http://localhost:3000/agents/referral-codes/{{CODE_ID}}/variants \
  -H "Authorization: Bearer {{TOKEN_DEL_AGENTE}}"
```

### 21. Activar/Desactivar Variante
```bash
curl -X POST http://localhost:3000/agents/variants/{{VARIANT_ID}}/toggle \
  -H "Authorization: Bearer {{TOKEN_DEL_AGENTE}}" \
  -H "Content-Type: application/json" \
  -d '{
    "isActive": false
  }'
```

---

## 📊 Analytics y Métricas

### 22. Dashboard General (Todos los Códigos)
```bash
curl -X GET http://localhost:3000/agents/analytics \
  -H "Authorization: Bearer {{TOKEN_DEL_AGENTE}}"
```

### 23. Analytics de un Código Específico
```bash
curl -X GET "http://localhost:3000/agents/analytics?codeId={{CODE_UUID}}" \
  -H "Authorization: Bearer {{TOKEN_DEL_AGENTE}}"
```

**Respuesta ejemplo:**
```json
{
  "code_id": "...",
  "code": "VERANO2025",
  "usage_count": 450,
  "total_bookings": 450,
  "confirmed_bookings": 315,
  "total_revenue_cents": 75000000,
  "avg_order_value_cents": 238095,
  "total_discounts_given_cents": 7500000,
  "conversion_rate_pct": 70.00,
  "first_use": "2025-06-01T10:00:00Z",
  "last_use": "2025-09-15T18:30:00Z"
}
```

### 24. Analytics de Variantes (A/B Testing)
```bash
curl -X GET http://localhost:3000/agents/referral-codes/{{CODE_ID}}/variant-analytics \
  -H "Authorization: Bearer {{TOKEN_DEL_AGENTE}}"
```

**Respuesta ejemplo:**
```json
[
  {
    "variant_name": "Variant A - 15%",
    "code": "VERANO2025A",
    "usage_count": 120,
    "conversion_count": 84,
    "conversion_rate_pct": 70.00
  },
  {
    "variant_name": "Variant B - 5%",
    "code": "VERANO2025B",
    "usage_count": 115,
    "conversion_count": 46,
    "conversion_rate_pct": 40.00
  }
]
```

---

## 🛒 Casos de Uso Avanzados

### Caso 1: Usar Código en Reserva
```bash
curl -X POST http://localhost:3000/bookings \
  -H "Authorization: Bearer {{TOKEN_CLIENTE}}" \
  -H "Content-Type: application/json" \
  -d '{
    "slotId": "{{SLOT_UUID}}",
    "experienceId": "{{EXPERIENCE_UUID}}",
    "adults": 2,
    "referralCode": "VERANO2025"
  }'
```

### Caso 2: Código con Restricción (Fallará si no cumple)
```bash
# Este código solo funciona para tours náuticos
curl -X POST http://localhost:3000/bookings \
  -H "Authorization: Bearer {{TOKEN_CLIENTE}}" \
  -H "Content-Type: application/json" \
  -d '{
    "slotId": "{{SLOT_UUID}}",
    "experienceId": "{{NAUTICAL_EXPERIENCE_UUID}}",
    "adults": 2,
    "referralCode": "NAUTICAL20"
  }'
```

### Caso 3: Código con Mínimo de Compra
```bash
# Este código requiere mínimo $50,000 COP de compra
# Si el total es menor, rechaza con error
curl -X POST http://localhost:3000/bookings \
  -H "Authorization: Bearer {{TOKEN_CLIENTE}}" \
  -H "Content-Type: application/json" \
  -d '{
    "slotId": "{{SLOT_UUID}}",
    "experienceId": "{{EXPERIENCE_UUID}}",
    "adults": 4,
    "referralCode": "EXTRA10"
  }'
```

---

## 📋 Resumen de Endpoints

| Categoría | Total |
|-----------|-------|
| Gestión de Agentes | 3 |
| Panel del Agente | 3 |
| Códigos Básicos | 6 |
| Restricciones | 5 |
| A/B Testing | 4 |
| Analytics | 3 |
| **TOTAL** | **24 endpoints** |

---

## ⚡ Tips de Testing

### 1. Flujo Completo de Test
```bash
# 1. Crear código con restricción
CODE_ID=$(curl -X POST ... | jq -r '.id')

# 2. Agregar restricción para "nautical"
curl -X POST .../restrictions -d '{...}'

# 3. Crear 2 variantes A/B
curl -X POST .../variants -d '{...}'

# 4. Simular usos de clientes
# (usar código en 50 reservas)

# 5. Ver analytics
curl -X GET .../variant-analytics
```

### 2. Variables de Entorno (Postman)
```javascript
pm.environment.set("TOKEN_DEL_AGENTE", "eyJhbGc...");
pm.environment.set("CODE_ID", response.id);
pm.environment.set("RESORT_ID", "...");
```

### 3. Test de Validaciones
```bash
# Debe fallar: código inválido
curl ... -d '{"referralCode": "CODIGOINVALIDO"}'

# Debe fallar: mínimo de compra no alcanzado
curl ... -d '{"referralCode": "EXTRA10", "adults": 1}'

# Debe fallar: código no válido para esta categoría
curl ... -d '{"referralCode": "NAUTICAL20", "experienceId": "city-tour-id"}'
```

---

**Versión**: 2.0  
**Última actualización**: 2025-11-25
