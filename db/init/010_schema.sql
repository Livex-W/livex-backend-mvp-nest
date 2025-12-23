
-- LIVEX MVP PostgreSQL schema (DDL)
-- Generated: 2025-09-19T01:57:52.010786

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('tourist','resort','admin','agent');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'resort_status') THEN
        CREATE TYPE resort_status AS ENUM ('draft','under_review','approved','rejected');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'experience_status') THEN
        CREATE TYPE experience_status AS ENUM ('draft','under_review','active','rejected');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
        CREATE TYPE booking_status AS ENUM ('pending','confirmed','cancelled','refunded','expired');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
        CREATE TYPE payment_status AS ENUM ('pending','authorized','paid','refunded','failed','expired');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_provider') THEN
        CREATE TYPE payment_provider AS ENUM ('wompi','epayco','stripe','paypal');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'refund_status') THEN
        CREATE TYPE refund_status AS ENUM ('pending','processed','failed','cancelled');
    END IF;
END $$;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         citext UNIQUE NOT NULL,
  
  -- Puede ser NULL para usuarios de Google
  password_hash text, 
  
  -- Nuevo campo para vincular con Firebase
  firebase_uid  text UNIQUE, 
  
  full_name     text,
  phone         text,
  avatar        text, -- Recomendado
  role          user_role NOT NULL DEFAULT 'tourist',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS resorts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  description    text,
  contact_email  citext,
  contact_phone  text,
  address_line   text,
  city           text,
  country        text,
  latitude       numeric(9,6),
  longitude      numeric(9,6),
  owner_user_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  is_active      boolean NOT NULL DEFAULT true,
  status          resort_status NOT NULL DEFAULT 'draft',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_resorts_city ON resorts(city);
