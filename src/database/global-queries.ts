import { eq, and, or, desc, asc, isNull, isNotNull } from 'drizzle-orm';
import { DrizzleDatabaseManager, getGlobalDatabase } from './drizzle-connection.js';
import { 
  workspaces, 
  sessions, 
  toolFlows, 
  toolFlowSteps,
  feedbackSteps, 
  mcpServerMappings 
} from './schema/global-schema.js';
import type { 
  Workspace, 
  NewWorkspace, 
  Session, 
  NewSession, 
  ToolFlow, 
  NewToolFlow,
  ToolFlowStep,
  NewToolFlowStep, 
  FeedbackStep, 
  NewFeedbackStep, 
  McpServerMapping, 
  NewMcpServerMapping 
} from './schema/global-schema.js';

export class GlobalDatabaseService {
  private db: DrizzleDatabaseManager;

  constructor(dbInstance?: DrizzleDatabaseManager) {
    this.db = dbInstance || getGlobalDatabase();
  }

  /**
   * Initialize the database
   */
  async initialize(): Promise<void> {
    await this.db.initialize();
  }

  /**
   * Get the underlying DrizzleDatabaseManager instance
   */
  getDrizzleManager(): DrizzleDatabaseManager {
    return this.db;
  }

  // ========================================
  // WORKSPACE OPERATIONS
  // ========================================

  /**
   * Create a new workspace
   */
  async createWorkspace(workspace: NewWorkspace): Promise<Workspace> {
    const db = this.db.getDb();
    const [result] = await db.insert(workspaces).values(workspace).returning();
    return result;
  }

