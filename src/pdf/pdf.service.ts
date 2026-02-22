import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';

export interface ExperienceForPdf {
    title: string;
    category: string;
    image_url: string | null;
    price_adult: number;
    price_child: number;
    commission_adult: number;
    commission_child: number;
    allows_children: boolean;
    child_age_range: string;
    status: string;
    includes: string;
    excludes: string;
    description: string;
    currency: string;
}

export interface GenerateCatalogRequest {
    resort_name: string;
    generated_at?: string;
    experiences: ExperienceForPdf[];
}

@Injectable()
export class PdfService {
    private readonly logger = new Logger(PdfService.name);
    private readonly pdfServiceUrl: string;

    constructor() {
        this.pdfServiceUrl = process.env.PDF_SERVICE_URL || 'http://livex_pdf_service:8090';
    }

    async generateExperiencesCatalog(request: GenerateCatalogRequest): Promise<Buffer> {
        try {
            this.logger.log(`Generating PDF for resort: ${request.resort_name} with ${request.experiences.length} experiences`);

            // Set default generated_at if not provided
            if (!request.generated_at) {
                request.generated_at = new Date().toLocaleDateString('es-CO', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                });
            }

            const response = await axios.post(
                `${this.pdfServiceUrl}/api/v1/pdf/experiences`,
                request,
                {
                    responseType: 'arraybuffer',
                    timeout: 60000, // 60 seconds for image downloads
                    headers: {
                        'Content-Type': 'application/json',
                    },
                },
            );

            this.logger.log(`PDF generated successfully, size: ${response.data.length} bytes`);
            return Buffer.from(response.data);
        } catch (error) {
            this.logger.error(`Failed to generate PDF: ${error.message}`, error.stack);

            if (axios.isAxiosError(error)) {
                if (error.code === 'ECONNREFUSED') {
                    throw new HttpException(
                        'PDF service is not available',
                        HttpStatus.SERVICE_UNAVAILABLE,
                    );
                }
            }

            throw new HttpException(
                'Failed to generate PDF',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}
