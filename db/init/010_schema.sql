-- ====================================================================================
-- LIVEX MVP - MASTER SCHEMA (DDL)
-- Version: Final Integrated (No ALTER statements)
-- ====================================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- ====================================================================================
-- 1. CONFIGURACIÓN BASE Y TIPOS (ENUMS)
-- ====================================================================================

DO $$ BEGIN
    -- Roles y Estados Generales
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('tourist','resort','admin','agent');
    END IF;
    
    -- Resort & Documentos
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'resort_status') THEN
        CREATE TYPE resort_status AS ENUM ('draft','under_review','approved','rejected');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'resort_doc_type') THEN
        CREATE TYPE resort_doc_type AS ENUM ('camara_comercio','rut_nit','rnt','other');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_status') THEN
        CREATE TYPE document_status AS ENUM ('uploaded','under_review','approved','rejected');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_type_enum') THEN
        CREATE TYPE document_type_enum AS ENUM (
            'CC',           -- Cédula Ciudadanía
            'CE',           -- Cédula Extranjería
            'TI',           -- Tarjeta Identidad
            'PPT',          -- Permiso Protección Temporal
            'NIT',          -- Empresas
            'PASSPORT',     -- Pasaporte estándar
            'FOREIGN_ID'    -- DNI/Cédula extranjera
        );
    END IF;

    -- Experiencias
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'experience_status') THEN
        CREATE TYPE experience_status AS ENUM ('draft','under_review','active','rejected');
    END IF;

    -- Flujo de Reservas y Pagos
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
        CREATE TYPE booking_status AS ENUM ('pending','confirmed','cancelled','refunded','expired');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
        CREATE TYPE payment_status AS ENUM ('pending','authorized','paid','refunded','failed','expired', 'cancelled');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_provider') THEN
        CREATE TYPE payment_provider AS ENUM ('wompi','epayco','stripe','paypal');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'refund_status') THEN
        CREATE TYPE refund_status AS ENUM ('pending','processed','failed','cancelled');
    END IF;
    
    -- Finanzas y Comisiones
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'commission_status') THEN
        CREATE TYPE commission_status AS ENUM ('accrued','in_payout','paid','void');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payout_status') THEN
        CREATE TYPE payout_status AS ENUM ('draft','processing','paid','failed');
    END IF;

    -- Sistema (Webhooks/Outbox)
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'webhook_status') THEN
        CREATE TYPE webhook_status AS ENUM ('pending','processed','failed','ignored', 'validated');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'outbox_status') THEN
        CREATE TYPE outbox_status AS ENUM ('pending','sent','failed');
    END IF;

    -- Reservas BNG (Agentes)
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_source') THEN
        CREATE TYPE booking_source AS ENUM ('app','bng');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'agent_payment_type') THEN
        CREATE TYPE agent_payment_type AS ENUM ('full_at_resort','deposit_to_agent','commission_to_agent');
    END IF;

    -- Tipo de entidad de negocio (para business_profiles compartido)
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'business_entity_type') THEN
        CREATE TYPE business_entity_type AS ENUM ('resort', 'agent');
    END IF;
END $$;

-- Función global para updated_at
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ====================================================================================
-- 2. USUARIOS Y AUTENTICACIÓN
-- ====================================================================================

CREATE TABLE IF NOT EXISTS users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           citext UNIQUE NOT NULL,
  password_hash   text,
  firebase_uid    text UNIQUE,
  full_name       text,
  avatar          text,
  role            user_role NOT NULL DEFAULT 'tourist',
  phone           text, 
  document_type   document_type_enum,
  document_number text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_users_document UNIQUE (document_type, document_number)
);

CREATE INDEX idx_users_phone ON users(phone) WHERE phone IS NOT NULL;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Preferencias del usuario
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id uuid PRIMARY KEY,
    language VARCHAR(5) DEFAULT 'es' NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD' NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_currency ON user_preferences(currency);

-- Tokens de seguridad
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jti         uuid NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  ip          inet,
  user_agent  text
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       VARCHAR(6) NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz
);

CREATE TABLE IF NOT EXISTS email_verifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       uuid NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz
);

