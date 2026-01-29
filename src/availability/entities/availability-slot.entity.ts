export interface AvailabilitySlot {
  id: string;
  experience_id: string;
  start_time: Date;
  end_time: Date;
  capacity: number;
  // Precios de temporada
  price_per_adult_cents?: number | null;
  price_per_child_cents?: number | null;
  // Comisión (para app móvil y agentes BNG)
  commission_per_adult_cents?: number | null;
  commission_per_child_cents?: number | null;
  created_at: Date;
  updated_at: Date;
}



export interface AvailabilitySlotWithRemaining extends AvailabilitySlot {
  remaining: number;
}

export interface SlotSummary {
  date: string; // YYYY-MM-DD format
  slots: AvailabilitySlotWithRemaining[];
  total_capacity: number;
  total_remaining: number;
}
