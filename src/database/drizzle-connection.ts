import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';

// Import schemas
import * as globalSchema from './schema/global-schema.js';
import * as workspaceSchema from './schema/workspace-schema.js';
import * as relations from './schema/relations.js';

export enum DatabaseType {
  GLOBAL = 'global',
  WORKSPACE = 'workspace'
}

export class DrizzleDatabaseManager {
  private db: ReturnType<typeof drizzle> | null = null;
  private sqlite: Database.Database | null = null;
  private isInitialized = false;
  private readonly dbType: DatabaseType;

  constructor(
    private dbPath: string = ':memory:',
    dbType: DatabaseType = DatabaseType.WORKSPACE
  ) {
    this.dbType = dbType;
  }

  /**
   * Initialize database connection and create schema
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Ensure directory exists for file-based databases
      if (this.dbPath !== ':memory:') {
        const dbDir = dirname(this.dbPath);
        if (!existsSync(dbDir)) {
          mkdirSync(dbDir, { recursive: true });
        }
      }

      // Create SQLite connection
      this.sqlite = new Database(this.dbPath);
      
      // Enable foreign keys
      this.sqlite.pragma('foreign_keys = ON');

      // Create Drizzle instance with appropriate schema
      if (this.dbType === DatabaseType.GLOBAL) {
        this.db = drizzle(this.sqlite, { 
          schema: { ...globalSchema, ...relations }
        });
      } else {
        this.db = drizzle(this.sqlite, { 
          schema: { ...workspaceSchema }
        });
      }

      // Run migrations if available
      try {
        await this.runMigrations();
      } catch (error) {
        console.warn('No migrations available or migration failed:', error);
        // If migrations fail, create tables manually using embedded schema
        await this.createTablesManually();
      }

      this.isInitialized = true;
      console.log(`${this.dbType} database initialized successfully at ${this.dbPath}`);
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }

  /**
   * Run Drizzle migrations
   */
  private async runMigrations(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const migrationsFolder = join(process.cwd(), 'src', 'database', 'migrations');
    if (existsSync(migrationsFolder)) {
      await migrate(this.db, { migrationsFolder });
      console.log('Migrations completed');
    }
  }

  /**
   * Create tables manually using embedded schema (fallback)
   */
  private async createTablesManually(): Promise<void> {
    if (!this.sqlite) {
      throw new Error('SQLite connection not available');
    }

    // This is a fallback - in production, we'll embed the SQL schema
    if (this.dbType === DatabaseType.GLOBAL) {
      // Create global tables
      this.sqlite.exec(`
        CREATE TABLE IF NOT EXISTS workspaces (
          id TEXT PRIMARY KEY,
          path TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          status TEXT DEFAULT 'disconnected' CHECK (status IN ('active', 'idle', 'inactive', 'disconnected', 'error')),
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          last_activity TEXT,
          task_count INTEGER DEFAULT 0,
          active_task TEXT
        );

        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          last_activity TEXT DEFAULT CURRENT_TIMESTAMP,
          is_active INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS tool_flows (
          id TEXT PRIMARY KEY,
          tool_name TEXT NOT NULL,
          description TEXT,
          feedback_step_id TEXT,
          next_tool TEXT,
          is_global INTEGER DEFAULT 1,
          workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS feedback_steps (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          template_content TEXT NOT NULL,
          variable_schema TEXT DEFAULT '{}',
          is_global INTEGER DEFAULT 1,
          workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS mcp_server_mappings (
          id TEXT PRIMARY KEY,
          interface_type TEXT NOT NULL CHECK(interface_type IN ('github', 'jira', 'linear', 'asana', 'trello', 'custom')),
          mcp_server_name TEXT NOT NULL,
          description TEXT,
          is_default INTEGER DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Indexes
        CREATE INDEX IF NOT EXISTS idx_sessions_workspace_id ON sessions(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON sessions(is_active);
        CREATE INDEX IF NOT EXISTS idx_tool_flows_workspace_id ON tool_flows(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_tool_flows_tool_name ON tool_flows(tool_name);
        CREATE INDEX IF NOT EXISTS idx_feedback_steps_workspace_id ON feedback_steps(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_feedback_steps_name ON feedback_steps(name);
        CREATE INDEX IF NOT EXISTS idx_mcp_server_mappings_interface_type ON mcp_server_mappings(interface_type);
        CREATE INDEX IF NOT EXISTS idx_mcp_server_mappings_default ON mcp_server_mappings(is_default);
      `);
    } else {
      // Create workspace tables
      this.sqlite.exec(`
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          status TEXT DEFAULT 'backlog' CHECK(status IN ('backlog', 'in-progress', 'blocked', 'review', 'done', 'dropped')),
          priority TEXT DEFAULT 'medium' CHECK(priority IN ('high', 'medium', 'low')),
          progress INTEGER DEFAULT 0 CHECK(progress >= 0 AND progress <= 100),
          dependencies TEXT DEFAULT '[]',
          notes TEXT,
          connected_files TEXT DEFAULT '[]',
          github_issue_number INTEGER,
          github_url TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          completed_at TEXT
        );

        CREATE TABLE IF NOT EXISTS github_configs (
          id TEXT PRIMARY KEY,
          repo_url TEXT NOT NULL,
          repo_owner TEXT NOT NULL,
          repo_name TEXT NOT NULL,
          github_token TEXT NOT NULL,
          auto_sync INTEGER DEFAULT 0,
          sync_direction TEXT CHECK(sync_direction IN ('bidirectional', 'github_to_taskpilot', 'taskpilot_to_github')) DEFAULT 'bidirectional',
          last_sync TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS remote_interfaces (
          id TEXT PRIMARY KEY,
          interface_type TEXT NOT NULL CHECK(interface_type IN ('github', 'jira', 'linear', 'asana', 'trello', 'custom')),
          name TEXT NOT NULL,
          base_url TEXT NOT NULL,
          api_token TEXT NOT NULL,
          project_id TEXT,
          sync_enabled INTEGER DEFAULT 1,
          sync_direction TEXT CHECK(sync_direction IN ('bidirectional', 'import_only', 'export_only')) DEFAULT 'bidirectional',
          field_mappings TEXT DEFAULT '[]',
          last_sync TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS workspace_tool_flows (
          id TEXT PRIMARY KEY,
          tool_name TEXT NOT NULL,
          description TEXT,
          feedback_step_id TEXT,
          next_tool TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS workspace_feedback_steps (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          template_content TEXT NOT NULL,
          variable_schema TEXT DEFAULT '{}',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Indexes
        CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
        CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
        CREATE INDEX IF NOT EXISTS idx_tasks_github_issue_number ON tasks(github_issue_number);
        CREATE INDEX IF NOT EXISTS idx_remote_interfaces_type ON remote_interfaces(interface_type);
        CREATE INDEX IF NOT EXISTS idx_workspace_tool_flows_tool_name ON workspace_tool_flows(tool_name);
        CREATE INDEX IF NOT EXISTS idx_workspace_feedback_steps_name ON workspace_feedback_steps(name);
      `);
    }
  }

