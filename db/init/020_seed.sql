-- ===========================
-- LIVEX MVP seed data (full, FIX enum casts)
-- ===========================

-- 1) Usuarios base (admin + operadores)
WITH u AS (
  INSERT INTO users (email, password_hash, full_name, phone, role) VALUES
    ('admin@livex.app', '$2b$10$j54QekkMZucJ.hKpcRMmqe4SnETnpr.8OxLyRfAZVLnSVkBgP4eFS','Admin Livex', '+573000000000', 'admin'),
    ('operaciones@marysol.co', '$2b$10$5eTgOS5SOy7P1E/xsB4kBuUTTfEstsU4fM2wNhKGiHWp/HXl2cQ2.','Operaciones Mar y Sol', '+573001111111', 'resort'),
    ('coordinacion@islabrisa.co', '$2b$10$xo422QzD1EzJGyZw4ZX.uOGPhvH1O/AcZqGXiLXekrQxQWIrfmtB6','Coordinación Isla Brisa', '+573002222222', 'resort'),
    ('reservas@nauticabahia.co', '$2b$10$spwKr.1mndnqnkr1I4Y/keuLEUKmJ/AXvvTKvv9Jo.EwSdZIVe8Le','Reservas Náutica Bahía', '+573003333333', 'resort'),
    ('sofia.turista@gmail.com', '$2b$10$2ll7SeL6f3FtaB1l3FYWiOoOBLxSousw97M2bDrBxqk9cxQiqOLnC','Sofía Turista', '+573004444444', 'tourist')
  RETURNING id, email, role
),

-- 2) Prestadores (resorts) aprobados por el admin
r AS (
  INSERT INTO resorts (
    name, description, contact_email, contact_phone,
    address_line, city, country, latitude, longitude,
    owner_user_id, is_active, status, approved_by, approved_at
  )
  SELECT
    'Mar y Sol Cartagena', 'Operador de actividades de playa y city tours', 'contacto@marysol.co', '+57 300 1111111',
    'Bocagrande Cra 1 #1-23', 'Cartagena', 'Colombia', 10.400000, -75.550000,
    (SELECT id FROM u WHERE email='operaciones@marysol.co'), true, 'approved'::resort_status,
    (SELECT id FROM u WHERE email='admin@livex.app'), now()
  UNION ALL
  SELECT
    'Isla Brisa Resort', 'Resort boutique en Islas del Rosario', 'hola@islabrisa.co', '+57 300 2222222',
    'Muelle La Bodeguita', 'Cartagena', 'Colombia', 10.411100, -75.545000,
    (SELECT id FROM u WHERE email='coordinacion@islabrisa.co'), true, 'approved'::resort_status,
    (SELECT id FROM u WHERE email='admin@livex.app'), now()
  UNION ALL
  SELECT
    'Náutica Bahía Club', 'Club náutico con experiencias de vela y atardecer', 'info@nauticabahia.co', '+57 300 3333333',
    'Marina Santa Cruz', 'Cartagena', 'Colombia', 10.420000, -75.530000,
    (SELECT id FROM u WHERE email='reservas@nauticabahia.co'), true, 'approved'::resort_status,
    (SELECT id FROM u WHERE email='admin@livex.app'), now()
  RETURNING id, name
),

-- 3) KYC básico: cuenta bancaria principal por prestador
bank AS (
  INSERT INTO resort_bank_info (resort_id, bank_name, account_holder, account_number, account_type, tax_id, is_primary)
  VALUES
    ((SELECT id FROM r WHERE name='Mar y Sol Cartagena'), 'Bancolombia', 'Mar y Sol SAS', '1234567890', 'checking', '900111222-3', true),
    ((SELECT id FROM r WHERE name='Isla Brisa Resort'), 'Davivienda', 'Isla Brisa SAS', '2233445566', 'savings',  '901222333-4', true),
    ((SELECT id FROM r WHERE name='Náutica Bahía Club'), 'BBVA', 'Nautica Bahia SAS', '3344556677', 'checking', '902333444-5', true)
  RETURNING resort_id
),

