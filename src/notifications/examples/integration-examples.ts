/**
 * Ejemplos de integración del sistema de notificaciones
 * con otros módulos de LIVEX
 */

import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { NotificationService } from '../services/notification.service';
import {
    BookingConfirmedEvent,
    PaymentConfirmedEvent,
    UserRegisteredEvent,
    ResortApprovedEvent,
    NotificationEvent,
} from '../events/notification.events';

@Injectable()
export class IntegrationExamples {
    constructor(
        private readonly notificationService: NotificationService,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    /**
     * Ejemplo 1: Integración en el módulo de Auth
     * Cuando un usuario se registra, enviar email de bienvenida
     */
    onUserRegistered(userId: string, email: string, name: string, role: string) {
        // Opción A: Usando eventos (recomendado)
        this.eventEmitter.emit('user.registered', new UserRegisteredEvent(
            userId,
            email,
            name,
            role,
        ));

        // Opción B: Llamada directa al servicio
        this.notificationService.sendWelcomeEmail(email, { userName: name });
    }

    /**
     * Ejemplo 2: Integración en el módulo de Bookings
     * Cuando se confirma una reserva
     */
    onBookingConfirmed(bookingData: {
        id: string;
        customerEmail: string;
        customerName: string;
        experienceName: string;
        date: string;
        time: string;
        guestCount: number;
        totalAmount: number;
        code: string;
        resortEmail?: string;
        resortName?: string;
        resortNetAmount?: number;
        commissionAmount?: number;
        childrenCount?: number;
        location?: string;
    }) {
        // Emitir evento para notificación inmediata
        this.eventEmitter.emit('booking.confirmed', new BookingConfirmedEvent(
            bookingData.id,
            bookingData.customerEmail,
            bookingData.customerName,
            bookingData.experienceName,
            bookingData.date,
            bookingData.time,
            bookingData.guestCount,
            bookingData.totalAmount,
            bookingData.code,
            bookingData.resortEmail || '',
            bookingData.resortName || '',
            bookingData.resortNetAmount || 0,
            bookingData.commissionAmount || 0,
            bookingData.childrenCount || 0,
            bookingData.location || '',
        ));

        // Programar recordatorio 24 horas antes
        const reminderDate = new Date(bookingData.date);
        reminderDate.setDate(reminderDate.getDate() - 1);

        if (reminderDate > new Date()) {
            this.notificationService.sendBookingReminder(
                bookingData.customerEmail,
                {
                    customerName: bookingData.customerName,
                    experienceName: bookingData.experienceName,
                    bookingDate: bookingData.date,
                    bookingTime: bookingData.time,
                    location: 'Ubicación de la experiencia', // Obtener de la experiencia
                    bookingCode: bookingData.code,
                },
                reminderDate
            );
        }
    }

    /**
     * Ejemplo 3: Integración en el módulo de Payments
     * Cuando se procesa un pago
     */
    onPaymentProcessed(paymentData: {
        id: string;
        bookingId: string;
        customerEmail: string;
        customerName: string;
        commissionAmount: number;
        resortNetAmount: number;
        bookingCode: string;
        status: 'success' | 'failed';
        errorReason?: string;
        experienceName: string;
        bookingDate: string;
        bookingTime: string;
        guestCount: number;
        resortName: string;
        location: string;
    }) {
        if (paymentData.status === 'success') {
            this.eventEmitter.emit('payment.confirmed', new PaymentConfirmedEvent(
                paymentData.id,
                paymentData.bookingId,
                paymentData.customerEmail,
                paymentData.customerName,
                paymentData.commissionAmount,
                paymentData.resortNetAmount,
                paymentData.bookingCode,
                paymentData.experienceName,
                paymentData.bookingDate,
                paymentData.bookingTime,
                paymentData.guestCount,
                paymentData.resortName,
                paymentData.location,
            ));
        } else {
            this.eventEmitter.emit('payment.failed', {
                paymentId: paymentData.id,
                bookingId: paymentData.bookingId,
                customerEmail: paymentData.customerEmail,
                customerName: paymentData.customerName,
                bookingCode: paymentData.bookingCode,
                reason: paymentData.errorReason,
            });
        }
    }

    /**
     * Ejemplo 4: Integración en el módulo de Admin
     * Cuando se aprueba un prestador
     */
    onResortStatusChanged(resortData: {
        id: string;
        email: string;
        name: string;
        status: 'approved' | 'rejected';
        resortName: string;
        rejectionReason?: string;
    }) {
        if (resortData.status === 'approved') {
            this.eventEmitter.emit('resort.approved', new ResortApprovedEvent(
                resortData.id,
                resortData.email,
                resortData.name,
                resortData.resortName,
            ));
        } else {
            this.eventEmitter.emit('resort.rejected', {
                resortId: resortData.id,
                resortEmail: resortData.email,
                resortName: resortData.name,
                rejectionReason: resortData.rejectionReason || 'No especificado',
            });
        }
    }

    /**
     * Ejemplo 5: Notificaciones programadas
     * Recordatorios automáticos basados en fechas
     */
    scheduleBookingReminders(bookings: Array<{
        id: string;
        customerEmail: string;
        customerName: string;
        experienceName: string;
        date: string;
        time: string;
        location: string;
        code: string;
    }>) {
        for (const booking of bookings) {
            const bookingDate = new Date(booking.date);

            // Recordatorio 24 horas antes
            const reminder24h = new Date(bookingDate);
            reminder24h.setHours(reminder24h.getHours() - 24);

            if (reminder24h > new Date()) {
                this.notificationService.sendBookingReminder(
                    booking.customerEmail,
                    {
                        customerName: booking.customerName,
                        experienceName: booking.experienceName,
                        bookingDate: booking.date,
                        bookingTime: booking.time,
                        location: booking.location,
                        bookingCode: booking.code,
                    },
                    reminder24h
                );
            }

            // Recordatorio 2 horas antes
            const reminder2h = new Date(bookingDate);
            reminder2h.setHours(reminder2h.getHours() - 2);

            if (reminder2h > new Date()) {
                this.notificationService.sendBookingReminder(
                    booking.customerEmail,
                    {
                        customerName: booking.customerName,
                        experienceName: booking.experienceName,
                        bookingDate: booking.date,
                        bookingTime: booking.time,
                        location: booking.location,
                        bookingCode: booking.code,
                    },
                    reminder2h
                );
            }
        }
    }

    /**
     * Ejemplo 6: Notificaciones en lote
     * Para campañas o notificaciones masivas
     */
    sendBulkNotifications(recipients: Array<{
        email: string;
        name: string;
        data: Record<string, any>;
    }>, templateType: string) {
        let successful = 0;
        let failed = 0;

        for (const recipient of recipients) {
            try {
                this.notificationService.sendEmailNotification(
                    recipient.email,
                    templateType as any,
                    {
                        userName: recipient.name,
                        ...recipient.data,
                    },
                    { priority: 'low' } // Baja prioridad para envíos masivos
                );

                successful++;
            } catch (error: unknown) {
                failed++;
                console.error('Failed to queue bulk notification:', {
                    email: recipient.email,
                    templateType,
                    error: error instanceof Error ? error.message : error,
                });
            }
        }

        console.log(`Bulk notifications: ${successful} sent, ${failed} failed`);

        return { successful, failed };
    }

    /**
     * Ejemplo 7: Manejo de errores y reintentos
     * Cómo manejar fallos en el envío
     */
    async sendCriticalNotification(
        email: string,
        templateType: string,
        data: Record<string, any>
    ) {
        try {
            // Intentar envío síncrono primero para notificaciones críticas
            const success = await this.notificationService.sendEmailNotificationSync(
                email,
                templateType as any,
                data
            );

            if (!success) {
                // Si falla, encolar con alta prioridad
                this.notificationService.sendEmailNotification(
                    email,
                    templateType as any,
                    data,
                    { priority: 'high' }
                );
            }
        } catch (error) {
            console.error('Failed to send critical notification:', error);

            // Como último recurso, encolar con alta prioridad
            this.notificationService.sendEmailNotification(
                email,
                templateType as any,
                data,
                { priority: 'high' }
            );
        }
    }
}

/**
 * Ejemplo de uso en un controlador
 */
export class BookingController {
    constructor(
        private readonly integrationExamples: IntegrationExamples
    ) { }

