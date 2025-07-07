import { eq, and, or, desc, asc, isNull, isNotNull } from 'drizzle-orm';
import { DrizzleDatabaseManager, getWorkspaceDatabase } from './drizzle-connection.js';
import { 
  tasks, 
  githubConfigs, 
  remoteInterfaces, 
  workspaceToolFlows, 
  workspaceFeedbackSteps, 
  type Task, 
  type NewTask,
  type GithubConfig,
  type NewGithubConfig,
  type RemoteInterface,
  type NewRemoteInterface,
  type WorkspaceToolFlow,
  type NewWorkspaceToolFlow,
  type WorkspaceFeedbackStep,
  type NewWorkspaceFeedbackStep
} from './schema/workspace-schema.js';

export class WorkspaceDatabaseService {
  private db: DrizzleDatabaseManager;

  constructor(workspacePath: string, dbInstance?: DrizzleDatabaseManager) {
    this.db = dbInstance || getWorkspaceDatabase(workspacePath);
  }

  /**
   * Initialize the database
   */
  async initialize(): Promise<void> {
    await this.db.initialize();
  }

  // ========================================
  // TASK OPERATIONS
  // ========================================

  /**
   * Create a new task
   */
  async createTask(task: NewTask): Promise<Task> {
    const db = this.db.getDb();
    const [result] = await db.insert(tasks).values(task).returning();
    return result;
  }

  /**
   * Get task by ID
   */
  async getTask(id: string): Promise<Task | null> {
    const db = this.db.getDb();
    const [result] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    return result || null;
  }

  /**
   * Get all tasks
   */
  async getAllTasks(): Promise<Task[]> {
    const db = this.db.getDb();
    return db.select().from(tasks).orderBy(desc(tasks.updatedAt));
  }

  /**
   * Get tasks by status
   */
  async getTasksByStatus(status: string): Promise<Task[]> {
    const db = this.db.getDb();
    return db.select()
      .from(tasks)
      .where(eq(tasks.status, status as any))
      .orderBy(desc(tasks.updatedAt));
  }

  /**
   * Get tasks by priority
   */
  async getTasksByPriority(priority: string): Promise<Task[]> {
    const db = this.db.getDb();
    return db.select()
      .from(tasks)
      .where(eq(tasks.priority, priority as any))
      .orderBy(desc(tasks.updatedAt));
  }

  /**
   * Get in-progress tasks
   */
  async getInProgressTasks(): Promise<Task[]> {
    return this.getTasksByStatus('in-progress');
  }

  /**
   * Get high priority tasks
   */
  async getHighPriorityTasks(): Promise<Task[]> {
    return this.getTasksByPriority('high');
  }

  /**
   * Update task
   */
  async updateTask(id: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>): Promise<Task | null> {
    const db = this.db.getDb();
    const updateData = { ...updates, updatedAt: new Date().toISOString() };
    
    // If status is being changed to 'done', set completedAt
    if (updates.status === 'done' && !updates.completedAt) {
      updateData.completedAt = new Date().toISOString();
    }
    
    const [result] = await db.update(tasks)
      .set(updateData)
      .where(eq(tasks.id, id))
      .returning();
    return result || null;
  }

  /**
   * Update task progress
   */
  async updateTaskProgress(id: string, progress: number): Promise<Task | null> {
    const db = this.db.getDb();
    const updateData: any = { 
      progress, 
      updatedAt: new Date().toISOString() 
    };
    
    // If progress is 100%, mark as done
    if (progress >= 100) {
      updateData.status = 'done';
      updateData.completedAt = new Date().toISOString();
    }
    
    const [result] = await db.update(tasks)
      .set(updateData)
      .where(eq(tasks.id, id))
      .returning();
    return result || null;
  }

  /**
   * Delete task
   */
  async deleteTask(id: string): Promise<boolean> {
    const db = this.db.getDb();
    const result = await db.delete(tasks).where(eq(tasks.id, id));
    return result.changes > 0;
  }

  /**
   * Search tasks by title or description
   */
  async searchTasks(query: string): Promise<Task[]> {
    const db = this.db.getDb();
    // Note: SQLite doesn't have full-text search by default, so we use LIKE
    const likeQuery = `%${query}%`;
    return db.select()
      .from(tasks)
      .where(or(
        eq(tasks.title, likeQuery),
        eq(tasks.description, likeQuery)
      ))
      .orderBy(desc(tasks.updatedAt));
  }

  // ========================================
  // GITHUB CONFIG OPERATIONS
  // ========================================

