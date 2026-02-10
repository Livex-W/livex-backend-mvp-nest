export interface BookingStatistics {
    totalBookings: number;
    confirmedBookings: number;
    cancelledBookings: number;
    pendingBookings: number;
    completedBookings: number;
    totalRevenueCents: number;
    totalCommissionCents: number;
    averageBookingValueCents: number;
    currency: string;
}

export interface AgentStatistics {
    totalAgents: number;
    activeAgents: number;
    pendingAgents: number;
    suspendedAgents: number;
    totalAgentCommissionCents: number;
}

export interface ResortStatistics {
    totalResorts: number;
    activeResorts: number;
    totalExperiences: number;
    activeExperiences: number;
}

export interface UserStatistics {
    totalUsers: number;
    activeVipUsers: number;
    newUsersInPeriod: number;
}

export interface DashboardStatistics {
    bookings: BookingStatistics;
    agents: AgentStatistics;
    resorts: ResortStatistics;
    users: UserStatistics;
    period: {
        startDate: Date;
        endDate: Date;
    };
}
