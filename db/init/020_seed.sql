-- ====================================================================================
-- LIVEX SEED DATA - COMPLETE & ORGANIZED
-- FECHA: Diciembre 2025
-- ====================================================================================
-- 
-- ⚠️  CONTRASEÑA DE PRUEBA PARA TODOS LOS USUARIOS: Test1234
-- 
-- ====================================================================================

-- ===========================
-- BLOQUE 1: DATOS ESTRUCTURALES (Core)
-- Usuarios, Resorts, Documentos, Categorías, Experiencias, Imágenes y Ubicaciones
-- ===========================

-- 1. Usuarios Base (Admin, Operadores, Turista)
-- CONTRASEÑA: Test1234 (hash bcrypt)
WITH u AS (
  INSERT INTO users (email, password_hash, full_name, phone, role, document_type, document_number) VALUES
    -- 1. ADMIN DEL SISTEMA
    ('admin@livex.app', 
     '$2b$10$AUoDb4ExvjeUGT7r0kjkeuezbtKLalTUj.YRLcg0wHtMIdG4OxWye', 
     'Admin Livex', 
     '+573000000000', 
     'admin', 
     'CC', '1000000001'),

    -- 2. RESORTS / OPERADORES
    ('operaciones@marysol.co', 
     '$2b$10$AUoDb4ExvjeUGT7r0kjkeuezbtKLalTUj.YRLcg0wHtMIdG4OxWye', 
     'Operaciones Mar y Sol', 
     '+573011111111', 
     'resort', 
     'NIT', '900111222'),
     
    ('coordinacion@islabrisa.co', 
     '$2b$10$AUoDb4ExvjeUGT7r0kjkeuezbtKLalTUj.YRLcg0wHtMIdG4OxWye', 
     'Coordinación Isla Brisa', 
     '+573022222222', 
     'resort', 
     'NIT', '900333444'),
     
    ('reservas@nauticabahia.co', 
     '$2b$10$AUoDb4ExvjeUGT7r0kjkeuezbtKLalTUj.YRLcg0wHtMIdG4OxWye', 
     'Reservas Náutica Bahía', 
     '+573033333333', 
     'resort', 
     'NIT', '900555666'),

    -- 3. AGENTE DE VENTAS
    ('carlos.ventas@livex.app', 
     '$2b$10$AUoDb4ExvjeUGT7r0kjkeuezbtKLalTUj.YRLcg0wHtMIdG4OxWye', 
     'Carlos El Vendedor', 
     '+573109998877', 
     'agent', 
     'CC', '72345678'),

    -- 4. TURISTAS (Variedad de Documentos)
    
    -- Turista Local (CC) - TIENE CUPONES
    ('sofia.turista@gmail.com', 
     '$2b$10$AUoDb4ExvjeUGT7r0kjkeuezbtKLalTUj.YRLcg0wHtMIdG4OxWye', 
     'Sofía Turista', 
     '+573154444444', 
     'tourist', 
     'CC', '1045678901'),

    -- Turista Extranjero USA (PASSPORT) - TIENE CUPONES
    ('john.doe@usmail.com', 
     '$2b$10$AUoDb4ExvjeUGT7r0kjkeuezbtKLalTUj.YRLcg0wHtMIdG4OxWye', 
     'John Doe', 
     '+13055551234', 
     'tourist', 
     'PASSPORT', 'A12345678'),

    -- Turista Brasilero (FOREIGN_ID / DNI)
    ('lucia.silva@uol.com.br', 
     '$2b$10$AUoDb4ExvjeUGT7r0kjkeuezbtKLalTUj.YRLcg0wHtMIdG4OxWye', 
     'Lucia Silva', 
     '+551199998888', 
     'tourist', 
     'FOREIGN_ID', 'MG1234567'),

    -- Residente Extranjero en Colombia (CE)
    ('pierre.frances@gmail.com', 
     '$2b$10$AUoDb4ExvjeUGT7r0kjkeuezbtKLalTUj.YRLcg0wHtMIdG4OxWye', 
     'Pierre Dubois', 
     '+573205556677', 
     'tourist', 
     'CE', '887766'),

    -- Migrante con Permiso (PPT)
    ('jose.perez@email.com', 
     '$2b$10$AUoDb4ExvjeUGT7r0kjkeuezbtKLalTUj.YRLcg0wHtMIdG4OxWye', 
     'José Pérez', 
     '+573041234567', 
     'tourist', 
     'PPT', '99887766')

  RETURNING id, email, role
),

