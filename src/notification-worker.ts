/* eslint-disable @typescript-eslint/no-misused-promises */
import * as amqplib from "amqplib";
import { Pool } from "pg";
import { EmailService } from "./notifications/services/email.service";
import { NotificationJob } from "./notifications/services/notification-queue.service";

// ---- ENV ----
const AMQP_URL = process.env.AMQP_URL || "amqp://livex:livex@rabbitmq:5672";
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://livex:livex@db:5432/livex";

// ---- MQ nombres para notificaciones ----
const EX_NOTIFICATIONS = "notifications";
const EX_DLX = "notifications.dlx";
const Q_EMAIL_HIGH = "notifications.email.high";
const Q_EMAIL_MEDIUM = "notifications.email.medium";
const Q_EMAIL_LOW = "notifications.email.low";
const Q_EMAIL_RETRY = "notifications.email.retry";
const Q_EMAIL_SCHEDULED = "notifications.email.scheduled";

async function setupExchangesAndQueues(ch: amqplib.Channel): Promise<void> {
    await ch.assertExchange(EX_NOTIFICATIONS, "topic", { durable: true });
    await ch.assertExchange(EX_DLX, "fanout", { durable: true });

    await ch.assertQueue(Q_EMAIL_HIGH, {
        durable: true,
        deadLetterExchange: EX_DLX,
    });
    await ch.bindQueue(Q_EMAIL_HIGH, EX_NOTIFICATIONS, "email.high");

    await ch.assertQueue(Q_EMAIL_MEDIUM, {
        durable: true,
        deadLetterExchange: EX_DLX,
    });
    await ch.bindQueue(Q_EMAIL_MEDIUM, EX_NOTIFICATIONS, "email.medium");

    await ch.assertQueue(Q_EMAIL_LOW, {
        durable: true,
        deadLetterExchange: EX_DLX,
    });
    await ch.bindQueue(Q_EMAIL_LOW, EX_NOTIFICATIONS, "email.low");

    await ch.assertQueue(Q_EMAIL_SCHEDULED, {
        durable: true,
        deadLetterExchange: EX_NOTIFICATIONS,
    });

    await ch.assertQueue(Q_EMAIL_RETRY, {
        durable: true,
        messageTtl: 60000,
        deadLetterExchange: EX_NOTIFICATIONS,
    });
    await ch.bindQueue(Q_EMAIL_RETRY, EX_DLX, "");

    console.log("[notification-worker] exchanges y colas aseguradas");
}

async function connectRabbitWithRetry(retries = 10, delay = 2000): Promise<amqplib.ChannelModel> {
    for (let attempt = 1; ; attempt += 1) {
        try {
            return await amqplib.connect(AMQP_URL);
        } catch (err) {
            if (attempt >= retries) throw err;
            const wait = delay * attempt;
            console.warn(`[worker] RabbitMQ no disponible (intento ${attempt}) → reintentando en ${wait} ms`);
            await new Promise(res => setTimeout(res, wait));
        }
    }
}

