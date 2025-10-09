import { registerAs } from '@nestjs/config';

export interface BookingConfig {
  pendingTtlMinutes: number;
}

const DEFAULT_PENDING_TTL = 15;

export default registerAs('booking', (): BookingConfig => {
  const value = Number(process.env.BOOKING_PENDING_TTL_MINUTES ?? DEFAULT_PENDING_TTL);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('BOOKING_PENDING_TTL_MINUTES must be a positive number');
  }

  return {
    pendingTtlMinutes: value,
  };
});