-- 2. Prestadores (Resorts)
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

-- 3. KYC Financiero (Cuentas Bancarias)
bank AS (
  INSERT INTO resort_bank_info (resort_id, bank_name, account_holder, account_number, account_type, tax_id, is_primary)
  VALUES
    ((SELECT id FROM r WHERE name='Mar y Sol Cartagena'), 'Bancolombia', 'Mar y Sol SAS', '1234567890', 'checking', '900111222-3', true),
    ((SELECT id FROM r WHERE name='Isla Brisa Resort'), 'Davivienda', 'Isla Brisa SAS', '2233445566', 'savings',  '901222333-4', true),
    ((SELECT id FROM r WHERE name='Náutica Bahía Club'), 'BBVA', 'Nautica Bahia SAS', '3344556677', 'checking', '902333444-5', true)
  RETURNING resort_id
),

-- 4. Documentos Legales
docs AS (
  INSERT INTO resort_documents (resort_id, doc_type, file_url, status, reviewed_by, reviewed_at)
  VALUES
    ((SELECT id FROM r WHERE name='Mar y Sol Cartagena'), 'tax_id'::resort_doc_type, 'https://files.example.com/marysol-rut.pdf', 'approved'::document_status, (SELECT id FROM u WHERE email='admin@livex.app'), now()),
    ((SELECT id FROM r WHERE name='Isla Brisa Resort'),   'license'::resort_doc_type, 'https://files.example.com/islabrisa-lic.pdf', 'approved'::document_status, (SELECT id FROM u WHERE email='admin@livex.app'), now()),
    ((SELECT id FROM r WHERE name='Náutica Bahía Club'),  'insurance'::resort_doc_type,'https://files.example.com/nautica-pola.pdf', 'approved'::document_status, (SELECT id FROM u WHERE email='admin@livex.app'), now())
  RETURNING resort_id
),

-- 5. Categorías
c AS (
  INSERT INTO categories (slug, name) VALUES
    ('city_tour','City Tour'),
    ('islands','Islas y Playa'),
    ('nautical','Náutica y Vela')
  RETURNING id, slug
),

