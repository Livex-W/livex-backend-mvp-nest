import { Module } from '@nestjs/common';
import { DatabaseClient } from './database.client';

export const DATABASE_CLIENT = Symbol('DATABASE_CLIENT');

@Module({
  providers: [
    {
      provide: DATABASE_CLIENT,
      useFactory: () => DatabaseClient.getInstance(),
    },
  ],
  exports: [DATABASE_CLIENT],
})
export class DatabaseModule {}
