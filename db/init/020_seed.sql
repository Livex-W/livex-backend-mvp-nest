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

-- User Preferences (currency settings for each user)
up AS (
  INSERT INTO user_preferences (user_id, language, currency)
  SELECT id, 'es', 'COP' FROM u WHERE email = 'sofia.turista@gmail.com'
  UNION ALL
  SELECT id, 'en', 'USD' FROM u WHERE email = 'john.doe@usmail.com'
  UNION ALL
  SELECT id, 'es', 'COP' FROM u WHERE email = 'pedro.brasil@email.br'
  UNION ALL
  SELECT id, 'es', 'COP' FROM u WHERE email = 'pierre.france@email.fr'
  UNION ALL
  SELECT id, 'es', 'COP' FROM u WHERE email = 'jose.perez@email.com'
  UNION ALL
  SELECT id, 'es', 'COP' FROM u WHERE email = 'admin@livex.app'
  UNION ALL
  SELECT id, 'es', 'COP' FROM u WHERE email = 'operador@marysol.co'
  UNION ALL
  SELECT id, 'es', 'COP' FROM u WHERE email = 'carlos.ventas@livex.app'
),

-- 2. Business Profiles para Resorts
bp_resorts AS (
  INSERT INTO business_profiles (entity_type, name, nit, rnt, contact_email, contact_phone, status, approved_by, approved_at)
  VALUES
    ('resort'::business_entity_type, 'Mar y Sol Cartagena', '900111222-1', '12345', 'contacto@marysol.co', '+57 300 1111111', 'approved'::resort_status, (SELECT id FROM u WHERE email='admin@livex.app'), now()),
    ('resort'::business_entity_type, 'Isla Brisa Resort', '900333444-2', '23456', 'hola@islabrisa.co', '+57 300 2222222', 'approved'::resort_status, (SELECT id FROM u WHERE email='admin@livex.app'), now()),
    ('resort'::business_entity_type, 'Náutica Bahía Club', '900555666-3', '34567', 'info@nauticabahia.co', '+57 300 3333333', 'approved'::resort_status, (SELECT id FROM u WHERE email='admin@livex.app'), now())
  RETURNING id, name
),

-- 3. Prestadores (Resorts) con referencia a business_profiles
r AS (
  INSERT INTO resorts (
    name, description, website, contact_email, contact_phone,
    address_line, city, country, latitude, longitude,
    owner_user_id, business_profile_id, is_active, status, approved_by, approved_at
  )
  SELECT
    'Mar y Sol Cartagena', 'Operador de actividades de playa y city tours', 'https://marysol.co', 'contacto@marysol.co', '+57 300 1111111',
    'Bocagrande Cra 1 #1-23', 'Cartagena', 'Colombia', 10.400000, -75.550000,
    (SELECT id FROM u WHERE email='operaciones@marysol.co'), 
    (SELECT id FROM bp_resorts WHERE name='Mar y Sol Cartagena'),
    true, 'approved'::resort_status,
    (SELECT id FROM u WHERE email='admin@livex.app'), now()
  UNION ALL
  SELECT
    'Isla Brisa Resort', 'Resort boutique en Islas del Rosario', 'https://islabrisa.co', 'hola@islabrisa.co', '+57 300 2222222',
    'Muelle La Bodeguita', 'Cartagena', 'Colombia', 10.411100, -75.545000,
    (SELECT id FROM u WHERE email='coordinacion@islabrisa.co'),
    (SELECT id FROM bp_resorts WHERE name='Isla Brisa Resort'),
    true, 'approved'::resort_status,
    (SELECT id FROM u WHERE email='admin@livex.app'), now()
  UNION ALL
  SELECT
    'Náutica Bahía Club', 'Club náutico con experiencias de vela y atardecer', 'https://nauticabahia.co', 'info@nauticabahia.co', '+57 300 3333333',
    'Marina Santa Cruz', 'Cartagena', 'Colombia', 10.420000, -75.530000,
    (SELECT id FROM u WHERE email='reservas@nauticabahia.co'),
    (SELECT id FROM bp_resorts WHERE name='Náutica Bahía Club'),
    true, 'approved'::resort_status,
    (SELECT id FROM u WHERE email='admin@livex.app'), now()
  RETURNING id, name
),

-- 4. Business Documents (documentos en la nueva tabla compartida)
bp_docs AS (
  INSERT INTO business_documents (business_profile_id, doc_type, file_url, status, reviewed_by, reviewed_at)
  VALUES
    ((SELECT id FROM bp_resorts WHERE name='Mar y Sol Cartagena'), 'rut_nit'::resort_doc_type, 'https://files.example.com/marysol-rut.pdf', 'approved'::document_status, (SELECT id FROM u WHERE email='admin@livex.app'), now()),
    ((SELECT id FROM bp_resorts WHERE name='Mar y Sol Cartagena'), 'camara_comercio'::resort_doc_type, 'https://files.example.com/marysol-camara.pdf', 'approved'::document_status, (SELECT id FROM u WHERE email='admin@livex.app'), now()),
    ((SELECT id FROM bp_resorts WHERE name='Isla Brisa Resort'), 'rnt'::resort_doc_type, 'https://files.example.com/islabrisa-lic.pdf', 'approved'::document_status, (SELECT id FROM u WHERE email='admin@livex.app'), now()),
    ((SELECT id FROM bp_resorts WHERE name='Isla Brisa Resort'), 'rut_nit'::resort_doc_type, 'https://files.example.com/islabrisa-rut.pdf', 'approved'::document_status, (SELECT id FROM u WHERE email='admin@livex.app'), now()),
    ((SELECT id FROM bp_resorts WHERE name='Náutica Bahía Club'), 'camara_comercio'::resort_doc_type, 'https://files.example.com/nautica-pola.pdf', 'approved'::document_status, (SELECT id FROM u WHERE email='admin@livex.app'), now())
  RETURNING business_profile_id
),