  /**
   * Get Drizzle database instance
   */
  getDb() {
    if (!this.db || !this.isInitialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  /**
   * Get raw SQLite instance for direct queries if needed
   */
  getSqlite(): Database.Database {
    if (!this.sqlite || !this.isInitialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.sqlite;
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.sqlite) {
      this.sqlite.close();
      this.sqlite = null;
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

  /**
   * Execute a transaction
   */
  async transaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
    const db = this.getDb();
    return db.transaction(callback);
  }
}

// Database instances
let globalDbInstance: DrizzleDatabaseManager | null = null;
let workspaceDbInstance: DrizzleDatabaseManager | null = null;

/**
 * Get or create global database instance
 */
export function getGlobalDatabase(): DrizzleDatabaseManager {
  if (!globalDbInstance) {
    const globalPath = join(process.env.HOME || '/tmp', '.taskpilot', 'global.db');
    globalDbInstance = new DrizzleDatabaseManager(globalPath, DatabaseType.GLOBAL);
  }
  return globalDbInstance;
}

/**
 * Get or create workspace database instance
 */
export function getWorkspaceDatabase(workspacePath: string): DrizzleDatabaseManager {
  const workspaceDbPath = join(workspacePath, '.taskpilot', 'task.db');
  return new DrizzleDatabaseManager(workspaceDbPath, DatabaseType.WORKSPACE);
}

/**
 * Initialize global database instance
 */
export async function initializeGlobalDatabase(): Promise<DrizzleDatabaseManager> {
  const db = getGlobalDatabase();
  await db.initialize();
  return db;
}

/**
 * Initialize workspace database instance
 */
export async function initializeWorkspaceDatabase(workspacePath: string): Promise<DrizzleDatabaseManager> {
  const db = getWorkspaceDatabase(workspacePath);
  await db.initialize();
  return db;
}

/**
 * Initialize both databases
 */
export async function initializeBothDatabases(workspacePath: string): Promise<{
  global: DrizzleDatabaseManager;
  workspace: DrizzleDatabaseManager;
}> {
  const [global, workspace] = await Promise.all([
    initializeGlobalDatabase(),
    initializeWorkspaceDatabase(workspacePath)
  ]);
  
  return { global, workspace };
}

// Export schema types for use in other files
export type { 
  Workspace, NewWorkspace, 
  Session, NewSession,
  ToolFlow, NewToolFlow,
  FeedbackStep, NewFeedbackStep,
  McpServerMapping, NewMcpServerMapping
} from './schema/global-schema.js';

export type {
  Task, NewTask,
  GithubConfig, NewGithubConfig,
  RemoteInterface, NewRemoteInterface,
  WorkspaceToolFlow, NewWorkspaceToolFlow,
  WorkspaceFeedbackStep, NewWorkspaceFeedbackStep
} from './schema/workspace-schema.js';