-- 4) KYC: documentos (marcados aprobados)
docs AS (
  INSERT INTO resort_documents (resort_id, doc_type, file_url, status, reviewed_by, reviewed_at)
  VALUES
    ((SELECT id FROM r WHERE name='Mar y Sol Cartagena'), 'tax_id'::resort_doc_type, 'https://files.example.com/marysol-rut.pdf', 'approved'::document_status, (SELECT id FROM u WHERE email='admin@livex.app'), now()),
    ((SELECT id FROM r WHERE name='Isla Brisa Resort'),   'license'::resort_doc_type, 'https://files.example.com/islabrisa-lic.pdf', 'approved'::document_status, (SELECT id FROM u WHERE email='admin@livex.app'), now()),
    ((SELECT id FROM r WHERE name='Náutica Bahía Club'),  'insurance'::resort_doc_type,'https://files.example.com/nautica-pola.pdf', 'approved'::document_status, (SELECT id FROM u WHERE email='admin@livex.app'), now())
  RETURNING resort_id
),

-- 5) Catálogo: categorías normalizadas
c AS (
  INSERT INTO categories (slug, name) VALUES
    ('city_tour','City Tour'),
    ('islands','Islas y Playa'),
    ('nautical','Náutica y Vela')
  RETURNING id, slug
),

-- 6) Experiencias (con category = slug; status activo y aprobadas)
e AS (
  INSERT INTO experiences (
    resort_id, title, description, category, price_cents, currency,
    includes, excludes, main_image_url, status, approved_by, approved_at
  )
  VALUES
    ((SELECT id FROM r WHERE name='Mar y Sol Cartagena'),
      'City Tour Histórico', 'Recorrido por el Centro Histórico y Getsemaní', 'city_tour', 120000, 'COP',
      'Guía certificado, hidratación', 'Almuerzo', 'https://images.example.com/city_tour.jpg', 'active'::experience_status,
      (SELECT id FROM u WHERE email='admin@livex.app'), now()),
    ((SELECT id FROM r WHERE name='Isla Brisa Resort'),
      'Full Day Islas del Rosario', 'Traslado en lancha y día de playa en Isla Brisa', 'islands', 250000, 'COP',
      'Traslados, coctel de bienvenida, carpa', 'Impuesto de muelle', 'https://images.example.com/islas.jpg', 'active'::experience_status,
      (SELECT id FROM u WHERE email='admin@livex.app'), now()),
    ((SELECT id FROM r WHERE name='Náutica Bahía Club'),
      'Sunset Sailing', 'Navegación a vela por la Bahía al atardecer', 'nautical', 180000, 'COP',
      'Capitán, seguro, snacks', 'Traslados al muelle', 'https://images.example.com/sunset.jpg', 'active'::experience_status,
      (SELECT id FROM u WHERE email='admin@livex.app'), now())
  RETURNING id, title, category, resort_id
),

-- 7) Relación experiencia↔categorías (M:N)
ec AS (
  INSERT INTO experience_categories (experience_id, category_id)
  SELECT e.id, c.id
  FROM e
  JOIN c ON c.slug = e.category
  RETURNING experience_id
),

-- 8) Imágenes de experiencias
imgs AS (
  INSERT INTO experience_images (experience_id, url, sort_order) VALUES
    ((SELECT id FROM e WHERE title='City Tour Histórico'), 'https://images.example.com/city_tour_1.jpg', 0),
    ((SELECT id FROM e WHERE title='City Tour Histórico'), 'https://images.example.com/city_tour_2.jpg', 1),
    ((SELECT id FROM e WHERE title='Full Day Islas del Rosario'), 'https://images.example.com/islas_1.jpg', 0),
    ((SELECT id FROM e WHERE title='Full Day Islas del Rosario'), 'https://images.example.com/islas_2.jpg', 1),
    ((SELECT id FROM e WHERE title='Sunset Sailing'), 'https://images.example.com/sunset_1.jpg', 0)
  RETURNING experience_id
),

