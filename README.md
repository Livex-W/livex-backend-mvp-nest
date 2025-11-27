# 🚀 LIVEX Backend MVP

> **Versión:** 1.0.0 (Producción-Ready)  
> **Estado:** Completado ✅  
> **Fecha:** Noviembre 2025

Backend robusto y escalable para la plataforma de turismo LIVEX, construido con **NestJS**, **PostgreSQL** y **TypeScript**.

---

## 📋 Tabla de Contenidos

1. [Visión General](#-visión-general)
2. [Características Principales](#-características-principales)
3. [Arquitectura del Sistema](#-arquitectura-del-sistema)
4. [Documentación Detallada](#-documentación-detallada)
5. [Guía de Instalación](#-guía-de-instalación)
6. [Variables de Entorno](#-variables-de-entorno)
7. [Testing y Desarrollo](#-testing-y-desarrollo)
8. [Estructura del Proyecto](#-estructura-del-proyecto)

---

## 🔭 Visión General

LIVEX es una plataforma que conecta turistas con resorts y experiencias exclusivas. Este backend maneja toda la lógica de negocio, desde la autenticación de usuarios hasta el procesamiento seguro de pagos y la gestión de comisiones para agentes.

### Tecnologías Core
- **Framework:** NestJS 10.x (Node.js)
- **Base de Datos:** PostgreSQL 15
- **Lenguaje:** TypeScript 5.x
- **Pagos:** Wompi (Colombia) & PayPal (Global)
- **Email:** Nodemailer + SMTP
- **Validación:** Class-validator & Class-transformer

---

## ✨ Características Principales

### 🔐 Autenticación y Seguridad
- **JWT:** Access tokens (15min) y Refresh tokens (7 días) con rotación segura.
- **Roles:** Sistema RBAC con roles `tourist`, `resort`, `agent`, `admin`.
- **Protección:** Rate limiting, CORS configurado, Headers de seguridad (Helmet).
- **Webhooks:** Validación criptográfica de firmas (HMAC-SHA256) para pagos seguros.

### 🏨 Gestión de Experiencias
- **CRUD Completo:** Creación, edición y aprobación de experiencias turísticas.
- **Disponibilidad:** Gestión de cupos en tiempo real con bloqueos temporales (`inventory_locks`).
- **Imágenes:** Soporte para múltiples imágenes por experiencia.

### 💰 Pagos y Reembolsos
- **Multi-Pasarela:** Integración transparente con Wompi y PayPal.
- **Flujo de Pago:** `Pending` → `Authorized` → `Paid`.
- **Reembolsos Automáticos:** Al cancelar una reserva confirmada, el dinero se devuelve automáticamente.
- **Seguridad:** Validación estricta de webhooks para evitar fraudes.

### 🤝 Agentes y Comisiones
- **Sistema de Referidos v2.0:** Códigos avanzados con reglas personalizadas.
- **Reglas:** Mínimo de compra, stacking, restricciones por resort/categoría.
- **A/B Testing:** Variantes de códigos para optimizar conversiones.
- **Comisiones:** Cálculo automático de split entre plataforma y agente.

### 📧 Notificaciones
- **Emails Transaccionales:** Bienvenida, Confirmación de Reserva, Reset Password, Pagos.
- **Templates:** HTML responsivo y multi-idioma.
- **Arquitectura:** Desacoplada mediante `NotificationService`.

---

## 📚 Documentación Detallada

Hemos generado documentación técnica específica para cada subsistema. Consulta estos archivos para detalles de implementación:

| Módulo | Documento | Descripción |
|--------|-----------|-------------|
| **Resumen Final** | [📄 MVP_COMPLETE.md](docs/MVP_COMPLETE.md) | Resumen ejecutivo del estado del proyecto. |
| **Agentes** | [📄 AGENTS_SYSTEM.md](docs/AGENTS_SYSTEM.md) | Arquitectura del sistema de comisiones. |
| **Códigos V2** | [📄 REFERRAL_CODES_SYSTEM.md](docs/REFERRAL_CODES_SYSTEM.md) | Implementación de códigos de referido avanzados. |
| **A/B Testing** | [📄 AB_TESTING_GUIDE.md](docs/AB_TESTING_GUIDE.md) | Guía para crear variantes de códigos. |
| **Notificaciones** | [📄 NOTIFICATIONS_SYSTEM.md](docs/NOTIFICATIONS_SYSTEM.md) | Configuración y uso del servicio de emails. |
| **Reembolsos** | [📄 REFUND_IMPLEMENTATION.md](docs/REFUND_IMPLEMENTATION.md) | Flujos de cancelación y devolución de dinero. |
| **Seguridad** | [📄 WEBHOOK_SECURITY.md](docs/WEBHOOK_SECURITY.md) | Implementación de validación de firmas de pago. |
| **Testing** | [📄 AGENTS_CURL_TESTS.md](docs/AGENTS_CURL_TESTS.md) | Colección de comandos CURL para probar la API. |

---

## 🛠 Guía de Instalación

### Prerrequisitos
- Node.js >= 18
- Docker & Docker Compose
- PostgreSQL (si no usas Docker)

### Pasos

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/livex/backend.git
   cd backend
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Configurar entorno:**
   ```bash
   cp .env.example .env
   # Editar .env con tus credenciales
   ```

4. **Iniciar base de datos (Docker):**
   ```bash
   docker-compose up -d db
   ```

5. **Ejecutar migraciones y seed:**
   ```bash
   npm run migration:run
   npm run seed:run
   ```

6. **Iniciar servidor:**
   ```bash
   # Desarrollo
   npm run start:dev
   
   # Producción
   npm run build
   npm run start:prod
   ```

---

## 🔑 Variables de Entorno

Las variables críticas que debes configurar en `.env`:

```bash
# App
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:4000

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/livex

# Auth
JWT_SECRET=super-secret-key
JWT_ACCESS_TOKEN_TTL_SECONDS=900
JWT_REFRESH_TOKEN_TTL_SECONDS=604800

# Payments (Wompi)
WOMPI_PUBLIC_KEY=pub_test_...
WOMPI_PRIVATE_KEY=prv_test_...
WOMPI_WEBHOOK_SECRET=prod_secret_...  # ⭐ Requerido para seguridad

# Payments (PayPal)
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_WEBHOOK_ID=...

# Email
SMTP_HOST=smtp.gmail.com
SMTP_USER=noreply@livex.com
SMTP_PASS=...
```

---

## 🧪 Testing y Desarrollo

### Tests Manuales (CURL)
Hemos preparado una suite completa de tests manuales usando CURL. Puedes encontrarlos en `docs/AGENTS_CURL_TESTS.md`.

Ejemplo para crear una reserva:

```bash
curl -X POST http://localhost:3000/api/v1/bookings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "experienceId": "exp_123",
    "adults": 2,
    "referralCode": "SUMMER2025"
  }'
```

### Comandos Útiles

```bash
# Linting
npm run lint

# Formateo
npm run format

# Generar recurso
nest g resource my-new-feature
```

---

## 📂 Estructura del Proyecto

```
src/
├── agents/          # Módulo de Agentes y Códigos
├── auth/            # Autenticación y JWT
├── bookings/        # Gestión de Reservas
├── common/          # Decorators, Guards, Filters
├── database/        # Configuración DB
├── experiences/     # Módulo de Experiencias
├── notifications/   # Servicio de Email
├── payments/        # Pasarelas de Pago
├── resorts/         # Gestión de Resorts
└── users/           # Gestión de Usuarios
```

---

## 📞 Soporte

Para dudas técnicas sobre la implementación, contactar al equipo de desarrollo backend.

> **LIVEX Backend Team** - 2025