-- 6. Experiencias
e AS (
  INSERT INTO experiences (
    resort_id, title, description, category, price_cents, commission_cents, currency,
    includes, excludes, main_image_url, status, approved_by, approved_at
  )
  VALUES
    -- 1. City Tour (Imagen: Calle colonial clásica con balcones y flores - Cartagena Vibe)
    -- price_cents = $120 neto resort (pago presencial), commission_cents = $30 (pago online)
    ((SELECT id FROM r WHERE name='Mar y Sol Cartagena'),
      'City Tour Histórico', 'Recorrido por el Centro Histórico y Getsemaní', 'city_tour', 12000, 3000, 'USD',
      'Guía certificado, hidratación', 'Almuerzo', 'https://images.unsplash.com/photo-1536308037887-165852797016?w=800', 'active'::experience_status,
      (SELECT id FROM u WHERE email='admin@livex.app'), now()),
      
    -- 2. Islas del Rosario (Existente)
    -- price_cents = $250 neto resort, commission_cents = $50 (pago online)
    ((SELECT id FROM r WHERE name='Isla Brisa Resort'),
      'Full Day Islas del Rosario', 'Traslado en lancha y día de playa en Isla Brisa', 'islands', 25000, 5000, 'USD',
      'Traslados, coctel de bienvenida, carpa', 'Impuesto de muelle', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800', 'active'::experience_status,
      (SELECT id FROM u WHERE email='admin@livex.app'), now()),
      
    -- 3. Sunset Sailing (Existente)
    -- price_cents = $180 neto resort, commission_cents = $40 (pago online)
    ((SELECT id FROM r WHERE name='Náutica Bahía Club'),
      'Sunset Sailing', 'Navegación a vela por la Bahía al atardecer', 'nautical', 18000, 4000, 'USD',
      'Capitán, seguro, snacks', 'Traslados al muelle', 'https://images.unsplash.com/photo-1500514966906-fe245eea9344?w=800', 'active'::experience_status,
      (SELECT id FROM u WHERE email='admin@livex.app'), now()),

    -- 4. NUEVA: Cholón Party (Imagen: Grupo de amigos en bote, agua turquesa - Party Vibe)
    -- price_cents = $450 neto resort, commission_cents = $80 (pago online)
    ((SELECT id FROM r WHERE name='Náutica Bahía Club'),
      'Fiesta en Bote Deportivo Cholón', 'Experiencia de fiesta en el agua con música y amigos', 'nautical', 45000, 8000, 'USD',
      'Bote deportivo, capitán, nevera con hielo', 'Bebidas alcohólicas, comida', 'https://images.unsplash.com/photo-1520116468816-95b69f847357?w=800', 'active'::experience_status,
      (SELECT id FROM u WHERE email='admin@livex.app'), now()),

    -- 5. NUEVA: Tour Gastronómico (Existente)
    -- price_cents = $350 neto resort, commission_cents = $60 (pago online)
    ((SELECT id FROM r WHERE name='Mar y Sol Cartagena'),
      'Street Food Tour Getsemaní', 'Prueba las mejores arepas, fritos y frutas locales', 'city_tour', 35000, 6000, 'USD',
      'Degustaciones en 5 paradas, guía local', 'Transporte al punto de encuentro', 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800', 'active'::experience_status,
      (SELECT id FROM u WHERE email='admin@livex.app'), now()),

    -- 6. NUEVA: Beach Club Tierra Bomba (Imagen: Piscina frente al mar estilo club de playa)
    -- price_cents = $550 neto resort, commission_cents = $100 (pago online)
    ((SELECT id FROM r WHERE name='Isla Brisa Resort'),
      'Relax Day Tierra Bomba', 'Día de piscina y playa frente a la ciudad', 'islands', 55000, 10000, 'USD',
      'Transporte en lancha, bono consumible', 'Toallas', 'https://images.unsplash.com/photo-1540206351-d6465b3ac5c1?w=800', 'active'::experience_status,
      (SELECT id FROM u WHERE email='admin@livex.app'), now())

  RETURNING id, title, category, resort_id
),

-- 7) Relación M:N (Categorías - Automático)
ec AS (
  INSERT INTO experience_categories (experience_id, category_id)
  SELECT e.id, c.id
  FROM e
  JOIN c ON c.slug = e.category
  RETURNING experience_id
),