-- 9) Ubicaciones/puntos de encuentro
loc AS (
  INSERT INTO experience_locations (experience_id, name, address_line, latitude, longitude, meeting_instructions)
  VALUES
    ((SELECT id FROM e WHERE title='City Tour Histórico'),
      'Monumento Camellón de los Mártires', 'Camellón de los Mártires, Centro', 10.422300, -75.545500,
      'Llegar 10 min antes. Busca al guía con sombrero vueltiao.'),
    ((SELECT id FROM e WHERE title='Full Day Islas del Rosario'),
      'Muelle La Bodeguita', 'Av. Blas de Lezo, Centro', 10.421900, -75.548300,
      'Impuesto de muelle no incluido. Presentar documento.'),
    ((SELECT id FROM e WHERE title='Sunset Sailing'),
      'Marina Santa Cruz', 'Manga, Cartagena', 10.409800, -75.535100,
      'Ingresar por portería principal, muelle 3.')
  RETURNING experience_id
)

-- 10) Disponibilidad (slots)
INSERT INTO availability_slots (experience_id, start_time, end_time, capacity)
VALUES
  ((SELECT id FROM e WHERE title='City Tour Histórico'),
    '2025-09-20T09:00:00-05', '2025-09-20T12:00:00-05', 20),
  ((SELECT id FROM e WHERE title='City Tour Histórico'),
    '2025-09-20T15:00:00-05', '2025-09-20T18:00:00-05', 20),
  ((SELECT id FROM e WHERE title='Full Day Islas del Rosario'),
    '2025-09-20T08:00:00-05', '2025-09-20T16:00:00-05', 40),
  ((SELECT id FROM e WHERE title='Sunset Sailing'),
    '2025-09-21T17:30:00-05', '2025-09-21T19:30:00-05', 10),
  ((SELECT id FROM e WHERE title='Sunset Sailing'),
    '2025-09-22T17:30:00-05', '2025-09-22T19:30:00-05', 10);

-- (Opcional de prueba rápida) Una reserva confirmada con impuestos y comisión calculada
-- Descomenta si quieres datos operativos para probar pagos/payouts.

-- WITH b AS (
--   INSERT INTO bookings (user_id, experience_id, slot_id, adults, children, subtotal_cents, tax_cents, total_cents, currency, status)
--   VALUES (
--     (SELECT id FROM users WHERE email='sofia.turista@gmail.com'),
--     (SELECT id FROM e WHERE title='City Tour Histórico'),
--     (SELECT id FROM availability_slots WHERE experience_id=(SELECT id FROM e WHERE title='City Tour Histórico') LIMIT 1),
--     2, 0, 100000, 20000, 120000, 'COP', 'confirmed'::booking_status
--   )
--   RETURNING id
-- ),
-- pay AS (
--   INSERT INTO payments (booking_id, provider, provider_ref, amount_cents, status, paid_at, idempotency_key, signature_valid, payment_method)
--   VALUES ((SELECT id FROM b), 'fakepay', 'FP-0001', 120000, 'paid'::payment_status, now(), 'seed-ct-0001', true, 'card')
--   RETURNING booking_id
-- )
-- INSERT INTO commissions (booking_id, rate_bps, commission_cents, status)
-- VALUES ((SELECT id FROM b), 1000, 12000, 'accrued'::commission_status);

UPDATE experience_images SET image_type = 'gallery' WHERE image_type IS NULL;

-- ===========================
-- 11) DATOS DE PRUEBA SISTEMA DE AGENTES
-- ===========================

-- 11.1) Crear un usuario Agente
-- 11.1) Crear un usuario Agente
INSERT INTO users (email, password_hash, full_name, phone, role) 
VALUES ('agente.carlos@gmail.com', '$2b$10$j54QekkMZucJ.hKpcRMmqe4SnETnpr.8OxLyRfAZVLnSVkBgP4eFS', 'Carlos El Vendedor', '+573005555555', 'agent');

-- 11.2) Crear Acuerdo: Carlos vende para "Mar y Sol Cartagena" con 15% (1500 bps)
INSERT INTO resort_agents (resort_id, user_id, commission_bps, is_active)
SELECT 
  (SELECT id FROM resorts WHERE name='Mar y Sol Cartagena'),
  (SELECT id FROM users WHERE email='agente.carlos@gmail.com'),
  1500, -- 15%
  true;