CREATE TRIGGER trg_resorts_updated_at BEFORE UPDATE ON resorts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS experiences (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resort_id       uuid NOT NULL REFERENCES resorts(id) ON DELETE CASCADE,
  title           text NOT NULL,
  slug            text GENERATED ALWAYS AS (regexp_replace(lower(title), '\s+', '-', 'g')) STORED,
  description     text,
  category        text NOT NULL CHECK (category IN ('islands','nautical','city_tour')),
  price_cents     integer NOT NULL CHECK (price_cents >= 0),
  currency        text NOT NULL DEFAULT 'USD',
  includes        text,
  excludes        text,
  main_image_url  text,
  status          experience_status NOT NULL DEFAULT 'under_review',
  rating_avg      numeric(3,2) NOT NULL DEFAULT 0.0,
  rating_count    integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_experiences_resort ON experiences(resort_id);
CREATE INDEX IF NOT EXISTS idx_experiences_category ON experiences(category);
CREATE INDEX IF NOT EXISTS idx_experiences_status ON experiences(status);
CREATE INDEX IF NOT EXISTS idx_experiences_price ON experiences(price_cents);
CREATE TRIGGER trg_experiences_updated_at BEFORE UPDATE ON experiences
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS experience_images (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experience_id  uuid NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  url            text NOT NULL,
  sort_order     integer NOT NULL DEFAULT 0,
  image_type     VARCHAR(20) DEFAULT 'gallery' CHECK (image_type IN ('hero', 'gallery')),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_images_experience ON experience_images(experience_id);
CREATE INDEX IF NOT EXISTS idx_experience_images_type ON experience_images(experience_id, image_type);

CREATE TABLE IF NOT EXISTS availability_slots (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experience_id  uuid NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  start_time     timestamptz NOT NULL,
  end_time       timestamptz NOT NULL,
  capacity       integer NOT NULL CHECK (capacity >= 0),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT slot_time_range CHECK (start_time < end_time)
);
CREATE INDEX IF NOT EXISTS idx_slots_experience ON availability_slots(experience_id);
CREATE INDEX IF NOT EXISTS idx_slots_start ON availability_slots(start_time);
CREATE TRIGGER trg_slots_updated_at BEFORE UPDATE ON availability_slots
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 1. Tabla para definir la relación entre un Agente (Usuario) y un Resort, con su % de comisión
CREATE TABLE resort_agents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    resort_id uuid NOT NULL REFERENCES resorts(id),
    user_id uuid NOT NULL REFERENCES users(id),
    commission_bps integer NOT NULL CHECK (commission_bps >= 0 AND commission_bps <= 10000), -- Basis Points (1500 = 15%)
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    -- Un usuario solo puede tener un acuerdo activo por resort
    CONSTRAINT unique_active_agent_resort UNIQUE (resort_id, user_id)
);

-- Tabla de Códigos de Referido / Cupones
CREATE TABLE IF NOT EXISTS referral_codes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE NOT NULL, -- El código memorable (ej: VERANO2025, JUANVIP)
    owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Tipo de código
    code_type text NOT NULL DEFAULT 'commission' CHECK (code_type IN ('commission', 'discount', 'both')),
    
    -- Descuento (si aplica)
    discount_type text CHECK (discount_type IN ('percentage', 'fixed', 'none')),
    discount_value integer DEFAULT 0, -- Percentage (bps) o Fixed (cents)
    
    -- Comisión override (opcional, si NULL usa el de resort_agents)
    commission_override_bps integer,
    
    -- Control
    is_active boolean DEFAULT true,
    usage_limit integer, -- NULL = ilimitado
    usage_count integer DEFAULT 0,
    expires_at timestamptz,
    
    -- Metadata
    description text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    CONSTRAINT valid_discount_config CHECK (
        (code_type = 'commission' AND discount_type IS NULL) OR
        (code_type IN ('discount', 'both') AND discount_type IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_referral_codes_owner ON referral_codes(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_active ON referral_codes(code) WHERE is_active = true;

CREATE TRIGGER trg_referral_codes_updated_at BEFORE UPDATE ON referral_codes
FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TABLE IF NOT EXISTS bookings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  experience_id  uuid NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  slot_id        uuid NOT NULL REFERENCES availability_slots(id) ON DELETE CASCADE,
  adults         integer NOT NULL CHECK (adults >= 0),
  children       integer NOT NULL DEFAULT 0 CHECK (children >= 0),
  total_cents    integer NOT NULL CHECK (total_cents >= 0),
  currency       text NOT NULL DEFAULT 'USD',
  idempotency_key text,
  status         booking_status NOT NULL DEFAULT 'pending',
  agent_id       uuid REFERENCES users(id), -- Nuevo campo para Agentes
  referral_code_id uuid REFERENCES referral_codes(id), -- Código usado en esta reserva
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_quantities CHECK (adults + children > 0)
);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_experience ON bookings(experience_id);
CREATE INDEX IF NOT EXISTS idx_bookings_slot ON bookings(slot_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_agent ON bookings(agent_id); -- Índice para agentes

-- 3. Tabla para registrar las comisiones generadas por cada venta
CREATE TABLE IF NOT EXISTS agent_commissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id uuid NOT NULL REFERENCES bookings(id),
    agent_id uuid NOT NULL REFERENCES users(id),
    resort_id uuid NOT NULL REFERENCES resorts(id),
    
    amount_cents integer NOT NULL, -- Monto exacto de la comisión
    rate_bps integer NOT NULL,     -- Tasa que se aplicó en ese momento
    
    status text NOT NULL DEFAULT 'pending', -- pending, paid, cancelled
    paid_at timestamptz,
    
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Datos Bancarios
    bank_name text,
    account_number text,
    account_type text, -- savings, checking
    account_holder_name text,
    
    -- Datos Fiscales
    tax_id text, -- NIT, Cédula, SSN
    
    is_verified boolean DEFAULT false,
    
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    CONSTRAINT unique_agent_profile UNIQUE (user_id)
);


-- Tabla de Restricciones por Experiencia/Categoría
CREATE TABLE IF NOT EXISTS referral_code_restrictions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    referral_code_id uuid NOT NULL REFERENCES referral_codes(id) ON DELETE CASCADE,
    
    -- Restricción por tipo (mutuamente exclusivo)
    restriction_type text NOT NULL CHECK (restriction_type IN ('experience', 'category', 'resort')),
    
    -- IDs relacionados (solo uno debe estar lleno según el tipo)
    experience_id uuid REFERENCES experiences(id) ON DELETE CASCADE,
    category_slug text,
    resort_id uuid REFERENCES resorts(id) ON DELETE CASCADE,
    
    created_at timestamptz DEFAULT now(),
    
    -- Un código no puede tener la misma restricción duplicada
    UNIQUE (referral_code_id, restriction_type, experience_id, category_slug, resort_id)
);

CREATE INDEX IF NOT EXISTS idx_referral_restrictions_code ON referral_code_restrictions(referral_code_id);
CREATE INDEX IF NOT EXISTS idx_referral_restrictions_experience ON referral_code_restrictions(experience_id);

-- Tabla de Variantes A/B Testing
CREATE TABLE IF NOT EXISTS referral_code_variants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_code_id uuid NOT NULL REFERENCES referral_codes(id) ON DELETE CASCADE,
    
    variant_name text NOT NULL, -- 'A', 'B', 'Control', etc.
    code text UNIQUE NOT NULL,
    
    -- Configuración propia (puede diferir del padre)
    discount_value integer,
    commission_override_bps integer,
    
    -- Métricas
    usage_count integer DEFAULT 0,
    conversion_count integer DEFAULT 0, -- Cuántos se confirmaron
    
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    
    UNIQUE (parent_code_id, variant_name)
);

CREATE INDEX IF NOT EXISTS idx_code_variants_parent ON referral_code_variants(parent_code_id);

-- Ampliar referral_codes con nuevos campos
ALTER TABLE referral_codes
    ADD COLUMN IF NOT EXISTS allow_stacking boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS min_purchase_cents integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS max_discount_cents integer;

CREATE TABLE IF NOT EXISTS bookings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  experience_id  uuid NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  slot_id        uuid NOT NULL REFERENCES availability_slots(id) ON DELETE CASCADE,
  adults         integer NOT NULL CHECK (adults >= 0),
  children       integer NOT NULL DEFAULT 0 CHECK (children >= 0),
  total_cents    integer NOT NULL CHECK (total_cents >= 0),
  currency       text NOT NULL DEFAULT 'USD',
  idempotency_key text,
  status         booking_status NOT NULL DEFAULT 'pending',
  agent_id       uuid REFERENCES users(id), -- Nuevo campo para Agentes
  referral_code_id uuid REFERENCES referral_codes(id), -- Código usado en esta reserva
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_quantities CHECK (adults + children > 0)
);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_experience ON bookings(experience_id);
CREATE INDEX IF NOT EXISTS idx_bookings_slot ON bookings(slot_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_agent ON bookings(agent_id); -- Índice para agentes

-- 3. Tabla para registrar las comisiones generadas por cada venta
CREATE TABLE IF NOT EXISTS agent_commissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id uuid NOT NULL REFERENCES bookings(id),
    agent_id uuid NOT NULL REFERENCES users(id),
    resort_id uuid NOT NULL REFERENCES resorts(id),
    
    amount_cents integer NOT NULL, -- Monto exacto de la comisión
    rate_bps integer NOT NULL,     -- Tasa que se aplicó en ese momento
    
    status text NOT NULL DEFAULT 'pending', -- pending, paid, cancelled
    paid_at timestamptz,
    
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Datos Bancarios
    bank_name text,
    account_number text,
    account_type text, -- savings, checking
    account_holder_name text,
    
    -- Datos Fiscales
    tax_id text, -- NIT, Cédula, SSN
    
    is_verified boolean DEFAULT false,
    
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    CONSTRAINT unique_agent_profile UNIQUE (user_id)
);