-- 8) Imágenes de Experiencias (Ampliado)
imgs AS (
  INSERT INTO experience_images (experience_id, url, sort_order) VALUES
    -- City Tour Histórico
    ((SELECT id FROM e WHERE title='City Tour Histórico'), 'https://images.unsplash.com/photo-1583531172005-893e7e366d3f?w=800', 0),
    ((SELECT id FROM e WHERE title='City Tour Histórico'), 'https://images.unsplash.com/photo-1578632292335-df3abbb0d586?w=800', 1),
    
    -- Full Day Islas
    ((SELECT id FROM e WHERE title='Full Day Islas del Rosario'), 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800', 0),
    ((SELECT id FROM e WHERE title='Full Day Islas del Rosario'), 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800', 1),
    
    -- Sunset Sailing
    ((SELECT id FROM e WHERE title='Sunset Sailing'), 'https://images.unsplash.com/photo-1500514966906-fe245eea9344?w=800', 0),
    ((SELECT id FROM e WHERE title='Sunset Sailing'), 'https://images.unsplash.com/photo-1540946485063-a40da27545f8?w=800', 1),

    -- NUEVO: Cholón Party
    ((SELECT id FROM e WHERE title='Fiesta en Bote Deportivo Cholón'), 'https://images.unsplash.com/photo-1566412435010-b747372c0506?w=800', 0),
    ((SELECT id FROM e WHERE title='Fiesta en Bote Deportivo Cholón'), 'https://images.unsplash.com/photo-1544551763-46a42a4571da?w=800', 1),
    
    -- NUEVO: Street Food Tour
    ((SELECT id FROM e WHERE title='Street Food Tour Getsemaní'), 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800', 0),
    ((SELECT id FROM e WHERE title='Street Food Tour Getsemaní'), 'https://images.unsplash.com/photo-1626202162624-9b578c7c9800?w=800', 1),
    
    -- NUEVO: Tierra Bomba
    ((SELECT id FROM e WHERE title='Relax Day Tierra Bomba'), 'https://images.unsplash.com/photo-1573046738959-1e35593f0b24?w=800', 0),
    ((SELECT id FROM e WHERE title='Relax Day Tierra Bomba'), 'https://images.unsplash.com/photo-1596436889106-be35e843f974?w=800', 1)

  RETURNING experience_id
),

-- 9) Ubicaciones (Ampliado)
loc AS (
  INSERT INTO experience_locations (experience_id, name, address_line, latitude, longitude, meeting_instructions)
  VALUES
    -- Existentes
    ((SELECT id FROM e WHERE title='City Tour Histórico'), 'Monumento Camellón de los Mártires', 'Camellón de los Mártires, Centro', 10.422300, -75.545500, 'Llegar 10 min antes. Busca al guía con sombrero vueltiao.'),
    ((SELECT id FROM e WHERE title='Full Day Islas del Rosario'), 'Muelle La Bodeguita', 'Av. Blas de Lezo, Centro', 10.421900, -75.548300, 'Impuesto de muelle no incluido. Presentar documento.'),
    ((SELECT id FROM e WHERE title='Sunset Sailing'), 'Marina Santa Cruz', 'Manga, Cartagena', 10.409800, -75.535100, 'Ingresar por portería principal, muelle 3.'),
    
    -- Nuevas
    ((SELECT id FROM e WHERE title='Fiesta en Bote Deportivo Cholón'), 'Muelle de los Pegasos', 'Centro Histórico, muelle lateral', 10.420500, -75.546000, 'Preguntar por el bote "La Fantástica".'),
    ((SELECT id FROM e WHERE title='Street Food Tour Getsemaní'), 'Plaza de la Trinidad', 'Getsemaní, frente a la iglesia', 10.419500, -75.542000, 'El guía lleva camiseta naranja de Livex.'),
    ((SELECT id FROM e WHERE title='Relax Day Tierra Bomba'), 'Muelle Hospital Bocagrande', 'Cra 1, Bocagrande', 10.398000, -75.556000, 'Lancha sale cada 30 minutos.')

  RETURNING experience_id
)
SELECT count(*) as core_data_inserted FROM u;

-- Update para asegurar tipo de imagen
UPDATE experience_images SET image_type = 'gallery' WHERE image_type IS NULL;


-- ===========================
-- BLOQUE 2: DISPONIBILIDAD (Slots) - GENERACIÓN MASIVA
-- ===========================

-- Generación masiva (15 días desde Diciembre 22, 2025)
-- Se han añadido los 3 nuevos títulos al generador
INSERT INTO availability_slots (experience_id, start_time, end_time, capacity)
SELECT
  e.id,
  (to_char(d, 'YYYY-MM-DD') || 'T' || to_char(t.start_time, 'HH24:MI:SS') || '-05')::timestamptz,
  (to_char(d, 'YYYY-MM-DD') || 'T' || to_char(t.end_time, 'HH24:MI:SS') || '-05')::timestamptz,
  t.capacity
FROM
  experiences e
  CROSS JOIN generate_series('2025-12-22'::date, '2026-01-05'::date, '1 day'::interval) AS d
  JOIN (
    VALUES
      ('City Tour Histórico', '09:00:00'::time, '12:00:00'::time, 20),
      ('City Tour Histórico', '15:00:00'::time, '18:00:00'::time, 20),
      ('Full Day Islas del Rosario', '08:00:00'::time, '16:00:00'::time, 40),
      ('Sunset Sailing', '17:30:00'::time, '19:30:00'::time, 10),
      
      -- Datos de disponibilidad para las NUEVAS experiencias
      ('Fiesta en Bote Deportivo Cholón', '10:00:00'::time, '16:00:00'::time, 12),
      ('Street Food Tour Getsemaní', '17:00:00'::time, '19:30:00'::time, 15),
      ('Relax Day Tierra Bomba', '09:00:00'::time, '17:00:00'::time, 30)
  ) AS t(title, start_time, end_time, capacity) ON e.title = t.title;


-- ===========================
-- BLOQUE 3: SOCIAL PROOF (Reseñas)
-- ===========================

INSERT INTO reviews (user_id, experience_id, rating, comment, created_at)
VALUES
  -- Existentes
  ((SELECT id FROM users WHERE email='sofia.turista@gmail.com'),
   (SELECT id FROM experiences WHERE title='City Tour Histórico'), 5, '¡Increíble experiencia! El guía fue muy amable.', now() - INTERVAL '2 days'),
  ((SELECT id FROM users WHERE email='sofia.turista@gmail.com'),
   (SELECT id FROM experiences WHERE title='Full Day Islas del Rosario'), 5, 'El paraíso en la tierra.', now() - INTERVAL '1 week'),
  
  -- Nuevas Reseñas
  ((SELECT id FROM users WHERE email='sofia.turista@gmail.com'),
   (SELECT id FROM experiences WHERE title='Fiesta en Bote Deportivo Cholón'), 5, '¡La mejor fiesta de mi vida! Muy recomendado ir con amigos.', now() - INTERVAL '1 day'),
  ((SELECT id FROM users WHERE email='sofia.turista@gmail.com'),
   (SELECT id FROM experiences WHERE title='Street Food Tour Getsemaní'), 4, 'La comida deliciosa, pero hay que caminar bastante.', now() - INTERVAL '4 days'),
  ((SELECT id FROM users WHERE email='sofia.turista@gmail.com'),
   (SELECT id FROM experiences WHERE title='Relax Day Tierra Bomba'), 5, 'Un lugar muy exclusivo y tranquilo. El almuerzo estuvo 10/10.', now() - INTERVAL '6 days');

-- ===========================
-- BLOQUE 4: SISTEMA DE AGENTES
-- Creación de usuario agente, acuerdo comercial y simulación de venta
-- ===========================

-- 4.1 Crear Usuario Agente
INSERT INTO users (email, password_hash, full_name, phone, role) 
VALUES ('agente.carlos@gmail.com', '$2b$10$j54QekkMZucJ.hKpcRMmqe4SnETnpr.8OxLyRfAZVLnSVkBgP4eFS', 'Carlos El Vendedor', '+573005555555', 'agent');

-- 4.2 Acuerdo Comercial (15% Comisión para Carlos con Mar y Sol)
INSERT INTO resort_agents (resort_id, user_id, commission_bps, is_active)
SELECT 
  (SELECT id FROM resorts WHERE name='Mar y Sol Cartagena'),
  (SELECT id FROM users WHERE email='agente.carlos@gmail.com'),
  1500, -- 15%
  true;

-- 4.3 Perfil Financiero del Agente
INSERT INTO agent_profiles (
  user_id, bank_name, account_number, account_type, account_holder_name, tax_id, is_verified
)
SELECT 
  (SELECT id FROM users WHERE email='agente.carlos@gmail.com'),
  'Bancolombia', '9876543210', 'savings', 'Carlos Vendedor', '1234567890', true;

-- 4.4 Crear Reserva por Agente (Confirmada)
-- Usando el nuevo modelo: commission_cents = pago online, resort_net_cents = pago presencial
INSERT INTO bookings (
  user_id, experience_id, slot_id, agent_id,
  adults, children, subtotal_cents, tax_cents, commission_cents, resort_net_cents, total_cents, currency, 
  status, created_at, updated_at
)
SELECT
  (SELECT id FROM users WHERE email='sofia.turista@gmail.com'), -- Turista
  (SELECT id FROM experiences WHERE title='City Tour Histórico'),
  (SELECT id FROM availability_slots WHERE experience_id=(SELECT id FROM experiences WHERE title='City Tour Histórico') LIMIT 1),
  (SELECT id FROM users WHERE email='agente.carlos@gmail.com'), -- Agente
  2, 0, 24000, 0, 6000, 24000, 30000, 'USD',  -- 2 personas × ($120 neto + $30 comisión) = $300 total, $60 comisión
  'confirmed', now(), now();

-- 4.5 Registrar Pago
INSERT INTO payments (
  booking_id, provider, provider_reference, amount_cents, currency, 
  status, payment_method, paid_at
)
SELECT
  (SELECT id FROM bookings WHERE user_id=(SELECT id FROM users WHERE email='sofia.turista@gmail.com') AND agent_id=(SELECT id FROM users WHERE email='agente.carlos@gmail.com') ORDER BY created_at DESC LIMIT 1),
  'wompi', 'WOMPI-TEST-AGENT-01', 
  238000, 'USD',
  'paid', 'card', now();

-- 4.6 Generar Comisiones
-- A) Comisión de Plataforma (10%)
INSERT INTO commissions (booking_id, rate_bps, commission_cents, created_at)
SELECT
  (SELECT id FROM bookings WHERE user_id=(SELECT id FROM users WHERE email='sofia.turista@gmail.com') AND agent_id=(SELECT id FROM users WHERE email='agente.carlos@gmail.com') ORDER BY created_at DESC LIMIT 1),
  1000, FLOOR(238000 * 0.10), now();

-- B) Comisión del Agente (15%)
INSERT INTO agent_commissions (
  booking_id, agent_id, resort_id, amount_cents, rate_bps, status, created_at
)
SELECT 
  b.id, 
  b.agent_id, 
  (SELECT id FROM resorts WHERE name='Mar y Sol Cartagena'),
  FLOOR(b.total_cents * 0.15), -- 15% de 238,000
  1500,
  'pending',
  now()
