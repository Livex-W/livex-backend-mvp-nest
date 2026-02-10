import { Module } from '@nestjs/common';
import { AVAILABILITY_SLOT_REPOSITORY } from './domain/repositories/availability-slot.repository.interface';
import { AvailabilitySlotRepository } from './infrastructure/persistence/availability-slot.repository';

@Module({
    providers: [
        {
            provide: AVAILABILITY_SLOT_REPOSITORY,
            useClass: AvailabilitySlotRepository,
        },
    ],
    exports: [AVAILABILITY_SLOT_REPOSITORY],
})
export class AvailabilityDddModule { }
