-- Ensure bookings table has idempotency support and default children
ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS idempotency_key text;

-- Backfill defaults for children and ensure constraint consistency
ALTER TABLE bookings
    ALTER COLUMN children SET DEFAULT 0;

-- Create partial unique index for idempotency keys (ignores nulls)
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_idempotency
    ON bookings(idempotency_key) WHERE idempotency_key IS NOT NULL;
