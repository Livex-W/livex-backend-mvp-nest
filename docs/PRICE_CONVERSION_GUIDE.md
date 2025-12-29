# Guía de Integración de Conversión de Precios

Este documento explica cómo integrar la conversión de moneda en las APIs de Livex utilizando el sistema de preferencias del usuario y las tasas de cambio dinámicas.

## Componentes del Sistema

El sistema se basa en tres pilares:
1. **UserPreferencesService**: Almacena la moneda preferida del usuario (ej. 'USD', 'COP', 'EUR').
2. **ExchangeRatesService**: Proporciona las tasas de cambio actuales respecto al USD (base).
3. **Price Converter Utility**: Funciones puras para el cálculo y redondeo.

## Utilidad: `convertPrice`

Ubicación: `src/common/utils/price-converter.ts`

### Firma de la Función
```typescript
function convertPrice(
    priceUnits: number,       // Valor en unidades reales (ej: 100.50) o centavos
    sourceCurrency: string,   // Moneda de origen (ej: 'USD')
    targetCurrency: string,   // Moneda de destino (ej: 'COP')
    sourceRate: number,       // Tasa de la moneda origen (relativa a USD)
    targetRate: number,       // Tasa de la moneda destino (relativa a USD)
): number
```

### Lógica de Redondeo
La función aplica automáticamente `roundToNearestThousand` al resultado si este es mayor o igual a **10,000**. Esto es ideal para monedas como el COP, donde no se suelen mostrar valores como $451,234 sino $451,000.

---

## Cómo Integrar en un Servicio

### 1. Inyectar Dependencias
Asegúrate de importar `UserPreferencesModule` y `ExchangeRatesModule` en tu módulo.

```typescript
constructor(
  private readonly userPreferencesService: UserPreferencesService,
  private readonly exchangeRatesService: ExchangeRatesService,
) {}
```

### 2. Obtener Preferencias y Tasas
```typescript
const preferences = await this.userPreferencesService.getOrCreateDefault(userId);
const sourceRate = await this.exchangeRatesService.getRate(sourceCurrency);
const targetRate = await this.exchangeRatesService.getRate(preferences.currency);
```

### 3. Realizar la Conversión
Se recomienda dividir los centavos por 100 antes de la conversión para trabajar con unidades reales.

```typescript
const displayPrice = convertPrice(
  (price_cents / 100),
  sourceCurrency,
  preferences.currency,
  sourceRate,
  targetRate,
);
```

---

## Implementaciones en el Código

Actualmente, la conversión se utiliza en los siguientes puntos:

### 1. Experiencias (`ExperiencesService`)
Se usa en `addDisplayPrices` para convertir el precio base y la comisión.
- **Archivo**: `src/experiences/experiences.service.ts`
- **Campos**: `display_price`, `display_commission`.

### 2. Pagos y Reembolsos (`PaymentsService`)
Se usa para mostrar el monto pagado o reembolsado en la moneda del usuario.
- **Archivo**: `src/payments/payments.service.ts`
- **Campos**: `display_amount`.

### 3. Cupones (`CouponsController`)
Calcula el descuento total y el total final convertido.
- **Archivo**: `src/coupons/coupons.controller.ts`
- **Campos**: `display_total_discount`, `display_final_total`.

### 4. Reservas (`BookingsService`)
Muestra los detalles financieros de la reserva del usuario.
- **Archivo**: `src/bookings/bookings.service.ts`
- **Campos**: `display_subtotal`, `display_tax`, `display_total`.

## Buenas Prácticas

1. **Mantener el Original**: Nunca reemplaces el valor en USD. Devuelve siempre un campo nuevo con el prefijo `display_`.
2. **Validar Tasas**: Si `sourceRate` o `targetRate` son nulos, devuelve el valor original o maneja el error adecuadamente sin romper la respuesta.
3. **División por 100**: La base de datos guarda centavos (integer). La conversión debe operar sobre unidades reales (float) para mayor precisión antes del redondeo final.
