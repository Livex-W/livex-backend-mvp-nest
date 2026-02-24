-- Migration: 015_add_headers_to_webhook_events.sql
-- Description: Add missing headers column to webhook_events table
-- Date: 2026-02-23

ALTER TABLE webhook_events 
    ADD COLUMN IF NOT EXISTS headers jsonb;

COMMENT ON COLUMN webhook_events.headers IS 'HTTP headers from the webhook request (required for PayPal verification)';
