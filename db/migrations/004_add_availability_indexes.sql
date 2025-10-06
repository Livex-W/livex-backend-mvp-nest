-- Migration: Add additional indexes for availability performance
-- Date: 2025-01-05
-- Description: Optimize availability queries with additional indexes

-- Add composite index for availability queries by experience and date range
CREATE INDEX IF NOT EXISTS idx_availability_slots_experience_date 
ON availability_slots(experience_id, start_time, end_time);

-- Add index for date-based queries (for calendar views)
CREATE INDEX IF NOT EXISTS idx_availability_slots_date 
ON availability_slots(DATE(start_time AT TIME ZONE 'UTC'));

-- Add index for capacity filtering
CREATE INDEX IF NOT EXISTS idx_availability_slots_capacity 
ON availability_slots(capacity) WHERE capacity > 0;

-- Optimize the v_slot_remaining view with better indexing
-- Add index for active bookings
CREATE INDEX IF NOT EXISTS idx_bookings_active_slot 
ON bookings(slot_id, status) 
WHERE status IN ('pending', 'confirmed');

-- Add index for inventory locks
CREATE INDEX IF NOT EXISTS idx_inventory_locks_active_detailed 
ON inventory_locks(slot_id, expires_at, consumed_at) 
WHERE consumed_at IS NULL;

-- Add partial index for non-expired bookings
CREATE INDEX IF NOT EXISTS idx_bookings_non_expired 
ON bookings(slot_id, expires_at, status) 
WHERE expires_at IS NULL OR expires_at > now();

-- Add comment for documentation
COMMENT ON INDEX idx_availability_slots_experience_date IS 'Optimizes availability queries by experience and date range';
COMMENT ON INDEX idx_availability_slots_date IS 'Optimizes calendar view queries by date';
COMMENT ON INDEX idx_availability_slots_capacity IS 'Optimizes queries filtering by available capacity';
COMMENT ON INDEX idx_bookings_active_slot IS 'Optimizes remaining capacity calculations for active bookings';
COMMENT ON INDEX idx_inventory_locks_active_detailed IS 'Optimizes remaining capacity calculations for active locks';
COMMENT ON INDEX idx_bookings_non_expired IS 'Optimizes queries for non-expired bookings';