-- 5. Categorías
c AS (
  INSERT INTO categories (slug, name) VALUES
    ('sun_beach', 'Sol y playa (Resort, vacacionales)'),
    ('cultural', 'Cultural (Arte, Historia, Tradiciones y Museos)'),
    ('adventure', 'Turismo Aventura'),
    ('ecotourism', 'Ecoturismo'),
    ('agrotourism', 'Agro turismo'),
    ('gastronomic', 'Turismo gastronómico'),
    ('religious', 'Turismo religioso'),
    ('educational', 'Turismo educativo')
  RETURNING id, slug
),
-- 6. Experiencias (sin precios - ahora van en availability_slots)
e AS (
  INSERT INTO experiences (
    resort_id, title, description, category,
    allows_children, child_min_age, child_max_age,
    currency, includes, excludes, status, approved_by, approved_at
  )
  VALUES
    -- 1. City Tour Histórico
    ((SELECT id FROM r WHERE name='Mar y Sol Cartagena'),
      'City Tour Histórico', 'Recorrido por el Centro Histórico y Getsemaní', 'cultural',
      true, 3, 9,
      'COP', 'Guía certificado, hidratación', 'Almuerzo',
      'active'::experience_status,
      (SELECT id FROM u WHERE email='admin@livex.app'), now()),
      
    -- 2. Sunset Sailing
    ((SELECT id FROM r WHERE name='Náutica Bahía Club'),
      'Sunset Sailing', 'Navegación a vela por la Bahía al atardecer', 'nautical',
      false, NULL, NULL,
      'COP', 'Capitán, seguro, snacks', 'Traslados al muelle',
      'active'::experience_status,
      (SELECT id FROM u WHERE email='admin@livex.app'), now()),

    -- 3. Cholón Party - Solo adultos (18+)
    ((SELECT id FROM r WHERE name='Náutica Bahía Club'),
      'Fiesta en Bote Deportivo Cholón', 'Experiencia de fiesta en el agua con música y amigos', 'nautical',
      false, NULL, NULL,
      'COP', 'Bote deportivo, capitán, nevera con hielo', 'Bebidas alcohólicas, comida',
      'active'::experience_status,
      (SELECT id FROM u WHERE email='admin@livex.app'), now()),

    -- 4. Tour Murallas y Castillo
    ((SELECT id FROM r WHERE name='Mar y Sol Cartagena'),
      'Tour Murallas y Castillo', 'Recorrido por las murallas y el Castillo San Felipe', 'cultural',
      true, 5, 12,
      'COP', 'Guía especializado, entrada al castillo', 'Propinas',
      'active'::experience_status,
      (SELECT id FROM u WHERE email='admin@livex.app'), now()),

    -- 5. Kayak Mangrove Tour
    ((SELECT id FROM r WHERE name='Náutica Bahía Club'),
      'Kayak Mangrove Tour', 'Aventura en kayak por los manglares de la bahía', 'ecotourism',
      true, 8, 16,
      'COP', 'Kayak doble, chaleco, instructor', 'Refrigerio',
      'active'::experience_status,
      (SELECT id FROM u WHERE email='admin@livex.app'), now()),

    -- 6. Catamaran Premium
    ((SELECT id FROM r WHERE name='Náutica Bahía Club'),
      'Catamaran Premium', 'Navegación en catamarán con barra libre', 'nautical',
      false, NULL, NULL,
      'COP', 'Barra libre, DJ, snacks gourmet', 'Transporte al muelle',
      'active'::experience_status,
      (SELECT id FROM u WHERE email='admin@livex.app'), now()),

    -- 7. Tour Nocturno Getsemaní
    ((SELECT id FROM r WHERE name='Mar y Sol Cartagena'),
      'Tour Nocturno Getsemaní', 'Descubre el barrio más bohemio de noche', 'cultural',
      false, NULL, NULL,
      'COP', 'Guía, coctel de bienvenida', 'Cena',
      'active'::experience_status,
      (SELECT id FROM u WHERE email='admin@livex.app'), now()),

    -- 8. Jet Ski Adventure
    ((SELECT id FROM r WHERE name='Náutica Bahía Club'),
      'Jet Ski Adventure', 'Adrenalina pura en moto acuática', 'adventure',
      false, NULL, NULL,
      'COP', 'Jet ski, chaleco, instructor', 'Seguro adicional',
      'active'::experience_status,
      (SELECT id FROM u WHERE email='admin@livex.app'), now()),

    -- 9. Pesca Deportiva
    ((SELECT id FROM r WHERE name='Náutica Bahía Club'),
      'Pesca Deportiva', 'Jornada de pesca en alta mar', 'nautical',
      false, NULL, NULL,
      'COP', 'Embarcación, equipos, carnada', 'Licencia de pesca',
      'active'::experience_status,
      (SELECT id FROM u WHERE email='admin@livex.app'), now()),

    -- 10. Tour del Café
    ((SELECT id FROM r WHERE name='Mar y Sol Cartagena'),
      'Tour del Café', 'Degustación y cultura del café colombiano', 'gastronomic',
      true, 6, 15,
      'COP', 'Degustación, souvenirs', 'Almuerzo',
      'active'::experience_status,
      (SELECT id FROM u WHERE email='admin@livex.app'), now()),

    -- 11. Paddleboard Sunset
    ((SELECT id FROM r WHERE name='Náutica Bahía Club'),
      'Paddleboard Sunset', 'Paddleboard al atardecer en la bahía', 'adventure',
      true, 10, 17,
      'COP', 'Tabla, remo, instructor', 'Fotos',
      'active'::experience_status,
      (SELECT id FROM u WHERE email='admin@livex.app'), now()),

    -- 12. Tour Gastronómico
    ((SELECT id FROM r WHERE name='Mar y Sol Cartagena'),
      'Tour Gastronómico', 'Prueba los sabores auténticos de Cartagena', 'gastronomic',
      true, 5, 14,
      'COP', 'Degustaciones en 5 paradas, guía local', 'Bebidas alcohólicas',
      'active'::experience_status,
      (SELECT id FROM u WHERE email='admin@livex.app'), now()),

    -- 13. Avistamiento de Delfines
    ((SELECT id FROM r WHERE name='Náutica Bahía Club'),
      'Avistamiento de Delfines', 'Navega en busca de delfines en su hábitat', 'ecotourism',
      true, 4, 12,
      'COP', 'Embarcación, guía biólogo, snacks', 'Garantía de avistamiento',
      'active'::experience_status,
      (SELECT id FROM u WHERE email='admin@livex.app'), now()),

    -- 14. Experiencia Test 5k
    ((SELECT id FROM r WHERE name='Mar y Sol Cartagena'),
      'Experiencia Test 5k', 'Experiencia para probar pagos mínimos de 5000 pesos', 'city_tour',
      true, 1, 99,
      'COP', 'Incluye todo', 'No incluye nada',
      'active'::experience_status,
      (SELECT id FROM u WHERE email='admin@livex.app'), now()),

    -- 15. Tours Islas + Playa Tranquila
    ((SELECT id FROM r WHERE name='Isla Brisa Resort'),
      'Tours Islas + Playa Tranquila', 'tour por las paradisiacas islas del rosario y parada en Playa Tranquila Baru para disfrutar del mar azul', 'sun_beach',
      true, 3, 12,
      'COP', 'Transporte maritimo ida y vuelta, Tour panoramico islas, Llegada al Oceanario, Llegada a playa tranquila, Almuerzo tipico', 'Boleto de entrada al Oceanario, Impuestos de zarpe',
      'active'::experience_status,
      (SELECT id FROM u WHERE email='admin@livex.app'), now()),

    -- 16. Palmarito Beach
    ((SELECT id FROM r WHERE name='Isla Brisa Resort'),
      'Palmarito Beach', 'Atencion y servicio que te haran querer volver', 'sun_beach',
      true, 3, 12,
      'COP', 'Transporte maritimo ida y vuelta, Coctel de bienvenida, Almuerzo, Camas y Sillas asoleadoras, Piscina, canchas, zonas comunes', 'Cualquier producto o servicio no especificado',
      'active'::experience_status,
      (SELECT id FROM u WHERE email='admin@livex.app'), now()),

    -- 17. Luxury Open Bar Area House
    ((SELECT id FROM r WHERE name='Isla Brisa Resort'),
      'Luxury Open Bar Area House', 'Vive una experiencia junto al mar en uno de los lugares mas exclusivos de Islas del Rosario', 'sun_beach',
      true, 3, 12,
      'COP', 'Transporte maritimo ida y vuelta, Barra abierta bebida nacional ilimitada, Traslado al oceanario (opcional), Kayak y paddle board, Careta para snorkel, Cama de playa, Almuerzo tipico', 'Boleto de entrada al Oceanario, Impuestos de zarpe',
      'active'::experience_status,
      (SELECT id FROM u WHERE email='admin@livex.app'), now()),

    -- 18. BACHEROLETTE
    ((SELECT id FROM r WHERE name='Isla Brisa Resort'),
      'BACHEROLETTE', 'Plan extra mejorado para un disfrute mas pleno en un lugar lleno de tranquilidad y excelente atencion', 'sun_beach',
      false, 0, 0,
      'COP', 'Transporte maritimo ida y vuelta, 4 cocteles de la casa, Almuerzo y bebida, Cama Lounge y Silla asoleadora, Piscina, Playa semi privada, Postre shot, Mini ensalada de frutas', 'Cualquier producto o servicio no especificado',
      'active'::experience_status,
      (SELECT id FROM u WHERE email='admin@livex.app'), now()),

    -- 19. Tamarindo Beach
    ((SELECT id FROM r WHERE name='Isla Brisa Resort'),
      'Tamarindo Beach', 'A solo 10 minutos de cartagena un lugar lleno de tranquilidad y excelente atencion', 'sun_beach',
      true, 3, 12,
      'COP', 'Transporte maritimo ida y vuelta, Coctel de bienvenida, Almuerzo, Cama Lounge y Silla asoleadora, Piscina, Playa semi privada', 'Cualquier producto o servicio no especificado',
      'active'::experience_status,
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
    -- 1. City Tour Histórico (Keywords: Cartagena, colonial)
    ((SELECT id FROM e WHERE title='City Tour Histórico'), 'https://loremflickr.com/800/600/cartagena,colonial?random=1', 0),
    ((SELECT id FROM e WHERE title='City Tour Histórico'), 'https://loremflickr.com/800/600/architecture,old?random=2', 1),
    
    -- 3. Sunset Sailing (Keywords: Sailing, sunset)
    ((SELECT id FROM e WHERE title='Sunset Sailing'), 'https://loremflickr.com/800/600/sailing,sunset?random=3', 0),
    ((SELECT id FROM e WHERE title='Sunset Sailing'), 'https://loremflickr.com/800/600/boat,ocean?random=4', 1),

    -- 4. Cholón Party (Keywords: Yacht, party)
    ((SELECT id FROM e WHERE title='Fiesta en Bote Deportivo Cholón'), 'https://loremflickr.com/800/600/yacht,party?random=5', 0),
    ((SELECT id FROM e WHERE title='Fiesta en Bote Deportivo Cholón'), 'https://loremflickr.com/800/600/boat,people?random=6', 1),

    -- 8. Tour Murallas y Castillo (Keywords: Fortress, stone)
    ((SELECT id FROM e WHERE title='Tour Murallas y Castillo'), 'https://loremflickr.com/800/600/fortress,castle?random=7', 0),
    ((SELECT id FROM e WHERE title='Tour Murallas y Castillo'), 'https://loremflickr.com/800/600/stone,wall?random=8', 1),

    -- 10. Kayak Mangrove Tour (Keywords: Mangrove, kayak)
    ((SELECT id FROM e WHERE title='Kayak Mangrove Tour'), 'https://loremflickr.com/800/600/kayak,nature?random=9', 0),
    ((SELECT id FROM e WHERE title='Kayak Mangrove Tour'), 'https://loremflickr.com/800/600/mangrove,water?random=10', 1),

    -- 11. Catamaran Premium (Keywords: Catamaran)
    ((SELECT id FROM e WHERE title='Catamaran Premium'), 'https://loremflickr.com/800/600/catamaran,luxury?random=11', 0),
    ((SELECT id FROM e WHERE title='Catamaran Premium'), 'https://loremflickr.com/800/600/sea,yacht?random=12', 1),

    -- 12. Tour Nocturno Getsemaní (Keywords: Street, night)
    ((SELECT id FROM e WHERE title='Tour Nocturno Getsemaní'), 'https://loremflickr.com/800/600/street,night?random=13', 0),
    ((SELECT id FROM e WHERE title='Tour Nocturno Getsemaní'), 'https://loremflickr.com/800/600/neon,city?random=14', 1),

    -- 14. Jet Ski Adventure
    ((SELECT id FROM e WHERE title='Jet Ski Adventure'), 'https://loremflickr.com/800/600/jetski,water?random=15', 0),

    -- 15. Pesca Deportiva
    ((SELECT id FROM e WHERE title='Pesca Deportiva'), 'https://loremflickr.com/800/600/fishing,boat?random=16', 0),

    -- 16. Tour del Café
    ((SELECT id FROM e WHERE title='Tour del Café'), 'https://loremflickr.com/800/600/coffee,beans?random=17', 0),
    ((SELECT id FROM e WHERE title='Tour del Café'), 'https://loremflickr.com/800/600/cafe,cup?random=18', 1),

    -- 18. Paddleboard Sunset
    ((SELECT id FROM e WHERE title='Paddleboard Sunset'), 'https://loremflickr.com/800/600/paddleboard,sea?random=19', 0),

    -- 19. Tour Gastronómico
    ((SELECT id FROM e WHERE title='Tour Gastronómico'), 'https://loremflickr.com/800/600/food,dinner?random=20', 0),
    ((SELECT id FROM e WHERE title='Tour Gastronómico'), 'https://loremflickr.com/800/600/restaurant,dish?random=21', 1),

    -- 20. Avistamiento de Delfines
    ((SELECT id FROM e WHERE title='Avistamiento de Delfines'), 'https://loremflickr.com/800/600/dolphin,ocean?random=22', 0),
    
    -- Experiencia Test 5k
    ((SELECT id FROM e WHERE title='Experiencia Test 5k'), 'https://images.unsplash.com/photo-1621609764180-2ca554a9d6f2?w=800', 0),

    -- 1. Tours Islas + Playa Tranquila
    ((SELECT id FROM e WHERE title='Tours Islas + Playa Tranquila'), 'https://livex.com.co/images/1.Islas_Playa_Tranquila/bc.jpg', 0),
    ((SELECT id FROM e WHERE title='Tours Islas + Playa Tranquila'), 'https://livex.com.co/images/1.Islas_Playa_Tranquila/Captura%20de%20pantalla%202026-01-07%20180916.png', 1),
    ((SELECT id FROM e WHERE title='Tours Islas + Playa Tranquila'), 'https://livex.com.co/images/1.Islas_Playa_Tranquila/dsc07105-web_standard.jpg', 2),
    ((SELECT id FROM e WHERE title='Tours Islas + Playa Tranquila'), 'https://livex.com.co/images/1.Islas_Playa_Tranquila/isla-del-pirata-islas-del-rosario-pasadia-islas-del-rosario-tours-islas-del-rosario-3-min-600x600.jpg', 3),
    ((SELECT id FROM e WHERE title='Tours Islas + Playa Tranquila'), 'https://livex.com.co/images/1.Islas_Playa_Tranquila/Oceanario-islas-del-rosario.png', 4),

    -- 2. Palmarito Beach
    ((SELECT id FROM e WHERE title='Palmarito Beach'), 'https://livex.com.co/images/2.Palmarito/20210514_084346%20(1).jpg', 0),
    ((SELECT id FROM e WHERE title='Palmarito Beach'), 'https://livex.com.co/images/2.Palmarito/DJI_0016.jpg', 1),
    ((SELECT id FROM e WHERE title='Palmarito Beach'), 'https://livex.com.co/images/2.Palmarito/DJI_0301.jpg', 2),
    ((SELECT id FROM e WHERE title='Palmarito Beach'), 'https://livex.com.co/images/2.Palmarito/DJI_0845.jpg', 3),
    ((SELECT id FROM e WHERE title='Palmarito Beach'), 'https://livex.com.co/images/2.Palmarito/DJI_0866.jpg', 4),

    -- 3. Luxury Open Bar Area House
    ((SELECT id FROM e WHERE title='Luxury Open Bar Area House'), 'https://livex.com.co/images/3.Luxury/hotel-luxury-beach-islas-rosario04.jpg', 0),
    ((SELECT id FROM e WHERE title='Luxury Open Bar Area House'), 'https://livex.com.co/images/3.Luxury/hotel-luxury-beach-islas-rosario05.jpg', 1),
    ((SELECT id FROM e WHERE title='Luxury Open Bar Area House'), 'https://livex.com.co/images/3.Luxury/hotel-luxury-beach-islas-rosario06b.jpg', 2),
    ((SELECT id FROM e WHERE title='Luxury Open Bar Area House'), 'https://livex.com.co/images/3.Luxury/hotel-luxury-beach-islas-rosario07.jpg', 3),
    ((SELECT id FROM e WHERE title='Luxury Open Bar Area House'), 'https://livex.com.co/images/3.Luxury/hotel-luxury-beach-islas-rosario08.jpg', 4),

    -- 4. BACHEROLETTE
    ((SELECT id FROM e WHERE title='BACHEROLETTE'), 'https://livex.com.co/images/4.Bacherolete/Captura%20de%20pantalla%202026-01-08%20172229.png', 0),
    ((SELECT id FROM e WHERE title='BACHEROLETTE'), 'https://livex.com.co/images/4.Bacherolete/Captura%20de%20pantalla%202026-01-08%20172251.png', 1),
    ((SELECT id FROM e WHERE title='BACHEROLETTE'), 'https://livex.com.co/images/4.Bacherolete/Captura%20de%20pantalla%202026-01-08%20172311.png', 2),
    ((SELECT id FROM e WHERE title='BACHEROLETTE'), 'https://livex.com.co/images/4.Bacherolete/Captura%20de%20pantalla%202026-01-08%20172332.png', 3),

    -- 5. Tamarindo Beach
    ((SELECT id FROM e WHERE title='Tamarindo Beach'), 'https://livex.com.co/images/5.Tamarindo/F1.jpg', 0),
    ((SELECT id FROM e WHERE title='Tamarindo Beach'), 'https://livex.com.co/images/5.Tamarindo/F2.jpg', 1),
    ((SELECT id FROM e WHERE title='Tamarindo Beach'), 'https://livex.com.co/images/5.Tamarindo/F3.jpg', 2),
    ((SELECT id FROM e WHERE title='Tamarindo Beach'), 'https://livex.com.co/images/5.Tamarindo/F6%20(1).jpg', 3),
    ((SELECT id FROM e WHERE title='Tamarindo Beach'), 'https://livex.com.co/images/5.Tamarindo/F6.jpg', 4)

  RETURNING experience_id
),

-- 9) Ubicaciones (Ampliado)
loc AS (
  INSERT INTO experience_locations (experience_id, name, address_line, latitude, longitude, meeting_instructions)
  VALUES
    -- Existentes
    ((SELECT id FROM e WHERE title='City Tour Histórico'), 'Monumento Camellón de los Mártires', 'Camellón de los Mártires, Centro', 10.422300, -75.545500, 'Llegar 10 min antes. Busca al guía con sombrero vueltiao.'),
    -- ((SELECT id FROM e WHERE title='Sol y Papaya Classic'), 'Muelle La Bodeguita', 'Av. Blas de Lezo, Centro', 10.421900, -75.548300, 'Impuesto de muelle no incluido. Presentar documento.'),
    ((SELECT id FROM e WHERE title='Sunset Sailing'), 'Marina Santa Cruz', 'Manga, Cartagena', 10.409800, -75.535100, 'Ingresar por portería principal, muelle 3.'),
    
    -- Nuevas
    ((SELECT id FROM e WHERE title='Fiesta en Bote Deportivo Cholón'), 'Muelle de los Pegasos', 'Centro Histórico, muelle lateral', 10.420500, -75.546000, 'Preguntar por el bote "La Fantástica".'),
    -- ((SELECT id FROM e WHERE title='Palmarito Beach Day'), 'Muelle Hospital Bocagrande', 'Cra 1, Bocagrande', 10.398000, -75.556000, 'Lancha sale cada 30 minutos.'),
    -- ((SELECT id FROM e WHERE title='Isla Bela Deluxe'), 'Muelle La Bodeguita', 'Puerta 4', 10.421900, -75.548300, 'Hora de salida 8:30 AM puntual.'),
    -- ((SELECT id FROM e WHERE title='Lizamar Island Escape'), 'Muelle La Bodeguita', 'Puerta 5', 10.421900, -75.548300, 'Presentar voucher impreso o digital.'),
    ((SELECT id FROM e WHERE title='Experiencia Test 5k'), 'Oficina Livex', 'Centro', 10.42, -75.54, 'Preguntar por Dev')

  RETURNING experience_id
)
SELECT count(*) as core_data_inserted FROM u;

