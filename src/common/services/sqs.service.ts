import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    SQSClient,
    SendMessageCommand,
    ReceiveMessageCommand,
    DeleteMessageCommand,
    GetQueueAttributesCommand,
    Message,
} from '@aws-sdk/client-sqs';
import { AwsConfig } from '../../config/aws.config';

@Injectable()
export class SqsService implements OnModuleInit {
    private readonly logger = new Logger(SqsService.name);
    private client: SQSClient;

    constructor(private readonly configService: ConfigService) { }

    onModuleInit() {
        const awsConfig = this.configService.get<AwsConfig>('aws');

        const clientConfig: ConstructorParameters<typeof SQSClient>[0] = {
            region: awsConfig?.region,
            credentials: {
                accessKeyId: awsConfig?.accessKeyId || '',
                secretAccessKey: awsConfig?.secretAccessKey || '',
            },
        };

        // Para LocalStack u otros endpoints custom (dev/test)
        if (awsConfig?.sqsEndpoint) {
            clientConfig.endpoint = awsConfig.sqsEndpoint;
            this.logger.log(`SQS usando endpoint custom: ${awsConfig.sqsEndpoint}`);
        }

        this.client = new SQSClient(clientConfig);
        this.logger.log('SQS client inicializado');
    }

    /**
     * Envía un mensaje a una cola SQS
     * @param queueUrl - URL completa de la cola SQS
     * @param body - Objeto que será serializado a JSON
     * @param delaySeconds - Delay opcional antes de que el mensaje sea visible (0-900 seg)
     * @param messageGroupId - Para colas FIFO (opcional)
     */
    async sendMessage(
        queueUrl: string,
        body: Record<string, any>,
        delaySeconds?: number,
        messageGroupId?: string,
    ): Promise<string | undefined> {
        try {
            const command = new SendMessageCommand({
                QueueUrl: queueUrl,
                MessageBody: JSON.stringify(body),
                ...(delaySeconds !== undefined && delaySeconds > 0 && { DelaySeconds: delaySeconds }),
                ...(messageGroupId && { MessageGroupId: messageGroupId }),
            });

            const result = await this.client.send(command);

            this.logger.debug(`Mensaje enviado a SQS: ${result.MessageId}`, {
                queueUrl: this.getQueueName(queueUrl),
            });

            return result.MessageId;
        } catch (error) {
            this.logger.error(`Error enviando mensaje a SQS: ${this.getQueueName(queueUrl)}`, error);
            throw error;
        }
    }

    /**
     * Recibe mensajes de una cola SQS (long polling)
     * @param queueUrl - URL completa de la cola SQS
     * @param maxMessages - Máximo de mensajes a recibir (1-10)
     * @param waitTimeSeconds - Tiempo máximo de espera (0-20 seg, 20 = long polling)
     * @param visibilityTimeout - Tiempo antes de que el mensaje vuelva a ser visible (seg)
     */
    async receiveMessages(
        queueUrl: string,
        maxMessages: number = 5,
        waitTimeSeconds: number = 20,
        visibilityTimeout: number = 60,
    ): Promise<Message[]> {
        try {
            const command = new ReceiveMessageCommand({
                QueueUrl: queueUrl,
                MaxNumberOfMessages: Math.min(maxMessages, 10),
                WaitTimeSeconds: waitTimeSeconds,
                VisibilityTimeout: visibilityTimeout,
                MessageAttributeNames: ['All'],
                AttributeNames: ['All'],
            });

            const result = await this.client.send(command);
            return result.Messages || [];
        } catch (error) {
            this.logger.error(`Error recibiendo mensajes de SQS: ${this.getQueueName(queueUrl)}`, error);
            throw error;
        }
    }

    /**
     * Elimina un mensaje de la cola (equivalente a ack en RabbitMQ)
     */
    async deleteMessage(queueUrl: string, receiptHandle: string): Promise<void> {
        try {
            await this.client.send(
                new DeleteMessageCommand({
                    QueueUrl: queueUrl,
                    ReceiptHandle: receiptHandle,
                }),
            );
        } catch (error) {
            this.logger.error(`Error eliminando mensaje de SQS: ${this.getQueueName(queueUrl)}`, error);
            throw error;
        }
    }

    /**
     * Obtiene estadísticas de una cola SQS
     */
    async getQueueAttributes(queueUrl: string): Promise<Record<string, string>> {
        try {
            const result = await this.client.send(
                new GetQueueAttributesCommand({
                    QueueUrl: queueUrl,
                    AttributeNames: [
                        'ApproximateNumberOfMessages',
                        'ApproximateNumberOfMessagesNotVisible',
                        'ApproximateNumberOfMessagesDelayed',
                    ],
                }),
            );
            return result.Attributes || {};
        } catch (error) {
            this.logger.error(`Error obteniendo atributos de SQS: ${this.getQueueName(queueUrl)}`, error);
            return {};
        }
    }

    /**
     * Parsea el body de un mensaje SQS a un objeto tipado
     */
    parseMessageBody<T>(message: Message): T | null {
        try {
            if (!message.Body) return null;
            return JSON.parse(message.Body) as T;
        } catch (error) {
            this.logger.error('Error parseando body de mensaje SQS', error);
            return null;
        }
    }

    /**
     * Extrae el nombre corto de la cola desde la URL para logging
     */
    private getQueueName(queueUrl: string): string {
        return queueUrl.split('/').pop() || queueUrl;
    }
}
