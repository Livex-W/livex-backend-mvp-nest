# 🚀 Sistema Avanzado de Códigos de Referido v2.0 - LIVEX

## 📋 Novedades de la Versión 2.0

Esta versión amplía el sistema básico de códigos con 5 funcionalidades enterprise:
1. ✅ **Restricciones por Producto/Categoría**
2. ✅ **Code Stacking** (Códigos combinables)
3. ✅ **A/B Testing** con variantes
4. ✅ **Dashboard de Analytics**
5. ✅ **Mínimos de compra y límites de descuento**

---

## 🎯 Funcionalidad 1: Restricciones de Uso

### ¿Para qué sirve?
Permite que un código solo funcione para:
- **Experiencias específicas**: "PROMO-KAYAK" solo para "Sunset Kayak Tour"
- **Categorías**: "NAUTICAL20" solo para tours náuticos
- **Resorts**: "MARRIOTT15" solo para productos de Marriott

### Estructura de Datos
```sql
CREATE TABLE referral_code_restrictions (
    referral_code_id UUID,
    restriction_type TEXT ('experience', 'category', 'resort'),
    experience_id UUID,      -- Solo uno de estos se llena
    category_slug TEXT,      -- según el restriction_type
    resort_id UUID
);
```

### Ejemplos de Uso

**Caso 1: Código solo para "Sunset Sailing"**
```bash
POST /agents/referral-codes/{code_id}/restrictions
{
  "restrictionType": "experience",
  "experienceId": "uuid-sunset-sailing"
}
```

**Caso 2: "20% OFF en Tours Náuticos"**
```bash
POST /agents/referral-codes/{code_id}/restrictions
{
  "restrictionType": "category",
  "categorySlug": "nautical"
}
```

**Caso 3: Código exclusivo para un Resort**
```bash
POST /agents/referral-codes/{code_id}/restrictions
{
  "restrictionType": "resort",
  "resortId": "uuid-del-resort"
}
```

### Validación Automática
Cuando un cliente intenta usar el código:
1. El sistema verifica si hay restricciones
2. Compara la experiencia seleccionada con las reglas
3. ❌ Rechaza si no cumple: `"Referral code not valid for this experience"`

---

## 🔗 Funcionalidad 2: Code Stacking

### ¿Qué es?
Permite combinar múltiples códigos en una misma compra.

**Ejemplo:**
- Código base: `VERANO10` (10% OFF)
- Código combinable: `FIRST5` (5% adicional)
- **Descuento total**: 15% 🎉

### Campo Nuevo
```sql
ALTER TABLE referral_codes 
ADD COLUMN allow_stacking BOOLEAN DEFAULT false;
```

### Cómo Funciona
1. Solo códigos con `allow_stacking = true` se pueden combinar
2. El cliente envía un array de códigos: `["VERANO10", "FIRST5"]`
3. El sistema aplica ambos descuentos y los registra en `booking_referral_codes`

### Crear Código Stackable
```json
{
  "code": "EXTRA10",
  "codeType": "discount",
  "discountType": "percentage",
  "discountValue": 1000,
  "allowStacking": true  // <-- Permite combinación
}
```

### Tabla de Registro
```sql
CREATE TABLE booking_referral_codes (
    booking_id UUID,
    referral_code_id UUID,
    discount_applied_cents INTEGER
);
```
Esto permite rastrear exactamente cuánto descuento dio cada código.

---

## 🧪 Funcionalidad 3: A/B Testing

### ¿Para qué sirve?
Crear **variantes** de un código para probar cuál convierte mejor.

**Ejemplo Real:**
- **Código padre**: `VERANO2025`
  - Variante A: `VERANO2025A` → 15% OFF
  - Variante B: `VERANO2025B` → 5% OFF
- Reparte el tráfico 50/50 y mide cuál genera más ventas

### Estructura
```sql
CREATE TABLE referral_code_variants (
    parent_code_id UUID,
    variant_name TEXT ('Variant A', 'Variant B', 'Control'),
    code TEXT UNIQUE,
    discount_value INTEGER,      -- Override del padre
    usage_count INTEGER,
    conversion_count INTEGER,    -- Confirmados
    is_active BOOLEAN
);
```

