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
    resort_id, title, description, category,
    price_per_adult_cents, price_per_child_cents,
    commission_per_adult_cents, commission_per_child_cents,
    allows_children, child_min_age, child_max_age,
    currency, includes, excludes, main_image_url, status, approved_by, approved_at
  )
  VALUES
    -- 1. City Tour Histórico
    ((SELECT id FROM r WHERE name='Mar y Sol Cartagena'),
      'City Tour Histórico', 'Recorrido por el Centro Histórico y Getsemaní', 'city_tour',
      19000000, 18000000,  -- price_per_adult ($190k), price_per_child ($180k)
      3500000, 2500000,   -- commission_per_adult ($35k), commission_per_child ($25k)
      true, 3, 9,          -- allows_children, min_age, max_age
      'COP', 'Guía certificado, hidratación', 'Almuerzo',
      'https://images.unsplash.com/photo-1536308037887-165852797016?w=800', 'active'::experience_status,
      (SELECT id FROM u WHERE email='admin@livex.app'), now()),
      
    -- 2. Full Day Islas del Rosario - SOL Y PAPAYA CLASSIC
    -- precio_adulto = $320.000 COP, niño = $280.000 COP
    ((SELECT id FROM r WHERE name='Isla Brisa Resort'),
      'Sol y Papaya Classic', 'Día de playa en Islas del Rosario, traslado ida y vuelta', 'islands',
      32000000, 28000000,  -- price_per_adult, price_per_child
      9000000, 8000000,    -- commission_per_adult ($90k), commission_per_child ($80k)
      true, 3, 10,           -- allows_children, min_age=3, max_age=10
      'COP', 'Traslados, coctel de bienvenida, carpa', 'Impuesto de muelle',
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800', 'active'::experience_status,
      (SELECT id FROM u WHERE email='admin@livex.app'), now()),
      
    -- 3. Sunset Sailing
    ((SELECT id FROM r WHERE name='Náutica Bahía Club'),
      'Sunset Sailing', 'Navegación a vela por la Bahía al atardecer', 'nautical',
      17000000, 0,          -- price_per_adult ($170k), price_per_child (no aplica)
      4000000, 0,          -- commission_per_adult ($40k), commission_per_child (no aplica)
      false, NULL, NULL,    -- allows_children=false, sin rango de edad
      'COP', 'Capitán, seguro, snacks', 'Traslados al muelle',
      'https://images.unsplash.com/photo-1500514966906-fe245eea9344?w=800', 'active'::experience_status,
      (SELECT id FROM u WHERE email='admin@livex.app'), now()),

    -- 4. Cholón Party - Solo adultos (18+)
    ((SELECT id FROM r WHERE name='Náutica Bahía Club'),
      'Fiesta en Bote Deportivo Cholón', 'Experiencia de fiesta en el agua con música y amigos', 'nautical',
      42000000, 0,         -- Luxury Beach Area ($420k)
      8000000, 0,          -- Commission ($80k)
      false, NULL, NULL,    -- NO permite niños
      'COP', 'Bote deportivo, capitán, nevera con hielo', 'Bebidas alcohólicas, comida',
      'https://images.unsplash.com/photo-1520116468816-95b69f847357?w=800', 'active'::experience_status,
      (SELECT id FROM u WHERE email='admin@livex.app'), now()),

    -- 5. Street Food Tour - TIERRA BOMBA PALMARITO
    ((SELECT id FROM r WHERE name='Isla Brisa Resort'),
      'Palmarito Beach Day', 'Día de playa en Tierra Bomba con almuerzo incluido', 'islands',
      23000000, 18000000, -- Adult ($230k), Niño ($180k)
      3000000, 2500000,   -- Comm Adult ($30k), Comm Child ($25k)
      true, 4, 10,          -- Niños de 4-10 años
      'COP', 'Almuerzo típico, uso de instalaciones', 'Toallas',
      'https://images.unsplash.com/photo-1573046738959-1e35593f0b24?w=800', 'active'::experience_status,
      (SELECT id FROM u WHERE email='admin@livex.app'), now()),

    -- 6. Isla Bela - ISLAS DEL ROSARIO
    ((SELECT id FROM r WHERE name='Isla Brisa Resort'),
      'Isla Bela Deluxe', 'Experiencia exclusiva en Isla Bela', 'islands',
      39000000, 30000000, -- Adult ($390k), Child ($300k)
      7000000, 2000000,   -- Comm Adult ($70k), Comm Child ($20k)
      true, 3, 10,
      'COP', 'Transporte rápido, almuerzo gourmet', 'Bebidas premium',
      'https://images.unsplash.com/photo-1540206351-d6465b3ac5c1?w=800', 'active'::experience_status,
      (SELECT id FROM u WHERE email='admin@livex.app'), now()),

    -- 7. Lizamar - ISLAS DEL ROSARIO
    ((SELECT id FROM r WHERE name='Isla Brisa Resort'),
      'Lizamar Island Escape', 'Escapada relajante a Lizamar', 'islands',
      40000000, 0,        -- Adult ($400k)
      8000000, 0,         -- Comm ($80k)
      false, NULL, NULL,  -- Solo adultos por ahora en este ejemplo
      'COP', 'Transporte, almuerzo buffet, piscina', 'Snorkel',
      'https://images.unsplash.com/photo-1590523741831-ab7e8b8f9c7f?w=800', 'active'::experience_status,
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
    
    -- Sol y Papaya (Classic)
    ((SELECT id FROM e WHERE title='Sol y Papaya Classic'), 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800', 0),
    ((SELECT id FROM e WHERE title='Sol y Papaya Classic'), 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800', 1),
    
    -- Sunset Sailing
    ((SELECT id FROM e WHERE title='Sunset Sailing'), 'https://images.unsplash.com/photo-1500514966906-fe245eea9344?w=800', 0),
    ((SELECT id FROM e WHERE title='Sunset Sailing'), 'https://images.unsplash.com/photo-1540946485063-a40da27545f8?w=800', 1),

    -- Cholón Party
    ((SELECT id FROM e WHERE title='Fiesta en Bote Deportivo Cholón'), 'https://images.unsplash.com/photo-1566412435010-b747372c0506?w=800', 0),
    ((SELECT id FROM e WHERE title='Fiesta en Bote Deportivo Cholón'), 'https://images.unsplash.com/photo-1544551763-46a42a4571da?w=800', 1),
    
    -- Palmarito (Tierra Bomba)
    ((SELECT id FROM e WHERE title='Palmarito Beach Day'), 'https://images.unsplash.com/photo-1573046738959-1e35593f0b24?w=800', 0),
    ((SELECT id FROM e WHERE title='Palmarito Beach Day'), 'https://images.unsplash.com/photo-1596436889106-be35e843f974?w=800', 1),
    
    -- Isla Bela
    ((SELECT id FROM e WHERE title='Isla Bela Deluxe'), 'https://images.unsplash.com/photo-1540206351-d6465b3ac5c1?w=800', 0),
    ((SELECT id FROM e WHERE title='Isla Bela Deluxe'), 'https://images.unsplash.com/photo-1626202162624-9b578c7c9800?w=800', 1),

    -- Lizamar
    ((SELECT id FROM e WHERE title='Lizamar Island Escape'), 'https://images.unsplash.com/photo-1590523741831-ab7e8b8f9c7f?w=800', 0),
    ((SELECT id FROM e WHERE title='Lizamar Island Escape'), 'https://images.unsplash.com/photo-1544551763-46a42a4571da?w=800', 1)

  RETURNING experience_id
),

-- 9) Ubicaciones (Ampliado)
loc AS (
  INSERT INTO experience_locations (experience_id, name, address_line, latitude, longitude, meeting_instructions)
  VALUES
    -- Existentes
    ((SELECT id FROM e WHERE title='City Tour Histórico'), 'Monumento Camellón de los Mártires', 'Camellón de los Mártires, Centro', 10.422300, -75.545500, 'Llegar 10 min antes. Busca al guía con sombrero vueltiao.'),
    ((SELECT id FROM e WHERE title='Sol y Papaya Classic'), 'Muelle La Bodeguita', 'Av. Blas de Lezo, Centro', 10.421900, -75.548300, 'Impuesto de muelle no incluido. Presentar documento.'),
    ((SELECT id FROM e WHERE title='Sunset Sailing'), 'Marina Santa Cruz', 'Manga, Cartagena', 10.409800, -75.535100, 'Ingresar por portería principal, muelle 3.'),
    
    -- Nuevas
    ((SELECT id FROM e WHERE title='Fiesta en Bote Deportivo Cholón'), 'Muelle de los Pegasos', 'Centro Histórico, muelle lateral', 10.420500, -75.546000, 'Preguntar por el bote "La Fantástica".'),
    ((SELECT id FROM e WHERE title='Palmarito Beach Day'), 'Muelle Hospital Bocagrande', 'Cra 1, Bocagrande', 10.398000, -75.556000, 'Lancha sale cada 30 minutos.'),
    ((SELECT id FROM e WHERE title='Isla Bela Deluxe'), 'Muelle La Bodeguita', 'Puerta 4', 10.421900, -75.548300, 'Hora de salida 8:30 AM puntual.'),
    ((SELECT id FROM e WHERE title='Lizamar Island Escape'), 'Muelle La Bodeguita', 'Puerta 5', 10.421900, -75.548300, 'Presentar voucher impreso o digital.')

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
      ('Sol y Papaya Classic', '08:00:00'::time, '16:00:00'::time, 40),
      ('Sunset Sailing', '17:30:00'::time, '19:30:00'::time, 10),
      
      -- Datos de disponibilidad para las NUEVAS experiencias
      ('Fiesta en Bote Deportivo Cholón', '10:00:00'::time, '16:00:00'::time, 12),
      ('Palmarito Beach Day', '09:00:00'::time, '17:00:00'::time, 30),
      ('Isla Bela Deluxe', '08:30:00'::time, '15:30:00'::time, 25),
      ('Lizamar Island Escape', '08:00:00'::time, '16:00:00'::time, 30)
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
   (SELECT id FROM experiences WHERE title='Sol y Papaya Classic'), 5, 'El paraíso en la tierra.', now() - INTERVAL '1 week'),
  
  -- Nuevas Reseñas
  ((SELECT id FROM users WHERE email='sofia.turista@gmail.com'),
   (SELECT id FROM experiences WHERE title='Fiesta en Bote Deportivo Cholón'), 5, '¡La mejor fiesta de mi vida! Muy recomendado ir con amigos.', now() - INTERVAL '1 day'),
  ((SELECT id FROM users WHERE email='sofia.turista@gmail.com'),
   (SELECT id FROM experiences WHERE title='Isla Bela Deluxe'), 4, 'La comida deliciosa y el servicio excelente.', now() - INTERVAL '4 days'),
  ((SELECT id FROM users WHERE email='sofia.turista@gmail.com'),
   (SELECT id FROM experiences WHERE title='Palmarito Beach Day'), 5, 'Un lugar muy exclusivo y tranquilo. El almuerzo estuvo 10/10.', now() - INTERVAL '6 days');

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
  2, 0, 96000000, 0, 24000000, 96000000, 120000000, 'COP',  -- 2 personas × ($480k neto + $120k comisión) = $1.2M total, $240k comisión
  'confirmed', now(), now();

-- 4.5 Registrar Pago
INSERT INTO payments (
  booking_id, provider, provider_reference, amount_cents, currency, 
  status, payment_method, paid_at
)
SELECT
  (SELECT id FROM bookings WHERE user_id=(SELECT id FROM users WHERE email='sofia.turista@gmail.com') AND agent_id=(SELECT id FROM users WHERE email='agente.carlos@gmail.com') ORDER BY created_at DESC LIMIT 1),
  'wompi', 'WOMPI-TEST-AGENT-01', 
  952000000, 'COP',
  'paid', 'card', now();

-- 4.6 Generar Comisiones
-- A) Comisión de Plataforma (10%)
INSERT INTO commissions (booking_id, rate_bps, commission_cents, created_at)
SELECT
  (SELECT id FROM bookings WHERE user_id=(SELECT id FROM users WHERE email='sofia.turista@gmail.com') AND agent_id=(SELECT id FROM users WHERE email='agente.carlos@gmail.com') ORDER BY created_at DESC LIMIT 1),
  1000, FLOOR(952000000 * 0.10), now();

