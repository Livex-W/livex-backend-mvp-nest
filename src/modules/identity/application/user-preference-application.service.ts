import { Injectable, Inject, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import type { IUserPreferenceRepository } from '../domain/repositories/user-preference.repository.interface';
import { USER_PREFERENCE_REPOSITORY } from '../domain/repositories/user-preference.repository.interface';
import { UserPreference } from '../domain/entities/user-preference.entity';
import { randomUUID } from 'crypto';

export interface CreatePreferenceDto {
    language?: string;
    currency?: string;
}

export interface UpdatePreferenceDto {
    language?: string;
    currency?: string;
}

export interface UserPreferenceResponse {
    userId: string;
    language: string;
    currency: string;
    createdAt: Date;
    updatedAt: Date;
}

@Injectable()
export class UserPreferenceApplicationService {
    private readonly logger = new Logger(UserPreferenceApplicationService.name);

    constructor(
        @Inject(USER_PREFERENCE_REPOSITORY)
        private readonly preferenceRepository: IUserPreferenceRepository,
    ) { }

    async create(userId: string, dto: CreatePreferenceDto): Promise<UserPreferenceResponse> {
        // Check if already exists
        const existing = await this.preferenceRepository.findByUserId(userId);
        if (existing) {
            throw new ConflictException('User preferences already exist. Use PUT to update.');
        }

        const preference = UserPreference.create({
            id: randomUUID(),
            userId,
            language: dto.language,
            currency: dto.currency,
        });

        await this.preferenceRepository.save(preference);
        this.logger.log(`Created preferences for user ${userId}`);

        return this.toResponse(preference);
    }

    async update(userId: string, dto: UpdatePreferenceDto): Promise<UserPreferenceResponse> {
        const preference = await this.preferenceRepository.findByUserId(userId);
        if (!preference) {
            throw new NotFoundException('User preferences not found. Use POST to create.');
        }

        if (dto.language !== undefined) {
            preference.updateLanguage(dto.language);
        }
        if (dto.currency !== undefined) {
            preference.updateCurrency(dto.currency);
        }

        await this.preferenceRepository.save(preference);
        this.logger.log(`Updated preferences for user ${userId}`);

        return this.toResponse(preference);
    }

    async getOrCreateDefault(userId: string): Promise<UserPreferenceResponse> {
        const preference = await this.preferenceRepository.findByUserId(userId);

        if (preference) {
            return this.toResponse(preference);
        }

        // Return default without persisting
        const defaultPreference = UserPreference.createDefault(userId);
        return this.toResponse(defaultPreference);
    }

    async findByUserId(userId: string): Promise<UserPreferenceResponse> {
        const preference = await this.preferenceRepository.findByUserId(userId);
        if (!preference) {
            throw new NotFoundException('User preferences not found');
        }
        return this.toResponse(preference);
    }

    private toResponse(preference: UserPreference): UserPreferenceResponse {
        return {
            userId: preference.userId,
            language: preference.language,
            currency: preference.currency,
            createdAt: preference.createdAt,
            updatedAt: preference.updatedAt,
        };
    }
}
