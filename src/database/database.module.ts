import { Module } from '@nestjs/common';
import { DatabaseClient } from './database.client';

export const DATABASE_CLIENT = Symbol('DATABASE_CLIENT');

@Module({
  providers: [
    { // Added missing opening brace
      provide: DATABASE_CLIENT,
      useFactory: async () => {
        return await DatabaseClient.initialize();
      },
    }, // Removed the extra closing brace that was previously there
  ],
  exports: [DATABASE_CLIENT],
})
export class DatabaseModule { }