-- Update para asegurar tipo de imagen
UPDATE experience_images SET image_type = 'gallery' WHERE image_type IS NULL;


-- ===========================
-- BLOQUE 2: DISPONIBILIDAD (Slots) - GENERACIÓN MASIVA
-- ===========================

-- TEMPORADA BAJA: 11-14 Enero 2026 (Precios Base)
INSERT INTO availability_slots (
  experience_id, start_time, end_time, capacity,
  price_per_adult_cents, price_per_child_cents,
  commission_per_adult_cents, commission_per_child_cents
)
SELECT
  e.id,
  (to_char(d, 'YYYY-MM-DD') || 'T' || to_char(t.start_time, 'HH24:MI:SS') || '-05')::timestamptz,
  (to_char(d, 'YYYY-MM-DD') || 'T' || to_char(t.end_time, 'HH24:MI:SS') || '-05')::timestamptz,
  t.capacity,
  t.price_adult,
  t.price_child,
  t.comm_adult,
  t.comm_child
FROM
  experiences e
  CROSS JOIN generate_series('2026-01-11'::date, '2026-01-14'::date, '1 day'::interval) AS d
  JOIN (
    VALUES
      -- TEMPORADA BAJA - Precios Base
      ('City Tour Histórico', '09:00:00'::time, '12:00:00'::time, 20, 19000000, 18000000, 3500000, 2500000),
      ('City Tour Histórico', '15:00:00'::time, '18:00:00'::time, 20, 19000000, 18000000, 3500000, 2500000),
      ('Sunset Sailing', '17:30:00'::time, '19:30:00'::time, 10, 17000000, 0, 4000000, 0),
      ('Fiesta en Bote Deportivo Cholón', '10:00:00'::time, '16:00:00'::time, 12, 42000000, 0, 8000000, 0),
      ('Palmarito Beach', '09:00:00'::time, '17:00:00'::time, 30, 25000000, 20000000, 5000000, 4000000),
      ('Tours Islas + Playa Tranquila', '08:30:00'::time, '16:00:00'::time, 30, 20000000, 16000000, 4000000, 3200000),
      ('Luxury Open Bar Area House', '09:00:00'::time, '16:00:00'::time, 20, 38000000, 30000000, 7500000, 6000000),
      ('BACHEROLETTE', '09:00:00'::time, '16:00:00'::time, 15, 42000000, 0, 8500000, 0),
      ('Tamarindo Beach', '09:00:00'::time, '16:00:00'::time, 30, 23000000, 18000000, 4600000, 3600000),
      ('Tour Murallas y Castillo', '09:00:00'::time, '12:30:00'::time, 25, 22000000, 18000000, 4000000, 3000000),
      ('Kayak Mangrove Tour', '07:00:00'::time, '10:00:00'::time, 12, 15000000, 12000000, 2500000, 2000000),
      ('Catamaran Premium', '11:00:00'::time, '17:00:00'::time, 20, 55000000, 0, 12000000, 0),
      ('Tour Nocturno Getsemaní', '19:00:00'::time, '22:00:00'::time, 15, 16000000, 0, 3000000, 0),
      ('Jet Ski Adventure', '09:00:00'::time, '10:00:00'::time, 6, 25000000, 0, 5000000, 0),
      ('Jet Ski Adventure', '14:00:00'::time, '15:00:00'::time, 6, 25000000, 0, 5000000, 0),
      ('Tour del Café', '10:00:00'::time, '13:00:00'::time, 15, 12000000, 10000000, 2000000, 1500000),
      ('Paddleboard Sunset', '16:30:00'::time, '18:30:00'::time, 10, 13000000, 10000000, 2000000, 1500000),
      ('Tour Gastronómico', '11:00:00'::time, '14:00:00'::time, 12, 18000000, 14000000, 3000000, 2500000),
      ('Avistamiento de Delfines', '06:30:00'::time, '10:30:00'::time, 18, 38000000, 30000000, 7000000, 5500000),
      ('Experiencia Test 5k', '08:00:00'::time, '18:00:00'::time, 100, 500000, 500000, 50000, 50000)
  ) AS t(title, start_time, end_time, capacity, price_adult, price_child, comm_adult, comm_child) ON e.title = t.title;

