import { Inject, Injectable } from '@nestjs/common';
import { DatabaseClient } from '../../../../database/database.client';
import { DATABASE_CLIENT } from '../../../../database/database.module';
import { DateRange } from '../../domain/value-objects/date-range.vo';
import { DashboardStatistics } from '../../domain/interfaces/statistics.interface';
import { IStatisticsRepository } from '../../domain/repositories/statistics.repository.interface';

@Injectable()
export class StatisticsRepository implements IStatisticsRepository {
    constructor(
        @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
    ) { }

    async getDashboardStatistics(dateRange: DateRange): Promise<DashboardStatistics> {
        const [bookings, agents, resorts, users] = await Promise.all([
            this.getBookingStats(dateRange),
            this.getAgentStats(),
            this.getResortStats(),
            this.getUserStats(dateRange),
        ]);

        return {
            bookings,
            agents,
            resorts,
            users,
            period: {
                startDate: dateRange.startDate,
                endDate: dateRange.endDate,
            },
        };
    }

    private async getBookingStats(dateRange: DateRange) {
        const result = await this.db.query<{
            total_bookings: string;
            confirmed_bookings: string;
            cancelled_bookings: string;
            pending_bookings: string;
            completed_bookings: string;
            total_revenue_cents: string;
            total_commission_cents: string;
        }>(`
            SELECT 
                COUNT(*) as total_bookings,
                COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_bookings,
                COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_bookings,
                COUNT(*) FILTER (WHERE status = 'pending') as pending_bookings,
                COUNT(*) FILTER (WHERE status = 'completed') as completed_bookings,
                COALESCE(SUM(total_cents) FILTER (WHERE status IN ('confirmed', 'completed')), 0) as total_revenue_cents,
                COALESCE(SUM(commission_cents) FILTER (WHERE status IN ('confirmed', 'completed')), 0) as total_commission_cents
            FROM bookings
            WHERE created_at BETWEEN $1 AND $2
        `, [dateRange.startDate, dateRange.endDate]);

        const row = result.rows[0];
        const totalBookings = parseInt(row.total_bookings, 10);

        return {
            totalBookings,
            confirmedBookings: parseInt(row.confirmed_bookings, 10),
            cancelledBookings: parseInt(row.cancelled_bookings, 10),
            pendingBookings: parseInt(row.pending_bookings, 10),
            completedBookings: parseInt(row.completed_bookings, 10),
            totalRevenueCents: parseInt(row.total_revenue_cents, 10),
            totalCommissionCents: parseInt(row.total_commission_cents, 10),
            averageBookingValueCents: totalBookings > 0
                ? Math.round(parseInt(row.total_revenue_cents, 10) / totalBookings)
                : 0,
            currency: 'COP',
        };
    }

    private async getAgentStats() {
        const result = await this.db.query<{
            total_agents: string;
            active_agents: string;
            pending_agents: string;
            suspended_agents: string;
            total_commission_cents: string;
        }>(`
            SELECT 
                COUNT(*) as total_agents,
                COUNT(*) FILTER (WHERE status = 'active') as active_agents,
                COUNT(*) FILTER (WHERE status = 'pending') as pending_agents,
                COUNT(*) FILTER (WHERE status = 'suspended') as suspended_agents,
                COALESCE(SUM(total_commission_cents), 0) as total_commission_cents
            FROM agents
        `);

        const row = result.rows[0];
        return {
            totalAgents: parseInt(row.total_agents, 10),
            activeAgents: parseInt(row.active_agents, 10),
            pendingAgents: parseInt(row.pending_agents, 10),
            suspendedAgents: parseInt(row.suspended_agents, 10),
            totalAgentCommissionCents: parseInt(row.total_commission_cents, 10),
        };
    }

    private async getResortStats() {
        const result = await this.db.query<{
            total_resorts: string;
            active_resorts: string;
            total_experiences: string;
            active_experiences: string;
        }>(`
            SELECT 
                (SELECT COUNT(*) FROM resorts) as total_resorts,
                (SELECT COUNT(*) FROM resorts WHERE status = 'active') as active_resorts,
                (SELECT COUNT(*) FROM experiences) as total_experiences,
                (SELECT COUNT(*) FROM experiences WHERE status = 'active') as active_experiences
        `);

        const row = result.rows[0];
        return {
            totalResorts: parseInt(row.total_resorts, 10),
            activeResorts: parseInt(row.active_resorts, 10),
            totalExperiences: parseInt(row.total_experiences, 10),
            activeExperiences: parseInt(row.active_experiences, 10),
        };
    }

