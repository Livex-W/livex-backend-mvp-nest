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
            <li><strong>Total:</strong> $\{{ totalAmount }}</li>
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
      [EmailTemplateType.PAYMENT_CONFIRMED]: {
        subject: '💳 Pago Confirmado - LIVEX',
        html: `
          <h2>¡Pago confirmado!</h2>
          <p>Hola {{customerName}},</p>
          <p>Hemos recibido tu pago de $\{{ amount }} para la reserva {{bookingCode}}.</p>
          <p>Tu experiencia está confirmada.</p>
        `,
        text: 'Pago de ${{amount}} confirmado para reserva {{bookingCode}}'
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
      [EmailTemplateType.REFUND_PROCESSED]: {
        subject: '💰 Reembolso Procesado - LIVEX',
        html: `
          <h2>Reembolso procesado</h2>
          <p>Hola {{customerName}},</p>
          <p>Se ha procesado un reembolso de $\{{ refundAmount }} para tu reserva {{bookingCode}}.</p>
          <p>El dinero aparecerá en tu cuenta en 3-5 días hábiles.</p>
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