-- B) Comisión del Agente (15%)
INSERT INTO agent_commissions (
  booking_id, agent_id, resort_id, amount_cents, rate_bps, status, created_at
)
SELECT 
  b.id, 
  b.agent_id, 
  (SELECT id FROM resorts WHERE name='Mar y Sol Cartagena'),
  FLOOR(b.total_cents * 0.15), -- 15% de 952,000,000
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
VALUES ((SELECT id FROM users WHERE email='agente.carlos@gmail.com'), 'VERANO2025', 'both', 'fixed', 2500000, 'Promoción de verano - $25.000 de descuento');

-- 5.3 Código Monto Fijo
INSERT INTO referral_codes (owner_user_id, code, code_type, discount_type, discount_value, usage_limit, description)
VALUES ((SELECT id FROM users WHERE email='agente.carlos@gmail.com'), 'PRIMERACOMPRA', 'both', 'fixed', 8000000, 50, 'Primera compra - $80.000 COP de descuento');

-- 5.4 Código con Stacking
INSERT INTO referral_codes (owner_user_id, code, code_type, discount_type, discount_value, allow_stacking, min_purchase_cents, description)
VALUES ((SELECT id FROM users WHERE email='agente.carlos@gmail.com'), 'EXTRA10', 'discount', 'percentage', 1000, true, 200000000, 'Extra 10% - Combinable');