FROM bookings b
WHERE b.user_id=(SELECT id FROM users WHERE email='sofia.turista@gmail.com') 
  AND b.agent_id=(SELECT id FROM users WHERE email='agente.carlos@gmail.com')
ORDER BY b.created_at DESC LIMIT 1;

-- ===========================
-- BLOQUE 5: MARKETING & REFERIDOS
-- Códigos de descuento, tracking y reglas
-- ===========================

-- 5.1 Código Básico (Tracking)
INSERT INTO referral_codes (owner_user_id, code, code_type, description)
VALUES ((SELECT id FROM users WHERE email='agente.carlos@gmail.com'), 'CARLOSVIP', 'commission', 'Código personal de Carlos - Solo tracking');

-- 5.2 Código Mixto (Descuento 10% + Comisión)
INSERT INTO referral_codes (owner_user_id, code, code_type, discount_type, discount_value, description)
VALUES ((SELECT id FROM users WHERE email='agente.carlos@gmail.com'), 'VERANO2025', 'both', 'percentage', 1000, 'Promoción de verano - 10% de descuento');

-- 5.3 Código Monto Fijo
INSERT INTO referral_codes (owner_user_id, code, code_type, discount_type, discount_value, usage_limit, description)
VALUES ((SELECT id FROM users WHERE email='agente.carlos@gmail.com'), 'PRIMERACOMPRA', 'both', 'fixed', 2000000, 50, 'Primera compra - $20,000 COP de descuento');

