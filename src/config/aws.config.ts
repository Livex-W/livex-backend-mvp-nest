import { registerAs } from '@nestjs/config';

export interface AwsConfig {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    bucketName: string;
}

export default registerAs('aws', (): AwsConfig => {
    const config: AwsConfig = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        region: process.env.AWS_REGION || 'us-east-1',
        bucketName: process.env.AWS_S3_BUCKET_NAME || '',
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
