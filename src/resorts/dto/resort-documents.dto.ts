import { IsString, IsEnum, IsUrl, IsOptional, IsUUID } from 'class-validator';

// Document types matching schema enum
export type ResortDocType = 'camara_comercio' | 'rut_nit' | 'rnt' | 'other';

export class CreateResortDocumentDto {
    @IsEnum(['camara_comercio', 'rut_nit', 'rnt', 'other'])
    doc_type: ResortDocType;

    @IsUrl()
    file_url: string;
}

export class UpdateResortDocumentDto {
    @IsOptional()
    @IsUrl()
    file_url?: string;
}

export class ResortDocumentResponseDto {
    @IsUUID()
    id: string;

    @IsString()
    doc_type: ResortDocType;

    @IsString()
    file_url: string;

    @IsString()
    status: string;

    @IsOptional()
    @IsString()
    rejection_reason?: string;

    @IsOptional()
    @IsString()
    reviewed_at?: string;

    @IsString()
    uploaded_at: string;

    @IsString()
    created_at: string;

    @IsString()
    updated_at: string;
}
