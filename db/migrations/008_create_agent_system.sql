-- 1. Tabla para definir la relación entre un Agente (Usuario) y un Resort
CREATE TABLE resort_agents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    resort_id uuid NOT NULL REFERENCES resorts(id),
    user_id uuid NOT NULL REFERENCES users(id),
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    -- Un usuario solo puede tener un acuerdo activo por resort
    CONSTRAINT unique_active_agent_resort UNIQUE (resort_id, user_id)
);

-- 2. Agregar la referencia del agente a la tabla de bookings
ALTER TABLE bookings 
ADD COLUMN agent_id uuid REFERENCES users(id);

-- 3. Tabla para registrar las comisiones generadas por cada venta
CREATE TABLE agent_commissions (
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

-- Índices para mejorar el rendimiento
CREATE INDEX idx_resort_agents_user ON resort_agents(user_id);
CREATE INDEX idx_bookings_agent ON bookings(agent_id);
CREATE INDEX idx_agent_commissions_agent ON agent_commissions(agent_id);