-- ===========================
-- TEMPORADA MEDIA: 15-31 Enero 2026 (Precios +15%)
-- ===========================
INSERT INTO availability_slots (
  experience_id, start_time, end_time, capacity,
  price_per_adult_cents, price_per_child_cents,
  commission_per_adult_cents, commission_per_child_cents
)
SELECT
  e.id,
  (to_char(d, 'YYYY-MM-DD') || 'T' || to_char(t.start_time, 'HH24:MI:SS') || '-05')::timestamptz,
  (to_char(d, 'YYYY-MM-DD') || 'T' || to_char(t.end_time, 'HH24:MI:SS') || '-05')::timestamptz,
  t.capacity,
  t.price_adult,
  t.price_child,
  t.comm_adult,
  t.comm_child
FROM
  experiences e
  CROSS JOIN generate_series('2026-01-15'::date, '2026-01-31'::date, '1 day'::interval) AS d
  JOIN (
    VALUES
      -- TEMPORADA MEDIA - Precios +15%
      ('City Tour Histórico', '09:00:00'::time, '12:00:00'::time, 20, 21850000, 20700000, 4025000, 2875000),
      ('City Tour Histórico', '15:00:00'::time, '18:00:00'::time, 20, 21850000, 20700000, 4025000, 2875000),
      ('Sunset Sailing', '17:30:00'::time, '19:30:00'::time, 10, 19550000, 0, 4600000, 0),
      ('Fiesta en Bote Deportivo Cholón', '10:00:00'::time, '16:00:00'::time, 12, 48300000, 0, 9200000, 0),
      ('Palmarito Beach', '09:00:00'::time, '17:00:00'::time, 30, 28750000, 23000000, 5750000, 4600000),
      ('Tours Islas + Playa Tranquila', '08:30:00'::time, '16:00:00'::time, 30, 23000000, 18400000, 4600000, 3680000),
      ('Luxury Open Bar Area House', '09:00:00'::time, '16:00:00'::time, 20, 43700000, 34500000, 8625000, 6900000),
      ('BACHEROLETTE', '09:00:00'::time, '16:00:00'::time, 15, 48300000, 0, 9775000, 0),
      ('Tamarindo Beach', '09:00:00'::time, '16:00:00'::time, 30, 26450000, 20700000, 5290000, 4140000),
      ('Tour Murallas y Castillo', '09:00:00'::time, '12:30:00'::time, 25, 25300000, 20700000, 4600000, 3450000),
      ('Kayak Mangrove Tour', '07:00:00'::time, '10:00:00'::time, 12, 17250000, 13800000, 2875000, 2300000),
      ('Catamaran Premium', '11:00:00'::time, '17:00:00'::time, 20, 63250000, 0, 13800000, 0),
      ('Tour Nocturno Getsemaní', '19:00:00'::time, '22:00:00'::time, 15, 18400000, 0, 3450000, 0),
      ('Jet Ski Adventure', '09:00:00'::time, '10:00:00'::time, 6, 28750000, 0, 5750000, 0),
      ('Jet Ski Adventure', '14:00:00'::time, '15:00:00'::time, 6, 28750000, 0, 5750000, 0),
      ('Tour del Café', '10:00:00'::time, '13:00:00'::time, 15, 13800000, 11500000, 2300000, 1725000),
      ('Paddleboard Sunset', '16:30:00'::time, '18:30:00'::time, 10, 14950000, 11500000, 2300000, 1725000),
      ('Tour Gastronómico', '11:00:00'::time, '14:00:00'::time, 12, 20700000, 16100000, 3450000, 2875000),
      ('Avistamiento de Delfines', '06:30:00'::time, '10:30:00'::time, 18, 43700000, 34500000, 8050000, 6325000),
      ('Experiencia Test 5k', '08:00:00'::time, '18:00:00'::time, 100, 575000, 575000, 57500, 57500)
  ) AS t(title, start_time, end_time, capacity, price_adult, price_child, comm_adult, comm_child) ON e.title = t.title;

