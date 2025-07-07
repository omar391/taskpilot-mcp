import { DatabaseManager, getGlobalDatabase, getWorkspaceDatabase, initializeWorkspaceDatabase } from '../database/connection.js';

/**
 * Database Service
 * 
 * Provides unified access to both global and workspace databases.
 * This service manages the dual database architecture and provides
 * a clean interface for tools to access the appropriate database.
 */
export class DatabaseService {
  private globalDb: DatabaseManager;
  private workspaceDb: DatabaseManager | null = null;
  private currentWorkspacePath: string | null = null;

  constructor(globalDb: DatabaseManager) {
    this.globalDb = globalDb;
  }

  /**
   * Get global database instance
   */
  getGlobal(): DatabaseManager {
    return this.globalDb;
  }

  /**
   * Get workspace database instance
   * Initializes workspace database if not already initialized for this workspace
   */
  async getWorkspace(workspacePath: string): Promise<DatabaseManager> {
    // If we already have a workspace DB for this path, return it
    if (this.workspaceDb && this.currentWorkspacePath === workspacePath) {
      return this.workspaceDb;
    }

    // Initialize new workspace database
    this.workspaceDb = await initializeWorkspaceDatabase(workspacePath);
    this.currentWorkspacePath = workspacePath;
    
    return this.workspaceDb;
  }

  /**
   * Execute query on global database
   */
  async globalAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return this.globalDb.all<T>(sql, params);
  }

  /**
   * Execute query on global database (single result)
   */
  async globalGet<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    return this.globalDb.get<T>(sql, params);
  }

  /**
   * Execute query on global database (run)
   */
  async globalRun(sql: string, params: any[] = []): Promise<any> {
    return this.globalDb.run(sql, params);
  }

  /**
   * Execute query on workspace database
   */
  async workspaceAll<T = any>(workspacePath: string, sql: string, params: any[] = []): Promise<T[]> {
    const db = await this.getWorkspace(workspacePath);
    return db.all<T>(sql, params);
  }

  /**
   * Execute query on workspace database (single result)
   */
  async workspaceGet<T = any>(workspacePath: string, sql: string, params: any[] = []): Promise<T | undefined> {
    const db = await this.getWorkspace(workspacePath);
    return db.get<T>(sql, params);
  }

  /**
   * Execute query on workspace database (run)
   */
  async workspaceRun(workspacePath: string, sql: string, params: any[] = []): Promise<any> {
    const db = await this.getWorkspace(workspacePath);
    return db.run(sql, params);
  }

  /**
   * Execute transaction on global database
   */
  async globalTransaction(statements: Array<{ sql: string; params?: any[] }>): Promise<void> {
    return this.globalDb.transaction(statements);
  }

  /**
   * Execute transaction on workspace database
   */
  async workspaceTransaction(workspacePath: string, statements: Array<{ sql: string; params?: any[] }>): Promise<void> {
    const db = await this.getWorkspace(workspacePath);
    return db.transaction(statements);
  }

  /**
   * Close all database connections
   */
  async close(): Promise<void> {
    if (this.globalDb) {
      await this.globalDb.close();
    }
    if (this.workspaceDb) {
      await this.workspaceDb.close();
      this.workspaceDb = null;
      this.currentWorkspacePath = null;
    }
  }

  /**
   * Check if workspace database is ready
   */
  isWorkspaceReady(workspacePath: string): boolean {
    return this.workspaceDb !== null && this.currentWorkspacePath === workspacePath;
  }

  /**
   * Check if global database is ready
   */
  isGlobalReady(): boolean {
    return this.globalDb.isReady();
  }
}