-- 5.4 Código con Stacking
INSERT INTO referral_codes (owner_user_id, code, code_type, discount_type, discount_value, allow_stacking, min_purchase_cents, description)
VALUES ((SELECT id FROM users WHERE email='agente.carlos@gmail.com'), 'EXTRA10', 'discount', 'percentage', 1000, true, 5000000, 'Extra 10% - Combinable');

-- 5.5 Restricciones (Solo Náutica)
INSERT INTO referral_code_restrictions (referral_code_id, restriction_type, category_slug)
VALUES ((SELECT id FROM referral_codes WHERE code = 'VERANO2025'), 'category', 'nautical');

-- 5.6 A/B Testing
INSERT INTO referral_code_variants (parent_code_id, variant_name, code, discount_value)
VALUES 
  ((SELECT id FROM referral_codes WHERE code = 'VERANO2025'), 'Variant A - 15%', 'VERANO2025A', 1500),
  ((SELECT id FROM referral_codes WHERE code = 'VERANO2025'), 'Variant B - 5%', 'VERANO2025B', 500);

-- 5.7 Código de Influencer (No permite stacking)
INSERT INTO referral_codes (owner_user_id, code, code_type, referral_type, discount_type, discount_value, description)
VALUES ((SELECT id FROM users WHERE email='agente.carlos@gmail.com'), 'INFLUENCER20', 'discount', 'influencer', 'percentage', 2000, 'Código de influencer - 20% descuento, uso exclusivo');

-- ===========================
-- BLOQUE 6: CUPONES DE USUARIO Y VIP
-- Cupones ganados, promocionales y VIP
-- ===========================