    confirmBooking(bookingId: string) {
        // ... lógica de confirmación de reserva ...

        const bookingData = {
            id: bookingId,
            customerEmail: 'customer@example.com',
            customerName: 'Juan Pérez',
            experienceName: 'Tour en Kayak',
            date: '2024-01-15',
            time: '10:00 AM',
            guestCount: 2,
            totalAmount: 150000,
            code: 'LVX-001',
        };

        // Enviar notificación de confirmación
        this.integrationExamples.onBookingConfirmed(bookingData);

        return { success: true, booking: bookingData };
    }
}

/**
 * Ejemplo de middleware para notificaciones automáticas
 */
// Interface para definir la estructura de datos que puede contener eventos
interface EventResponse {
    eventType?: string;
    eventData?: NotificationEvent;
    [key: string]: unknown;
}

@Injectable()
export class NotificationMiddleware implements NestInterceptor {
    constructor(private readonly eventEmitter: EventEmitter2) { }

    // Interceptor que puede capturar eventos del sistema
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        return next.handle().pipe(
            tap((data: unknown) => {
                // Type guard para verificar si la respuesta contiene eventos
                if (this.isEventResponse(data)) {
                    if (data.eventType && data.eventData) {
                        this.eventEmitter.emit(data.eventType, data.eventData);
                    }
                }
            })
        );
    }

    private isEventResponse(data: unknown): data is EventResponse {
        return (
            typeof data === 'object' &&
            data !== null &&
            ('eventType' in data || 'eventData' in data)
        );
    }
}
