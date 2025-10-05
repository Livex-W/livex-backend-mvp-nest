import { registerAs } from '@nestjs/config';

export interface AzureConfig {
  storageAccountName: string;
  storageAccountKey?: string;
  storageContainer: string;
  storageUrl?: string;
}

export default registerAs('azure', (): AzureConfig => {
  const config: AzureConfig = {
    storageAccountName: process.env.AZURE_STORAGE_ACCOUNT_NAME || '',
    storageAccountKey: process.env.AZURE_STORAGE_ACCOUNT_KEY,
    storageContainer: process.env.AZURE_STORAGE_CONTAINER || 'livex-media',
    storageUrl: process.env.AZURE_STORAGE_URL,
  };

  // Validate required configuration
  if (!config.storageAccountName) {
    throw new Error('AZURE_STORAGE_ACCOUNT_NAME is required');
  }

  // In production, we might use Managed Identity, so account key is optional
  if (process.env.NODE_ENV !== 'production' && !config.storageAccountKey) {
    throw new Error('AZURE_STORAGE_ACCOUNT_KEY is required for development');
  }

  return config;
});
