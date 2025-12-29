CREATE TABLE IF NOT EXISTS exchange_rates (
    code VARCHAR(3) PRIMARY KEY,
    rate DECIMAL(20, 10) NOT NULL,
    base_code VARCHAR(3) DEFAULT 'USD',
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_updated_at ON exchange_rates(updated_at);
