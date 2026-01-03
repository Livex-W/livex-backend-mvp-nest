# Guía de Integración Wompi - LIVEX Backend

Este documento detalla la integración completa con la pasarela de pagos Wompi, explicando la arquitectura, los patrones de diseño utilizados y los pasos para probar cada medio de pago.

## 1. Arquitectura y Patrones de Diseño

Hemos implementado una arquitectura flexible y escalable utilizando los patrones **Strategy** y **Factory**. Esto nos permite manejar diferentes métodos de pago (PSE, Nequi, Tarjeta) de manera limpia y extensible.

### ¿Por qué usamos estos patrones?

*   **PaymentStrategyFactory (`payment-strategy.factory.ts`)**: Es la "fábrica" que decide qué estrategia usar basándose en el tipo de pago (`PSE`, `NEQUI`, `CARD`).
*   **Strategies (`pse.strategy.ts`, `nequi.strategy.ts`, `card.strategy.ts`)**: Cada archivo contiene la lógica específica para construir el payload de Wompi de ese método de pago. Por ejemplo, PSE requiere `user_type` y `financial_institution_code`, mientras que Nequi solo necesita `phone_number`.
*   **WompiProvider (`wompi.provider.ts`)**: Es el coordinador. Recibe la intención de pago, le pide a la *Factory* la estrategia correcta, y luego usa esa estrategia para armar los datos que Wompi necesita.

**Flujo de Datos:**
1.  `PaymentsService` recibe la petición del usuario.
2.  Llama a `WompiProvider.createPayment`.
3.  `WompiProvider` obtiene el `AcceptanceToken`.
4.  `WompiProvider` usa la *Factory* para obtener la estrategia (ej. `PSEStrategy`).
5.  La estrategia construye el `payload` específico.
6.  `WompiProvider` firma el payload (Integrity Signature) y lo envía a Wompi.
7.  Si es PSE, `WompiProvider` hace *polling* (revisión constante) por unos segundos para recuperar la URL de redirección del banco.

---

## 2. Configuración en Dashboard Wompi

Para que los eventos (aprobación/rechazo de pagos) lleguen a nuestro backend, debes configurar la URL de Webhooks.

