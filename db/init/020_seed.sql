-- ===========================
-- LIVEX MVP seed data (full, FIX enum casts)
-- ===========================

-- 1) Usuarios base (admin + operadores)
WITH u AS (
  INSERT INTO users (email, full_name, role) VALUES
    ('admin@livex.app','Admin Livex','admin'),
    ('operaciones@marysol.co','Operaciones Mar y Sol','resort'),
    ('coordinacion@islabrisa.co','Coordinación Isla Brisa','resort'),
    ('reservas@nauticabahia.co','Reservas Náutica Bahía','resort'),
    ('sofia.turista@gmail.com','Sofía Turista','tourist')
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