-- Tabla de uso múltiple de códigos (stacking)
CREATE TABLE IF NOT EXISTS booking_referral_codes (
    booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    referral_code_id uuid NOT NULL REFERENCES referral_codes(id),
    discount_applied_cents integer NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (booking_id, referral_code_id)
);

-- Vista de Analytics por Código
CREATE OR REPLACE VIEW v_referral_code_analytics AS
SELECT 
    rc.id as code_id,
    rc.code,
    rc.owner_user_id,
    rc.code_type,
    
    -- Uso
    rc.usage_count,
    COUNT(DISTINCT b.id) as total_bookings,
    COUNT(DISTINCT CASE WHEN b.status = 'confirmed' THEN b.id END) as confirmed_bookings,
    
    -- Revenue
    COALESCE(SUM(CASE WHEN b.status = 'confirmed' THEN b.total_cents ELSE 0 END), 0) as total_revenue_cents,
    COALESCE(AVG(CASE WHEN b.status = 'confirmed' THEN b.total_cents END), 0) as avg_order_value_cents,
    
    -- Descuentos
    COALESCE(SUM(brc.discount_applied_cents), 0) as total_discounts_given_cents,
    
    -- Tasa de conversión
    CASE 
        WHEN COUNT(DISTINCT b.id) > 0 
        THEN ROUND((COUNT(DISTINCT CASE WHEN b.status = 'confirmed' THEN b.id END)::numeric / COUNT(DISTINCT b.id)::numeric) * 100, 2)
        ELSE 0 
    END as conversion_rate_pct,
    
    -- Temporal
    MIN(b.created_at) as first_use,
    MAX(b.created_at) as last_use
    
