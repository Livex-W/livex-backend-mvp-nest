/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
    Controller,
    Post,
    Body,
    Res,
    Req,
    UseGuards,
    Logger,
    HttpStatus,
    Inject,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PdfService, ExperienceForPdf } from './pdf.service';
import { DatabaseClient } from '../database/database.client';
import { DATABASE_CLIENT } from '../database/database.module';

// Category slug to name mapping
const CATEGORY_NAMES: Record<string, string> = {
    city_tour: 'City Tour',
    islands: 'Islas y Playa',
    nautical: 'Náutica y Vela',
    sun_beach: 'Sol y Playa',
    cultural: 'Cultural',
    adventure: 'Aventura',
    ecotourism: 'Ecoturismo',
    agrotourism: 'Agroturismo',
    gastronomic: 'Gastronómico',
    religious: 'Religioso',
    educational: 'Educativo',
};

function getCategoryName(slug: string): string {
    return CATEGORY_NAMES[slug] || slug;
}

function getStatusName(status: string): string {
    const statusMap: Record<string, string> = {
        active: 'Activo',
        draft: 'Borrador',
        under_review: 'En revisión',
        rejected: 'Rechazado',
    };
    return statusMap[status] || status;
}

// DTO for export request
interface ExportPdfDto {
    resortId?: string;
}

@Controller('api/v1/pdf')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('resort', 'agent', 'admin')
export class PdfController {
    private readonly logger = new Logger(PdfController.name);

    constructor(
        private readonly pdfService: PdfService,
        @Inject(DATABASE_CLIENT) private readonly db: DatabaseClient,
    ) { }