-- ===========================
-- TEMPORADA ALTA: 1-28 Febrero 2026 (Precios +30%)
-- ===========================
INSERT INTO availability_slots (
  experience_id, start_time, end_time, capacity,
  price_per_adult_cents, price_per_child_cents,
  commission_per_adult_cents, commission_per_child_cents
)
SELECT
  e.id,
  (to_char(d, 'YYYY-MM-DD') || 'T' || to_char(t.start_time, 'HH24:MI:SS') || '-05')::timestamptz,
  (to_char(d, 'YYYY-MM-DD') || 'T' || to_char(t.end_time, 'HH24:MI:SS') || '-05')::timestamptz,
  t.capacity,
  t.price_adult,
  t.price_child,
  t.comm_adult,
  t.comm_child
FROM
  experiences e
  CROSS JOIN generate_series('2026-02-01'::date, '2026-02-28'::date, '1 day'::interval) AS d
  JOIN (
    VALUES
      -- TEMPORADA ALTA - Precios +30%
      ('City Tour Histórico', '09:00:00'::time, '12:00:00'::time, 20, 24700000, 23400000, 4550000, 3250000),
      ('City Tour Histórico', '15:00:00'::time, '18:00:00'::time, 20, 24700000, 23400000, 4550000, 3250000),
      ('Sunset Sailing', '17:30:00'::time, '19:30:00'::time, 10, 22100000, 0, 5200000, 0),
      ('Fiesta en Bote Deportivo Cholón', '10:00:00'::time, '16:00:00'::time, 12, 54600000, 0, 10400000, 0),
      ('Palmarito Beach', '09:00:00'::time, '17:00:00'::time, 30, 32500000, 26000000, 6500000, 5200000),
      ('Tours Islas + Playa Tranquila', '08:30:00'::time, '16:00:00'::time, 30, 26000000, 20800000, 5200000, 4160000),
      ('Luxury Open Bar Area House', '09:00:00'::time, '16:00:00'::time, 20, 49400000, 39000000, 9750000, 7800000),
      ('BACHEROLETTE', '09:00:00'::time, '16:00:00'::time, 15, 54600000, 0, 11050000, 0),
      ('Tamarindo Beach', '09:00:00'::time, '16:00:00'::time, 30, 29900000, 23400000, 5980000, 4680000),
      ('Tour Murallas y Castillo', '09:00:00'::time, '12:30:00'::time, 25, 28600000, 23400000, 5200000, 3900000),
      ('Kayak Mangrove Tour', '07:00:00'::time, '10:00:00'::time, 12, 19500000, 15600000, 3250000, 2600000),
      ('Catamaran Premium', '11:00:00'::time, '17:00:00'::time, 20, 71500000, 0, 15600000, 0),
      ('Tour Nocturno Getsemaní', '19:00:00'::time, '22:00:00'::time, 15, 20800000, 0, 3900000, 0),
      ('Jet Ski Adventure', '09:00:00'::time, '10:00:00'::time, 6, 32500000, 0, 6500000, 0),
      ('Jet Ski Adventure', '14:00:00'::time, '15:00:00'::time, 6, 32500000, 0, 6500000, 0),
      ('Tour del Café', '10:00:00'::time, '13:00:00'::time, 15, 15600000, 13000000, 2600000, 1950000),
      ('Paddleboard Sunset', '16:30:00'::time, '18:30:00'::time, 10, 16900000, 13000000, 2600000, 1950000),
      ('Tour Gastronómico', '11:00:00'::time, '14:00:00'::time, 12, 23400000, 18200000, 3900000, 3250000),
      ('Avistamiento de Delfines', '06:30:00'::time, '10:30:00'::time, 18, 49400000, 39000000, 9100000, 7150000),
      ('Experiencia Test 5k', '08:00:00'::time, '18:00:00'::time, 100, 650000, 650000, 65000, 65000)
  ) AS t(title, start_time, end_time, capacity, price_adult, price_child, comm_adult, comm_child) ON e.title = t.title;


