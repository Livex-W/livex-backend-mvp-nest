# Sistema de Reservaciones y Comisiones - LIVEX

> **Versión**: 3.0 | **Fecha**: 2026-01-12

---

## Estructura de Precios en Slots

Los precios definidos en `availability_slots` son el **NETO/BASE** del resort:

```sql
price_per_adult_cents      -- Precio BASE adulto (neto resort)
price_per_child_cents      -- Precio BASE niño (neto resort)
commission_per_adult_cents -- Comisión LIVEX por adulto (adicional)
commission_per_child_cents -- Comisión LIVEX por niño (adicional)
```

---

## Canales de Venta

| Canal | Turista ve | Paga Online | Paga en Resort |
|-------|-----------|-------------|----------------|
| **App Mobile** | Base + Comisión LIVEX | Comisión LIVEX | Base (neto) |
| **BNG Agente** | Base + Comisión Agente | $0 (sin pasarela) | Según tipo de pago |

---

## Flujo App Mobile

### Fórmulas
```
neto_resort = (price_adult × adults) + (price_child × children)
comision_livex = (commission_adult × adults) + (commission_child × children)
total_turista = neto_resort + comision_livex

Pagos:
→ Online (pasarela): comision_livex
→ En resort: neto_resort
```

### Ejemplo: 2 adultos, 1 niño
```
Precio/adulto: $80,000   Comisión LIVEX/adulto: $8,000
Precio/niño:   $40,000   Comisión LIVEX/niño:   $4,000

neto_resort = (80k×2) + (40k×1) = $200,000
comision_livex = (8k×2) + (4k×1) = $20,000
total = $220,000

→ Turista paga $20,000 online (pasarela)
→ Turista paga $200,000 en resort
```

---

## Flujo BNG (Agentes)

### Fórmulas
```
neto_resort = (price_adult × adults) + (price_child × children)  -- Mismo que app
agent_commission = (agent_comm_adult × adults) + (agent_comm_child × children)
total_cliente = neto_resort + agent_commission

Pagos (3 opciones, sin pasarela):
→ full_at_resort: Todo en resort, resort paga comisión al agente después
→ deposit_to_agent: Abono al agente, resto en resort
→ commission_to_agent: Comisión al agente, neto en resort
```

### Ejemplo: 2 adultos, 1 niño

#### 📊 Datos Base

| Concepto | Adulto | Niño | Cantidad | Subtotal |
|----------|--------|------|----------|----------|
| **Precio Base** | $80,000 | $40,000 | 2 adultos + 1 niño | **$200,000** |
| **Comisión Agente** | $25,000 | $10,000 | 2 adultos + 1 niño | **$60,000** |

| Cálculo | Valor |
|---------|-------|
| `neto_resort` | ($80k × 2) + ($40k × 1) = **$200,000** |
| `agent_commission` | ($25k × 2) + ($10k × 1) = **$60,000** |
| `total_cliente` | $200,000 + $60,000 = **$260,000** |

---

#### 💳 Comparación de Tipos de Pago

| Tipo de Pago | Cliente → Agente | Cliente → Resort | Resort → Agente | Balance Final |
|--------------|------------------|------------------|-----------------|---------------|
| **`full_at_resort`** | $0 | $260,000 | $60,000 | ✅ Balanceado |
| **`deposit_to_agent`** *(abono $40k)* | $40,000 | $220,000 | $20,000 | ✅ Balanceado |
| **`commission_to_agent`** | $60,000 | $200,000 | $0 | ✅ Balanceado |

---

#### 📝 Detalle por Tipo

| Tipo | Descripción | Flujo de Dinero |
|------|-------------|-----------------|
| **`full_at_resort`** | Todo se paga en el resort | 1️⃣ Cliente paga **$260,000** en resort → 2️⃣ Resort paga **$60,000** al agente después |
| **`deposit_to_agent`** | Abono parcial al agente | 1️⃣ Cliente paga **$40,000** al agente → 2️⃣ Cliente paga **$220,000** en resort → 3️⃣ Resort paga **$20,000** restantes al agente |
| **`commission_to_agent`** | Comisión completa al agente | 1️⃣ Cliente paga **$60,000** al agente → 2️⃣ Cliente paga **$200,000** en resort → ✅ Nadie debe nada |

---

## Comparación de Flujos

| Aspecto | App Mobile | BNG Agente |
|---------|------------|------------|
| Precio base visible | ❌ Ve el total | ✅ Ve el neto |
| Comisión la define | LIVEX (en slot) | Agente (al crear reserva) |
| Pago online | ✅ Pasarela | ❌ No hay |
| Neto se paga en | Resort | Resort |
| Comisión se paga en | Online | Según tipo de pago |

---

## Campos en `bookings`

### Existentes (sin cambios)
```sql
commission_cents      -- Comisión LIVEX (calculado)
resort_net_cents      -- Neto del resort
agent_id              -- UUID agente (si hay)
```

### Nuevos
```sql
booking_source text DEFAULT 'app',  -- 'app' | 'bng'

-- Comisión del agente (igual estructura que LIVEX)
agent_commission_per_adult_cents integer DEFAULT 0,
agent_commission_per_child_cents integer DEFAULT 0,
agent_commission_cents integer DEFAULT 0,

-- Distribución de pagos físicos (solo BNG)
agent_payment_type text,  -- 'full_at_resort' | 'deposit_to_agent' | 'commission_to_agent'
amount_paid_to_agent_cents integer DEFAULT 0,
amount_paid_to_resort_cents integer DEFAULT 0,
```

---

## Registro en Base de Datos

### App Mobile
```sql
booking_source = 'app'
agent_id = NULL
resort_net_cents = 200000
commission_cents = 20000  -- LIVEX
agent_commission_cents = 0
total_cents = 220000
-- (payment se crea en tabla payments con status='paid')
```

### BNG Agente (tipo commission_to_agent)
```sql
booking_source = 'bng'
agent_id = 'uuid-agente'
resort_net_cents = 200000
commission_cents = 0  -- No hay LIVEX
agent_commission_per_adult_cents = 25000
agent_commission_per_child_cents = 10000
agent_commission_cents = 60000
total_cents = 260000
agent_payment_type = 'commission_to_agent'
amount_paid_to_agent_cents = 60000
amount_paid_to_resort_cents = 200000
-- (NO se crea payment, es físico)
```

---

## Liquidación Agente-Resort

```sql
settlement = agent_commission_cents - amount_paid_to_agent_cents

-- > 0: Resort debe al agente
-- < 0: Agente debe al resort
-- = 0: Balanced (tipo commission_to_agent)
```