-- 11.3) Crear una Reserva hecha por el Agente (Booking Confirmado)
INSERT INTO bookings (
  user_id, experience_id, slot_id, agent_id,
  adults, children, subtotal_cents, tax_cents, total_cents, currency, 
  status, created_at, updated_at
)
SELECT
  (SELECT id FROM users WHERE email='sofia.turista@gmail.com'), -- El turista final
  (SELECT id FROM experiences WHERE title='City Tour Histórico'),
  (SELECT id FROM availability_slots WHERE experience_id=(SELECT id FROM experiences WHERE title='City Tour Histórico') LIMIT 1),
  (SELECT id FROM users WHERE email='agente.carlos@gmail.com'), -- El agente Carlos
  2, 0, 200000, 38000, 238000, 'COP', -- $238,000 COP Total
  'confirmed', now(), now();

-- 11.4) Registrar el Pago Exitoso
INSERT INTO payments (
  booking_id, provider, provider_reference, amount_cents, currency, 
  status, payment_method, paid_at
)
SELECT
  (SELECT id FROM bookings WHERE user_id=(SELECT id FROM users WHERE email='sofia.turista@gmail.com') AND agent_id=(SELECT id FROM users WHERE email='agente.carlos@gmail.com') ORDER BY created_at DESC LIMIT 1),
  'wompi', 'WOMPI-TEST-AGENT-01', 
  238000, 'COP',
  'paid', 'card', now();

-- 11.5) Generar las Comisiones (Simulando lo que haría el backend)
-- Comisión Livex (10%)
INSERT INTO commissions (booking_id, rate_bps, commission_cents, created_at)
SELECT
  (SELECT id FROM bookings WHERE user_id=(SELECT id FROM users WHERE email='sofia.turista@gmail.com') AND agent_id=(SELECT id FROM users WHERE email='agente.carlos@gmail.com') ORDER BY created_at DESC LIMIT 1),
  1000, FLOOR(238000 * 0.10), now();

-- Comisión Agente (15%)
INSERT INTO agent_commissions (
  booking_id, agent_id, resort_id, amount_cents, rate_bps, status, created_at
)
SELECT 
  b.id, 
  b.agent_id, 
  (SELECT id FROM resorts WHERE name='Mar y Sol Cartagena'),
  FLOOR(b.total_cents * 0.15), -- 15% de 238,000 = 35,700
  1500,
  'pending',
  now()
FROM bookings b
WHERE b.user_id=(SELECT id FROM users WHERE email='sofia.turista@gmail.com') 
  AND b.agent_id=(SELECT id FROM users WHERE email='agente.carlos@gmail.com')
ORDER BY b.created_at DESC LIMIT 1;

-- 11.6) Completar Perfil del Agente (Datos Bancarios)
INSERT INTO agent_profiles (
  user_id, bank_name, account_number, account_type, account_holder_name, tax_id, is_verified
)
SELECT 
  (SELECT id FROM users WHERE email='agente.carlos@gmail.com'),
  'Bancolombia',
  '9876543210',
  'savings',
  'Carlos Vendedor',
  '1234567890',
  true;

-- 11.7) Códigos de Referido del Agente Carlos
-- Código de comisión simple (solo trackea)
INSERT INTO referral_codes (
  owner_user_id, code, code_type, description
)
VALUES (
  (SELECT id FROM users WHERE email='agente.carlos@gmail.com'),
  'CARLOSVIP',
  'commission',
  'Código personal de Carlos - Solo tracking'
);

-- Código con descuento del 10% (10% = 1000 bps)
INSERT INTO referral_codes (
  owner_user_id, code, code_type, discount_type, discount_value, description
)
VALUES (
  (SELECT id FROM users WHERE email='agente.carlos@gmail.com'),
  'VERANO2025',
  'both', -- Da descuento Y comisión
  'percentage',
  1000, -- 10%
  'Promoción de verano - 10% de descuento'
);