-- ===========================
-- BLOQUE 3: SOCIAL PROOF (Reseñas)
-- ===========================

INSERT INTO reviews (user_id, experience_id, rating, comment, created_at)
VALUES
  -- 1. City Tour Histórico
  ((SELECT id FROM users WHERE email='sofia.turista@gmail.com'),
   (SELECT id FROM experiences WHERE title='City Tour Histórico'), 
   5, '¡Increíble experiencia! El guía fue muy amable.', now() - INTERVAL '2 days'),
  
  -- 2. Fiesta en Bote Deportivo Cholón
  ((SELECT id FROM users WHERE email='sofia.turista@gmail.com'),
   (SELECT id FROM experiences WHERE title='Fiesta en Bote Deportivo Cholón'), 
   5, '¡La mejor fiesta de mi vida! Muy recomendado ir con amigos.', now() - INTERVAL '1 day'),

  -- 3. Tours Islas + Playa Tranquila (Isla Brisa)
  ((SELECT id FROM users WHERE email='sofia.turista@gmail.com'),
   (SELECT id FROM experiences WHERE title='Tours Islas + Playa Tranquila'), 
   5, 'Excelente tour, muy relajante. Vale la pena totalmente.', now() - INTERVAL '5 days'),

  -- 4. Palmarito Beach (Isla Brisa)
  ((SELECT id FROM users WHERE email='john.doe@usmail.com'),
   (SELECT id FROM experiences WHERE title='Palmarito Beach'), 
   4, 'Buena comida y playa limpia, aunque estaba un poco lleno.', now() - INTERVAL '1 week'),

  -- 5. Luxury Open Bar Area House (Isla Brisa)
  ((SELECT id FROM users WHERE email='sofia.turista@gmail.com'),
   (SELECT id FROM experiences WHERE title='Luxury Open Bar Area House'), 
   5, 'Increíble lugar, el bar abierto vale la pena. Muy exclusivo.', now() - INTERVAL '3 days'),

  -- 6. Tamarindo Beach (Isla Brisa)
  ((SELECT id FROM users WHERE email='john.doe@usmail.com'),
   (SELECT id FROM experiences WHERE title='Tamarindo Beach'), 
   3, 'El lugar es bonito pero el servicio en el restaurante demoró un poco.', now() - INTERVAL '2 weeks'),

  -- 7. Tours Islas + Playa Tranquila (Isla Brisa) - Otro review
  ((SELECT id FROM users WHERE email='john.doe@usmail.com'),
   (SELECT id FROM experiences WHERE title='Tours Islas + Playa Tranquila'), 
   4, 'Muy bonito todo, el oceanario es espectacular.', now() - INTERVAL '10 days');