  /**
   * Create GitHub config
   */
  async createGithubConfig(config: NewGithubConfig): Promise<GithubConfig> {
    const db = this.db.getDb();
    const [result] = await db.insert(githubConfigs).values(config).returning();
    return result;
  }

  /**
   * Get GitHub config
   */
  async getGithubConfig(): Promise<GithubConfig | null> {
    const db = this.db.getDb();
    const [result] = await db.select().from(githubConfigs).limit(1);
    return result || null;
  }

  /**
   * Update GitHub config
   */
  async updateGithubConfig(id: string, updates: Partial<Omit<GithubConfig, 'id' | 'createdAt'>>): Promise<GithubConfig | null> {
    const db = this.db.getDb();
    const [result] = await db.update(githubConfigs)
      .set({ ...updates, updatedAt: new Date().toISOString() })
      .where(eq(githubConfigs.id, id))
      .returning();
    return result || null;
  }

  /**
   * Delete GitHub config
   */
  async deleteGithubConfig(id: string): Promise<boolean> {
    const db = this.db.getDb();
    const result = await db.delete(githubConfigs).where(eq(githubConfigs.id, id));
    return result.changes > 0;
  }

  // ========================================
  // REMOTE INTERFACE OPERATIONS
  // ========================================

  /**
   * Create remote interface
   */
  async createRemoteInterface(remoteInterface: NewRemoteInterface): Promise<RemoteInterface> {
    const db = this.db.getDb();
    const [result] = await db.insert(remoteInterfaces).values(remoteInterface).returning();
    return result;
  }

  /**
   * Get remote interface by ID
   */
  async getRemoteInterface(id: string): Promise<RemoteInterface | null> {
    const db = this.db.getDb();
    const [result] = await db.select().from(remoteInterfaces).where(eq(remoteInterfaces.id, id)).limit(1);
    return result || null;
  }

  /**
   * Get all remote interfaces
   */
  async getAllRemoteInterfaces(): Promise<RemoteInterface[]> {
    const db = this.db.getDb();
    return db.select().from(remoteInterfaces).orderBy(asc(remoteInterfaces.interfaceType));
  }

  /**
   * Get remote interfaces by type
   */
  async getRemoteInterfacesByType(interfaceType: string): Promise<RemoteInterface[]> {
    const db = this.db.getDb();
    return db.select()
      .from(remoteInterfaces)
      .where(eq(remoteInterfaces.interfaceType, interfaceType as any))
      .orderBy(asc(remoteInterfaces.name));
  }

  /**
   * Update remote interface
   */
  async updateRemoteInterface(id: string, updates: Partial<Omit<RemoteInterface, 'id' | 'createdAt'>>): Promise<RemoteInterface | null> {
    const db = this.db.getDb();
    const [result] = await db.update(remoteInterfaces)
      .set({ ...updates, updatedAt: new Date().toISOString() })
      .where(eq(remoteInterfaces.id, id))
      .returning();
    return result || null;
  }

  /**
   * Delete remote interface
   */
  async deleteRemoteInterface(id: string): Promise<boolean> {
    const db = this.db.getDb();
    const result = await db.delete(remoteInterfaces).where(eq(remoteInterfaces.id, id));
    return result.changes > 0;
  }

  // ========================================
  // WORKSPACE TOOL FLOW OPERATIONS
  // ========================================

  /**
   * Create workspace tool flow
   */
  async createWorkspaceToolFlow(toolFlow: NewWorkspaceToolFlow): Promise<WorkspaceToolFlow> {
    const db = this.db.getDb();
    const [result] = await db.insert(workspaceToolFlows).values(toolFlow).returning();
    return result;
  }

  /**
   * Get all workspace tool flows
   */
  async getAllWorkspaceToolFlows(): Promise<WorkspaceToolFlow[]> {
    const db = this.db.getDb();
    return db.select().from(workspaceToolFlows).orderBy(asc(workspaceToolFlows.toolName));
  }

  /**
   * Get workspace tool flow by tool name
   */
  async getWorkspaceToolFlowByName(toolName: string): Promise<WorkspaceToolFlow | null> {
    const db = this.db.getDb();
    const [result] = await db.select()
      .from(workspaceToolFlows)
      .where(eq(workspaceToolFlows.toolName, toolName))
      .limit(1);
    return result || null;
  }

  /**
   * Update workspace tool flow
   */
  async updateWorkspaceToolFlow(id: string, updates: Partial<Omit<WorkspaceToolFlow, 'id' | 'createdAt'>>): Promise<WorkspaceToolFlow | null> {
    const db = this.db.getDb();
    const [result] = await db.update(workspaceToolFlows)
      .set({ ...updates, updatedAt: new Date().toISOString() })
      .where(eq(workspaceToolFlows.id, id))
      .returning();
    return result || null;
  }