async function main() {
    console.log("[notification-worker] iniciando...");

    // DB
    const db = new Pool({ connectionString: DATABASE_URL });
    await db.query("select 1");
    console.log("[notification-worker] DB conectada");

    // Email Service
    const emailService = new EmailService();
    await emailService.testConnection();
    console.log("[notification-worker] Email service inicializado");

    // RabbitMQ
    const conn = await connectRabbitWithRetry();
    const ch = await conn.createChannel();

    await setupExchangesAndQueues(ch);

    // Configurar prefetch para procesar mensajes de uno en uno por cola
    ch.prefetch(1);

    console.log("[notification-worker] listo. Esperando notificaciones...");

    // Función para procesar jobs de email
    const processEmailJob = async (msg: amqplib.ConsumeMessage | null, queueName: string) => {
        if (!msg) return;

        try {
            const rawContent = msg.content.toString("utf-8");
            const job = JSON.parse(rawContent) as NotificationJob;

            console.log(`[notification-worker] procesando job ${job.id} desde ${queueName}`);

            // Validar que es un job de email
            if (job.type !== 'email') {
                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                console.warn(`[notification-worker] tipo de job no soportado: ${job.type}`);
                ch.ack(msg);
                return;
            }

            // Intentar enviar el email
            const success = await emailService.sendEmail(job.payload);

            if (success) {
                // Email enviado exitosamente
                ch.ack(msg);
                console.log(`[notification-worker] email enviado exitosamente: ${job.id}`);
                
                // Opcional: registrar en DB el envío exitoso
                await logEmailSent(db, job, 'sent');
            } else {
                // Error al enviar email
                console.error(`[notification-worker] error enviando email: ${job.id}`);
                
                // Incrementar intentos
                job.attempts += 1;
                
                if (job.attempts >= job.maxAttempts) {
                    // Máximo de intentos alcanzado, mover a DLQ
                    console.error(`[notification-worker] job ${job.id} excedió máximo de intentos`);
                    ch.nack(msg, false, false); // Enviar a DLX
                    await logEmailSent(db, job, 'failed');
                } else {
                    // Reencolar para reintento
                    console.warn(`[notification-worker] reencolando job ${job.id} (intento ${job.attempts}/${job.maxAttempts})`);
                    
                    // Calcular delay exponencial
                    const delay = Math.pow(2, job.attempts) * 30 * 1000; // 30s, 60s, 120s, etc.
                    
                    // Enviar a cola de retry con TTL
                    const retryMessage = Buffer.from(JSON.stringify(job));
                     ch.sendToQueue(Q_EMAIL_RETRY, retryMessage, {
                        persistent: true,
                        expiration: delay.toString(),
                    });
                    
                    ch.ack(msg); // Ack el mensaje original
                    await logEmailSent(db, job, 'retrying');
                }
            }
        } catch (err) {
            console.error(`[notification-worker] error procesando mensaje desde ${queueName}:`, err);
            ch.nack(msg, false, false); // Enviar a DLX
        }
    };

    // Consumir cola de alta prioridad
    await ch.consume(Q_EMAIL_HIGH, (msg) => processEmailJob(msg, Q_EMAIL_HIGH));
    console.log(`[notification-worker] consumiendo ${Q_EMAIL_HIGH}`);

    // Consumir cola de prioridad media
    await ch.consume(Q_EMAIL_MEDIUM, (msg) => processEmailJob(msg, Q_EMAIL_MEDIUM));
    console.log(`[notification-worker] consumiendo ${Q_EMAIL_MEDIUM}`);

    // Consumir cola de baja prioridad
    await ch.consume(Q_EMAIL_LOW, (msg) => processEmailJob(msg, Q_EMAIL_LOW));
    console.log(`[notification-worker] consumiendo ${Q_EMAIL_LOW}`);

    // Función de shutdown
    const shutdown = async () => {
        console.log("[notification-worker] apagando...");
        try {
            await ch.close();
        } catch { /* empty */ }
        try {
            await conn.close();
        } catch { /* empty */ }
        try {
            await db.end();
        } catch { /* empty */ }
        process.exit(0);
    };

    process.on("SIGINT", () => {
        void shutdown();
    });
    process.on("SIGTERM", () => {
        void shutdown();
    });
}

// Función para registrar el estado del envío de email en la DB
async function logEmailSent(
    db: Pool, 
    job: NotificationJob, 
    status: 'sent' | 'failed' | 'retrying'
): Promise<void> {
    try {
        const client = await db.connect();
        try {
            await client.query(`
                INSERT INTO email_logs (
                    job_id, 
                    recipient, 
                    template_type, 
                    status, 
                    attempts, 
                    created_at,
                    updated_at
                ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
                ON CONFLICT (job_id) 
                DO UPDATE SET 
                    status = EXCLUDED.status,
                    attempts = EXCLUDED.attempts,
                    updated_at = NOW()
            `, [
                job.id,
                job.payload.to,
                job.payload.templateType,
                status,
                job.attempts
            ]);
        } finally {
            client.release();
        }
    } catch (error) {
        console.error("[notification-worker] error logging email status:", error);
        // No lanzar error para no afectar el procesamiento principal
    }
}

main().catch((e) => {
    console.error("[notification-worker] fatal", e);
    process.exit(1);
});