    private async getUserStats(dateRange: DateRange) {
        const result = await this.db.query<{
            total_users: string;
            active_vip_users: string;
            new_users: string;
        }>(`
            SELECT 
                (SELECT COUNT(*) FROM users) as total_users,
                (SELECT COUNT(*) FROM vip_subscriptions WHERE expires_at > NOW()) as active_vip_users,
                (SELECT COUNT(*) FROM users WHERE created_at BETWEEN $1 AND $2) as new_users
        `, [dateRange.startDate, dateRange.endDate]);

        const row = result.rows[0];
        return {
            totalUsers: parseInt(row.total_users, 10),
            activeVipUsers: parseInt(row.active_vip_users, 10),
            newUsersInPeriod: parseInt(row.new_users, 10),
        };
    }

    async getBookingsByDay(dateRange: DateRange): Promise<{ date: string; count: number; revenueCents: number }[]> {
        const result = await this.db.query<{ date: string; count: string; revenue_cents: string }>(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as count,
                COALESCE(SUM(total_cents) FILTER (WHERE status IN ('confirmed', 'completed')), 0) as revenue_cents
            FROM bookings
            WHERE created_at BETWEEN $1 AND $2
            GROUP BY DATE(created_at)
            ORDER BY date
        `, [dateRange.startDate, dateRange.endDate]);

        return result.rows.map(row => ({
            date: row.date,
            count: parseInt(row.count, 10),
            revenueCents: parseInt(row.revenue_cents, 10),
        }));
    }

    async getTopExperiences(dateRange: DateRange, limit: number): Promise<{ experienceId: string; name: string; bookings: number; revenueCents: number }[]> {
        const result = await this.db.query<{ experience_id: string; name: string; bookings: string; revenue_cents: string }>(`
            SELECT 
                b.experience_id,
                e.name,
                COUNT(*) as bookings,
                COALESCE(SUM(b.total_cents) FILTER (WHERE b.status IN ('confirmed', 'completed')), 0) as revenue_cents
            FROM bookings b
            JOIN experiences e ON e.id = b.experience_id
            WHERE b.created_at BETWEEN $1 AND $2
            GROUP BY b.experience_id, e.name
            ORDER BY bookings DESC
            LIMIT $3
        `, [dateRange.startDate, dateRange.endDate, limit]);

        return result.rows.map(row => ({
            experienceId: row.experience_id,
            name: row.name,
            bookings: parseInt(row.bookings, 10),
            revenueCents: parseInt(row.revenue_cents, 10),
        }));
    }

    async getTopAgents(dateRange: DateRange, limit: number): Promise<{ agentId: string; name: string; bookings: number; commissionCents: number }[]> {
        const result = await this.db.query<{ agent_id: string; name: string; bookings: string; commission_cents: string }>(`
            SELECT 
                b.agent_id,
                a.full_name as name,
                COUNT(*) as bookings,
                COALESCE(SUM(b.agent_commission_cents) FILTER (WHERE b.status IN ('confirmed', 'completed')), 0) as commission_cents
            FROM bookings b
            JOIN agents a ON a.id = b.agent_id
            WHERE b.created_at BETWEEN $1 AND $2 AND b.agent_id IS NOT NULL
            GROUP BY b.agent_id, a.full_name
            ORDER BY bookings DESC
            LIMIT $3
        `, [dateRange.startDate, dateRange.endDate, limit]);

        return result.rows.map(row => ({
            agentId: row.agent_id,
            name: row.name,
            bookings: parseInt(row.bookings, 10),
            commissionCents: parseInt(row.commission_cents, 10),
        }));
    }

    async getRevenueByCategory(dateRange: DateRange): Promise<{ categorySlug: string; name: string; revenueCents: number }[]> {
        const result = await this.db.query<{ category_slug: string; name: string; revenue_cents: string }>(`
            SELECT 
                c.slug as category_slug,
                c.name,
                COALESCE(SUM(b.total_cents) FILTER (WHERE b.status IN ('confirmed', 'completed')), 0) as revenue_cents
            FROM bookings b
            JOIN experiences e ON e.id = b.experience_id
            JOIN categories c ON c.slug = e.category
            WHERE b.created_at BETWEEN $1 AND $2
            GROUP BY c.slug, c.name
            ORDER BY revenue_cents DESC
        `, [dateRange.startDate, dateRange.endDate]);

        return result.rows.map(row => ({
            categorySlug: row.category_slug,
            name: row.name,
            revenueCents: parseInt(row.revenue_cents, 10),
        }));
    }
}
