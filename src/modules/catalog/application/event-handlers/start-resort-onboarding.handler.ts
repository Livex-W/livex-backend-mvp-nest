import { Injectable, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { UserRegisteredEvent } from '../../../identity/domain/events/user-registered.event';
import { Resort } from '../../domain/aggregates/resort.aggregate';
import { RESORT_REPOSITORY } from '../../domain/repositories/resort.repository.interface';
import type { IResortRepository } from '../../domain/repositories/resort.repository.interface';
import { CustomLoggerService } from '../../../../common/services/logger.service';

/**
 * Handles the UserRegisteredEvent to automatically create a resort
 * when a user registers with role 'resort'.
 * 
 * This follows DDD principles where the catalog module reacts to
 * events from the identity module without coupling them directly.
 */
@Injectable()
export class StartResortOnboardingHandler {
    constructor(
        @Inject(RESORT_REPOSITORY) private readonly resortRepository: IResortRepository,
        private readonly logger: CustomLoggerService,
    ) { }

    @OnEvent('user.registered', { async: true })
    async handle(event: UserRegisteredEvent): Promise<void> {
        console.log('[StartResortOnboardingHandler] EVENT RECEIVED', event);

        // Only process if the user registered as a resort
        if (event.role !== 'resort') {
            console.log('[StartResortOnboardingHandler] Not a resort role, skipping. Role:', event.role);
            return;
        }

        this.logger.log(`[StartResortOnboardingHandler] Processing resort onboarding for user ${event.userId}`);

        try {
            // Check if resort already exists for this owner
            const existingResort = await this.resortRepository.findByOwnerId(event.userId);
            if (existingResort) {
                this.logger.warn(`[StartResortOnboardingHandler] Resort already exists for user ${event.userId}`);
                return;
            }

            // Create the resort with minimal data
            // The resort owner can complete the details later via the dashboard
            const resort = Resort.create({
                ownerId: event.userId,
                name: event.fullName || 'Mi Resort',
                email: event.email,
                phone: event.phone,
                taxId: event.nit,
                businessName: event.fullName,
            });

            await this.resortRepository.save(resort);

            this.logger.logBusinessEvent('resort_auto_created_on_registration', {
                userId: event.userId,
                resortId: resort.id,
                resortName: resort.name,
            });

        } catch (error) {
            // Log the error but don't fail the registration
            // The user can create the resort manually later
            this.logger.error(
                `[StartResortOnboardingHandler] Failed to auto-create resort for user`,
                (error as Error).stack,
            );
            this.logger.logSecurityEvent('resort_auto_creation_failed', {
                userId: event.userId,
                email: event.email,
                error: (error as Error).message,
            });
        }
    }
}