-- Table to exchange_rates
CREATE TABLE IF NOT EXISTS exchange_rates (
    code VARCHAR(3) PRIMARY KEY,
    rate DECIMAL(20, 10) NOT NULL,
    base_code VARCHAR(3) DEFAULT 'USD',
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster lookups if needed (though PK is indexed)
CREATE INDEX IF NOT EXISTS idx_exchange_rates_updated_at ON exchange_rates(updated_at);


-- ====================================================================================
-- 2.5 PERFILES DE NEGOCIO (Compartido entre Resorts y Agentes)
-- ====================================================================================

-- Perfil de negocio compartido para entidades comerciales (resorts y agentes)
CREATE TABLE IF NOT EXISTS business_profiles (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type        business_entity_type NOT NULL,
  name               text NOT NULL,
  nit                text,  -- Format: 800098813-6
  rnt                text,  -- Format: 23412 (5 digits)
  contact_email      citext,
  contact_phone      text,
  
  -- Estado y Aprobación
  status             resort_status NOT NULL DEFAULT 'draft',
  approved_by        uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at        timestamptz,
  rejection_reason   text,
  
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_profiles_entity_type ON business_profiles(entity_type);
CREATE INDEX IF NOT EXISTS idx_business_profiles_status ON business_profiles(status);
CREATE TRIGGER trg_business_profiles_updated_at BEFORE UPDATE ON business_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE business_profiles IS 'Shared business profile for resorts and agents. Contains NIT, RNT, and approval workflow.';
COMMENT ON COLUMN business_profiles.entity_type IS 'Type of entity: resort or agent';
COMMENT ON COLUMN business_profiles.nit IS 'Tax ID number (NIT) - Format: 800098813-6';
COMMENT ON COLUMN business_profiles.rnt IS 'National Tourism Registry (RNT) - Format: 23412 (5 digits)';

-- Documentos de negocio compartidos
CREATE TABLE IF NOT EXISTS business_documents (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_profile_id   uuid NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  doc_type              resort_doc_type NOT NULL,
  file_url              text NOT NULL,
  status                document_status NOT NULL DEFAULT 'uploaded',
  rejection_reason      text,
  reviewed_by           uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at           timestamptz,
  uploaded_at           timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_documents_profile ON business_documents(business_profile_id);
CREATE INDEX IF NOT EXISTS idx_business_documents_status ON business_documents(status);
CREATE TRIGGER trg_business_documents_updated_at BEFORE UPDATE ON business_documents FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE business_documents IS 'Documents attached to business profiles (shared between resorts and agents)';

-- ====================================================================================
-- 3. DOMINIO DE RESORTS (PROVEEDORES)
-- ====================================================================================

CREATE TABLE IF NOT EXISTS resorts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  description    text,
  website        text,
  contact_email  citext,
  contact_phone  text,
  address_line   text,
  city           text,
  country        text,
  latitude       numeric(9,6),
  longitude      numeric(9,6),
  owner_user_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  business_profile_id uuid REFERENCES business_profiles(id) ON DELETE SET NULL,
  
  -- Estado y Aprobación
  is_active      boolean NOT NULL DEFAULT true,
  status         resort_status NOT NULL DEFAULT 'draft',
  approved_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at    timestamptz,
  rejection_reason text,
  
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_resorts_city ON resorts(city);
CREATE INDEX IF NOT EXISTS idx_resorts_status_active ON resorts(status, is_active);
CREATE TRIGGER trg_resorts_updated_at BEFORE UPDATE ON resorts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
       
CREATE TABLE IF NOT EXISTS resort_bank_info (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resort_id       uuid NOT NULL REFERENCES resorts(id) ON DELETE CASCADE,
  bank_name       text NOT NULL,
  account_holder  text NOT NULL,
  account_number  text NOT NULL,
  account_type    text, 
  tax_id          text,
  is_primary      boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_resort_bank_info_updated_at BEFORE UPDATE ON resort_bank_info FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Relación Agentes <-> Resorts
CREATE TABLE IF NOT EXISTS resort_agents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    resort_id uuid REFERENCES resorts(id), -- Nullable for global agents/influencers
    user_id uuid NOT NULL REFERENCES users(id),
    business_profile_id uuid REFERENCES business_profiles(id) ON DELETE SET NULL, -- Agent's business docs
    commission_bps integer NOT NULL DEFAULT 0 CHECK (commission_bps >= 0 AND commission_bps <= 10000), 
    commission_fixed_cents integer NOT NULL DEFAULT 0 CHECK (commission_fixed_cents >= 0),
    is_active boolean DEFAULT true,
    
    -- Estado y Aprobación (igual que resorts)
    status resort_status NOT NULL DEFAULT 'draft',
    approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
    approved_at timestamptz,
    rejection_reason text,
    
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT unique_active_agent_resort UNIQUE (resort_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_resort_agents_status ON resort_agents(status);
CREATE TRIGGER trg_resort_agents_updated_at BEFORE UPDATE ON resort_agents FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ====================================================================================
-- 4. CATÁLOGO Y EXPERIENCIAS
-- ====================================================================================

CREATE TABLE IF NOT EXISTS categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text UNIQUE NOT NULL,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS experiences (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resort_id       uuid NOT NULL REFERENCES resorts(id) ON DELETE CASCADE,
  title           text NOT NULL,
  slug            text GENERATED ALWAYS AS (regexp_replace(lower(title), '\s+', '-', 'g')) STORED,
  description     text,
  category        text NOT NULL CHECK (category IN (
    'islands','nautical','city_tour',
    'sun_beach','cultural','adventure','ecotourism',
    'agrotourism','gastronomic','religious','educational'
  )),
  
  -- Moneda para esta experiencia (los precios van en availability_slots)
  currency        text NOT NULL DEFAULT 'COP',
  
  -- Configuración de niños
  allows_children boolean NOT NULL DEFAULT true,
  child_min_age   integer DEFAULT 3 CHECK (child_min_age >= 0),
  child_max_age   integer DEFAULT 9 CHECK (child_max_age >= child_min_age),
  
  includes        text,
  excludes        text,
  
  -- Estado y Aprobación
  status          experience_status NOT NULL DEFAULT 'under_review',
  approved_by     uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at     timestamptz,
  rejection_reason text,
  is_active       boolean NOT NULL DEFAULT true,
  
  -- Métricas
  rating_avg      numeric(3,2) NOT NULL DEFAULT 0.0,
  rating_count    integer NOT NULL DEFAULT 0,
  
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN experiences.currency IS 'Currency for this experience. Prices are defined per availability slot.';
COMMENT ON COLUMN experiences.allows_children IS 'Whether children are allowed for this experience.';
COMMENT ON COLUMN experiences.child_min_age IS 'Minimum age to be considered a child (for pricing).';
COMMENT ON COLUMN experiences.child_max_age IS 'Maximum age to be considered a child (for pricing).';
COMMENT ON COLUMN experiences.allows_children IS 'Whether this experience allows children. If false, children field must be 0.';
COMMENT ON COLUMN experiences.child_min_age IS 'Minimum age to be considered a child (inclusive). Below this age, the person does not pay.';
COMMENT ON COLUMN experiences.child_max_age IS 'Maximum age to be considered a child (inclusive). Above this age, the person is considered an adult.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_experiences_resort_slug ON experiences(resort_id, slug);
CREATE INDEX IF NOT EXISTS idx_experiences_category ON experiences(category);
CREATE INDEX IF NOT EXISTS idx_experiences_status ON experiences(status);

CREATE TRIGGER trg_experiences_updated_at BEFORE UPDATE ON experiences FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS experience_categories (
  experience_id uuid NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  category_id   uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (experience_id, category_id)
);

CREATE TABLE IF NOT EXISTS experience_images (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experience_id  uuid NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  url            text NOT NULL,
  sort_order     integer NOT NULL DEFAULT 0,
  image_type     VARCHAR(20) DEFAULT 'gallery' CHECK (image_type IN ('hero', 'gallery')),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_experience_images_type ON experience_images(experience_id, image_type);

CREATE TABLE IF NOT EXISTS experience_locations (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experience_id        uuid NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  name                 text,
  address_line         text,
  latitude             numeric(9,6),
  longitude            numeric(9,6),
  meeting_instructions text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- Disponibilidad
CREATE TABLE IF NOT EXISTS availability_slots (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experience_id  uuid NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  start_time     timestamptz NOT NULL,
  end_time       timestamptz NOT NULL,
  capacity       integer NOT NULL CHECK (capacity >= 0),
  -- Precios por temporada (obligatorios)
  price_per_adult_cents      integer NOT NULL DEFAULT 0 CHECK (price_per_adult_cents >= 0),
  price_per_child_cents      integer NOT NULL DEFAULT 0 CHECK (price_per_child_cents >= 0),
  commission_per_adult_cents integer NOT NULL DEFAULT 0 CHECK (commission_per_adult_cents >= 0),
  commission_per_child_cents integer NOT NULL DEFAULT 0 CHECK (commission_per_child_cents >= 0),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT slot_time_range CHECK (start_time < end_time)
);

COMMENT ON COLUMN availability_slots.price_per_adult_cents IS 'Precio por adulto para esta temporada (obligatorio).';
COMMENT ON COLUMN availability_slots.price_per_child_cents IS 'Precio por niño para esta temporada. 0 si niños no pagan.';
COMMENT ON COLUMN availability_slots.commission_per_adult_cents IS 'Comisión LIVEX por adulto para esta temporada.';
COMMENT ON COLUMN availability_slots.commission_per_child_cents IS 'Comisión LIVEX por niño para esta temporada.';
CREATE INDEX IF NOT EXISTS idx_slots_experience ON availability_slots(experience_id);
CREATE INDEX IF NOT EXISTS idx_slots_start ON availability_slots(start_time);
CREATE TRIGGER trg_slots_updated_at BEFORE UPDATE ON availability_slots FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ====================================================================================
-- 5. MARKETING Y REFERIDOS
-- ====================================================================================

CREATE TABLE IF NOT EXISTS referral_codes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE NOT NULL,
    owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    code_type text NOT NULL DEFAULT 'commission' CHECK (code_type IN ('commission', 'discount', 'both')),
    referral_type text NOT NULL DEFAULT 'standard' CHECK (referral_type IN ('standard', 'influencer', 'affiliate', 'partner')),
    
    discount_type text CHECK (discount_type IN ('percentage', 'fixed', 'none')),
    discount_value integer DEFAULT 0,
    max_discount_cents integer,
    min_purchase_cents integer DEFAULT 0,
    currency text DEFAULT 'COP' CHECK (currency IN ('USD', 'COP', 'EUR')),
    allow_stacking boolean DEFAULT false,
    
    commission_override_bps integer,

    usage_count integer DEFAULT 0,
    
    is_active boolean DEFAULT true,
    usage_limit integer,
    expires_at timestamptz,
    
    description text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

COMMENT ON COLUMN referral_codes.referral_type IS 'standard: permite stacking con otros cupones. influencer/affiliate/partner: uso exclusivo, no permite stacking.';
CREATE INDEX IF NOT EXISTS idx_referral_codes_owner ON referral_codes(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_active ON referral_codes(code) WHERE is_active = true;
CREATE TRIGGER trg_referral_codes_updated_at BEFORE UPDATE ON referral_codes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS referral_code_restrictions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    referral_code_id uuid NOT NULL REFERENCES referral_codes(id) ON DELETE CASCADE,
    restriction_type text NOT NULL CHECK (restriction_type IN ('experience', 'category', 'resort')),
    
    experience_id uuid REFERENCES experiences(id) ON DELETE CASCADE,
    category_slug text,
    resort_id uuid REFERENCES resorts(id) ON DELETE CASCADE,
    
    created_at timestamptz DEFAULT now(),
    UNIQUE (referral_code_id, restriction_type, experience_id, category_slug, resort_id)
);

CREATE TABLE IF NOT EXISTS referral_code_variants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_code_id uuid NOT NULL REFERENCES referral_codes(id) ON DELETE CASCADE,
    variant_name text NOT NULL,
    code text UNIQUE NOT NULL,
    discount_value integer,
    commission_override_bps integer,
    usage_count integer DEFAULT 0,
    conversion_count integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    UNIQUE (parent_code_id, variant_name)
);

-- Cupones de Usuario (ganados por promociones, referidos, gamificación, etc.)
CREATE TABLE IF NOT EXISTS user_coupons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Información del cupón
    code text UNIQUE NOT NULL,
    coupon_type text NOT NULL CHECK (coupon_type IN ('user_earned', 'vip_subscription', 'promotional')),
    description text,
    
    -- Descuento
    discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value integer NOT NULL CHECK (discount_value > 0), -- basis points para % o centavos para fijo
    max_discount_cents integer,
    min_purchase_cents integer DEFAULT 0,
    currency text DEFAULT 'USD' CHECK (currency IN ('USD', 'COP', 'EUR')),
    
    -- Control de uso
    is_used boolean DEFAULT false,
    used_at timestamptz,
    used_booking_id uuid, -- Se llena después de crear bookings table
    
    -- Validez
    is_active boolean DEFAULT true,
    expires_at timestamptz,
    
    -- Para VIP: duración de la suscripción
    vip_duration_days integer DEFAULT 365, -- 1 año por defecto
    
    -- Restricciones opcionales
    experience_id uuid REFERENCES experiences(id) ON DELETE SET NULL,
    category_slug text,
    resort_id uuid REFERENCES resorts(id) ON DELETE SET NULL,
    
    -- Origen del cupón
    source_type text CHECK (source_type IN ('referral_bonus', 'promotional', 'vip_purchase', 'admin_granted', 'gamification', 'first_booking')),
    source_reference_id uuid,
    
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_user_coupons_user ON user_coupons(user_id);
CREATE INDEX idx_user_coupons_code ON user_coupons(code) WHERE is_active = true AND is_used = false;
CREATE INDEX idx_user_coupons_type ON user_coupons(user_id, coupon_type) WHERE is_active = true;
CREATE TRIGGER trg_user_coupons_updated_at BEFORE UPDATE ON user_coupons FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON COLUMN user_coupons.discount_value IS 'Para percentage: basis points (1000 = 10%). Para fixed: centavos.';
COMMENT ON COLUMN user_coupons.vip_duration_days IS 'Días de duración del VIP al activar. Default 365 (1 año). Configurable.';

-- Suscripciones VIP (estado activo de membresía)
CREATE TABLE IF NOT EXISTS vip_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Detalles de la suscripción
    discount_type text NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value integer NOT NULL CHECK (discount_value > 0), -- basis points o centavos
    currency text DEFAULT 'USD' CHECK (currency IN ('USD', 'COP', 'EUR')),
    
    -- Estado
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'expired', 'cancelled')),
    
    -- Fechas
    activated_at timestamptz,
    expires_at timestamptz NOT NULL,
    cancelled_at timestamptz,
    
    -- Origen
    coupon_id uuid REFERENCES user_coupons(id) ON DELETE SET NULL,
    
    -- Restricciones opcionales
    excluded_categories text[],
    excluded_experiences uuid[],
    
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_vip_subscriptions_user_active ON vip_subscriptions(user_id) WHERE status = 'active';
CREATE INDEX idx_vip_subscriptions_expiry ON vip_subscriptions(expires_at) WHERE status = 'active';
CREATE TRIGGER trg_vip_subscriptions_updated_at BEFORE UPDATE ON vip_subscriptions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE vip_subscriptions IS 'Membresías VIP activas. Solo una suscripción activa por usuario.';

-- ====================================================================================
-- 6. RESERVAS (BOOKINGS)
-- ====================================================================================

CREATE TABLE IF NOT EXISTS bookings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  experience_id  uuid NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  slot_id        uuid NOT NULL REFERENCES availability_slots(id) ON DELETE CASCADE,
  
  -- Origen de la reserva
  booking_source booking_source NOT NULL DEFAULT 'app',
  
  -- Detalles
  adults         integer NOT NULL CHECK (adults >= 0),
  children       integer NOT NULL DEFAULT 0 CHECK (children >= 0),
  
  -- Financiero
  currency          text NOT NULL DEFAULT 'USD',
  subtotal_cents    integer NOT NULL DEFAULT 0,
  tax_cents         integer NOT NULL DEFAULT 0,
  
  -- Comisión LIVEX (solo para booking_source = 'app')
  commission_cents  integer NOT NULL DEFAULT 0 CHECK (commission_cents >= 0),
  resort_net_cents  integer NOT NULL DEFAULT 0 CHECK (resort_net_cents >= 0),
  vip_discount_cents integer NOT NULL DEFAULT 0 CHECK (vip_discount_cents >= 0),
  
  -- Comisión Agente (solo para booking_source = 'bng' con agent_id)
  agent_commission_per_adult_cents integer NOT NULL DEFAULT 0 CHECK (agent_commission_per_adult_cents >= 0),
  agent_commission_per_child_cents integer NOT NULL DEFAULT 0 CHECK (agent_commission_per_child_cents >= 0),
  agent_commission_cents integer NOT NULL DEFAULT 0 CHECK (agent_commission_cents >= 0),
  
  -- Distribución de pagos BNG
  agent_payment_type agent_payment_type,
  amount_paid_to_agent_cents integer NOT NULL DEFAULT 0 CHECK (amount_paid_to_agent_cents >= 0),
  amount_paid_to_resort_cents integer NOT NULL DEFAULT 0 CHECK (amount_paid_to_resort_cents >= 0),
  
  total_cents       integer NOT NULL CHECK (total_cents >= 0),
  
  -- Agentes y Referidos
  agent_id       uuid REFERENCES users(id),
  referral_code_id uuid REFERENCES referral_codes(id),
  
  -- Estados y Control
  status         booking_status NOT NULL DEFAULT 'pending',
  cancel_reason  text,
  expires_at     timestamptz,
  completed_at   timestamptz,
  checked_in_at  timestamptz,  -- When tourist checked in at resort/day pass
  idempotency_key text,
  
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT booking_quantities CHECK (adults + children > 0)
);

-- Comentarios sobre columnas integradas
COMMENT ON COLUMN bookings.booking_source IS 'Origin: app = mobile with online payment, bng = web panel without online payment';
COMMENT ON COLUMN bookings.commission_cents IS 'LIVEX commission amount charged online (only for booking_source = app)';
COMMENT ON COLUMN bookings.resort_net_cents IS 'Resort net amount (base price without commissions)';
COMMENT ON COLUMN bookings.agent_commission_per_adult_cents IS 'Agent commission per adult (set by agent, only for BNG)';
COMMENT ON COLUMN bookings.agent_commission_per_child_cents IS 'Agent commission per child (set by agent, only for BNG)';
COMMENT ON COLUMN bookings.agent_commission_cents IS 'Total agent commission = (per_adult × adults) + (per_child × children)';
COMMENT ON COLUMN bookings.agent_payment_type IS 'How BNG payment is distributed: full_at_resort, deposit_to_agent, commission_to_agent';
COMMENT ON COLUMN bookings.amount_paid_to_agent_cents IS 'Amount client paid directly to agent (physical payment)';
COMMENT ON COLUMN bookings.amount_paid_to_resort_cents IS 'Amount client paid/will pay at resort (physical payment)';
COMMENT ON COLUMN bookings.checked_in_at IS 'Timestamp when tourist checked in at the resort/day pass';

CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_experience ON bookings(experience_id);
CREATE INDEX IF NOT EXISTS idx_bookings_slot ON bookings(slot_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_agent ON bookings(agent_id);
CREATE INDEX IF NOT EXISTS idx_bookings_checked_in ON bookings(checked_in_at) WHERE checked_in_at IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_idempotency ON bookings(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE TRIGGER trg_bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Stacking de cupones
CREATE TABLE IF NOT EXISTS booking_referral_codes (
    booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    referral_code_id uuid NOT NULL REFERENCES referral_codes(id),
    discount_applied_cents integer NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (booking_id, referral_code_id)
);

-- Cupones de usuario aplicados a reservas
CREATE TABLE IF NOT EXISTS booking_coupons (
    booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    user_coupon_id uuid NOT NULL REFERENCES user_coupons(id),
    discount_applied_cents integer NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (booking_id, user_coupon_id)
);

-- Agregar FK de used_booking_id a user_coupons (después de crear bookings)
ALTER TABLE user_coupons 
ADD CONSTRAINT fk_user_coupons_used_booking 
FOREIGN KEY (used_booking_id) REFERENCES bookings(id) ON DELETE SET NULL;

-- Bloqueos de inventario
CREATE TABLE IF NOT EXISTS inventory_locks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id      uuid NOT NULL REFERENCES availability_slots(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES users(id) ON DELETE SET NULL,
  booking_id   uuid REFERENCES bookings(id) ON DELETE SET NULL,
  quantity     integer NOT NULL CHECK (quantity > 0),
  expires_at   timestamptz NOT NULL,
  consumed_at  timestamptz,
  released_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inventory_locks_active ON inventory_locks(slot_id, expires_at) WHERE consumed_at IS NULL;

-- ====================================================================================
-- 7. PAGOS Y FINANZAS
-- ====================================================================================

CREATE TABLE IF NOT EXISTS payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id          uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  provider            payment_provider NOT NULL,
  provider_payment_id text,
  provider_capture_id VARCHAR(255),
  provider_reference  text,
  amount_cents        integer NOT NULL CHECK (amount_cents >= 0),
  currency            text NOT NULL DEFAULT 'USD',
  status              payment_status NOT NULL DEFAULT 'pending',
  payment_method      text,
  
  idempotency_key     text,
  checkout_url        text,
  expires_at          timestamptz,
  
  -- Fechas
  authorized_at       timestamptz,
  paid_at             timestamptz,
  cancelled_at        timestamptz,
  failed_at           timestamptz,
  failure_reason      text,
  
  -- Debug
  raw_payload         jsonb,
  provider_metadata   jsonb,
  signature_valid     boolean NOT NULL DEFAULT false,
  error_code          text,
  error_message       text,
  
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_idempotency ON payments(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS refunds (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id          uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  amount_cents        integer NOT NULL CHECK (amount_cents >= 0),
  currency            text NOT NULL DEFAULT 'USD',
  status              refund_status NOT NULL DEFAULT 'pending',
  reason              text,
  provider_refund_id  text,
  provider_reference  text,
  requested_by        uuid REFERENCES users(id) ON DELETE SET NULL,
  requested_at        timestamptz NOT NULL DEFAULT now(),
  processed_at        timestamptz,
  failed_at           timestamptz,
  failure_reason      text,
  provider_metadata   jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_refunds_updated_at BEFORE UPDATE ON refunds FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Payouts (Liquidaciones a Resorts)
CREATE TABLE IF NOT EXISTS payouts (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resort_id               uuid NOT NULL REFERENCES resorts(id) ON DELETE CASCADE,
  period_start            date NOT NULL,
  period_end              date NOT NULL,
  currency                text NOT NULL DEFAULT 'USD',
  total_gross_cents       integer NOT NULL DEFAULT 0,
  total_commission_cents  integer NOT NULL DEFAULT 0,
  total_net_cents         integer NOT NULL DEFAULT 0,
  status                  payout_status NOT NULL DEFAULT 'draft',
  transfer_ref            text,
  notes                   text,
  paid_at                 timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_payouts_updated_at BEFORE UPDATE ON payouts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Comisiones (Plataforma)
CREATE TABLE IF NOT EXISTS commissions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id       uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  rate_bps         integer NOT NULL CHECK (rate_bps >= 0),
  commission_cents integer NOT NULL CHECK (commission_cents >= 0),
  status           commission_status NOT NULL DEFAULT 'accrued',
  payout_id        uuid REFERENCES payouts(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_commission_booking ON commissions(booking_id);

CREATE TABLE IF NOT EXISTS payout_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id        uuid NOT NULL REFERENCES payouts(id) ON DELETE CASCADE,
  commission_id    uuid NOT NULL REFERENCES commissions(id) ON DELETE RESTRICT,
  booking_id       uuid NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  amount_net_cents integer NOT NULL CHECK (amount_net_cents >= 0),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (commission_id),
  UNIQUE (payout_id, booking_id)
);

-- Comisiones (Agentes)
CREATE TABLE IF NOT EXISTS agent_commissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id uuid NOT NULL REFERENCES bookings(id),
    agent_id uuid NOT NULL REFERENCES users(id),
    resort_id uuid NOT NULL REFERENCES resorts(id),
    amount_cents integer NOT NULL,
    rate_bps integer NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    paid_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Reconciliación
CREATE TABLE IF NOT EXISTS payment_reconciliations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_date   date NOT NULL,
  provider              payment_provider NOT NULL,
  total_payments        integer NOT NULL DEFAULT 0,
  total_amount_cents    bigint NOT NULL DEFAULT 0,
  reconciled_payments   integer NOT NULL DEFAULT 0,
  reconciled_amount_cents bigint NOT NULL DEFAULT 0,
  discrepancies_count   integer NOT NULL DEFAULT 0,
  status                text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed')),
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ====================================================================================
-- 8. OPERACIONES Y AUDITORÍA
-- ====================================================================================

CREATE TABLE IF NOT EXISTS reviews (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id     uuid UNIQUE NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id        uuid REFERENCES users(id) ON DELETE SET NULL,
  experience_id  uuid NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  rating         smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment        text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_favorites (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  experience_id  uuid NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, experience_id)
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider          text NOT NULL,
  provider_event_id text,
  event_type        text,
  payload           jsonb NOT NULL,
  signature_valid   boolean NOT NULL DEFAULT false,
  status            webhook_status NOT NULL DEFAULT 'pending',
  received_at       timestamptz NOT NULL DEFAULT now(),
  processed_at      timestamptz,
  error             text,
  UNIQUE(provider, provider_event_id)
);

CREATE TABLE IF NOT EXISTS outbox_messages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type text NOT NULL,
  aggregate_id   uuid,
  event_type     text NOT NULL,
  payload        jsonb NOT NULL,
  status         outbox_status NOT NULL DEFAULT 'pending',
  attempts       integer NOT NULL DEFAULT 0,
  last_error     text,
  next_retry_at  timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_role    user_role,
  action        text NOT NULL,
  entity_type   text NOT NULL,
  entity_id     uuid,
  before        jsonb,
  after         jsonb,
  ip            inet,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_logs (
    id SERIAL PRIMARY KEY,
    job_id VARCHAR(255) UNIQUE NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    template_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('sent', 'failed', 'retrying', 'pending')),
    attempts INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ====================================================================================
-- 9. VISTAS Y FUNCIONES AVANZADAS
-- ====================================================================================

-- 9.1 Cálculo de Disponibilidad Real
CREATE OR REPLACE VIEW v_slot_remaining AS
SELECT
  s.id AS slot_id,
  s.experience_id,
  s.capacity
    - COALESCE(SUM(
        CASE
          WHEN b.status IN ('pending','confirmed')
           AND (b.expires_at IS NULL OR b.expires_at > now())
          THEN (b.adults + b.children)
          ELSE 0
        END
      ),0)
    - COALESCE((
        SELECT SUM(l.quantity)
        FROM inventory_locks l
        WHERE l.slot_id = s.id
          AND l.booking_id IS NULL
          AND l.consumed_at IS NULL
          AND l.expires_at > now()
      ),0) AS remaining
FROM availability_slots s
LEFT JOIN bookings b ON b.slot_id = s.id
GROUP BY s.id, s.capacity;

-- 9.2 Analytics de Referidos
CREATE OR REPLACE VIEW v_referral_code_analytics AS
SELECT 
    rc.id as code_id,
    rc.code,
    rc.owner_user_id,
    rc.code_type,
    rc.usage_count,
    COUNT(DISTINCT b.id) as total_bookings,
    COUNT(DISTINCT CASE WHEN b.status = 'confirmed' THEN b.id END) as confirmed_bookings,
    COALESCE(SUM(CASE WHEN b.status = 'confirmed' THEN b.total_cents ELSE 0 END), 0) as total_revenue_cents,
    COALESCE(SUM(brc.discount_applied_cents), 0) as total_discounts_given_cents,
    MIN(b.created_at) as first_use,
    MAX(b.created_at) as last_use
FROM referral_codes rc
LEFT JOIN bookings b ON b.referral_code_id = rc.id
LEFT JOIN booking_referral_codes brc ON brc.referral_code_id = rc.id
GROUP BY rc.id, rc.code, rc.owner_user_id, rc.code_type, rc.usage_count;

-- 9.3 Lógica de Ratings Automáticos
CREATE OR REPLACE FUNCTION recalc_experience_rating(p_experience_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_avg numeric(5,4); v_cnt integer;
BEGIN
  SELECT COALESCE(AVG(rating),0), COUNT(*) INTO v_avg, v_cnt
  FROM reviews WHERE experience_id = p_experience_id;
  UPDATE experiences
    SET rating_avg = ROUND(v_avg::numeric,2), rating_count = v_cnt, updated_at = now()
  WHERE id = p_experience_id;
END; $$;

CREATE OR REPLACE FUNCTION trg_reviews_after_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM recalc_experience_rating(NEW.experience_id);
  ELSIF (TG_OP = 'UPDATE') THEN
    IF NEW.experience_id <> OLD.experience_id THEN
      PERFORM recalc_experience_rating(OLD.experience_id);
    END IF;
    PERFORM recalc_experience_rating(NEW.experience_id);
  ELSIF (TG_OP = 'DELETE') THEN
    PERFORM recalc_experience_rating(OLD.experience_id);
  END IF;
  RETURN NULL;
END; $$;

CREATE TRIGGER trg_reviews_after_change_ins AFTER INSERT ON reviews FOR EACH ROW EXECUTE FUNCTION trg_reviews_after_change();
CREATE TRIGGER trg_reviews_after_change_upd AFTER UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION trg_reviews_after_change();
CREATE TRIGGER trg_reviews_after_change_del AFTER DELETE ON reviews FOR EACH ROW EXECUTE FUNCTION trg_reviews_after_change();