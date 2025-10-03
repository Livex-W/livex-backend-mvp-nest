import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DatabaseClient } from './database/database.client';
import { DatabaseConfig } from './database/database.config';

import * as swaggerUi from 'swagger-ui-express';
import openapi from '@livex/contracts/openapi';

async function bootstrap() {
  const dbConfig = DatabaseConfig.fromEnv();
  const dbClient = await DatabaseClient.initialize(dbConfig);
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();

  const shutdown = () => {
    void (async () => {
      await app.close();
      await dbClient.disconnect();
    })();
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi));

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