1.  Ingresa a [Wompi Dashboard (Sandbox)](https://computacion-nube.wompi.co/).
2.  Ve a **Desarrolladores** (o "Mi Cuenta" -> "Configuración técnica").
3.  En la sección **"Seguimiento de transacciones"** (URL de Eventos), coloca la URL de tu backend (o ngrok si estás local).

**URL para Eventos:**
```
https://<TU-DOMINIO-O-NGROK>/api/v1/payments/webhooks/wompi
```
*(Asegúrate de cambiar `<TU-DOMINIO-O-NGROK>` por tu url real)*

4.  **IMPORTANTE:** Activa el **"Modo de Pruebas"** en la parte superior derecha si estás desarrollando. Verás las llaves `pub_test_...` y `prv_test_...`.

![Wompi Dashboard Config](./images/wompi_config.png)

---

## 3. Guía de Pruebas (Paso a Paso)

A continuación, los endpoints y JSONs para probar cada método en Postman.

**Endpoint Base:** `POST /api/v1/payments/wompi/{Method pago}` // nequi, pse, card

### A. Prueba con PSE (Pagos Seguros en Línea)

El flujo de PSE requiere redireccionar al usuario al banco.

**JSON Body:**
```json
{
    "bookingId": "tu-uuid-de-booking-aqui",
    "provider": "wompi",
    "amount": 50000,
    "currency": "COP",
    "metadata": {
        "paymentMethod": "PSE",
        "customerEmail": "test@livex.com",
        "redirectUrl": "https://livex.com/payment/success",
        "pseData": {
            "userType": 0,                // 0 = Natural, 1 = Jurídica
            "userLegalId": "123456789",
            "userLegalIdType": "CC",
            "financialInstitutionCode": "1007", // 1007 = Bancolombia (producción) // 1 = APROVED 2 = DECLINED
            "paymentDescription": "Pago Reserva Livex"
        }
    }
}
```

**Resultado Esperado:**
*   Status: `201 Created`
*   Response: Un objeto con `checkoutUrl`. **Esta es la URL a la que debes redirigir al usuario.**
*   Al abrir esa URL, verás el simulador de banco de Wompi. Dale "Aprobar" o "Rechazar" para probar los webhooks.

> **Nota:** NO uses el código de banco `1` en Sandbox si quieres probar la redirección, ya que autocompleta el pago sin devolver URL. Usa `1007`.

---

### B. Prueba con NEQUI

Nequi funciona mediante una notificación Push al celular del usuario.

**JSON Body:**
```json
{
    "bookingId": "tu-uuid-de-booking-aqui",
    "provider": "wompi",
    "amount": 20000,
    "currency": "COP",
    "metadata": {
        "paymentMethod": "NEQUI",
        "customerEmail": "nequi@user.com",
        "redirectUrl": "https://livex.com/payment/success",
        "nequiData": {
            "phoneNumber": "3991111111" // Número de prueba Wompi Sandbox
        }
    }
}
```

**Resultado Esperado:**
*   Status: `201 Created`
*   Response: `checkoutUrl` será `null` (es correcto, no hay redirección).
*   En Sandbox, la transacción quedará en estado `PENDING` o pasará a `APPROVED` automáticamente tras unos segundos si usas el número `3991111111`.

---

### C. Prueba con Tarjeta de Crédito (Tokenizada)

Para pagos con tarjeta, Wompi espera que el frontend primero "tokenice" la tarjeta y envíe un token. Sin embargo, para pruebas de backend, simulamos el token.

**Requisito:** Necesitas un token de tarjeta válido de Sandbox. En postman a veces es difícil generarlo sin el widget de frontend.
*Si estás usando el Widget de Wompi en el front, este paso lo hace el widget.*

Para efectos de prueba de API directa "Server-to-Server", Wompi requiere un token.

**JSON Body:**
```json
{
    "bookingId": "tu-uuid-de-booking-aqui",
    "provider": "wompi",
    "amount": 75000,
    "currency": "COP",
    "metadata": {
        "paymentMethod": "CARD",
        "customerEmail": "card@user.com",
        "redirectUrl": "https://livex.com/payment/success",
        "cardData": {
            "token": "tok_test_..." // Token generado por el frontend/widget
            "installments": 1
        }
    }
}
```

> **Tip:** En desarrollo backend puro, es más fácil probar PSE y Nequi. Las pruebas de tarjeta suelen requerir el frontend integrado para generar el token de seguridad.

---

## 4. Cambios Realizados y Soluciones

1.  **Error 401 (Invalid Access Token) en PSE:**
    *   **Causa:** `PSEBanksService` no estaba enviando la llave privada a Wompi.
    *   **Solución:** Se agregó el header `Authorization: Bearer <WOMPI_PRIVATE_KEY>` en el servicio de bancos.

2.  **Error "Expression Expected" en build:**
    *   **Causa:** Error de sintaxis (una coma suelta) en `wompi.provider.ts`.
    *   **Solución:** Se corrigió la definición del array `possibleUrls`.

3.  **URL de PSE nula (null):**
    *   **Causa:** El endpoint de creación de transacción de Wompi a veces responde "aprobado" muy rápido (en sandbox con banco "1") y no devuelve URL, o la devuelve asíncronamente.
    *   **Solución:** Se implementó una lógica de **Polling** en `resolveCheckoutUrl`. Si la respuesta inicial no trae URL y es PSE, el backend consulta a Wompi hasta 5 veces (cada 1s) para intentar capturar la URL del banco apenas esté disponible.

4.  **Webhooks Robustos:**
    *   Se mejoró `payments.controller.ts` y `service` para manejar timestamps flexibles y validar firmas correctamente, evitando errores 500 innecesarios.