-- 6.1 Cupón ganado por referir amigo (para Sofía)
INSERT INTO user_coupons (
  user_id, code, coupon_type, description, 
  discount_type, discount_value, currency,
  source_type, expires_at
)
VALUES (
  (SELECT id FROM users WHERE email='sofia.turista@gmail.com'),
  'SOFIA-REF-001',
  'user_earned',
  'Cupón por referir a un amigo',
  'fixed',
  1500, -- $15 USD de descuento
  'USD',
  'referral_bonus',
  now() + INTERVAL '6 months'
);

-- 6.2 Cupón promocional de bienvenida (para John Doe)
INSERT INTO user_coupons (
  user_id, code, coupon_type, description, 
  discount_type, discount_value, currency,
  source_type, expires_at
)
VALUES (
  (SELECT id FROM users WHERE email='john.doe@usmail.com'),
  'JOHN-WELCOME',
  'promotional',
  'Bienvenida - Primera reserva',
  'percentage',
  1500, -- 15% de descuento
  'USD',
  'admin_granted',
  now() + INTERVAL '1 month'
);

-- 6.3 Cupón VIP (para Sofía - redimible por 1 año de membresía)
INSERT INTO user_coupons (
  user_id, code, coupon_type, description, 
  discount_type, discount_value, currency,
  vip_duration_days,
  source_type, expires_at
)
VALUES (
  (SELECT id FROM users WHERE email='sofia.turista@gmail.com'),
  'VIP-SOFIA-2025',
  'vip_subscription',
  'Membresía VIP 1 año - 10% en todas las experiencias',
  'percentage',
  1000, -- 10% de descuento permanente
  'USD',
  365, -- 1 año
  'promotional',
  now() + INTERVAL '2 months' -- El cupón para redimir VIP vence en 2 meses
);

-- 6.4 Múltiples cupones para probar stacking (para Sofía)
INSERT INTO user_coupons (
  user_id, code, coupon_type, description, 
  discount_type, discount_value, max_discount_cents, currency,
  source_type, expires_at
)
VALUES 
  -- Cupón de gamificación
  ((SELECT id FROM users WHERE email='sofia.turista@gmail.com'),
   'SOFIA-GAME-001',
   'user_earned',
   'Cupón por completar 3 reservas',
   'percentage',
   500, -- 5% extra
   1000, -- Máximo $10 USD de descuento
   'USD',
   'gamification',
   now() + INTERVAL '3 months'),
  -- Cupón de primera reserva
  ((SELECT id FROM users WHERE email='sofia.turista@gmail.com'),
   'SOFIA-FIRST-001',
   'user_earned',
   'Cupón por primera reserva completada',
   'fixed',
   2000, -- $20 USD fijo
   NULL,
   'USD',
   'first_booking',
   now() + INTERVAL '1 year');

-- 6.5 Suscripción VIP activa (para pruebas - Pierre ya es VIP)
INSERT INTO vip_subscriptions (
  user_id, discount_type, discount_value, currency,
  status, activated_at, expires_at
)
VALUES (
  (SELECT id FROM users WHERE email='pierre.frances@gmail.com'),
  'percentage',
  1200, -- 12% de descuento
  'USD',
  'active',
  now() - INTERVAL '1 month', -- Activado hace 1 mes
  now() + INTERVAL '11 months' -- Quedan 11 meses
);

-- ===========================
-- BLOQUE 7: ÍNDICES Y OPTIMIZACIÓN
-- ===========================

CREATE INDEX IF NOT EXISTS idx_availability_slots_experience_date ON availability_slots(experience_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_availability_slots_date ON availability_slots(DATE(start_time AT TIME ZONE 'UTC'));
CREATE INDEX IF NOT EXISTS idx_availability_slots_capacity ON availability_slots(capacity) WHERE capacity > 0;
CREATE INDEX IF NOT EXISTS idx_bookings_active_slot ON bookings(slot_id, status) WHERE status IN ('pending', 'confirmed');
CREATE INDEX IF NOT EXISTS idx_inventory_locks_active_detailed ON inventory_locks(slot_id, expires_at, consumed_at) WHERE consumed_at IS NULL;

-- Comentarios de documentación
COMMENT ON INDEX idx_availability_slots_experience_date IS 'Optimizes availability queries by experience and date range';
COMMENT ON INDEX idx_availability_slots_date IS 'Optimizes calendar view queries by date';
COMMENT ON INDEX idx_bookings_active_slot IS 'Optimizes remaining capacity calculations for active bookings';