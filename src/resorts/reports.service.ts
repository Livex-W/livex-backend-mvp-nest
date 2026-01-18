import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DatabaseClient } from '../database/database.client';
import { DATABASE_CLIENT } from '../database/database.module';
import { CustomLoggerService } from '../common/services/logger.service';
import * as ExcelJS from 'exceljs';

interface BookingRow {
    id: string;
    created_at: Date;
    booking_date: Date;
    start_time: string;
    experience_title: string;
    client_name: string;
    client_email: string;
    adults: number;
    children: number;
    total_cents: number;
    resort_net_cents: number;
    platform_fee_cents: number;
    agent_commission_cents: number;
    currency: string;
    status: string;
    booking_source: string;
    checked_in_at: Date | null;
}

interface ExperienceStats {
    id: string;
    title: string;
    bookings: string;
    revenue_cents: string;
    guests: string;
}

interface DailyStats {
    date: string;
    bookings: string;
    revenue_cents: string;
    guests: string;
}

@Injectable()
export class ReportsService {
    constructor(
        @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
        private readonly logger: CustomLoggerService,
    ) { }

    async generateFinanceReport(userId: string): Promise<Buffer> {
        // Get resort ID for this user
        const resortResult = await this.db.query<{ id: string; name: string }>(
            'SELECT id, name FROM resorts WHERE owner_user_id = $1 LIMIT 1',
            [userId]
        );

        if (resortResult.rows.length === 0) {
            throw new NotFoundException('No resort found for this user');
        }

        const resort = resortResult.rows[0];
        const resortId = resort.id;
        const resortName = resort.name;

        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthName = now.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

        // Create workbook
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Livex BnG';
        workbook.created = now;

        // ==================== SHEET 1: RESUMEN ====================
        const summarySheet = workbook.addWorksheet('Resumen', {
            properties: { tabColor: { argb: '4F46E5' } }
        });

        // Get summary stats
        const summaryResult = await this.db.query<{
            total_bookings: string;
            total_revenue_cents: string;
            total_resort_net_cents: string;
            total_guests: string;
            checked_in_count: string;
        }>(`
            SELECT 
                COUNT(b.id) as total_bookings,
                COALESCE(SUM(b.total_cents), 0) as total_revenue_cents,
                COALESCE(SUM(b.resort_net_cents), 0) as total_resort_net_cents,
                COALESCE(SUM(b.adults + b.children), 0) as total_guests,
                COUNT(CASE WHEN b.checked_in_at IS NOT NULL THEN 1 END) as checked_in_count
            FROM bookings b
            JOIN experiences e ON e.id = b.experience_id
            WHERE e.resort_id = $1 
                AND b.status IN ('confirmed', 'pending')
                AND b.created_at >= $2
        `, [resortId, firstDayOfMonth.toISOString()]);

        const summary = summaryResult.rows[0];

        // Header styling
        const headerStyle: Partial<ExcelJS.Style> = {
            font: { bold: true, size: 14, color: { argb: 'FFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: '4F46E5' } },
            alignment: { horizontal: 'center', vertical: 'middle' }
        };

        const titleStyle: Partial<ExcelJS.Style> = {
            font: { bold: true, size: 18 },
            alignment: { horizontal: 'center' }
        };

        // Title
        summarySheet.mergeCells('A1:D1');
        const titleCell = summarySheet.getCell('A1');
        titleCell.value = `Reporte Financiero - ${resortName}`;
        titleCell.style = titleStyle;

        summarySheet.mergeCells('A2:D2');
        summarySheet.getCell('A2').value = `Período: ${monthName}`;
        summarySheet.getCell('A2').style = { alignment: { horizontal: 'center' } };

        summarySheet.addRow([]);

        // Summary metrics
        const metricsData = [
            ['Métrica', 'Valor'],
            ['Ingresos Brutos', this.formatCurrency(parseInt(summary.total_revenue_cents))],
            ['Ingresos Neto Resort', this.formatCurrency(parseInt(summary.total_resort_net_cents))],
            ['Total Reservas', parseInt(summary.total_bookings)],
            ['Total Huéspedes', parseInt(summary.total_guests)],
            ['Check-ins Realizados', parseInt(summary.checked_in_count)],
            ['Fecha de Generación', now.toLocaleString('es-CO')],
        ];

        metricsData.forEach((row, index) => {
            const excelRow = summarySheet.addRow(row);
            if (index === 0) {
                excelRow.eachCell(cell => {
                    cell.style = headerStyle;
                });
            }
        });

        summarySheet.getColumn(1).width = 25;
        summarySheet.getColumn(2).width = 25;

        // ==================== SHEET 2: RESERVAS DETALLE ====================
        const bookingsSheet = workbook.addWorksheet('Reservas', {
            properties: { tabColor: { argb: '10B981' } }
        });

        // Get all bookings this month
        const bookingsResult = await this.db.query<BookingRow>(`
            SELECT 
                b.id,
                b.created_at,
                DATE(s.start_time) as booking_date,
                TO_CHAR(s.start_time, 'HH24:MI') as start_time,
                e.title as experience_title,
                COALESCE(u.full_name, 'N/A') as client_name,
                COALESCE(u.email, 'N/A') as client_email,
                b.adults,
                b.children,
                b.total_cents,
                b.resort_net_cents,
                b.commission_cents as platform_fee_cents,
                b.agent_commission_cents,
                b.currency,
                b.status,
                b.booking_source,
                b.checked_in_at
            FROM bookings b
            JOIN experiences e ON e.id = b.experience_id
            JOIN availability_slots s ON s.id = b.slot_id
            LEFT JOIN users u ON u.id = b.user_id
            WHERE e.resort_id = $1 
                AND b.created_at >= $2
            ORDER BY b.created_at DESC
        `, [resortId, firstDayOfMonth.toISOString()]);

        // Headers
        const bookingHeaders = [
            'ID Reserva',
            'Fecha Creación',
            'Fecha Visita',
            'Hora',
            'Experiencia',
            'Cliente',
            'Email',
            'Adultos',
            'Niños',
            'Total Bruto',
            'Neto Resort',
            'Comisión Plataforma',
            'Comisión Agente',
            'Estado',
            'Fuente',
            'Check-in'
        ];

        const headerRow = bookingsSheet.addRow(bookingHeaders);
        headerRow.eachCell(cell => {
            cell.style = headerStyle;
        });

        // Data rows
        bookingsResult.rows.forEach(booking => {
            bookingsSheet.addRow([
                booking.id.slice(0, 8) + '...',
                new Date(booking.created_at).toLocaleDateString('es-CO'),
                new Date(booking.booking_date).toLocaleDateString('es-CO'),
                booking.start_time || 'N/A',
                booking.experience_title,
                booking.client_name,
                booking.client_email,
                booking.adults,
                booking.children,
                this.formatCurrency(booking.total_cents),
                this.formatCurrency(booking.resort_net_cents),
                this.formatCurrency(booking.platform_fee_cents || 0),
                this.formatCurrency(booking.agent_commission_cents || 0),
                this.translateStatus(booking.status),
                this.translateSource(booking.booking_source),
                booking.checked_in_at ? 'Sí' : 'No'
            ]);
        });

        // Auto-fit columns
        bookingsSheet.columns.forEach(column => {
            column.width = 15;
        });
        bookingsSheet.getColumn(5).width = 25; // Experience
        bookingsSheet.getColumn(6).width = 20; // Client
        bookingsSheet.getColumn(7).width = 25; // Email

        // ==================== SHEET 3: TOP EXPERIENCIAS ====================
        const experiencesSheet = workbook.addWorksheet('Top Experiencias', {
            properties: { tabColor: { argb: 'F59E0B' } }
        });

        const topExperiencesResult = await this.db.query<ExperienceStats>(`
            SELECT 
                e.id,
                e.title,
                COUNT(b.id) as bookings,
                COALESCE(SUM(b.resort_net_cents), 0) as revenue_cents,
                COALESCE(SUM(b.adults + b.children), 0) as guests
            FROM experiences e
            LEFT JOIN bookings b ON b.experience_id = e.id 
                AND b.status IN ('confirmed', 'pending')
                AND b.created_at >= $2
            WHERE e.resort_id = $1
            GROUP BY e.id, e.title
            ORDER BY revenue_cents DESC
        `, [resortId, firstDayOfMonth.toISOString()]);

        const expHeaders = ['#', 'Experiencia', 'Reservas', 'Huéspedes', 'Ingresos Neto'];
        const expHeaderRow = experiencesSheet.addRow(expHeaders);
        expHeaderRow.eachCell(cell => {
            cell.style = headerStyle;
        });

        topExperiencesResult.rows.forEach((exp, index) => {
            experiencesSheet.addRow([
                index + 1,
                exp.title,
                parseInt(exp.bookings),
                parseInt(exp.guests),
                this.formatCurrency(parseInt(exp.revenue_cents))
            ]);
        });

        experiencesSheet.getColumn(1).width = 5;
        experiencesSheet.getColumn(2).width = 35;
        experiencesSheet.getColumn(3).width = 12;
        experiencesSheet.getColumn(4).width = 12;
        experiencesSheet.getColumn(5).width = 18;

        // ==================== SHEET 4: DESGLOSE DIARIO ====================
        const dailySheet = workbook.addWorksheet('Desglose Diario', {
            properties: { tabColor: { argb: '8B5CF6' } }
        });

        const dailyResult = await this.db.query<DailyStats>(`
            SELECT 
                DATE(b.created_at) as date,
                COUNT(b.id) as bookings,
                COALESCE(SUM(b.resort_net_cents), 0) as revenue_cents,
                COALESCE(SUM(b.adults + b.children), 0) as guests
            FROM bookings b
            JOIN experiences e ON e.id = b.experience_id
            WHERE e.resort_id = $1 
                AND b.status IN ('confirmed', 'pending')
                AND b.created_at >= $2
            GROUP BY DATE(b.created_at)
            ORDER BY date ASC
        `, [resortId, firstDayOfMonth.toISOString()]);

        const dailyHeaders = ['Fecha', 'Reservas', 'Huéspedes', 'Ingresos Neto'];
        const dailyHeaderRow = dailySheet.addRow(dailyHeaders);
        dailyHeaderRow.eachCell(cell => {
            cell.style = headerStyle;
        });

        dailyResult.rows.forEach(day => {
            dailySheet.addRow([
                new Date(day.date).toLocaleDateString('es-CO'),
                parseInt(day.bookings),
                parseInt(day.guests),
                this.formatCurrency(parseInt(day.revenue_cents))
            ]);
        });

        dailySheet.getColumn(1).width = 15;
        dailySheet.getColumn(2).width = 12;
        dailySheet.getColumn(3).width = 12;
        dailySheet.getColumn(4).width = 18;

        // Generate buffer
        const buffer = await workbook.xlsx.writeBuffer();

        this.logger.logBusinessEvent('finance_report_generated', {
            userId,
            resortId,
            resortName,
            month: monthName,
            totalBookings: summary.total_bookings,
        });

        return Buffer.from(buffer);
    }

    private formatCurrency(cents: number): string {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(cents / 100);
    }

    private translateStatus(status: string): string {
        const statusMap: Record<string, string> = {
            'pending': 'Pendiente',
            'confirmed': 'Confirmada',
            'cancelled': 'Cancelada',
            'expired': 'Expirada',
            'refunded': 'Reembolsada',
        };
        return statusMap[status] || status;
    }

    private translateSource(source: string): string {
        const sourceMap: Record<string, string> = {
            'app': 'App Móvil',
            'bng': 'Panel Web',
            'direct': 'Directa',
        };
        return sourceMap[source] || source || 'N/A';
    }
}
