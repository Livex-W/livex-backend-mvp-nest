import { DashboardStatistics } from '../interfaces/statistics.interface';
import { DateRange } from '../value-objects/date-range.vo';

export const STATISTICS_REPOSITORY = Symbol('STATISTICS_REPOSITORY');

export interface IStatisticsRepository {
    getDashboardStatistics(dateRange: DateRange): Promise<DashboardStatistics>;
    getBookingsByDay(dateRange: DateRange): Promise<{ date: string; count: number; revenueCents: number }[]>;
    getTopExperiences(dateRange: DateRange, limit: number): Promise<{ experienceId: string; name: string; bookings: number; revenueCents: number }[]>;
    getTopAgents(dateRange: DateRange, limit: number): Promise<{ agentId: string; name: string; bookings: number; commissionCents: number }[]>;
    getRevenueByCategory(dateRange: DateRange): Promise<{ categorySlug: string; name: string; revenueCents: number }[]>;
}
