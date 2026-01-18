-- Migration: 013_add_unique_agent_commission_booking.sql
-- Description: Add unique constraint to agent_commissions on booking_id to support ON CONFLICT
-- Date: 2026-01-17

ALTER TABLE agent_commissions
ADD CONSTRAINT uq_agent_commissions_booking_id UNIQUE (booking_id);
