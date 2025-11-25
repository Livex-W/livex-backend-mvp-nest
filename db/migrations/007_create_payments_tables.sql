-- Migration: 007_create_payments_tables.sql
-- Description: Update payments system with enhanced functionality
-- Date: 2025-10-15

-- Add new payment provider and refund status enums
DO $$ BEGIN
    -- Add new values to existing payment_status enum
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'pending' AND enumtypid = 'payment_status'::regtype) THEN
        ALTER TYPE payment_status ADD VALUE 'pending';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'expired' AND enumtypid = 'payment_status'::regtype) THEN
        ALTER TYPE payment_status ADD VALUE 'expired';
    END IF;

    -- Create payment_provider enum if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_provider') THEN
        CREATE TYPE payment_provider AS ENUM ('wompi','epayco','stripe','paypal');
    END IF;

    -- Create refund_status enum if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'refund_status') THEN
        CREATE TYPE refund_status AS ENUM ('pending','processed','failed','cancelled');
    END IF;
END $$;

-- Update payments table with new columns
ALTER TABLE payments 
    ADD COLUMN IF NOT EXISTS provider_payment_id text,
    ADD COLUMN IF NOT EXISTS provider_reference text,
    ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'COP',
    ADD COLUMN IF NOT EXISTS payment_method text,
    ADD COLUMN IF NOT EXISTS idempotency_key text,
    ADD COLUMN IF NOT EXISTS checkout_url text,
    ADD COLUMN IF NOT EXISTS expires_at timestamptz,
    ADD COLUMN IF NOT EXISTS authorized_at timestamptz,
    ADD COLUMN IF NOT EXISTS failed_at timestamptz,
    ADD COLUMN IF NOT EXISTS failure_reason text,
    ADD COLUMN IF NOT EXISTS provider_metadata jsonb,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Update provider column to use enum type
ALTER TABLE payments ALTER COLUMN provider TYPE payment_provider USING provider::payment_provider;

-- Add default value for status if not set
ALTER TABLE payments ALTER COLUMN status SET DEFAULT 'pending';

-- Create new indexes for payments
CREATE INDEX IF NOT EXISTS idx_payments_provider_id ON payments(provider, provider_payment_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_idempotency 
  ON payments(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Add updated_at trigger for payments
DROP TRIGGER IF EXISTS trg_payments_updated_at ON payments;
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Update refunds table with new columns
ALTER TABLE refunds 
    ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'COP',
    ADD COLUMN IF NOT EXISTS status refund_status NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS provider_refund_id text,
    ADD COLUMN IF NOT EXISTS provider_reference text,
    ADD COLUMN IF NOT EXISTS requested_by uuid REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS requested_at timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS failed_at timestamptz,
    ADD COLUMN IF NOT EXISTS failure_reason text,
    ADD COLUMN IF NOT EXISTS provider_metadata jsonb,
    ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Rename processed_at to maintain compatibility
ALTER TABLE refunds RENAME COLUMN processed_at TO processed_at_old;
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS processed_at timestamptz;
UPDATE refunds SET processed_at = processed_at_old WHERE processed_at_old IS NOT NULL;
ALTER TABLE refunds DROP COLUMN IF EXISTS processed_at_old;

-- Create new indexes for refunds
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);
CREATE INDEX IF NOT EXISTS idx_refunds_provider_id ON refunds(provider_refund_id);

-- Add updated_at trigger for refunds
DROP TRIGGER IF EXISTS trg_refunds_updated_at ON refunds;
CREATE TRIGGER trg_refunds_updated_at BEFORE UPDATE ON refunds
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Create payment_reconciliations table
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

-- Create indexes for payment_reconciliations
CREATE INDEX IF NOT EXISTS idx_payment_reconciliations_date ON payment_reconciliations(reconciliation_date);
CREATE INDEX IF NOT EXISTS idx_payment_reconciliations_provider ON payment_reconciliations(provider);

-- Add updated_at trigger for payment_reconciliations
CREATE TRIGGER trg_payment_reconciliations_updated_at BEFORE UPDATE ON payment_reconciliations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Update webhook_events table to handle payment webhooks better
ALTER TABLE webhook_events 
    ADD COLUMN IF NOT EXISTS signature_valid boolean NOT NULL DEFAULT false;

-- Add index for webhook events processing
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_status ON webhook_events(provider, status);

-- Comments for documentation
COMMENT ON TABLE payment_reconciliations IS 'Daily reconciliation records for payment providers';
COMMENT ON COLUMN payments.provider_payment_id IS 'Payment ID from the payment provider';
COMMENT ON COLUMN payments.provider_reference IS 'Reference or transaction ID from provider';
COMMENT ON COLUMN payments.idempotency_key IS 'Key for idempotent payment creation';
COMMENT ON COLUMN payments.provider_metadata IS 'JSON metadata from payment provider';
COMMENT ON COLUMN refunds.provider_refund_id IS 'Refund ID from the payment provider';
COMMENT ON COLUMN refunds.requested_by IS 'User who requested the refund';

-- Ensure existing data has proper defaults
UPDATE payments SET 
    currency = COALESCE(currency, 'COP'),
    status = COALESCE(status, 'pending'),
    updated_at = COALESCE(updated_at, created_at)
WHERE currency IS NULL OR status IS NULL OR updated_at IS NULL;

UPDATE refunds SET 
    currency = COALESCE(currency, 'COP'),
    status = COALESCE(status, 'pending'),
    requested_at = COALESCE(requested_at, created_at),
    updated_at = COALESCE(updated_at, created_at)
WHERE currency IS NULL OR status IS NULL OR requested_at IS NULL OR updated_at IS NULL;