-- ===========================
-- BLOQUE 4: SISTEMA DE AGENTES
-- Creación de usuario agente, acuerdo comercial y simulación de venta
-- ===========================

-- 4.1 Crear Usuario Agente
INSERT INTO users (email, password_hash, full_name, phone, role) 
VALUES ('agente.carlos@gmail.com', '$2b$10$j54QekkMZucJ.hKpcRMmqe4SnETnpr.8OxLyRfAZVLnSVkBgP4eFS', 'Carlos El Vendedor', '+573005555555', 'agent');

-- 4.1.1 Business Profile para el Agente
INSERT INTO business_profiles (entity_type, name, nit, rnt, contact_email, contact_phone, status, approved_by, approved_at)
SELECT
  'agent'::business_entity_type, 
  'Carlos El Vendedor - Agente', 
  '72345678-9',
  '45678',
  'agente.carlos@gmail.com', 
  '+573005555555', 
  'approved'::resort_status, 
  (SELECT id FROM users WHERE email='admin@livex.app'), 
  now();

-- 4.1.2 Business Documents para el Agente
INSERT INTO business_documents (business_profile_id, doc_type, file_url, status, reviewed_by, reviewed_at)
SELECT
  (SELECT id FROM business_profiles WHERE name='Carlos El Vendedor - Agente'),
  'rut_nit'::resort_doc_type,
  'https://files.example.com/carlos-rut.pdf',
  'approved'::document_status,
  (SELECT id FROM users WHERE email='admin@livex.app'),
  now();