### Crear Variante
```bash
POST /agents/referral-codes/{parent_id}/variants
{
  "variantName": "Variant A - 15%",
  "code": "VERANO2025A",
  "discountValue": 1500
}
```

### Analytics de Variantes
```bash
GET /agents/referral-codes/{code_id}/variant-analytics
```

**Respuesta:**
```json
[
  {
    "variant_name": "Variant A - 15%",
    "code": "VERANO2025A",
    "usage_count": 120,
    "conversion_count": 84,
    "conversion_rate_pct": 70.00  // 🏆 Ganadora
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

### Decisión
Con estos datos, el agente puede:
1. Pausar la variante perdedora
2. Escalar la ganadora (más presupuesto de marketing)

---

## 📊 Funcionalidad 4: Dashboard de Analytics

### Vista SQL Automática
```sql
CREATE VIEW v_referral_code_analytics AS
SELECT 
    code_id,
    code,
    usage_count,                    -- Veces usado
    total_bookings,                 -- Reservas generadas
    confirmed_bookings,             -- Confirmadas (pagadas)
    total_revenue_cents,            -- Revenue total
    avg_order_value_cents,          -- Ticket promedio
    total_discounts_given_cents,    -- Descuentos dados
    conversion_rate_pct,            -- % de confirmación
    first_use,                      -- Primera vez usado
    last_use                        -- Última vez usado
FROM referral_codes ...
```

### Endpoint
```bash
GET /agents/analytics?codeId={optional}
```

**Sin `codeId`**: Todos los códigos del agente
**Con `codeId`**: Solo ese código específico

### Ejemplo de Respuesta
```json
{
  "code": "VERANO2025",
  "usage_count": 450,
  "total_bookings": 450,
  "confirmed_bookings": 315,
  "total_revenue_cents": 75000000,  // $750,000 COP generados
  "avg_order_value_cents": 238095,  // $2,381 COP promedio
  "total_discounts_given_cents": 7500000,  // $75,000 COP en descuentos
  "conversion_rate_pct": 70.00,
  "first_use": "2025-06-01T10:00:00Z",
  "last_use": "2025-09-15T18:30:00Z"
}
```

### Métricas Clave
- **ROI del Código**: `(total_revenue - total_discounts) / total_discounts`
- **Tasa de Conversión**: Indica efectividad
- **Ticket Promedio**: Ayuda a identificar códigos de alto valor

---

## 💰 Funcionalidad 5: Límites de Compra

### Campos Nuevos
```sql
ALTER TABLE referral_codes 
ADD COLUMN min_purchase_cents INTEGER DEFAULT 0,
ADD COLUMN max_discount_cents INTEGER;
```

### Mínimo de Compra
**Ejemplo:** "ENVIOGRATIS" solo si compras más de $50,000 COP

```json
{
  "code": "ENVIOGRATIS",
  "minPurchaseCents": 5000000  // $50,000 COP en centavos
}
```

**Validación:**
```typescript
if (totalCents < code.min_purchase_cents) {
  throw new BadRequestException('Minimum purchase not met');
}
```

### Máximo Descuento
**Ejemplo:** "BLACKFRIDAY50" da 50% OFF pero máximo $100,000 COP

```json
{
  "code": "BLACKFRIDAY50",
  "discountType": "percentage",
  "discountValue": 5000,  // 50%
  "maxDiscountCents": 10000000  // Máximo $100,000 COP
}
```

**Lógica:**
```typescript
let discount = (total * 0.50);
if (discount > maxDiscountCents) {
  discount = maxDiscountCents;
}
```

---

## 🛠️ API Endpoints Completos

| Categoría | Método | Ruta | Descripción |
|-----------|--------|------|-------------|
| **Básico** | POST | `/agents/referral-codes` | Crear código |
| **Básico** | GET | `/agents/referral-codes` | Listar mis códigos |
| **Básico** | POST | `/agents/referral-codes/:id/toggle` | Activar/Desactivar |
| **Restricciones** | POST | `/agents/referral-codes/:id/restrictions` | Agregar restricción |
| **Restricciones** | GET | `/agents/referral-codes/:id/restrictions` | Ver restricciones |
| **Restricciones** | DELETE | `/agents/restrictions/:id` | Eliminar restricción |
| **A/B Testing** | POST | `/agents/referral-codes/:id/variants` | Crear variante |
| **A/B Testing** | GET | `/agents/referral-codes/:id/variants` | Listar variantes |
| **A/B Testing** | POST | `/agents/variants/:id/toggle` | Activar/Desactivar variante |
| **A/B Testing** | GET | `/agents/referral-codes/:id/variant-analytics` | Analytics de variantes |
| **Analytics** | GET | `/agents/analytics` | Dashboard general |
| **Analytics** | GET | `/agents/analytics?codeId=X` | Analytics de código específico |

---

## 🧪 Datos de Prueba (Seed)

El sistema incluye ejemplos pre-cargados:

### Códigos Base
1. **CARLOSVIP**: Solo tracking
2. **VERANO2025**: 10% OFF (restringido a `nautical`)
3. **PRIMERACOMPRA**: $20,000 COP fijo (50 usos máx)
4. **EXTRA10**: 10% combinable (mínimo $50,000 COP)

### Restricciones
- `VERANO2025` → Solo categoría `nautical`

### Variantes A/B
- `VERANO2025A` → 15% OFF
- `VERANO2025B` → 5% OFF

---

## 📈 Casos de Uso Reales

### Caso 1: Influencer de Instagram
**Problema:** Quiere dar 15% a sus followers pero solo en tours de isla

**Solución:**
```bash
# 1. Crear código
POST /agents/referral-codes
{
  "code": "INSTA15",
  "codeType": "both",
  "discountValue": 1500
}

