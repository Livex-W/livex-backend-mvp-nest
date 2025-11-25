# 🤝 Sistema de Agentes e Intermediarios - LIVEX

Este documento detalla la funcionalidad de **Agentes Intermediarios**, que permite a usuarios externos (vendedores, recepcionistas, afiliados) vender productos de Resorts a cambio de una comisión específica.

---

## 🎯 Concepto General

El sistema permite que un usuario (Agente) esté asociado a uno o varios Resorts. Cuando este agente realiza una venta (o comparte un link que resulta en venta), el sistema:
1. Identifica al agente.
2. Calcula su comisión basada en el acuerdo específico con ese Resort.
3. Registra la deuda/pago pendiente al agente.
4. Separa esto de la comisión de la plataforma (LIVEX).

---

## 🏗️ Arquitectura de Base de Datos

Para soportar esto, se han implementado 3 cambios clave en la base de datos:

### 1. Tabla de Acuerdos (`resort_agents`)
Define la relación "Quién vende qué y a cuánto".
- **`resort_id`**: El hotel/resort dueño del producto.
- **`user_id`**: El intermediario.
- **`commission_bps`**: La comisión pactada en Basis Points (Ej: `1500` = 15%).
- **Restricción**: Un agente solo puede tener un acuerdo activo por resort a la vez.

### 2. Rastro en la Reserva (`bookings`)
- **`agent_id`**: Columna nueva que guarda el ID del usuario que hizo la venta. Si es `NULL`, es una venta directa.

### 3. Registro de Ganancias (`agent_commissions`)
Lleva la contabilidad separada para los agentes.
- **`booking_id`**: De qué venta salió el dinero.
- **`amount_cents`**: Cuánto dinero ganó el agente.
- **`status`**: `pending` (por pagar al agente), `paid` (ya pagado).

---

## 🔄 Flujo de Venta con Agente

### 1. Inicio de Reserva (Frontend)
Cuando el agente está logueado o se usa su link de referido, el Frontend debe enviar su ID al crear la reserva.

**Endpoint**: `POST /api/v1/bookings`
```json
{
  "slotId": "uuid-slot",
  "experienceId": "uuid-experience",
  "adults": 2,
  "agentId": "uuid-del-agente" // <--- Campo Opcional Nuevo
}
```

### 2. Confirmación y Cálculo (Backend)
El cálculo ocurre automáticamente en el `PaymentsService` cuando se confirma el pago (Webhook `paid`).

**Lógica de Distribución:**
1. **Comisión LIVEX**: Se calcula primero (ej. 10% global).
2. **Comisión AGENTE**:
   - El sistema verifica si el booking tiene `agent_id`.
   - Busca en `resort_agents` el porcentaje pactado para ese resort.
   - Calcula el monto y lo guarda en `agent_commissions`.

---

## 💰 Ejemplo de Distribución de Dinero

Supongamos una venta de un Pasadía por **$100.00 USD** (10,000 cents).

| Concepto | Tasa | Cálculo | Monto | Destino |
|----------|------|---------|-------|---------|
| **Venta Total** | - | - | **$100.00** | Pasarela de Pagos |
| Comisión LIVEX | 10% (1000 bps) | $100 * 0.10 | **-$10.00** | Plataforma |
| Comisión Agente | 15% (1500 bps) | $100 * 0.15 | **-$15.00** | Billetera del Agente |
| **Neto Resort** | - | $100 - $10 - $15 | **$75.00** | Cuenta del Resort |

> **Nota**: Los cálculos se hacen en `cents` y `bps` para precisión exacta.

### 🇨🇴 Ejemplo con Pesos Colombianos (COP)

El sistema maneja **siempre** los montos multiplicados por 100 (centavos), incluso para monedas que no suelen usar decimales como el Peso Colombiano.

**Venta de Pasadía: $200,000 COP**

| Concepto | Tasa | Valor Real | Valor en BD (`cents`) | Destino |
|----------|------|------------|-----------------------|---------|
| **Venta Total** | - | **$200,000** | **20,000,000** | Pasarela |
| Comisión LIVEX | 10% | **-$20,000** | **-2,000,000** | Plataforma |
| Comisión Agente | 15% | **-$30,000** | **-3,000,000** | Agente |
| **Neto Resort** | - | **$150,000** | **15,000,000** | Resort |

> **Cálculo**: `20,000,000 - 2,000,000 (Livex) - 3,000,000 (Agente) = 15,000,000`

**Regla de Oro**:
- Al **guardar** en BD: Multiplicar por 100.
- Al **mostrar** en Frontend: Dividir por 100.

---

## 🛠️ Guía de Gestión (Cómo hacer...)

### ¿Cómo registrar un nuevo Agente?
Actualmente se hace vía base de datos (o futuro endpoint Admin).

```sql
INSERT INTO resort_agents (resort_id, user_id, commission_bps)
VALUES (
    'uuid-del-resort',
    'uuid-del-usuario-vendedor',
    1500 -- 15% de comisión
);
```

### ¿Cómo cambiar la comisión de un Agente?
Simplemente actualiza su acuerdo. Las reservas pasadas NO cambian, solo las futuras.

```sql
UPDATE resort_agents 
SET commission_bps = 2000 -- Subir a 20%
WHERE user_id = 'uuid-agente' AND resort_id = 'uuid-resort';
```

### ¿Cómo ver cuánto se le debe a un Agente?
Consultando la tabla de comisiones.

```sql
SELECT SUM(amount_cents) as deuda_total
FROM agent_commissions
WHERE agent_id = 'uuid-agente' 
AND status = 'pending';
```

---

## ⚠️ Consideraciones Importantes

1. **Validación**: Si envías un `agentId` que no tiene acuerdo (`resort_agents`) con el resort de la experiencia, la venta se procesa pero **NO se genera comisión** para el agente (se genera un warning en los logs).
2. **Reembolsos**: Si se hace un reembolso (`refund`) de la reserva, el sistema **NO cancela automáticamente** la comisión del agente hoy en día. Esto debe ser un proceso manual o una mejora futura (Reconciliación de Agentes).
