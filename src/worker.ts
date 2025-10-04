/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import * as amqplib from "amqplib";
import { Pool } from "pg";

// ---- ENV ----
const AMQP_URL = process.env.AMQP_URL || "amqp://livex:livex@rabbitmq:5672";
const DATABASE_URL =
    process.env.DATABASE_URL || "postgresql://livex:livex@db:5432/livex";

// ---- MQ nombres ----
const EX_WEBHOOKS = "webhooks.payments";
const EX_DLX = "webhooks.dlx";
const Q_PROCESS = "webhooks.payments.process";
const Q_RETRY = "webhooks.payments.retry";

async function main() {
    // DB
    const db = new Pool({ connectionString: DATABASE_URL });
    await db.query("select 1");

    // RabbitMQ
    const conn = await amqplib.connect(AMQP_URL);
    const ch = await conn.createChannel();

    await ch.assertExchange(EX_WEBHOOKS, "topic", { durable: true });
    await ch.assertExchange(EX_DLX, "fanout", { durable: true });

    await ch.assertQueue(Q_PROCESS, {
        durable: true,
        deadLetterExchange: EX_DLX,
    });
    await ch.bindQueue(Q_PROCESS, EX_WEBHOOKS, "#");

    await ch.assertQueue(Q_RETRY, {
        durable: true,
        messageTtl: 30_000, // 30s
        deadLetterExchange: EX_WEBHOOKS,
    });
    await ch.bindQueue(Q_RETRY, EX_DLX, "");

    ch.prefetch(8);

    console.log("[worker] listo. Esperando mensajes…");

    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-misused-promises
    await ch.consume(Q_PROCESS, async (msg: amqplib.ConsumeMessage | null) => {
        if (!msg) return;

        try {
            const rawContent = msg.content.toString("utf-8");
            const body = (rawContent ? JSON.parse(rawContent) : {}) as {
                eventId?: string;
            };
            const eventId = body.eventId;

            if (!eventId) {
                console.warn("[worker] mensaje sin eventId → ack");
                ch.ack(msg);
                return;
            }

            const client = await db.connect();
            try {
                await client.query("BEGIN");

                const { rows } = await client.query(
                    `SELECT id, provider, status, payload
                    FROM webhook_events
                    WHERE id = $1
                    FOR UPDATE SKIP LOCKED`,
                    [eventId],
                );

                const evt = rows[0];
                if (!evt) {
                    await client.query("COMMIT");
                    ch.ack(msg);
                    console.warn("[worker] webhook_event no encontrado → ack", {
                        eventId,
                    });
                    return;
                }
                if (evt.status !== "pending") {
                    await client.query("COMMIT");
                    ch.ack(msg);
                    console.log("[worker] evento ya no está pending → ack", {
                        eventId,
                        status: evt.status,
                    });
                    return;
                }

                // TODO: aquí va tu lógica real:
                // - resolver booking/payment a partir del payload
                // - upsert de payments
                // - confirmar booking/generar comisión
                // Por ahora, lo marcamos como processed para que el flujo avance.
                await client.query(
                    `UPDATE webhook_events
                        SET status = "processed",
                            processed_at = NOW()
                    WHERE id = $1`,
                    [eventId],
                );

                await client.query("COMMIT");
                ch.ack(msg);
                console.log("[worker] procesado webhook_event", { eventId });
            } catch (err) {
                await client.query("ROLLBACK").catch(() => { });
                console.error("[worker] error en tx → nack a DLX", err);
                ch.nack(msg, false, false); // va a DLX → Q_RETRY
            } finally {
                client.release();
            }
        } catch (err) {
            console.error("[worker] error parseando mensaje → nack", err);
            ch.nack(msg, false, false);
        }
    });

    const shutdown = async () => {
        console.log("[worker] apagando…");
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

main().catch((e) => {
    console.error("[worker] fatal", e);
    process.exit(1);
});
