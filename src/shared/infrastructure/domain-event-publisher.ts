import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DomainEvent } from '../domain/base/domain-event.base';
import { AggregateRoot } from '../domain/base/aggregate-root.base';

/**
 * Domain Event Publisher
 * Centralizes the publishing of domain events from aggregates.
 */
@Injectable()
export class DomainEventPublisher {
    constructor(private readonly eventEmitter: EventEmitter2) { }

    /**
     * Publish all pending domain events from an aggregate.
     */
    publishEventsFromAggregate<T extends object>(aggregate: AggregateRoot<T>): void {
        for (const event of aggregate.domainEvents) {
            this.publish(event);
        }
        aggregate.clearDomainEvents();
    }

    /**
     * Publish a single domain event.
     */
    publish(event: DomainEvent): void {
        this.eventEmitter.emit(event.eventName, event.toPayload());
    }

    /**
     * Publish multiple domain events.
     */
    publishAll(events: DomainEvent[]): void {
        for (const event of events) {
            this.publish(event);
        }
    }

    /**
     * Publish event asynchronously (for non-blocking scenarios).
     */
    async publishAsync(event: DomainEvent): Promise<void> {
        await this.eventEmitter.emitAsync(event.eventName, event.toPayload());
    }
}
