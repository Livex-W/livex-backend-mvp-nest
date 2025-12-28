# 🎫 Sistema de Cupones LIVEX v3.0

## Resumen

Sistema unificado de cupones que integra:
1. **Cupones de Usuario** - Ganados por referidos, promociones, gamificación (acumulables)
2. **Códigos de Influencer** - De uso exclusivo, no combinables con VIP
3. **Membresías VIP** - Descuento automático por tiempo configurable (default: 1 año)

---

## 📊 Tipos de Cupón

### 1. Cupones de Usuario (`user_earned`)
| Característica | Valor |
|----------------|-------|
| Stacking con otros `user_earned` | ✅ Permitido |
| Stacking con códigos de influencer | ❌ No permitido |
| Uso por cupón | 1 solo uso |
| Transferible | No |

### 2. Códigos de Influencer (`referral_type: 'influencer'`)
| Característica | Valor |
|----------------|-------|
| Stacking con cualquier tipo | ❌ No permitido |
| Compatible con VIP activo | ❌ No |
| Uso por código | Según `usage_limit` |

### 3. Membresía VIP (`vip_subscription`)
| Característica | Valor |
|----------------|-------|
| Descuento automático | ✅ Siempre aplica |
| Duración default | 1 año (configurable) |
| Stacking con `user_earned` | ✅ Permitido |
| Stacking con influencer | ❌ No permitido |

---

## 🔌 API Endpoints

Todos los endpoints requieren autenticación JWT.

### Listar Mis Cupones
```http
GET /coupons/my
Authorization: Bearer {token}
```

**Respuesta:**
```json
[
  {
    "id": "uuid",
    "code": "SOFIA-REF-001",
    "couponType": "user_earned",
    "description": "Cupón por referir a un amigo",
    "discountType": "fixed",
    "discountValue": 1500000,
    "isUsed": false,
    "isActive": true,
    "expiresAt": "2026-06-27T00:00:00Z"
  }
]
```

---

### Cupones Disponibles para Compra
```http
GET /coupons/my/available?experienceId={uuid}&totalCents={amount}
Authorization: Bearer {token}
```

---

### Estado VIP
```http
GET /coupons/vip/status
Authorization: Bearer {token}
```

**Respuesta (VIP Activo):**
```json
{
  "isVip": true,
  "discountType": "percentage",
  "discountValue": 1200,
  "activatedAt": "2025-11-27T00:00:00Z",
  "expiresAt": "2026-11-27T00:00:00Z",
  "remainingDays": 335
}
```

---

### Validar Cupón
```http
POST /coupons/validate
Authorization: Bearer {token}
Content-Type: application/json

{
  "code": "SOFIA-REF-001",
  "experienceId": "uuid-experiencia",
  "totalCents": 15000000
}
```

**Respuesta:**
```json
{
  "isValid": true,
  "couponType": "user_earned",
  "discountType": "fixed",
  "discountValue": 1500000,
  "discountAmountCents": 1500000,
  "source": "user_coupon"
}
```

---

### Calcular Descuentos (Múltiples Cupones)
```http
POST /coupons/calculate
Authorization: Bearer {token}
Content-Type: application/json

{
  "couponCodes": ["SOFIA-REF-001", "SOFIA-GAME-001"],
  "referralCode": null,
  "experienceId": "uuid-experiencia",
  "totalCents": 15000000
}
```

**Respuesta:**
```json
{
  "userCouponsDiscount": 2000000,
  "referralCodeDiscount": 0,
  "vipDiscount": 1800000,
  "totalDiscount": 3800000,
  "finalTotal": 11200000,
  "appliedCoupons": [
    { "code": "VIP", "type": "vip_subscription", "discountApplied": 1800000 },
    { "code": "SOFIA-REF-001", "type": "user_earned", "discountApplied": 1500000 },
    { "code": "SOFIA-GAME-001", "type": "user_earned", "discountApplied": 500000 }
  ]
}
```

---

### Activar VIP
```http
POST /coupons/vip/activate
Authorization: Bearer {token}
Content-Type: application/json

{
  "couponCode": "VIP-SOFIA-2025"
}
```

**Respuesta:**
```json
{
  "isVip": true,
  "discountType": "percentage",
  "discountValue": 1000,
  "activatedAt": "2025-12-27T20:00:00Z",
  "expiresAt": "2026-12-27T20:00:00Z",
  "remainingDays": 365
}
```

---

## 🗃️ Estructura de Base de Datos

### Tabla: `user_coupons`
```sql
CREATE TABLE user_coupons (
    id uuid PRIMARY KEY,
    user_id uuid REFERENCES users(id),
    code text UNIQUE NOT NULL,
    coupon_type text CHECK (coupon_type IN ('user_earned', 'vip_subscription', 'promotional')),
    discount_type text CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value integer,
    max_discount_cents integer,
    is_used boolean DEFAULT false,
    expires_at timestamptz,
    vip_duration_days integer DEFAULT 365,
    source_type text
);
```

### Tabla: `vip_subscriptions`
```sql
CREATE TABLE vip_subscriptions (
    id uuid PRIMARY KEY,
    user_id uuid REFERENCES users(id),
    discount_type text,
    discount_value integer,
    status text CHECK (status IN ('pending', 'active', 'expired', 'cancelled')),
    activated_at timestamptz,
    expires_at timestamptz
);
```

---

## 🧪 Datos de Prueba

### Usuarios con Cupones
| Email | Cupón | Tipo |
|-------|-------|------|
| sofia.turista@gmail.com | SOFIA-REF-001 | user_earned |
| sofia.turista@gmail.com | SOFIA-GAME-001 | user_earned |
| sofia.turista@gmail.com | VIP-SOFIA-2025 | vip_subscription |
| john.doe@usmail.com | JOHN-WELCOME | promotional |

### VIP Activo
| Email | Descuento | Expira |
|-------|-----------|--------|
| pierre.frances@gmail.com | 12% | ~11 meses |

---

## ⚠️ Errores Comunes

| Error | Causa |
|-------|-------|
| "Cupón no encontrado" | Código no existe o pertenece a otro usuario |
| "Cupón ya utilizado" | El cupón de un solo uso ya fue redimido |
| "Códigos de influencer no son compatibles con VIP" | Usuario VIP intentando usar código de influencer |
| "Mínimo de compra no alcanzado" | Total menor al mínimo requerido |

---

**Última actualización**: 2025-12-27  
**Versión**: 3.0
