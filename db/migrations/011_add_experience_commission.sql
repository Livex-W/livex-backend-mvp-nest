-- Migration: 011_add_experience_commission.sql
-- Description: Add commission_cents to experiences and bookings for commission-only payment model
-- Date: 2025-12-27

-- 1. Add commission_cents to experiences table
ALTER TABLE experiences 
ADD COLUMN IF NOT EXISTS commission_cents integer NOT NULL DEFAULT 0 CHECK (commission_cents >= 0);

COMMENT ON COLUMN experiences.commission_cents IS 'Fixed commission amount in cents that LIVEX charges online. Resort net (price_cents) is paid on-site.';

-- 2. Add commission_cents and resort_net_cents to bookings table
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS commission_cents integer NOT NULL DEFAULT 0 CHECK (commission_cents >= 0);

ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS resort_net_cents integer NOT NULL DEFAULT 0 CHECK (resort_net_cents >= 0);

COMMENT ON COLUMN bookings.commission_cents IS 'LIVEX commission amount charged online at booking time';
COMMENT ON COLUMN bookings.resort_net_cents IS 'Resort net amount to be paid on-site by the customer';

-- 3. Update existing bookings to have sensible defaults based on current total
-- Note: For existing records, we set resort_net_cents = subtotal_cents and commission_cents = 0
-- This maintains backward compatibility
UPDATE bookings 
SET resort_net_cents = subtotal_cents,
    commission_cents = 0
WHERE resort_net_cents = 0 AND commission_cents = 0;