  /**
   * Get workspace by ID
   */
  async getWorkspace(id: string): Promise<Workspace | null> {
    const db = this.db.getDb();
    const [result] = await db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1);
    return result || null;
  }

  /**
   * Get workspace by path
   */
  async getWorkspaceByPath(path: string): Promise<Workspace | null> {
    const db = this.db.getDb();
    const [result] = await db.select().from(workspaces).where(eq(workspaces.path, path)).limit(1);
    return result || null;
  }

  /**
   * Get all workspaces
   */
  async getAllWorkspaces(): Promise<Workspace[]> {
    const db = this.db.getDb();
    return db.select().from(workspaces).orderBy(desc(workspaces.updatedAt));
  }

  /**
   * Update workspace
   */
  async updateWorkspace(id: string, updates: Partial<Omit<Workspace, 'id' | 'createdAt'>>): Promise<Workspace | null> {
    const db = this.db.getDb();
    const [result] = await db.update(workspaces)
      .set({ ...updates, updatedAt: new Date().toISOString() })
      .where(eq(workspaces.id, id))
      .returning();
    return result || null;
  }

  /**
   * Delete workspace
   */
  async deleteWorkspace(id: string): Promise<boolean> {
    const db = this.db.getDb();
    const result = await db.delete(workspaces).where(eq(workspaces.id, id));
    return result.changes > 0;
  }

  /**
   * Update workspace activity
   */
  async updateWorkspaceActivity(id: string, taskCount?: number, activeTask?: string): Promise<void> {
    const updates: any = { 
      lastActivity: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    if (taskCount !== undefined) {
      updates.taskCount = taskCount;
    }
    
    if (activeTask !== undefined) {
      updates.activeTask = activeTask;
    }

    const db = this.db.getDb();
    await db.update(workspaces).set(updates).where(eq(workspaces.id, id));
  }

  // ========================================
  // SESSION OPERATIONS
  // ========================================

  /**
   * Create a new session
   */
  async createSession(session: NewSession): Promise<Session> {
    const db = this.db.getDb();
    const [result] = await db.insert(sessions).values(session).returning();
    return result;
  }

  /**
   * Get active session for workspace
   */
  async getActiveSession(workspaceId: string): Promise<Session | null> {
    const db = this.db.getDb();
    const [result] = await db.select()
      .from(sessions)
      .where(and(eq(sessions.workspaceId, workspaceId), eq(sessions.isActive, true)))
      .orderBy(desc(sessions.lastActivity))
      .limit(1);
    return result || null;
  }

  /**
   * Get all sessions for workspace
   */
  async getWorkspaceSessions(workspaceId: string): Promise<Session[]> {
    const db = this.db.getDb();
    return db.select()
      .from(sessions)
      .where(eq(sessions.workspaceId, workspaceId))
      .orderBy(desc(sessions.lastActivity));
  }

  /**
   * Update session activity
   */
  async updateSessionActivity(sessionId: string): Promise<void> {
    const db = this.db.getDb();
    await db.update(sessions)
      .set({ lastActivity: new Date().toISOString() })
      .where(eq(sessions.id, sessionId));
  }

  /**
   * Close session
   */
  async closeSession(sessionId: string): Promise<void> {
    const db = this.db.getDb();
    await db.update(sessions)
      .set({ isActive: false })
      .where(eq(sessions.id, sessionId));
  }

  // ========================================
  // TOOL FLOW OPERATIONS
  // ========================================

  /**
   * Create a new tool flow
   */
  async createToolFlow(toolFlow: NewToolFlow): Promise<ToolFlow> {
    const db = this.db.getDb();
    const [result] = await db.insert(toolFlows).values(toolFlow).returning();
    return result;
  }

  /**
   * Get global tool flows
   */
  async getGlobalToolFlows(): Promise<ToolFlow[]> {
    const db = this.db.getDb();
    return db.select()
      .from(toolFlows)
      .where(eq(toolFlows.isGlobal, true))
      .orderBy(asc(toolFlows.toolName));
  }

  /**
   * Get workspace-specific tool flows
   */
  async getWorkspaceToolFlows(workspaceId: string): Promise<ToolFlow[]> {
    const db = this.db.getDb();
    return db.select()
      .from(toolFlows)
      .where(and(eq(toolFlows.isGlobal, false), eq(toolFlows.workspaceId, workspaceId)))
      .orderBy(asc(toolFlows.toolName));
  }

  /**
   * Get all tool flows (global + workspace-specific)
   */
  async getAllToolFlows(workspaceId?: string): Promise<ToolFlow[]> {
    const db = this.db.getDb();
    if (workspaceId) {
      return db.select()
        .from(toolFlows)
        .where(or(
          eq(toolFlows.isGlobal, true),
          and(eq(toolFlows.isGlobal, false), eq(toolFlows.workspaceId, workspaceId))
        ))
        .orderBy(asc(toolFlows.toolName));
    } else {
      return db.select()
        .from(toolFlows)
        .orderBy(asc(toolFlows.toolName));
    }
  }

  /**
   * Get tool flow by ID
   */
  async getToolFlowById(id: string): Promise<ToolFlow | null> {
    const db = this.db.getDb();
    const [flow] = await db.select()
      .from(toolFlows)
      .where(eq(toolFlows.id, id))
      .limit(1);
    return flow || null;
  }

  /**
   * Get tool flow by name
   */
  async getToolFlowByName(name: string, workspaceId?: string): Promise<ToolFlow | null> {
    const db = this.db.getDb();
    const whereClause = workspaceId 
      ? and(eq(toolFlows.toolName, name), or(
          eq(toolFlows.isGlobal, true),
          and(eq(toolFlows.isGlobal, false), eq(toolFlows.workspaceId, workspaceId))
        ))
      : eq(toolFlows.toolName, name);
    
    const [flow] = await db.select()
      .from(toolFlows)
      .where(whereClause)
      .limit(1);
      
    return flow || null;
  }

  /**
   * Update a tool flow
   */
  async updateToolFlow(id: string, updates: Partial<Omit<ToolFlow, 'id' | 'createdAt'>>): Promise<ToolFlow | null> {
    const db = this.db.getDb();
    const [updatedFlow] = await db.update(toolFlows)
      .set({
        ...updates,
        updatedAt: new Date().toISOString()
      })
      .where(eq(toolFlows.id, id))
      .returning();
    return updatedFlow || null;
  }

  /**
   * Delete a tool flow
   */
  async deleteToolFlow(id: string): Promise<boolean> {
    const db = this.db.getDb();
    const result = await db.delete(toolFlows).where(eq(toolFlows.id, id));
    return result.changes > 0;
  }

  /**
   * Get all steps for a specific tool flow
   */
  async getToolFlowSteps(toolFlowId: string): Promise<ToolFlowStep[]> {
    const db = this.db.getDb();
    return db.select()
      .from(toolFlowSteps)
      .where(eq(toolFlowSteps.toolFlowId, toolFlowId))
      .orderBy(asc(toolFlowSteps.stepOrder));
  }

  /**
   * Create a new tool flow step
   */
  async createToolFlowStep(step: NewToolFlowStep): Promise<ToolFlowStep> {
    const db = this.db.getDb();
    const [result] = await db.insert(toolFlowSteps).values(step).returning();
    return result;
  }

  /**
   * Update a tool flow step
   */
  async updateToolFlowStep(id: string, updates: Partial<Omit<ToolFlowStep, 'id' | 'createdAt'>>): Promise<ToolFlowStep | null> {
    const db = this.db.getDb();
    const [updatedStep] = await db.update(toolFlowSteps)
      .set({
        ...updates,
        updatedAt: new Date().toISOString()
      })
      .where(eq(toolFlowSteps.id, id))
      .returning();
    return updatedStep || null;
  }

  /**
   * Delete a tool flow step
   */
  async deleteToolFlowStep(id: string): Promise<boolean> {
    const db = this.db.getDb();
    const result = await db.delete(toolFlowSteps).where(eq(toolFlowSteps.id, id));
    return result.changes > 0;
  }





  // ========================================
  // FEEDBACK STEP OPERATIONS
  // ========================================

  /**
   * Create a new feedback step
   */
  async createFeedbackStep(feedbackStep: NewFeedbackStep): Promise<FeedbackStep> {
    const db = this.db.getDb();
    const [result] = await db.insert(feedbackSteps).values(feedbackStep).returning();
    return result;
  }

  /**
   * Get global feedback steps
   */
  async getGlobalFeedbackSteps(): Promise<FeedbackStep[]> {
    const db = this.db.getDb();
    return db.select()
      .from(feedbackSteps)
      .where(eq(feedbackSteps.isGlobal, true))
      .orderBy(asc(feedbackSteps.name));
  }

  /**
   * Get workspace-specific feedback steps
   */
  async getWorkspaceFeedbackSteps(workspaceId: string): Promise<FeedbackStep[]> {
    const db = this.db.getDb();
    return db.select()
      .from(feedbackSteps)
      .where(and(eq(feedbackSteps.isGlobal, false), eq(feedbackSteps.workspaceId, workspaceId)))
      .orderBy(asc(feedbackSteps.name));
  }

  /**
   * Get all feedback steps (global + workspace-specific)
   */
  async getAllFeedbackSteps(workspaceId?: string): Promise<FeedbackStep[]> {
    const db = this.db.getDb();
    if (workspaceId) {
      return db.select()
        .from(feedbackSteps)
        .where(or(
          eq(feedbackSteps.isGlobal, true),
          and(eq(feedbackSteps.isGlobal, false), eq(feedbackSteps.workspaceId, workspaceId))
        ))
        .orderBy(asc(feedbackSteps.name));
    } else {
      return db.select()
        .from(feedbackSteps)
        .where(eq(feedbackSteps.isGlobal, true))
        .orderBy(asc(feedbackSteps.name));
    }
  }

  /**
   * Get feedback step by ID
   */
  async getFeedbackStep(id: string): Promise<FeedbackStep | null> {
    const db = this.db.getDb();
    const [result] = await db.select().from(feedbackSteps).where(eq(feedbackSteps.id, id)).limit(1);
    return result || null;
  }

  /**
   * Get feedback step by name
   */
  async getFeedbackStepByName(name: string, workspaceId?: string): Promise<FeedbackStep | null> {
    const db = this.db.getDb();
    
    if (workspaceId) {
      // Check workspace-specific first
      const [workspaceResult] = await db.select()
        .from(feedbackSteps)
        .where(and(
          eq(feedbackSteps.name, name),
          eq(feedbackSteps.isGlobal, false),
          eq(feedbackSteps.workspaceId, workspaceId)
        ))
        .limit(1);
      
      if (workspaceResult) {
        return workspaceResult;
      }
    }
    
    // Fall back to global
    const [globalResult] = await db.select()
      .from(feedbackSteps)
      .where(and(eq(feedbackSteps.name, name), eq(feedbackSteps.isGlobal, true)))
      .limit(1);
    
    return globalResult || null;
  }

  /**
   * Update feedback step
   */
  async updateFeedbackStep(id: string, updates: Partial<Omit<FeedbackStep, 'id' | 'createdAt'>>): Promise<FeedbackStep | null> {
    const db = this.db.getDb();
    const [result] = await db.update(feedbackSteps)
      .set({ ...updates, updatedAt: new Date().toISOString() })
      .where(eq(feedbackSteps.id, id))
      .returning();
    return result || null;
  }

  /**
   * Delete feedback step
   */
  async deleteFeedbackStep(id: string): Promise<boolean> {
    const db = this.db.getDb();
    const result = await db.delete(feedbackSteps).where(eq(feedbackSteps.id, id));
    return result.changes > 0;
  }

  // ========================================
  // TOOL FLOW OPERATIONS
  // ========================================



  // ========================================
  // MCP SERVER MAPPING OPERATIONS
  // ========================================

  /**
   * Create a new MCP server mapping
   */
  async createMcpServerMapping(mapping: NewMcpServerMapping): Promise<McpServerMapping> {
    const db = this.db.getDb();
    const [result] = await db.insert(mcpServerMappings).values(mapping).returning();
    return result;
  }

  /**
   * Get all MCP server mappings
   */
  async getAllMcpServerMappings(): Promise<McpServerMapping[]> {
    const db = this.db.getDb();
    return db.select()
      .from(mcpServerMappings)
      .orderBy(asc(mcpServerMappings.interfaceType));
  }

  /**
   * Get MCP server mappings by interface type
   */
  async getMcpServerMappingsByType(interfaceType: string): Promise<McpServerMapping[]> {
    const db = this.db.getDb();
    return db.select()
      .from(mcpServerMappings)
      .where(eq(mcpServerMappings.interfaceType, interfaceType as any))
      .orderBy(desc(mcpServerMappings.isDefault));
  }

  /**
   * Get default MCP server mapping for interface type
   */
  async getDefaultMcpServerMapping(interfaceType: string): Promise<McpServerMapping | null> {
    const db = this.db.getDb();
    const [result] = await db.select()
      .from(mcpServerMappings)
      .where(and(
        eq(mcpServerMappings.interfaceType, interfaceType as any),
        eq(mcpServerMappings.isDefault, true)
      ))
      .limit(1);
    return result || null;
  }

  /**
   * Set default MCP server mapping
   */
  async setDefaultMcpServerMapping(id: string): Promise<void> {
    const db = this.db.getDb();
    
    // Get the mapping to find its interface type
    const [mapping] = await db.select()
      .from(mcpServerMappings)
      .where(eq(mcpServerMappings.id, id))
      .limit(1);
    
    if (!mapping) {
      throw new Error('MCP server mapping not found');
    }

    // Use transaction to ensure consistency
    await this.db.transaction(async (tx) => {
      // Clear all defaults for this interface type
      await tx.update(mcpServerMappings)
        .set({ isDefault: false })
        .where(eq(mcpServerMappings.interfaceType, mapping.interfaceType));
      
      // Set new default
      await tx.update(mcpServerMappings)
        .set({ isDefault: true })
        .where(eq(mcpServerMappings.id, id));
    });
  }

  /**
   * Update MCP server mapping
   */
  async updateMcpServerMapping(id: string, updates: Partial<Omit<McpServerMapping, 'id' | 'createdAt'>>): Promise<McpServerMapping | null> {
    const db = this.db.getDb();
    const [result] = await db.update(mcpServerMappings)
      .set({ ...updates, updatedAt: new Date().toISOString() })
      .where(eq(mcpServerMappings.id, id))
      .returning();
    return result || null;
  }

  /**
   * Delete MCP server mapping
   */
  async deleteMcpServerMapping(id: string): Promise<boolean> {
    const db = this.db.getDb();
    const result = await db.delete(mcpServerMappings).where(eq(mcpServerMappings.id, id));
    return result.changes > 0;
  }
}

// Singleton instance
let globalDbService: GlobalDatabaseService | null = null;

/**
 * Get singleton global database service instance
 */
export function getGlobalDatabaseService(): GlobalDatabaseService {
  if (!globalDbService) {
    globalDbService = new GlobalDatabaseService();
  }
  return globalDbService;
}

/**
 * Initialize global database service
 */
export async function initializeGlobalDatabaseService(): Promise<GlobalDatabaseService> {
  const service = getGlobalDatabaseService();
  await service.initialize();
  return service;
}
