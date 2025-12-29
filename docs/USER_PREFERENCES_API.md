# Guía de API: Preferencias de Usuario y Conversión de Moneda

Esta guía documenta las APIs para gestionar preferencias de usuario (idioma y moneda) y obtener tasas de cambio para conversión de precios.

## 📋 Tabla de Contenidos

1. [Preferencias de Usuario](#preferencias-de-usuario)
   - [Crear Preferencias](#1-crear-preferencias)
   - [Actualizar Preferencias](#2-actualizar-preferencias)
   - [Obtener Preferencias](#3-obtener-preferencias)
2. [Tasas de Cambio](#tasas-de-cambio)
   - [Obtener Tasa de Cambio](#obtener-tasa-de-cambio)
3. [Integración con Precios](#integración-con-precios)
4. [Ejemplos de Uso](#ejemplos-de-uso)

---

## Preferencias de Usuario

Las preferencias de usuario permiten almacenar el idioma y la moneda preferida de cada usuario. Estas preferencias se usan para personalizar la experiencia del usuario, especialmente para mostrar precios en su moneda local.

### Modelo de Datos

```typescript
{
  userId: string;      // UUID del usuario
  language: string;    // Código de idioma (ej: 'es', 'en')
  currency: string;    // Código ISO 4217 (ej: 'USD', 'COP', 'MXN')
  createdAt: Date;
  updatedAt: Date;
}
```

### Valores por Defecto

- **language**: `'es'` (español)
- **currency**: `'USD'` (dólares estadounidenses)

---

## 1. Crear Preferencias

Crea las preferencias iniciales para el usuario autenticado.

### Endpoint

```http
POST /api/v1/user-preferences
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
```

### Request Body

```json
{
  "language": "es",
  "currency": "COP"
}
```

**Campos opcionales:**
- `language` (string, 2-5 caracteres) - Default: `'es'`
- `currency` (string, 3 caracteres) - Default: `'USD'`

### Response (201 Created)

```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "language": "es",
  "currency": "COP",
  "createdAt": "2025-12-28T20:00:00.000Z",
  "updatedAt": "2025-12-28T20:00:00.000Z"
}
```

### Errores

**409 Conflict** - Las preferencias ya existen
```json
{
  "statusCode": 409,
  "message": "User preferences already exist. Use PUT to update."
}
```

### Ejemplo cURL

```bash
curl -X POST http://localhost:3000/api/v1/user-preferences \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "language": "es",
    "currency": "COP"
  }'
```

---

## 2. Actualizar Preferencias

Actualiza las preferencias existentes del usuario. Puedes actualizar solo un campo o ambos.

### Endpoint

```http
PUT /api/v1/user-preferences
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
```

### Request Body

Puedes enviar uno o ambos campos:

**Actualizar solo moneda:**
```json
{
  "currency": "MXN"
}
```

**Actualizar solo idioma:**
```json
{
  "language": "en"
}
```

**Actualizar ambos:**
```json
{
  "language": "en",
  "currency": "EUR"
}
```

### Response (200 OK)

```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "language": "en",
  "currency": "EUR",
  "createdAt": "2025-12-28T20:00:00.000Z",
  "updatedAt": "2025-12-28T20:30:00.000Z"
}
```

### Errores

**404 Not Found** - No existen preferencias para este usuario
```json
{
  "statusCode": 404,
  "message": "User preferences not found. Use POST to create."
}
```

### Ejemplo cURL

```bash
curl -X PUT http://localhost:3000/api/v1/user-preferences \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "currency": "MXN"
  }'
```

---

## 3. Obtener Preferencias

Obtiene las preferencias del usuario autenticado.

### Endpoint

```http
GET /api/v1/user-preferences
Authorization: Bearer {JWT_TOKEN}
```

### Response (200 OK)

```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "language": "es",
  "currency": "COP",
  "createdAt": "2025-12-28T20:00:00.000Z",
  "updatedAt": "2025-12-28T20:00:00.000Z"
}
```

### Errores

**404 Not Found** - El usuario no tiene preferencias configuradas
```json
{
  "statusCode": 404,
  "message": "User preferences not found"
}
```

### Ejemplo cURL

```bash
curl -X GET http://localhost:3000/api/v1/user-preferences \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## Tasas de Cambio

Las tasas de cambio se actualizan automáticamente cada 2 horas desde la API de ExchangeRate-API. La moneda base es **USD**.

### Obtener Tasa de Cambio

Aunque este endpoint no está expuesto directamente, el backend lo usa internamente para convertir precios. Las tasas disponibles incluyen:

- **USD** - Dólar estadounidense (base)
- **COP** - Peso colombiano
- **MXN** - Peso mexicano
- **EUR** - Euro
- **GBP** - Libra esterlina
- **BRL** - Real brasileño
- **ARS** - Peso argentino
- **CLP** - Peso chileno
- **PEN** - Sol peruano
- Y más de 150 monedas adicionales

### Última Actualización

Las tasas se actualizan automáticamente mediante un cron job que corre cada 2 horas. Puedes verificar la última actualización consultando la tabla `exchange_rates` en la base de datos.

---

## Integración con Precios

### Cómo Funciona

1. El usuario configura su moneda preferida (ej: `COP`)
2. El backend obtiene la tasa de cambio USD → COP
3. Los precios se convierten usando la utilidad `convertPrice()`
4. El frontend recibe tanto el precio original (USD) como el precio convertido

### Formato de Respuesta con Conversión

Cuando integres la conversión de precios en tus APIs (experiencias, bookings, etc.), el formato recomendado es:

```json
{
  "id": "experience-uuid",
  "name": "Tour de Playa",
  "price": 100.00,           // Precio original en USD
  "displayPrice": 450000.00, // Precio convertido
  "displayCurrency": "COP"   // Moneda del usuario
}
```

### Utilidad de Conversión

```typescript
import { convertPrice } from '../common/utils/price-converter';

// Convertir precio
const displayPrice = convertPrice(100, 4500); // 100 USD * 4500 = 450000 COP

// Formatear precio con símbolo
import { formatPrice } from '../common/utils/price-converter';
const formatted = formatPrice(450000, 'COP'); // "$450000.00"
```

---

## Ejemplos de Uso

### Flujo Completo: Usuario Configura Moneda

```bash
# 1. Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "usuario@example.com",
    "password": "password123"
  }'

# Guardar el token JWT

# 2. Crear preferencias (primera vez)
curl -X POST http://localhost:3000/api/v1/user-preferences \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "es",
    "currency": "COP"
  }'

# 3. Obtener preferencias
curl -X GET http://localhost:3000/api/v1/user-preferences \
  -H "Authorization: Bearer {JWT_TOKEN}"

# 4. Actualizar solo la moneda
curl -X PUT http://localhost:3000/api/v1/user-preferences \
  -H "Authorization: Bearer {JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "currency": "MXN"
  }'
```

### Monedas Soportadas (Ejemplos)

| Código | Moneda | Símbolo |
|--------|--------|---------|
| USD | Dólar estadounidense | $ |
| COP | Peso colombiano | $ |
| MXN | Peso mexicano | $ |
| EUR | Euro | € |
| GBP | Libra esterlina | £ |
| BRL | Real brasileño | R$ |
| ARS | Peso argentino | $ |
| CLP | Peso chileno | $ |
| PEN | Sol peruano | S/ |
| JPY | Yen japonés | ¥ |

---

## Notas Importantes

> **⚠️ Autenticación Requerida**  
> Todos los endpoints de preferencias requieren un token JWT válido. El usuario solo puede gestionar sus propias preferencias.

> **💡 Valores por Defecto**  
> Si un usuario no ha configurado preferencias, el sistema usa `language: 'es'` y `currency: 'USD'` por defecto.

> **🔄 Actualización de Tasas**  
> Las tasas de cambio se actualizan automáticamente cada 2 horas. No es necesario hacer nada manualmente.

> **📊 Integración Futura**  
> La conversión de precios en las APIs de experiencias y bookings se implementará en una fase posterior. Por ahora, esta API solo gestiona las preferencias del usuario.

---

## Recursos Adicionales

- [PRICE_CONVERSION_GUIDE.md](../brain/{conversation-id}/PRICE_CONVERSION_GUIDE.md) - Guía para integrar conversión de precios en tus servicios
- [ExchangeRate-API Documentation](https://www.exchangerate-api.com/docs) - API externa usada para tasas de cambio