-- 4.2 Acuerdo Comercial (15% Comisión para Carlos con Mar y Sol)
INSERT INTO resort_agents (resort_id, user_id, business_profile_id, commission_bps, is_active)
SELECT 
  (SELECT id FROM resorts WHERE name='Mar y Sol Cartagena'),
  (SELECT id FROM users WHERE email='agente.carlos@gmail.com'),
  (SELECT id FROM business_profiles WHERE name='Carlos El Vendedor - Agente'),
  1500, -- 15%
  true;

-- 4.3 Crear Reserva por Agente (Confirmada)
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

-- 4.4 Registrar Pago
INSERT INTO payments (
  booking_id, provider, provider_reference, amount_cents, currency, 
  status, payment_method, paid_at
)
SELECT
  (SELECT id FROM bookings WHERE user_id=(SELECT id FROM users WHERE email='sofia.turista@gmail.com') AND agent_id=(SELECT id FROM users WHERE email='agente.carlos@gmail.com') ORDER BY created_at DESC LIMIT 1),
  'wompi', 'WOMPI-TEST-AGENT-01', 
  952000000, 'COP',
  'paid', 'card', now();

-- 4.5 Generar Comisiones
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

-- 5.2 Código Mixto (Descuento 25000 + Comisión)
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
    3000000, -- $30.000 COP fijo
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