FROM referral_codes rc
LEFT JOIN bookings b ON b.referral_code_id = rc.id
LEFT JOIN booking_referral_codes brc ON brc.referral_code_id = rc.id
GROUP BY rc.id, rc.code, rc.owner_user_id, rc.code_type, rc.usage_count;

CREATE INDEX IF NOT EXISTS idx_agent_commissions_agent ON agent_commissions(agent_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_idempotency
  ON bookings(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_idempotency
    ON bookings(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE TRIGGER trg_bookings_updated_at BEFORE UPDATE ON bookings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

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
  authorized_at       timestamptz,
  paid_at             timestamptz,
  failed_at           timestamptz,
  failure_reason      text,
  provider_metadata   jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_provider_capture_id ON payments(provider_capture_id);
CREATE INDEX IF NOT EXISTS idx_payments_provider_id ON payments(provider, provider_payment_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_idempotency 
  ON payments(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

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
CREATE INDEX IF NOT EXISTS idx_refunds_payment ON refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);
CREATE INDEX IF NOT EXISTS idx_refunds_provider_id ON refunds(provider_refund_id);
CREATE TRIGGER trg_refunds_updated_at BEFORE UPDATE ON refunds
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

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
CREATE INDEX IF NOT EXISTS idx_payment_reconciliations_date ON payment_reconciliations(reconciliation_date);
CREATE INDEX IF NOT EXISTS idx_payment_reconciliations_provider ON payment_reconciliations(provider);
CREATE TRIGGER trg_payment_reconciliations_updated_at BEFORE UPDATE ON payment_reconciliations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS commissions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id       uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  rate_bps         integer NOT NULL CHECK (rate_bps >= 0),
  commission_cents integer NOT NULL CHECK (commission_cents >= 0),
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_commission_booking ON commissions(booking_id);

CREATE OR REPLACE VIEW v_slot_remaining AS
SELECT
  s.id AS slot_id,
  s.experience_id,
  s.capacity - COALESCE(SUM(
      CASE
        WHEN b.status IN ('pending','confirmed') THEN (b.adults + b.children)
        ELSE 0
      END
  ),0) AS remaining
FROM availability_slots s
LEFT JOIN bookings b ON b.slot_id = s.id
GROUP BY s.id, s.capacity;

CREATE OR REPLACE FUNCTION refundable_cents(p_booking_id uuid, p_now timestamptz DEFAULT now())
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_total integer;
  v_slot_start timestamptz;
  v_paid integer;
  v_refunded integer;
  v_base_refund integer;
  v_due integer;
BEGIN
  SELECT b.total_cents, s.start_time
    INTO v_total, v_slot_start
  FROM bookings b
  JOIN availability_slots s ON s.id = b.slot_id
  WHERE b.id = p_booking_id;

  IF v_total IS NULL THEN
    RAISE EXCEPTION 'booking % not found', p_booking_id;
  END IF;

  SELECT COALESCE(SUM(CASE WHEN p.status = 'paid' THEN p.amount_cents ELSE 0 END),0)
    INTO v_paid
  FROM payments p
  WHERE p.booking_id = p_booking_id;

  SELECT COALESCE(SUM(r.amount_cents),0)
    INTO v_refunded
  FROM payments p
  JOIN refunds r ON r.payment_id = p.id
  WHERE p.booking_id = p_booking_id;

  IF p_now <= v_slot_start - INTERVAL '48 hours' THEN
    v_base_refund := (v_total * 80) / 100;
  ELSE
    v_base_refund := 0;
  END IF;

  v_due := GREATEST(LEAST(v_base_refund, v_paid - v_refunded), 0);
  RETURN v_due;
END;
$$;


-- ================================
-- DELTAS PARA COMPLETAR EL MVP
-- (Append a tu DDL existente)
-- ================================

-- ----- Tipos/ENUM necesarios -----
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'resort_status') THEN
    CREATE TYPE resort_status AS ENUM ('draft','under_review','approved','rejected');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'commission_status') THEN
    CREATE TYPE commission_status AS ENUM ('accrued','in_payout','paid','void');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payout_status') THEN
    CREATE TYPE payout_status AS ENUM ('draft','processing','paid','failed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_status') THEN
    CREATE TYPE document_status AS ENUM ('uploaded','under_review','approved','rejected');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'resort_doc_type') THEN
    CREATE TYPE resort_doc_type AS ENUM ('national_id','tax_id','license','insurance','bank_cert','other');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'webhook_status') THEN
    CREATE TYPE webhook_status AS ENUM ('pending','processed','failed','ignored');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'outbox_status') THEN
    CREATE TYPE outbox_status AS ENUM ('pending','sent','failed');
  END IF;
