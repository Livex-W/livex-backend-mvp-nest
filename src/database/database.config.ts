import { PoolConfig } from 'pg';

export interface DatabaseConfigProps {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly password: string;
  readonly database: string;
  readonly ssl: boolean;
  readonly max: number;
  readonly idleTimeoutMillis: number;
  readonly connectionTimeoutMillis: number;
}

export class DatabaseConfig {
  constructor(private readonly props: DatabaseConfigProps) {}

  static fromEnv(env: NodeJS.ProcessEnv = process.env): DatabaseConfig {
    const host = env.POSTGRES_HOST ?? 'localhost';
    const port = DatabaseConfig.parseInteger(env.POSTGRES_PORT, 5432, 'POSTGRES_PORT');
    const max = DatabaseConfig.parseInteger(env.POSTGRES_POOL_MAX, 10, 'POSTGRES_POOL_MAX');
    const idleTimeoutMillis = DatabaseConfig.parseInteger(
      env.POSTGRES_IDLE_TIMEOUT,
      30_000,
      'POSTGRES_IDLE_TIMEOUT',
    );
    const connectionTimeoutMillis = DatabaseConfig.parseInteger(
      env.POSTGRES_CONNECTION_TIMEOUT,
      5_000,
      'POSTGRES_CONNECTION_TIMEOUT',
    );

    return new DatabaseConfig({
      host,
      port,
      user: env.POSTGRES_USER ?? 'postgres',
      password: env.POSTGRES_PASSWORD ?? '',
      database: env.POSTGRES_DB ?? 'postgres',
      ssl: env.POSTGRES_SSL === 'true',
      max,
      idleTimeoutMillis,
      connectionTimeoutMillis,
    });
  }

  private static parseInteger(
    value: string | undefined,
    fallback: number,
    key: string,
  ): number {
    if (value === undefined) {
      return fallback;
    }

    const parsed = Number.parseInt(value, 10);

    if (Number.isNaN(parsed)) {
      throw new Error(`Invalid integer value for ${key}: ${value}`);
    }

    return parsed;
  }

  toPoolConfig(): PoolConfig {
    return {
      host: this.props.host,
      port: this.props.port,
      user: this.props.user,
      password: this.props.password,
      database: this.props.database,
      ssl: this.props.ssl || undefined,
      max: this.props.max,
      idleTimeoutMillis: this.props.idleTimeoutMillis,
      connectionTimeoutMillis: this.props.connectionTimeoutMillis,
    };
  }

  get host(): string {
    return this.props.host;
  }

  get port(): number {
    return this.props.port;
  }

  get user(): string {
    return this.props.user;
  }

  get password(): string {
    return this.props.password;
  }

  get database(): string {
    return this.props.database;
  }

  get ssl(): boolean {
    return this.props.ssl;
  }

  get max(): number {
    return this.props.max;
  }

  get idleTimeoutMillis(): number {
    return this.props.idleTimeoutMillis;
  }

  get connectionTimeoutMillis(): number {
    return this.props.connectionTimeoutMillis;
  }
}
