# 📱 Livex Mobile App API Documentation

Este documento detalla los endpoints del backend que serán consumidos por la aplicación móvil de clientes (turistas).

## 🔐 Autenticación (Auth)

Endpoints para el registro, inicio de sesión y gestión de sesiones.

### 1. Registro de Usuario
Crea una nueva cuenta de turista.

- **Endpoint:** `POST /api/v1/auth/register`
- **Body:**
  ```json
  {
    "email": "tourist@example.com",
    "password": "securePassword123",
    "fullName": "John Doe",
    "phone": "+573001234567"
  }
  ```
- **Respuesta:** Tokens de acceso (JWT).

### 2. Iniciar Sesión
Autentica a un usuario existente.

- **Endpoint:** `POST /api/v1/auth/login`
- **Body:**
  ```json
  {
    "email": "tourist@example.com",
    "password": "securePassword123"
  }
  ```
- **Respuesta:**
  ```json
  {
    "accessToken": "eyJhbG...",
    "refreshToken": "eyJhbG...",
    "user": {
      "id": "uuid...",
      "email": "tourist@example.com",
      "fullName": "John Doe",
      "role": "tourist"
    }
  }
  ```

### 3. Refrescar Token
Obtiene un nuevo access token usando el refresh token.

- **Endpoint:** `POST /api/v1/auth/refresh`
- **Body:** `{ "refreshToken": "..." }`

### 4. Recuperar Contraseña
Solicita un correo para restablecer la contraseña.

- **Endpoint:** `POST /api/v1/auth/password/request-reset`
- **Body:** `{ "email": "tourist@example.com" }`

---

## 👤 Perfil de Usuario

Gestión de la información del usuario autenticado. Requiere Header `Authorization: Bearer <token>`.

### 1. Obtener Perfil
- **Endpoint:** `GET /api/v1/user`
- **Respuesta:** Datos del usuario (nombre, email, teléfono, etc.).

### 2. Actualizar Perfil
- **Endpoint:** `PUT /api/v1/user`
- **Body:**
  ```json
  {
    "fullName": "John Updated",
    "email": "newemail@example.com" // Opcional
  }
  ```

---

## 🏝️ Descubrimiento (Discovery)

Endpoints para explorar experiencias y categorías.

### 1. Listar Experiencias
Obtiene el feed de experiencias con filtros y paginación.

- **Endpoint:** `GET /api/v1/experiences`
- **Query Params:**
  - `page`: Número de página (default 1).
  - `limit`: Items por página (default 10).
  - `category`: Slug de la categoría (ej. `playa`).
  - `minPrice`: Precio mínimo.
  - `maxPrice`: Precio máximo.
  - `search`: Texto para buscar por nombre.
- **Respuesta:** Objeto paginado con lista de experiencias.

### 2. Detalle de Experiencia
Obtiene toda la información de una experiencia específica.

- **Endpoint:** `GET /api/v1/experiences/:id`
- **Query Params:** `include_images=true` (recomendado para mostrar la galería).

### 3. Listar Categorías
Para mostrar iconos o filtros de categorías.

- **Endpoint:** `GET /api/v1/categories`

---

## 📅 Reservas (Bookings)

Flujo principal de compra.

### 1. Crear Reserva (Pending)
Inicia el proceso de reserva y bloquea el inventario temporalmente.

- **Endpoint:** `POST /api/v1/bookings`
- **Headers:** `Idempotency-Key: <uuid-unico>` (Recomendado para evitar duplicados).
- **Body:**
  ```json
  {
    "slotId": "uuid-del-slot-fecha",
    "experienceId": "uuid-experiencia",
    "adults": 2,
    "children": 0,
    "subtotalCents": 20000000, // Validado contra backend
    "taxCents": 0,
    "currency": "COP",
    "referralCode": "SUMMER2025" // Opcional: Código de agente/descuento
  }
  ```
- **Respuesta:**
  ```json
  {
    "bookingId": "uuid...",
    "status": "pending",
    "totalCents": 20000000,
    "expiresAt": "2025-11-30T..." // Tiempo límite para pagar
  }
  ```

### 2. Cancelar Reserva
Cancela una reserva pendiente o confirmada (si aplica reembolso).

- **Endpoint:** `PATCH /api/v1/bookings/:id/cancel`
- **Body:** `{ "reason": "User requested cancellation" }`

---

## 💳 Pagos (Payments)

**Nota:** Para la simulación, usaremos el entorno de Sandbox de Wompi.

### 1. Iniciar Pago
Genera la URL de pago para una reserva creada.

- **Endpoint:** `POST /v1/payments`
- **Body:**
  ```json
  {
    "bookingId": "uuid-de-la-reserva",
    "provider": "wompi", // o "paypal"
    "paymentMethod": "card" // opcional
  }
  ```
- **Respuesta:**
  ```json
  {
    "id": "uuid-pago",
    "checkoutUrl": "https://sandbox.wompi.co/...", // Abrir en WebView o Browser
    "status": "pending"
  }
  ```

### 2. Consultar Estado de Pago
Verifica si el pago fue exitoso (útil si el webhook tarda o para polling).

- **Endpoint:** `GET /v1/payments/booking/:bookingId`
- **Respuesta:** Lista de intentos de pago y sus estados (`pending`, `paid`, `failed`).

### 📝 Flujo de Simulación de Pagos
1. Crear Reserva -> Obtener `bookingId`.
2. Iniciar Pago -> Obtener `checkoutUrl`.
3. Abrir `checkoutUrl` en el móvil.
4. Usar datos de prueba de Wompi (Tarjeta Aprobada) para completar el flujo.
5. Al finalizar, Wompi redirige a la app y envía un Webhook al backend.
6. El backend actualiza la reserva a `confirmed`.
