import type { D1Database } from '@cloudflare/workers-types';

export class Db {
  constructor(private db: D1Database) {}

  // Generic query helpers
  async first<T>(sql: string, params: any[] = []): Promise<T | null> {
    const result = await this.db.prepare(sql).bind(...params).first();
    return result as T | null;
  }

  async all<T>(sql: string, params: any[] = []): Promise<T[]> {
    const result = await this.db.prepare(sql).bind(...params).all();
    return (result.results ?? []) as T[];
  }

  async run(sql: string, params: any[] = []): Promise<D1Result> {
    return this.db.prepare(sql).bind(...params).run();
  }

  async exec(sql: string): Promise<void> {
    await this.db.exec(sql);
  }

  // Transaction helper
  async transaction<T>(fn: (db: Db) => Promise<T>): Promise<T> {
    // D1 doesn't support explicit transactions yet, but we can batch
    // For now, just run sequentially
    return fn(this);
  }

  // Batch helper for multiple statements
  async batch(statements: { sql: string; params: any[] }[]): Promise<D1Result[]> {
    return this.db.batch(statements.map(s => this.db.prepare(s.sql).bind(...s.params)));
  }
}

// Type for D1 batch results
export interface D1Result {
  success: boolean;
  results?: any[];
  meta: {
    duration: number;
    changes: number;
    last_row_id: number;
    rows_read: number;
    rows_written: number;
  };
}

// Factory
export function createDb(env: any): Db {
  return new Db(env.DB);
}