  /**
   * Delete workspace tool flow
   */
  async deleteWorkspaceToolFlow(id: string): Promise<boolean> {
    const db = this.db.getDb();
    const result = await db.delete(workspaceToolFlows).where(eq(workspaceToolFlows.id, id));
    return result.changes > 0;
  }

  // ========================================
  // WORKSPACE FEEDBACK STEP OPERATIONS
  // ========================================

  /**
   * Create workspace feedback step
   */
  async createWorkspaceFeedbackStep(feedbackStep: NewWorkspaceFeedbackStep): Promise<WorkspaceFeedbackStep> {
    const db = this.db.getDb();
    const [result] = await db.insert(workspaceFeedbackSteps).values(feedbackStep).returning();
    return result;
  }

  /**
   * Get all workspace feedback steps
   */
  async getAllWorkspaceFeedbackSteps(): Promise<WorkspaceFeedbackStep[]> {
    const db = this.db.getDb();
    return db.select().from(workspaceFeedbackSteps).orderBy(asc(workspaceFeedbackSteps.name));
  }

  /**
   * Get workspace feedback step by name
   */
  async getWorkspaceFeedbackStepByName(name: string): Promise<WorkspaceFeedbackStep | null> {
    const db = this.db.getDb();
    const [result] = await db.select()
      .from(workspaceFeedbackSteps)
      .where(eq(workspaceFeedbackSteps.name, name))
      .limit(1);
    return result || null;
  }

  /**
   * Update workspace feedback step
   */
  async updateWorkspaceFeedbackStep(id: string, updates: Partial<Omit<WorkspaceFeedbackStep, 'id' | 'createdAt'>>): Promise<WorkspaceFeedbackStep | null> {
    const db = this.db.getDb();
    const [result] = await db.update(workspaceFeedbackSteps)
      .set({ ...updates, updatedAt: new Date().toISOString() })
      .where(eq(workspaceFeedbackSteps.id, id))
      .returning();
    return result || null;
  }

  /**
   * Delete workspace feedback step
   */
  async deleteWorkspaceFeedbackStep(id: string): Promise<boolean> {
    const db = this.db.getDb();
    const result = await db.delete(workspaceFeedbackSteps).where(eq(workspaceFeedbackSteps.id, id));
    return result.changes > 0;
  }

  // ========================================
  // UTILITY OPERATIONS
  // ========================================

  /**
   * Get task statistics
   */
  async getTaskStatistics(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    completionRate: number;
  }> {
    const db = this.db.getDb();
    const allTasks = await db.select().from(tasks);
    
    const stats = {
      total: allTasks.length,
      byStatus: {} as Record<string, number>,
      byPriority: {} as Record<string, number>,
      completionRate: 0
    };
    
    let completedCount = 0;
    
    for (const task of allTasks) {
      // Count by status
      if (task.status) {
        stats.byStatus[task.status] = (stats.byStatus[task.status] || 0) + 1;
      }
      
      // Count by priority
      if (task.priority) {
        stats.byPriority[task.priority] = (stats.byPriority[task.priority] || 0) + 1;
      }
      
      // Count completed tasks
      if (task.status === 'done') {
        completedCount++;
      }
    }
    
    // Calculate completion rate
    stats.completionRate = stats.total > 0 ? (completedCount / stats.total) * 100 : 0;
    
    return stats;
  }

  /**
   * Get high-priority in-progress tasks (for focus mode)
   */
  async getFocusTasks(): Promise<Task[]> {
    const db = this.db.getDb();
    return db.select()
      .from(tasks)
      .where(and(
        eq(tasks.status, 'in-progress'),
        eq(tasks.priority, 'high')
      ))
      .orderBy(desc(tasks.updatedAt));
  }

  /**
   * Execute a transaction
   */
  async transaction<T>(callback: (service: WorkspaceDatabaseService) => Promise<T>): Promise<T> {
    return this.db.transaction(async () => {
      return callback(this);
    });
  }
}

/**
 * Get workspace database service instance
 */
export function getWorkspaceDatabaseService(workspacePath: string): WorkspaceDatabaseService {
  return new WorkspaceDatabaseService(workspacePath);
}

/**
 * Initialize workspace database service
 */
export async function initializeWorkspaceDatabaseService(workspacePath: string): Promise<WorkspaceDatabaseService> {
  const service = new WorkspaceDatabaseService(workspacePath);
  await service.initialize();
  return service;
}
