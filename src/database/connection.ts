import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Enable verbose mode for debugging
sqlite3.verbose();

export class DatabaseManager {
  private db: sqlite3.Database | null = null;
  private isInitialized = false;

  constructor(private dbPath: string = ':memory:') {}

  /**
   * Initialize database connection and create schema
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Create database connection
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err.message);
          throw err;
        }
      });

      // Promisify database methods for easier async usage
      const runAsync = promisify(this.db.run.bind(this.db));
      const allAsync = promisify(this.db.all.bind(this.db));
      const getAsync = promisify(this.db.get.bind(this.db));

      // Store promisified methods
      (this.db as any).runAsync = runAsync;
      (this.db as any).allAsync = allAsync;
      (this.db as any).getAsync = getAsync;

      // Enable foreign keys
      await runAsync('PRAGMA foreign_keys = ON');

      // Read and execute schema
      const schemaPath = join(__dirname, 'schema.sql');
      const schema = readFileSync(schemaPath, 'utf8');
      
      // Execute schema as a single script to handle triggers properly
      await runAsync(schema);

      this.isInitialized = true;
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }

  /**
   * Get database instance
   */
  getDb(): sqlite3.Database {
    if (!this.db || !this.isInitialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  /**
   * Execute a query and return all results
   */
  async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const db = this.getDb();
    return (db as any).allAsync(sql, params);
  }

  /**
   * Execute a query and return first result
   */
  async get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    const db = this.getDb();
    return (db as any).getAsync(sql, params);
  }

  /**
   * Execute a query (INSERT, UPDATE, DELETE)
   */
  async run(sql: string, params: any[] = []): Promise<sqlite3.RunResult> {
    const db = this.getDb();
    return (db as any).runAsync(sql, params);
  }

  /**
   * Execute multiple statements in a transaction
   */
  async transaction(statements: Array<{ sql: string; params?: any[] }>): Promise<void> {
    const db = this.getDb();
    const runAsync = (db as any).runAsync;

    await runAsync('BEGIN TRANSACTION');
    try {
      for (const { sql, params = [] } of statements) {
        await runAsync(sql, params);
      }
      await runAsync('COMMIT');
    } catch (error) {
      await runAsync('ROLLBACK');
      throw error;
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      const closeAsync = promisify(this.db.close.bind(this.db));
      await closeAsync();
      this.db = null;
      this.isInitialized = false;
    }
  }

  /**
   * Check if database is initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.db !== null;
  }
}

// Global database instance
let dbInstance: DatabaseManager | null = null;

/**
 * Get or create global database instance
 */
export function getDatabase(dbPath?: string): DatabaseManager {
  if (!dbInstance) {
    // Use default database path in user's home directory if not specified
    const defaultPath = dbPath || join(process.env.HOME || '/tmp', '.taskpilot', 'taskpilot.db');
    dbInstance = new DatabaseManager(defaultPath);
  }
  return dbInstance;
}

/**
 * Initialize global database instance
 */
export async function initializeDatabase(dbPath?: string): Promise<DatabaseManager> {
  const db = getDatabase(dbPath);
  await db.initialize();
  return db;
}