-- 5.5 Restricciones (Solo Náutica)
INSERT INTO referral_code_restrictions (referral_code_id, restriction_type, category_slug)
VALUES ((SELECT id FROM referral_codes WHERE code = 'VERANO2025'), 'category', 'nautical');

-- 5.6 A/B Testing
INSERT INTO referral_code_variants (parent_code_id, variant_name, code, discount_value)
VALUES 
  ((SELECT id FROM referral_codes WHERE code = 'VERANO2025'), 'Variant A - 20k', 'VERANO2025A', 2000000),
  ((SELECT id FROM referral_codes WHERE code = 'VERANO2025'), 'Variant B - 50k', 'VERANO2025B', 5000000);

-- 5.7 Código de Influencer (No permite stacking)
INSERT INTO referral_codes (owner_user_id, code, code_type, referral_type, discount_type, discount_value, description)
VALUES ((SELECT id FROM users WHERE email='agente.carlos@gmail.com'), 'INFLUENCER20', 'discount', 'influencer', 'fixed', 2000000, 'Código de influencer - $20.000 descuento, uso exclusivo');

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
  3000000, -- $30.000 COP de descuento
  'COP',
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
  2000000, -- $20.000 COP de descuento
  'COP',
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
  'COP',
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
   'fixed',
    2000000, -- $20.000 extra
    NULL, -- Sin tope porcentual
    'COP',
   'gamification',
   now() + INTERVAL '3 months'),
  -- Cupón de primera reserva
  ((SELECT id FROM users WHERE email='sofia.turista@gmail.com'),
   'SOFIA-FIRST-001',
   'user_earned',
   'Cupón por primera reserva completada',
   'fixed',
    5000000, -- $50.000 COP fijo
   NULL,
   'COP',
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
  'COP',
  'active',
  now() - INTERVAL '1 month', -- Activado hace 1 mes
  now() + INTERVAL '11 months' -- Quedan 11 meses
),
(
  (SELECT id FROM users WHERE email='sofia.turista@gmail.com'),
  'percentage',
  1000, -- 10% de descuento
  'COP',
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