# 2. Agregar restricción
POST /agents/referral-codes/{id}/restrictions
{
  "restrictionType": "category",
  "categorySlug": "islands"
}
```

### Caso 2: Black Friday
**Problema:** 50% OFF pero solo hasta $100,000 COP de descuento

**Solución:**
```json
{
  "code": "BLACKFRIDAY50",
  "discountType": "percentage",
  "discountValue": 5000,
  "maxDiscountCents": 10000000
}
```

### Caso 3: Test de Precio
**Problema:** No sé si dar 10% o 20%, quiero probar

**Solución:**
```bash
# Crear variantes
POST /agents/referral-codes/{id}/variants
{ "variantName": "10% Test", "code": "TEST10", "discountValue": 1000 }

POST /agents/referral-codes/{id}/variants
{ "variantName": "20% Test", "code": "TEST20", "discountValue": 2000 }

# Después de 2 semanas, revisar analytics
GET /agents/referral-codes/{id}/variant-analytics
```

---

## 🔮 Roadmap Futuro (No implementado aún)

1. **Auto-generación de códigos únicos** por cliente
2. **Descuentos escalonados**: "Gasta $100K → 10%, Gasta $200K → 20%"
3. **Límites por usuario**: "1 uso por cliente"
4. **Gamificación**: "Usa 3 veces y desbloquea código VIP"
5. **Integración con CRM**: Auto-crear códigos para clientes VIP

---

## ⚠️ Consideraciones Importantes

### Seguridad
- Solo el dueño puede modificar sus códigos
- Las restricciones se validan en el backend
- No se pueden crear códigos duplicados

### Performance
- La vista `v_referral_code_analytics` usa índices optimizados
- Las validaciones de restricciones son O(n) pero n es típicamente pequeño (<10)

### Escalabilidad
- Sistema soporta millones de usos de códigos
- Analytics se pueden pre-calcular con jobs nocturnos
- Stacking está limitado a 5 códigos simultáneos (configurable)

---

**Última actualización**: 2025-11-25 v2.0
**Autor**: Sistema de Agentes LIVEX
