export interface AvailabilitySlot {
  id: string;
  experience_id: string;
  start_time: Date;
  end_time: Date;
  capacity: number;
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
