import { IsString, IsBoolean, IsOptional, IsNumber, IsUUID, IsArray, ValidateNested, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

// Document types matching schema enum
export type ResortDocType = 'camara_comercio' | 'rut_nit' | 'rnt' | 'other';
export type DocumentStatus = 'uploaded' | 'under_review' | 'approved' | 'rejected';
export type ResortStatus = 'draft' | 'under_review' | 'approved' | 'rejected';

export class ResortDocumentDto {
    @IsUUID()
    id: string;

    @IsString()
    doc_type: ResortDocType;

    @IsString()
    file_url: string;

    @IsString()
    status: DocumentStatus;

    @IsOptional()
    @IsString()
    rejection_reason?: string;

    @IsOptional()
    @IsDateString()
    reviewed_at?: string;

    @IsDateString()
    uploaded_at: string;

    @IsDateString()
    created_at: string;

    @IsDateString()
    updated_at: string;
}

export class ResortAgentDto {
    @IsUUID()
    id: string;

    @IsOptional()
    @IsUUID()
    resort_id?: string;

    @IsUUID()
    user_id: string;

    @IsNumber()
    commission_bps: number;

    @IsBoolean()
    is_active: boolean;

    // User info joined from users table
    @IsOptional()
    @IsString()
    agent_email?: string;

    @IsOptional()
    @IsString()
    agent_name?: string;

    @IsDateString()
    created_at: string;

    @IsDateString()
    updated_at: string;
}

export class ResortProfileDto {
    // Core resort info
    @IsUUID()
    id: string;

    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    website?: string;

    @IsOptional()
    @IsString()
    contact_email?: string;

    @IsOptional()
    @IsString()
    contact_phone?: string;

    @IsOptional()
    @IsString()
    address_line?: string;

    @IsOptional()
    @IsString()
    city?: string;

    @IsOptional()
    @IsString()
    country?: string;

    @IsOptional()
    @IsNumber()
    latitude?: number;

    @IsOptional()
    @IsNumber()
    longitude?: number;

    @IsOptional()
    @IsString()
    nit?: string;

    @IsOptional()
    @IsString()
    rnt?: string;

    @IsUUID()
    owner_user_id: string;

    @IsBoolean()
    is_active: boolean;

    @IsString()
    status: ResortStatus;

    @IsOptional()
    @IsUUID()
    approved_by?: string;

    @IsOptional()
    @IsDateString()
    approved_at?: string;

    @IsOptional()
    @IsString()
    rejection_reason?: string;

    @IsDateString()
    created_at: string;

    @IsDateString()
    updated_at: string;

    // Related data
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ResortDocumentDto)
    documents: ResortDocumentDto[];

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ResortAgentDto)
    agents: ResortAgentDto[];
}
