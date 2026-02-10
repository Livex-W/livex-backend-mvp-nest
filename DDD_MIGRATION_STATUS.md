# 🏗️ Estado de Migración a Domain-Driven Design (DDD)

Este documento detalla el estado actual de la migración de la arquitectura monolítica a una arquitectura orientada a dominio (DDD) modular en Livex.

> **Última actualización:** 05/02/2026

## 📊 Resumen de Progreso

| Área | Estado | Descripción |
|------|--------|-------------|
| **Estructura DDD** | ✅ Completa | Todos los *Bounded Contexts* tienen su estructura definida. |
| **Infraestructura** | ✅ Completa | Servicios transversales movidos a `SharedModule`. |
| **Lógica de Dominio** | 🚧 En Progreso | Migración gradual de servicios legacy a *Application Services*. |

---

## ✅ Módulos DDD (Bounded Contexts)
*Estructuras base de Dominio, Aplicación e Infraestructura creadas.*

| Bounded Context | Módulo Principal | Estado |
|-----------------|------------------|--------|
| **Admin** | `admin-ddd.module.ts` | ✅ Creado |
| **Auth** | `auth-ddd.module.ts` | ✅ Creado |
| **Availability** | `availability-ddd.module.ts` | ✅ Creado |
| **Booking** | `booking-ddd.module.ts` | ✅ Creado |
| **Catalog** | `catalog-ddd.module.ts` | ✅ Creado |
| **Categories** | `categories-ddd.module.ts` | ✅ Creado |
| **Coupons** | `coupons-ddd.module.ts` | ✅ Creado |
| **Favorites** | `favorites-ddd.module.ts` | ✅ Creado |
| **Identity** | `identity-ddd.module.ts` | ✅ Creado |
| **Notification** | `notification-ddd.module.ts` | ✅ Creado |
| **Partnership** | `partnership-ddd.module.ts` | ✅ Creado |
| **Payment** | `payment-ddd.module.ts` | ✅ Creado |

---

## 🛠️ Infraestructura Compartida (Legacy Refactorizado)
*Servicios técnicos migrados a `src/shared/infrastructure`.*

| Servicio | Nueva Ubicación | Estado |
|----------|-----------------|--------|
| **Upload Service** | `shared/.../upload` | ✅ Migrado |
| **PDF Service** | `shared/.../pdf` | ✅ Migrado |
| **Exchange Rates** | `shared/.../exchange-rates` | ✅ Migrado |

> *Nota: Los módulos legacy (`UploadModule`, `PdfModule`, etc.) actúan ahora como wrappers de compatibilidad.*

---

## ❌ Servicios Legacy Pendientes de Refactorizar
*Servicios monolíticos que aún contienen lógica de negocio y acceso directo a BD.*

| Servicio Legacy | Dependencias Críticas | Objetivo DDD |
|-----------------|-----------------------|--------------|
| `bookings.service.ts` | UserPreferences, Payments | `BookingApplicationService` |
| `experiences.service.ts` | BD Directa | Catalog Context |
| `resorts.service.ts` | BD Directa | Catalog Context |
| `availability.service.ts` | BD Directa | `AvailabilityApplicationService` |
| `payments.service.ts` | Wompi, PayPal | `PaymentApplicationService` |
| `agents.service.ts` | BD Directa | Partnership Context |
| `users.service.ts` | BD Directa | Identity Context |
| `admin.service.ts` | BD Directa | Admin Context |
| `coupons.service.ts` | BD Directa | `CouponApplicationService` |
| `favorites.service.ts` | BD Directa | `FavoriteApplicationService` |
| `categories.service.ts` | BD Directa | Categories Context |
| `partner.service.ts` | BD Directa | Partnership Context |

---

## 🔶 Migraciones Parciales / Híbridas

| Módulo | Estado | Detalles |
|--------|--------|----------|
| **Auth** | ⚠️ Híbrido | El controlador usa `AuthApplicationService` pero persiste lógica en `auth.service.ts`. |
| **User Preferences** | ⚠️ Híbrido | Controlador 100% DDD. Servicio legacy mantenido solo para `BookingsService`. |

---

## 📋 Hoja de Ruta (Next Steps)

Para completar la transición, se deben ejecutar las siguientes tareas por módulo:

1.  **Booking**: Redirigir `BookingsController` a `BookingApplicationService`.
2.  **Catalog**: Migrar lógica de `experiences` y `resorts` a Repositorios y Servicios de Dominio.
3.  **Partnership**: Mover gestión de agentes a `PartnershipApplicationService`.
4.  **Identity**: Centralizar lógica de usuarios en `IdentityApplicationService`.
5.  **Limpieza**: Eliminar archivos `*.service.ts` legacy una vez vacíos.
