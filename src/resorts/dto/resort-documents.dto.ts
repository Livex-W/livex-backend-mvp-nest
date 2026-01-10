import { IsString, IsEnum, IsUrl, IsOptional, IsUUID } from 'class-validator';

// Document types matching schema enum
export type ResortDocType = 'national_id' | 'tax_id' | 'license' | 'insurance' | 'bank_cert' | 'other';

export class CreateResortDocumentDto {
    @IsEnum(['national_id', 'tax_id', 'license', 'insurance', 'bank_cert', 'other'])
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