END $$;

-- ---------- Aprobaciones/KYC ----------
ALTER TABLE resorts
  ADD COLUMN IF NOT EXISTS status resort_status NOT NULL DEFAULT 'under_review',
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

CREATE TABLE IF NOT EXISTS resort_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resort_id       uuid NOT NULL REFERENCES resorts(id) ON DELETE CASCADE,
  doc_type        resort_doc_type NOT NULL,
  file_url        text NOT NULL,
  status          document_status NOT NULL DEFAULT 'uploaded',
  uploaded_at     timestamptz NOT NULL DEFAULT now(),
  reviewed_by     uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at     timestamptz,
  rejection_reason text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_resort_documents_resort ON resort_documents(resort_id);
CREATE INDEX IF NOT EXISTS idx_resort_documents_status ON resort_documents(status);
CREATE TRIGGER trg_resort_documents_updated_at BEFORE UPDATE ON resort_documents
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS resort_bank_info (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resort_id       uuid NOT NULL REFERENCES resorts(id) ON DELETE CASCADE,
  bank_name       text NOT NULL,
  account_holder  text NOT NULL,
  account_number  text NOT NULL,
  account_type    text, -- savings/checking si aplica
  tax_id          text,
  is_primary      boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_resort_bank_info_resort ON resort_bank_info(resort_id);
CREATE TRIGGER trg_resort_bank_info_updated_at BEFORE UPDATE ON resort_bank_info
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- Normalización de categorías ----------
CREATE TABLE IF NOT EXISTS categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text UNIQUE NOT NULL,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS experience_categories (
  experience_id uuid NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  category_id   uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (experience_id, category_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_experiences_resort_slug
  ON experiences(resort_id, slug);

-- ---------- Reseñas ----------
CREATE TABLE IF NOT EXISTS reviews (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id     uuid UNIQUE NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id        uuid REFERENCES users(id) ON DELETE SET NULL,
  experience_id  uuid NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  rating         smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment        text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reviews_experience ON reviews(experience_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id);

-- Función + trigger para mantener rating_avg/rating_count
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

DROP TRIGGER IF EXISTS trg_reviews_after_change_ins ON reviews;
DROP TRIGGER IF EXISTS trg_reviews_after_change_upd ON reviews;
DROP TRIGGER IF EXISTS trg_reviews_after_change_del ON reviews;

CREATE TRIGGER trg_reviews_after_change_ins AFTER INSERT ON reviews
FOR EACH ROW EXECUTE FUNCTION trg_reviews_after_change();
CREATE TRIGGER trg_reviews_after_change_upd AFTER UPDATE ON reviews
FOR EACH ROW EXECUTE FUNCTION trg_reviews_after_change();
CREATE TRIGGER trg_reviews_after_change_del AFTER DELETE ON reviews
FOR EACH ROW EXECUTE FUNCTION trg_reviews_after_change();

-- ---------- Locks de inventario y expiración de checkout ----------
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS subtotal_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE INDEX IF NOT EXISTS idx_bookings_expires_at ON bookings(expires_at);

CREATE TABLE IF NOT EXISTS inventory_locks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id      uuid NOT NULL REFERENCES availability_slots(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES users(id) ON DELETE SET NULL,
  booking_id   uuid REFERENCES bookings(id) ON DELETE SET NULL,
  quantity     integer NOT NULL CHECK (quantity > 0),
  expires_at   timestamptz NOT NULL,
  consumed_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inventory_locks_slot ON inventory_locks(slot_id);
CREATE INDEX IF NOT EXISTS idx_inventory_locks_active ON inventory_locks(slot_id, expires_at)
  WHERE consumed_at IS NULL;

-- Reemplaza la vista para restar locks activos no consumidos ni expirados (previos al booking)
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

-- ---------- Pagos robustos: idempotencia + webhooks ----------
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS raw_payload jsonb,
  ADD COLUMN IF NOT EXISTS signature_valid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS error_code text,
  ADD COLUMN IF NOT EXISTS error_message text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_idempotency
  ON payments(idempotency_key) WHERE idempotency_key IS NOT NULL;

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
  error             text
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_webhook_provider_event
  ON webhook_events(provider, provider_event_id) WHERE provider_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_webhook_status ON webhook_events(status);

-- ---------- Liquidaciones / Payouts ----------
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
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  paid_at                 timestamptz
);
CREATE INDEX IF NOT EXISTS idx_payouts_resort ON payouts(resort_id);
CREATE TRIGGER trg_payouts_updated_at BEFORE UPDATE ON payouts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

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
CREATE INDEX IF NOT EXISTS idx_payout_items_payout ON payout_items(payout_id);

ALTER TABLE commissions
  ADD COLUMN IF NOT EXISTS status commission_status NOT NULL DEFAULT 'accrued',
  ADD COLUMN IF NOT EXISTS payout_id uuid REFERENCES payouts(id) ON DELETE SET NULL;

-- ---------- Outbox para notificaciones/webhooks salientes ----------
CREATE TABLE IF NOT EXISTS outbox_messages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type text NOT NULL,        -- p.ej. 'booking'
  aggregate_id   uuid,                 -- id de la entidad
  event_type     text NOT NULL,        -- p.ej. 'BOOKING_CONFIRMED'
  payload        jsonb NOT NULL,
  status         outbox_status NOT NULL DEFAULT 'pending',
  attempts       integer NOT NULL DEFAULT 0,
  last_error     text,
  next_retry_at  timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox_messages(status, next_retry_at);

-- ---------- Auditoría ----------
CREATE TABLE IF NOT EXISTS audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_role    user_role,
  action        text NOT NULL,     -- 'update','approve','reject',...
  entity_type   text NOT NULL,     -- 'resort','experience','booking',...
  entity_id     uuid,
  before        jsonb,
  after         jsonb,
  ip            inet,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_user_id);

-- ---------- Tokens de auth/seguridad ----------
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jti         uuid NOT NULL, -- token id (JWT ID)
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  ip          inet,
  user_agent  text,
  UNIQUE(jti)
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

CREATE TABLE IF NOT EXISTS email_verifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       uuid NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  UNIQUE(token)
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       VARCHAR(6) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  UNIQUE(token)
);

-- ---------- Ubicación por experiencia (opcional pero útil) ----------
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
CREATE INDEX IF NOT EXISTS idx_experience_locations_exp ON experience_locations(experience_id);

-- ---------- Campos de aprobación en experiencias ----------
ALTER TABLE experiences
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- (Opcional) Índices adicionales útiles
CREATE INDEX IF NOT EXISTS idx_experiences_price_currency ON experiences(price_cents, currency);
CREATE INDEX IF NOT EXISTS idx_resorts_status_active ON resorts(status, is_active);

-- Crear tabla para logs de emails
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

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_template_type ON email_logs(template_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at);

-- Comentarios
COMMENT ON TABLE email_logs IS 'Registro de envíos de email y su estado';
COMMENT ON COLUMN email_logs.job_id IS 'ID único del job de notificación';
COMMENT ON COLUMN email_logs.recipient IS 'Email del destinatario';
COMMENT ON COLUMN email_logs.template_type IS 'Tipo de plantilla de email utilizada';
COMMENT ON COLUMN email_logs.status IS 'Estado del envío: sent, failed, retrying, pending';
COMMENT ON COLUMN email_logs.attempts IS 'Número de intentos de envío';
COMMENT ON COLUMN email_logs.error_message IS 'Mensaje de error si el envío falló';


-- Monitoreo y Limpieza
-- Cleanup Job (recomendado)

-- -- Limpiar refresh tokens expirados (cron job)
-- DELETE FROM refresh_tokens
-- WHERE expires_at < NOW() - INTERVAL '1 day';

-- -- Limpiar password reset tokens usados/expirados
-- DELETE FROM password_reset_tokens
-- WHERE used_at IS NOT NULL OR expires_at < NOW();

-- ---------- User Favorites ----------
CREATE TABLE IF NOT EXISTS user_favorites (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  experience_id  uuid NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, experience_id)
);
CREATE INDEX IF NOT EXISTS idx_user_favorites_user ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_experience ON user_favorites(experience_id);

COMMENT ON TABLE user_favorites IS 'Stores user favorite experiences';
COMMENT ON COLUMN user_favorites.user_id IS 'Reference to the user who favorited';
COMMENT ON COLUMN user_favorites.experience_id IS 'Reference to the favorited experience';
