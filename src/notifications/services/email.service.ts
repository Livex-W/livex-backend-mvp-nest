import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import {
  EmailTemplate,
  EmailTemplateType,
  EmailNotification,
  EmailTemplateData,
} from '../interfaces/email-template.interface';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter<SMTPTransport.SentMessageInfo>;
  private templateCache = new Map<string, handlebars.TemplateDelegate>();

  constructor() {
    this.initializeTransporter();
    this.preloadTemplates();
  }

  private initializeTransporter() {
    const isDevelopment = process.env.NODE_ENV !== 'production';

    if (isDevelopment) {
      // Para desarrollo, usar Mailhog o similar
      const devOptions: SMTPTransport.Options = {
        host: process.env.SMTP_HOST || 'localhost',
        port: parseInt(process.env.SMTP_PORT || '1025'),
        secure: false,
        ignoreTLS: true,
      };

      this.transporter = nodemailer.createTransport<SMTPTransport.SentMessageInfo>(devOptions);
    } else {
      // Para producción, configurar SMTP real
      const prodOptions: SMTPTransport.Options = {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      };

      this.transporter = nodemailer.createTransport<SMTPTransport.SentMessageInfo>(prodOptions);
    }

    this.logger.log('Email transporter initialized');
  }

  private preloadTemplates() {
    try {
      const templatesDir = path.join(__dirname, '..', 'templates');

      // Verificar si el directorio existe
      if (!fs.existsSync(templatesDir)) {
        this.logger.warn(`Templates directory not found: ${templatesDir}`);
        return;
      }

      const templateFiles = fs.readdirSync(templatesDir);

      for (const file of templateFiles) {
        if (file.endsWith('.hbs')) {
          const templateName = file.replace('.hbs', '');
          const templatePath = path.join(templatesDir, file);
          const templateContent = fs.readFileSync(templatePath, 'utf-8');
          const compiledTemplate = handlebars.compile(templateContent);

          this.templateCache.set(templateName, compiledTemplate);
          this.logger.debug(`Template loaded: ${templateName}`);
        }
      }

      this.logger.log(`Loaded ${this.templateCache.size} email templates`);
    } catch (error) {
      this.logger.error('Error loading email templates:', error);
    }
  }

  async sendEmail(notification: EmailNotification): Promise<boolean> {
    try {
      const template = this.getTemplate(
        notification.templateType,
        notification.templateData,
        notification.language,
      );

      if (!template) {
        this.logger.error(`Template not found: ${notification.templateType}`);
        return false;
      }

      const mailOptions: nodemailer.SendMailOptions = {
        from: process.env.SMTP_FROM || 'noreply@livex.com',
        to: notification.to,
        subject: template.subject,
        html: template.html,
        text: template.text,
      };

      const result: SMTPTransport.SentMessageInfo = await this.transporter.sendMail(mailOptions);

      this.logger.log(`Email sent successfully to ${notification.to}`, {
        messageId: result.messageId,
        templateType: notification.templateType,
      });

      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${notification.to}:`, error);
      return false;
    }
  }

  private getTemplate(
    templateType: EmailTemplateType,
    templateData: EmailTemplateData,
    language: string = 'es'
  ): EmailTemplate | null {
    const compiledTemplate = this.resolveTemplateDelegate(templateType, language);
    const defaults = this.getDefaultTemplate(templateType);

    if (!compiledTemplate && !defaults) {
      return null;
    }

    const html = compiledTemplate
      ? compiledTemplate(templateData)
      : this.compileTemplateString(defaults.html, templateData);

    const text = defaults.text
      ? this.compileTemplateString(defaults.text, templateData)
      : undefined;

    return {
      subject: defaults.subject,
      html,
      text,
    };
  }

  private resolveTemplateDelegate(
    templateType: EmailTemplateType,
    language: string,
  ): handlebars.TemplateDelegate | undefined {
    const templateKey = `${templateType}_${language}`;
    const fallbackKey = `${templateType}_es`;

    let compiledTemplate = this.templateCache.get(templateKey);

    if (!compiledTemplate) {
      compiledTemplate = this.loadTemplateFromFile(templateType, language);
    }

    if (!compiledTemplate && language !== 'es') {
      compiledTemplate =
        this.templateCache.get(fallbackKey) ||
        this.loadTemplateFromFile(templateType, 'es');
    }

    return compiledTemplate;
  }

  private compileTemplateString(
    templateContent: string,
    data: EmailTemplateData,
  ): string {
    return handlebars.compile(templateContent)(data);
  }

  private loadTemplateFromFile(
    templateType: EmailTemplateType,
    language: string
  ): handlebars.TemplateDelegate | undefined {
    try {
      const templatePath = path.join(
        __dirname,
        '..',
        'templates',
        `${templateType}_${language}.hbs`
      );

      if (fs.existsSync(templatePath)) {
        const templateContent = fs.readFileSync(templatePath, 'utf-8');
        const compiledTemplate = handlebars.compile(templateContent);

        // Guardar en caché
        this.templateCache.set(`${templateType}_${language}`, compiledTemplate);

        return compiledTemplate;
      }
    } catch (error) {
      this.logger.error(`Error loading template file: ${templateType}_${language}`, error);
    }

    return undefined;
  }

  private getDefaultTemplate(templateType: EmailTemplateType): EmailTemplate {
    const templates: Record<EmailTemplateType, EmailTemplate> = {
      [EmailTemplateType.BOOKING_CONFIRMATION]: {
        subject: '✅ Confirmación de Reserva - LIVEX',
        html: `
          <h2>¡Tu reserva ha sido confirmada!</h2>
          <p>Hola {{customerName}},</p>
          <p>Tu reserva para <strong>{{experienceName}}</strong> ha sido confirmada.</p>
          <ul>
            <li><strong>Fecha:</strong> {{bookingDate}}</li>
            <li><strong>Hora:</strong> {{bookingTime}}</li>
            <li><strong>Personas:</strong> {{guestCount}}</li>
          </ul>
          <p>Código de reserva: <strong>{{bookingCode}}</strong></p>
          <p>¡Esperamos que disfrutes tu experiencia!</p>
        `,
        text: 'Tu reserva para {{experienceName}} ha sido confirmada. Código: {{bookingCode}}'
      },
      [EmailTemplateType.BOOKING_REMINDER]: {
        subject: '⏰ Recordatorio de tu experiencia - LIVEX',
        html: `
          <h2>¡Tu experiencia es mañana!</h2>
          <p>Hola {{customerName}},</p>
          <p>Te recordamos que tienes una experiencia programada:</p>
          <ul>
            <li><strong>Experiencia:</strong> {{experienceName}}</li>
            <li><strong>Fecha:</strong> {{bookingDate}}</li>
            <li><strong>Hora:</strong> {{bookingTime}}</li>
            <li><strong>Ubicación:</strong> {{location}}</li>
          </ul>
          <p>Código de reserva: <strong>{{bookingCode}}</strong></p>
        `,
        text: 'Recordatorio: Tu experiencia {{experienceName}} es mañana a las {{bookingTime}}'
      },
      [EmailTemplateType.BOOKING_CANCELLED]: {
        subject: '❌ Reserva Cancelada - LIVEX',
        html: `
          <h2>Tu reserva ha sido cancelada</h2>
          <p>Hola {{customerName}},</p>
          <p>Tu reserva para <strong>{{experienceName}}</strong> ha sido cancelada.</p>
          <p>Código de reserva: <strong>{{bookingCode}}</strong></p>
          {{#if refundAmount}}
          <p>Se procesará un reembolso de $\{{ refundAmount }} en los próximos días hábiles.</p>
          {{/if}}
        `,
        text: 'Tu reserva {{bookingCode}} ha sido cancelada.'
      },
      [EmailTemplateType.BOOKING_CANCELLED_RESORT]: {
        subject: '❌ Reserva Cancelada - LIVEX',
        html: `
          <h2>Reserva Cancelada</h2>
          <p>Hola {{resortName}},</p>
          <p>La reserva para la experiencia <strong>{{experienceName}}</strong> ha sido cancelada.</p>
          <ul>
            <li><strong>Cliente:</strong> {{customerName}}</li>
            <li><strong>Fecha reservada:</strong> {{bookingDate}}</li>
          </ul>
          <p>Código de reserva: <strong>{{bookingCode}}</strong></p>
          <p>El cupo ha sido liberado automáticamente.</p>
        `,
        text: 'Reserva cancelada: {{experienceName}} por {{customerName}}. Código: {{bookingCode}}'
      },
      [EmailTemplateType.BOOKING_CANCELLED_ADMIN_PAYPAL]: {
        subject: '🔔 [ADMIN] Reserva Cancelada',
        html: `
          <h2>Reserva Cancelada</h2>
          <ul>
            <li><strong>Resort:</strong> {{resortName}}</li>
            <li><strong>Experiencia:</strong> {{experienceName}}</li>
            <li><strong>Cliente:</strong> {{customerName}}</li>
            <li><strong>Email del cliente:</strong> {{customerEmail}}</li>
            <li><strong>Código:</strong> {{bookingCode}}</li>
          </ul>
          {{#if refundAmount}}
          <p>Reembolso pendiente/procesado: $\{{ refundAmount }}</p>
          {{/if}}
        `,
        text: 'Reserva cancelada {{bookingCode}}. Resort: {{resortName}}'
      },

      [EmailTemplateType.BOOKING_CANCELLED_ADMIN_WOMPI]: {
        subject: '🔔 [ADMIN] Reserva Cancelada',
        html: `
          <h2>Reserva Cancelada</h2>
          <ul>
            <li><strong>Resort:</strong> {{resortName}}</li>
            <li><strong>Experiencia:</strong> {{experienceName}}</li>
            <li><strong>Cliente:</strong> {{customerName}}</li>
            <li><strong>Email del cliente:</strong> {{customerEmail}}</li>
            <li><strong>Código:</strong> {{bookingCode}}</li>
          </ul>
          {{#if refundAmount}}
          <p>Reembolso pendiente: $\{{ refundAmount }}</p>
          <p>Se debe contactar con el cliente para realizar el reembolso.</p>
          {{/if}}
        `,
        text: 'Reserva cancelada {{bookingCode}}. Resort: {{resortName}}'
      },

      [EmailTemplateType.PAYMENT_CONFIRMED]: {
        subject: '💳 Pago Confirmado - LIVEX',
        html: `
          <h2>¡Pago confirmado!</h2>
          <p>Hola {{customerName}},</p>
          <p>Hemos recibido tu pago de $\{{ commissionAmount }} para la reserva {{bookingCode}}.</p>
          <p>Tu experiencia está confirmada.</p>
        `,
        text: 'Pago de ${{commissionAmount}} confirmado para reserva {{bookingCode}}'
      },
      [EmailTemplateType.PAYMENT_FAILED]: {
        subject: '⚠️ Error en el Pago - LIVEX',
        html: `
          <h2>Error en el procesamiento del pago</h2>
          <p>Hola {{customerName}},</p>
          <p>No pudimos procesar el pago para tu reserva {{bookingCode}}.</p>
          <p>Por favor, intenta nuevamente o contacta con soporte.</p>
        `,
        text: 'Error en el pago para reserva {{bookingCode}}. Intenta nuevamente.'
      },
      [EmailTemplateType.REFUND_PROCESSED_PAYPAL]: {
        subject: '💰 Reembolso Procesado - LIVEX',
        html: `
          <h2>Reembolso procesado</h2>
          <p>Hola {{customerName}},</p>
          <p>Se ha procesado un reembolso de $\{{ refundAmount }} para tu reserva {{bookingCode}}.</p>
          <p>El dinero aparecerá en tu cuenta en 3-5 días hábiles.</p>
        `,
        text: 'Reembolso de ${{refundAmount}} procesado para reserva {{bookingCode}}'
      },
      [EmailTemplateType.REFUND_PROCESSED_WOMPI]: {
        subject: '💰 Reembolso Procesado - LIVEX',
        html: `
          <h2>Reembolso procesado</h2>
          <p>Hola {{customerName}},</p>
          <p>Has procesado un reembolso de $\{{ refundAmount }} para tu reserva {{bookingCode}}.</p>
          <p>El equipo de LIVEX se pondrá en contacto contigo para la realizacion del reembolso.</p>
        `,
        text: 'Reembolso de ${{refundAmount}} procesado para reserva {{bookingCode}}'
      },
      [EmailTemplateType.RESORT_APPROVED]: {
        subject: '🎉 ¡Prestador Aprobado! - LIVEX',
        html: `
          <h2>¡Felicitaciones!</h2>
          <p>Hola {{resortName}},</p>
          <p>Tu solicitud como prestador ha sido <strong>aprobada</strong>.</p>
          <p>Ya puedes comenzar a publicar tus experiencias en LIVEX.</p>
        `,
        text: 'Tu solicitud como prestador ha sido aprobada. ¡Bienvenido a LIVEX!'
      },
      [EmailTemplateType.RESORT_REJECTED]: {
        subject: '❌ Solicitud de Prestador - LIVEX',
        html: `
          <h2>Solicitud no aprobada</h2>
          <p>Hola {{resortName}},</p>
          <p>Lamentamos informarte que tu solicitud como prestador no ha sido aprobada.</p>
          <p><strong>Motivo:</strong> {{rejectionReason}}</p>
          <p>Puedes contactar con soporte para más información.</p>
        `,
        text: 'Tu solicitud como prestador no fue aprobada. Motivo: {{rejectionReason}}'
      },
      [EmailTemplateType.EXPERIENCE_APPROVED]: {
        subject: '✅ Experiencia Aprobada - LIVEX',
        html: `
          <h2>¡Experiencia aprobada!</h2>
          <p>Hola {{resortName}},</p>
          <p>Tu experiencia <strong>{{experienceName}}</strong> ha sido aprobada y ya está visible para los usuarios.</p>
        `,
        text: 'Tu experiencia {{experienceName}} ha sido aprobada'
      },
      [EmailTemplateType.EXPERIENCE_REJECTED]: {
        subject: '❌ Experiencia Rechazada - LIVEX',
        html: `
          <h2>Experiencia no aprobada</h2>
          <p>Hola {{resortName}},</p>
          <p>Tu experiencia <strong>{{experienceName}}</strong> no ha sido aprobada.</p>
          <p><strong>Motivo:</strong> {{rejectionReason}}</p>
        `,
        text: 'Tu experiencia {{experienceName}} no fue aprobada. Motivo: {{rejectionReason}}'
      },
      [EmailTemplateType.WELCOME]: {
        subject: '🎉 ¡Bienvenido a LIVEX!',
        html: `
          <h2>¡Bienvenido a LIVEX!</h2>
          <p>Hola {{userName}},</p>
          <p>Gracias por registrarte en LIVEX. ¡Estamos emocionados de tenerte con nosotros!</p>
          <p>Explora experiencias únicas y crea recuerdos inolvidables.</p>
        `,
        text: '¡Bienvenido a LIVEX! Gracias por registrarte, {{userName}}'
      },
      [EmailTemplateType.PASSWORD_RESET]: {
        subject: '🔑 Restablecer Contraseña - LIVEX',
        html: `
          <h2>Restablecer contraseña</h2>
          <p>Hola {{userName}},</p>
          <p>Recibimos una solicitud para restablecer tu contraseña.</p>
          <p>Tu código de verificación es:</p>
          <div style="background: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; border-radius: 5px; margin: 20px 0;">
            {{token}}
          </div>
          <p>Este código expira en 1 hora.</p>
          <p>Si no solicitaste este cambio, ignora este email.</p>
        `,
        text: 'Tu código para restablecer contraseña es: {{token}}'
      },
      [EmailTemplateType.RESORT_CREATED_ADMIN]: {
        subject: '🏨 Nuevo Prestador Pendiente de Aprobación - LIVEX',
        html: `
          <h2>Nuevo prestador registrado</h2>
          <p>Se ha registrado un nuevo prestador que requiere aprobación:</p>
          <ul>
            <li><strong>Nombre del Resort:</strong> {{resortName}}</li>
            <li><strong>Propietario:</strong> {{ownerName}}</li>
            <li><strong>Email del Propietario:</strong> {{ownerEmail}}</li>
            <li><strong>ID del Resort:</strong> {{resortId}}</li>
          </ul>
          <p>Por favor, revisa la información y aprueba o rechaza el prestador en el panel de administración.</p>
        `,
        text: 'Nuevo prestador registrado: {{resortName}} por {{ownerName}} ({{ownerEmail}}). ID: {{resortId}}'
      },
      [EmailTemplateType.BOOKING_CONFIRMED_RESORT]: {
        subject: '📅 Nueva Reserva Confirmada - LIVEX',
        html: `
          <h2>¡Nueva Reserva Recibida!</h2>
          <p>Hola {{resortName}},</p>
          <p>Has recibido una nueva reserva para la experiencia <strong>{{experienceName}}</strong>.</p>
          <ul>
            <li><strong>Cliente:</strong> {{customerName}}</li>
            <li><strong>Fecha:</strong> {{bookingDate}}</li>
            <li><strong>Hora:</strong> {{bookingTime}}</li>
            <li><strong>Adultos:</strong> {{guestCount}}</li>
            <li><strong>Niños:</strong> {{childrenCount}}</li>
          </ul>
          <p>Valor de la reserva a cobrar: <strong>$ {{resortNetAmount}}</strong></p>
          <p>Código de reserva: <strong>{{bookingCode}}</strong></p>
          <p>Por favor, asegúrate de estar preparado para recibir a tus huéspedes.</p>
        `,
        text: 'Nueva reserva confirmada: {{experienceName}} por {{customerName}}. Fecha: {{bookingDate}} {{bookingTime}}. Código: {{bookingCode}}'
      },
      [EmailTemplateType.BOOKING_CONFIRMED_ADMIN]: {
        subject: '🔔 [ADMIN] Nueva Reserva Confirmada',
        html: `
          <h2>Nueva transacción en plataforma</h2>
          <ul>
            <li><strong>Resort:</strong> {{resortName}}</li>
            <li><strong>Experiencia:</strong> {{experienceName}}</li>
            <li><strong>Monto Total:</strong> $\{{ commissionAmount }}</li>
            <li><strong>ID Reserva:</strong> {{bookingId}}</li>
          </ul>
        `,
        text: 'Nueva reserva confirmada. Monto: ${{amount}}. Resort: {{resortName}}'
      },
      [EmailTemplateType.PAYMENT_FAILED_ADMIN]: {
        subject: '⚠️ [ADMIN] Fallo en Pago',
        html: `
          <h2>Alerta de Pago Fallido</h2>
          <p>Un intento de pago ha fallado.</p>
          <ul>
            <li><strong>Usuario:</strong> {{customerName}} ({{customerEmail}})</li>
            <li><strong>Código Reserva:</strong> {{bookingCode}}</li>
            <li><strong>Motivo:</strong> {{reason}}</li>
          </ul>
        `,
        text: 'Pago fallido para reserva {{bookingCode}}. Motivo: {{reason}}'
      },
      [EmailTemplateType.REFUND_PROCESSED_RESORT]: {
        subject: '💸 Reembolso Procesado - LIVEX',
        html: `
          <h2>Notificación de Reembolso</h2>
          <p>Hola {{resortName}},</p>
          <p>Se ha procesado un reembolso para la reserva <strong>{{bookingCode}}</strong>.</p>
          <p><strong>Monto reembolsado al cliente:</strong> $\{{ refundAmount }}</p>
          <p>Este monto será deducido de tu próximo pago.</p>
        `,
        text: 'Reembolso procesado para reserva {{bookingCode}}. Monto: ${{refundAmount}}'
      },
      [EmailTemplateType.REFUND_PROCESSED_ADMIN]: {
        subject: '🔔 [ADMIN] Reembolso Procesado',
        html: `
          <h2>Reembolso ejecutado</h2>
          <ul>
             <li><strong>Reserva:</strong> {{bookingCode}}</li>
             <li><strong>Monto:</strong> $\{{ refundAmount }}</li>
          </ul>
        `,
        text: 'Reembolso procesado ${{refundAmount}} para {{bookingCode}}'
      },
      [EmailTemplateType.EXPERIENCE_CREATED_ADMIN]: {
        subject: '🌟 [ADMIN] Nueva Experiencia Creada',
        html: `
           <h2>Nueva experiencia pendiente de revisión</h2>
           <p>El resort <strong>{{resortName}}</strong> ha creado la experiencia: <strong>{{experienceName}}</strong></p>
           <p>ID: {{experienceId}}</p>
           <p><a href="{{adminLink}}">Ir al panel de administración para aprobar/rechazar</a></p>
        `,
        text: 'Nueva experiencia creada por {{resortName}}: {{experienceName}}. ID: {{experienceId}}'
      },
      [EmailTemplateType.USER_REGISTERED_ADMIN]: {
        subject: '👤 [ADMIN] Nuevo Usuario Registrado',
        html: `
           <p>Nuevo usuario registrado: <strong>{{userName}}</strong> ({{userEmail}})</p>
           <p>ID: {{userId}}</p>
        `,
        text: 'Nuevo usuario: {{userName}} ({{userEmail}})'
      },
      [EmailTemplateType.EMAIL_CONFIRMATION]: {
        subject: '✉️ Confirma tu correo electrónico - LIVEX',
        html: `
          <h2>Confirma tu cuenta</h2>
          <p>Hola {{userName}},</p>
          <p>Para completar tu registro, por favor confirma tu dirección de correo electrónico haciendo clic en el siguiente enlace:</p>
          <p><a href="{{confirmationLink}}">Confirmar mi correo</a></p>
          <p>O ingresa este código: <strong>{{confirmationCode}}</strong></p>
        `,
        text: 'Confirma tu correo: {{confirmationLink}} o código {{confirmationCode}}'
      },
      [EmailTemplateType.MONTHLY_REPORT_RESORT]: {
        subject: '📊 Tu Reporte Mensual - LIVEX',
        html: `
           <h2>Resumen de {{month}}</h2>
           <p>Hola {{resortName}},</p>
           <p>Aquí tienes el resumen de tu actividad este mes:</p>
           <ul>
             <li><strong>Reservas Totales:</strong> {{totalBookings}}</li>
             <li><strong>Ingresos Brutos:</strong> $\{{ totalRevenue }}</li>
           </ul>
           <p>Gracias por trabajar con nosotros.</p>
        `,
        text: 'Resumen mensual {{month}}: {{totalBookings}} reservas, ${{totalRevenue}} ingresos.'
      },
      [EmailTemplateType.MONTHLY_REPORT_ADMIN]: {
        subject: '📈 [ADMIN] Reporte Mensual de Plataforma',
        html: `
           <h2>Resumen Global - {{month}}</h2>
           <ul>
             <li><strong>Total Reservas:</strong> {{totalBookings}}</li>
             <li><strong>Volumen Total Transaccionado:</strong> $\{{ totalVolume }}</li>
             <li><strong>Nuevos Usuarios:</strong> {{newUsers}}</li>
           </ul>
        `,
        text: 'Reporte Mensual {{month}}: {{totalBookings}} reservas, ${{totalVolume}} volumen.'
      },
    };

    return templates[templateType];
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      this.logger.log('SMTP connection verified successfully');
      return true;
    } catch (error) {
      this.logger.error('SMTP connection failed:', error);
      return false;
    }
  }
}
