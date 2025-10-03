import { Pool, PoolClient, QueryConfig, QueryResult, QueryResultRow } from 'pg';

import { DatabaseConfig } from './database.config';

export class DatabaseClient {
  private static instance: DatabaseClient | undefined;
  private readonly pool: Pool;

  private constructor(private readonly config: DatabaseConfig) {
    this.pool = new Pool(config.toPoolConfig());
  }

  static async initialize(config: DatabaseConfig = DatabaseConfig.fromEnv()): Promise<DatabaseClient> {
    if (!DatabaseClient.instance) {
      const client = new DatabaseClient(config);
      await client.verifyConnection();
      DatabaseClient.instance = client;
    }

    return DatabaseClient.instance;
  }

  static getInstance(): DatabaseClient {
    if (!DatabaseClient.instance) {
      throw new Error('DatabaseClient has not been initialized. Call initialize() first.');
    }

    return DatabaseClient.instance;
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    queryText: string,
    values?: ReadonlyArray<unknown>,
  ): Promise<QueryResult<T>>;
  async query<T extends QueryResultRow = QueryResultRow>(
    queryConfig: QueryConfig,
  ): Promise<QueryResult<T>>;
  async query<T extends QueryResultRow = QueryResultRow>(
    queryTextOrConfig: string | QueryConfig,
    values?: ReadonlyArray<unknown>,
  ): Promise<QueryResult<T>> {
    if (typeof queryTextOrConfig === 'string') {
      const bindings = values ? [...values] : undefined;
      return this.pool.query<T>(queryTextOrConfig, bindings);
    }

    return this.pool.query<T>(queryTextOrConfig);
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  getPool(): Pool {
    return this.pool;
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
    DatabaseClient.instance = undefined;
  }

  private async verifyConnection(): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('SELECT 1');
    } finally {
      client.release();
    }
  }
}