    @Post('experiences')
    async exportExperiences(
        @Body() body: ExportPdfDto,
        @Req() req: FastifyRequest,
        @Res() res: FastifyReply,
    ) {
        const user = (req as any).user;
        const userRole = user?.role;
        const userId = user?.sub;

        this.logger.log(`Export experiences PDF requested by user ${userId} (role: ${userRole})`);

        try {
            let resortId: string | undefined;
            let resortName: string | undefined;

            // Determine which resort to use based on user role
            if (userRole === 'resort') {
                // For resorts: use their own resort
                const resortResult = await this.db.query<{ id: string; name: string }>(
                    `SELECT r.id, r.name FROM resorts r WHERE r.owner_user_id = $1`,
                    [userId],
                );

                if (resortResult.rows.length === 0) {
                    return res.status(HttpStatus.NOT_FOUND).send({
                        message: 'No resort found for this user',
                    });
                }

                resortId = resortResult.rows[0].id;
                resortName = resortResult.rows[0].name;
            } else if (userRole === 'agent') {
                // For agents: require resortId and verify assignment
                if (!body.resortId) {
                    return res.status(HttpStatus.BAD_REQUEST).send({
                        message: 'resortId is required for agents',
                    });
                }

                // Verify agent is assigned to this resort
                const assignmentResult = await this.db.query<{ resort_id: string }>(
                    `SELECT resort_id FROM resort_agents 
                     WHERE user_id = $1 AND resort_id = $2 AND status = 'approved'`,
                    [userId, body.resortId],
                );

                if (assignmentResult.rows.length === 0) {
                    return res.status(HttpStatus.FORBIDDEN).send({
                        message: 'You are not assigned to this resort',
                    });
                }

                // Get resort name
                const resortResult = await this.db.query<{ id: string; name: string }>(
                    `SELECT id, name FROM resorts WHERE id = $1`,
                    [body.resortId],
                );

                if (resortResult.rows.length === 0) {
                    return res.status(HttpStatus.NOT_FOUND).send({
                        message: 'Resort not found',
                    });
                }

                resortId = resortResult.rows[0].id;
                resortName = resortResult.rows[0].name;
            } else if (userRole === 'admin') {
                // For admins: allow any resortId
                if (!body.resortId) {
                    return res.status(HttpStatus.BAD_REQUEST).send({
                        message: 'resortId is required for admins',
                    });
                }

                const resortResult = await this.db.query<{ id: string; name: string }>(
                    `SELECT id, name FROM resorts WHERE id = $1`,
                    [body.resortId],
                );

                if (resortResult.rows.length === 0) {
                    return res.status(HttpStatus.NOT_FOUND).send({
                        message: 'Resort not found',
                    });
                }

                resortId = resortResult.rows[0].id;
                resortName = resortResult.rows[0].name;
            } else {
                return res.status(HttpStatus.FORBIDDEN).send({
                    message: 'Unauthorized role',
                });
            }

            // Fetch experiences with images
            const experiencesResult = await this.db.query<{
                id: string;
                title: string;
                category: string;
                description: string;
                allows_children: boolean;
                child_min_age: number;
                child_max_age: number;
                includes: string;
                excludes: string;
                status: string;
                currency: string;
                main_image_url: string;
                price_per_adult_cents: number;
                price_per_child_cents: number;
                commission_per_adult_cents: number;
                commission_per_child_cents: number;
            }>(
                `SELECT 
                    e.id,
                    e.title,
                    e.category,
                    e.description,
                    e.allows_children,
                    e.child_min_age,
                    e.child_max_age,
                    e.includes,
                    e.excludes,
                    e.status,
                    e.currency,
                    (SELECT url FROM experience_images ei WHERE ei.experience_id = e.id ORDER BY sort_order LIMIT 1) as main_image_url,
                    (SELECT price_per_adult_cents FROM availability_slots s WHERE s.experience_id = e.id ORDER BY start_time LIMIT 1) as price_per_adult_cents,
                    (SELECT price_per_child_cents FROM availability_slots s WHERE s.experience_id = e.id ORDER BY start_time LIMIT 1) as price_per_child_cents,
                    (SELECT commission_per_adult_cents FROM availability_slots s WHERE s.experience_id = e.id ORDER BY start_time LIMIT 1) as commission_per_adult_cents,
                    (SELECT commission_per_child_cents FROM availability_slots s WHERE s.experience_id = e.id ORDER BY start_time LIMIT 1) as commission_per_child_cents
                FROM experiences e
                WHERE e.resort_id = $1 AND e.status = 'active'
                ORDER BY e.title`,
                [resortId],
            );

            // Transform to PDF format
            const experiences: ExperienceForPdf[] = experiencesResult.rows.map((exp) => ({
                title: exp.title,
                category: getCategoryName(exp.category),
                image_url: exp.main_image_url || null,
                price_adult: exp.price_per_adult_cents || 0,
                price_child: exp.price_per_child_cents || 0,
                commission_adult: exp.commission_per_adult_cents || 0,
                commission_child: exp.commission_per_child_cents || 0,
                allows_children: exp.allows_children,
                child_age_range: exp.allows_children
                    ? `${exp.child_min_age || 3}-${exp.child_max_age || 12} años`
                    : '',
                status: getStatusName(exp.status),
                includes: exp.includes || '',
                excludes: exp.excludes || '',
                description: exp.description || '',
                currency: exp.currency || 'COP',
            }));

            this.logger.log(`Found ${experiences.length} experiences for resort ${resortName}`);

            // Generate PDF
            const pdfBuffer = await this.pdfService.generateExperiencesCatalog({
                resort_name: resortName,
                experiences,
            });

            // Send PDF response
            const filename = `catalogo-experiencias-${resortName.replace(/\s+/g, '-').toLowerCase()}.pdf`;

            return res
                .header('Content-Type', 'application/pdf')
                .header('Content-Disposition', `attachment; filename="${filename}"`)
                .header('Content-Length', pdfBuffer.length.toString())
                .send(pdfBuffer);
        } catch (error) {
            this.logger.error(`Failed to export experiences: ${(error as Error).message}`, (error as Error).stack);
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
                message: 'Failed to generate PDF',
                error: (error as Error).message,
            });
        }
    }
}
