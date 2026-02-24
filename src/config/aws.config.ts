import { registerAs } from '@nestjs/config';

export interface AwsConfig {
    accessKeyId?: string;
    secretAccessKey?: string;
    region?: string;
    bucketName?: string;

    // SQS
    sqsEndpoint?: string; // Para LocalStack en dev (ej: http://localhost:4566)
    sqsNotificationsHighUrl?: string;
    sqsNotificationsMediumUrl?: string;
    sqsNotificationsLowUrl?: string;
    sqsNotificationsDlqUrl?: string;
    sqsWebhooksUrl?: string;
    sqsWebhooksDlqUrl?: string;
    sqsReconciliationUrl?: string;
    sqsReconciliationDlqUrl?: string;
}

export default registerAs('aws', (): AwsConfig => {
    const config: AwsConfig = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        region: process.env.AWS_REGION || 'us-east-1',
        bucketName: process.env.AWS_S3_BUCKET_NAME || '',

        // SQS
        sqsEndpoint: process.env.SQS_ENDPOINT || undefined,
        sqsNotificationsHighUrl: process.env.SQS_NOTIFICATIONS_HIGH_URL || '',
        sqsNotificationsMediumUrl: process.env.SQS_NOTIFICATIONS_MEDIUM_URL || '',
        sqsNotificationsLowUrl: process.env.SQS_NOTIFICATIONS_LOW_URL || '',
        sqsNotificationsDlqUrl: process.env.SQS_NOTIFICATIONS_DLQ_URL || '',
        sqsWebhooksUrl: process.env.SQS_WEBHOOKS_URL || '',
        sqsWebhooksDlqUrl: process.env.SQS_WEBHOOKS_DLQ_URL || '',
        sqsReconciliationUrl: process.env.SQS_RECONCILIATION_URL || '',
        sqsReconciliationDlqUrl: process.env.SQS_RECONCILIATION_DLQ_URL || '',
    };

    // Validate required configuration
    if (!config.accessKeyId || !config.secretAccessKey) {
        throw new Error('AWS credentials are missing. S3 uploads will fail.');
    }

    if (!config.bucketName) {
        throw new Error('AWS_S3_BUCKET_NAME is missing. S3 uploads will fail.');
    }

    return config;
});