-- Código con descuento fijo de $20,000 COP
INSERT INTO referral_codes (
  owner_user_id, code, code_type, discount_type, discount_value, usage_limit, description
)
VALUES (
  (SELECT id FROM users WHERE email='agente.carlos@gmail.com'),
  'PRIMERACOMPRA',
  'both',
  'fixed',
  2000000, -- $20,000 COP en centavos (20000 * 100)
  50, -- Solo 50 usos
  'Primera compra - $20,000 COP de descuento (limitado a 50 usos)'
);

-- 11.8) Restricciones: Código solo para Tours Náuticos
INSERT INTO referral_code_restrictions (
  referral_code_id, restriction_type, category_slug
)
VALUES (
  (SELECT id FROM referral_codes WHERE code = 'VERANO2025'),
  'category',
  'nautical'
);

-- 11.9) A/B Testing: Variantes del código VERANO2025
-- Variante A: 15% descuento
INSERT INTO referral_code_variants (
  parent_code_id, variant_name, code, discount_value
)
VALUES (
  (SELECT id FROM referral_codes WHERE code = 'VERANO2025'),
  'Variant A - 15%',
  'VERANO2025A',
  1500  -- 15%
);

-- Variante B: 5% descuento
INSERT INTO referral_code_variants (
  parent_code_id, variant_name, code, discount_value
)
VALUES (
  (SELECT id FROM referral_codes WHERE code = 'VERANO2025'),
  'Variant B - 5%', 
  'VERANO2025B',
  500  -- 5%
);

-- 11.10) Código con Stacking permitido
INSERT INTO referral_codes (
  owner_user_id, code, code_type, discount_type, discount_value,
  allow_stacking, min_purchase_cents, description
)
VALUES (
  (SELECT id FROM users WHERE email='agente.carlos@gmail.com'),
  'EXTRA10',
  'discount',
  'percentage',
  1000,  -- 10%
  true,  -- Permite combinarse con otros códigos
  5000000,  -- Mínimo $50,000 COP (en centavos)
  'Extra 10% - Combinable con otros códigos (mínimo $50,000 COP)'
);

CREATE INDEX IF NOT EXISTS idx_availability_slots_experience_date 
ON availability_slots(experience_id, start_time, end_time);

-- Add index for date-based queries (for calendar views)
CREATE INDEX IF NOT EXISTS idx_availability_slots_date 
ON availability_slots(DATE(start_time AT TIME ZONE 'UTC'));

-- Add index for capacity filtering
CREATE INDEX IF NOT EXISTS idx_availability_slots_capacity 
ON availability_slots(capacity) WHERE capacity > 0;

-- Optimize the v_slot_remaining view with better indexing
-- Add index for active bookings
CREATE INDEX IF NOT EXISTS idx_bookings_active_slot 
ON bookings(slot_id, status) 
WHERE status IN ('pending', 'confirmed');

-- Add index for inventory locks
CREATE INDEX IF NOT EXISTS idx_inventory_locks_active_detailed 
ON inventory_locks(slot_id, expires_at, consumed_at) 
WHERE consumed_at IS NULL;

-- Add partial index for non-expired bookings
-- CREATE INDEX IF NOT EXISTS idx_bookings_non_expired 
-- ON bookings(slot_id, expires_at, status) 
-- WHERE expires_at IS NULL OR expires_at > now();

-- Add comment for documentation
COMMENT ON INDEX idx_availability_slots_experience_date IS 'Optimizes availability queries by experience and date range';
COMMENT ON INDEX idx_availability_slots_date IS 'Optimizes calendar view queries by date';
COMMENT ON INDEX idx_availability_slots_capacity IS 'Optimizes queries filtering by available capacity';
COMMENT ON INDEX idx_bookings_active_slot IS 'Optimizes remaining capacity calculations for active bookings';
COMMENT ON INDEX idx_inventory_locks_active_detailed IS 'Optimizes remaining capacity calculations for active locks';
-- COMMENT ON INDEX idx_bookings_non_expired IS 'Optimizes queries for non-expired bookings';
