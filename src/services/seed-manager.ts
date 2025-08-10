import { eq, and, isNull } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { DrizzleDatabaseManager } from '../database/drizzle-connection.js';
import {
  toolFlows,
  feedbackSteps,
  mcpServerMappings,
  toolFlowSteps,
  type ToolFlow,
  type FeedbackStep,
  type NewToolFlow,
  type NewFeedbackStep,
  type NewMcpServerMapping,
  type NewToolFlowStep
} from '../database/schema/global-schema.js';
import {
  GLOBAL_TOOL_FLOWS_SEED,
  GLOBAL_FEEDBACK_STEPS_SEED,
  MCP_SERVER_MAPPINGS_SEED,
  GLOBAL_TOOL_FLOW_STEPS_SEED
} from '../data/embedded-seed-data.js';
import { isStdioMode } from '../utils/cli-parser.js';
/**
 * Pure TypeScript/Drizzle ORM seed manager
 * Eliminates custom SQL and JSON, uses type-safe Drizzle operations
 */
export class SeedManager {
  private drizzleDb: ReturnType<DrizzleDatabaseManager['getDb']>;

  constructor(private dbManager: DrizzleDatabaseManager) {
    this.drizzleDb = this.dbManager.getDb();
  }

  /**
   * Initialize global seed data using pure Drizzle ORM operations
   */
  async initializeGlobalData(): Promise<void> {
    try {
      // Clear existing global data using type-safe Drizzle deletes
      await this.drizzleDb.delete(toolFlowSteps);
      await this.drizzleDb.delete(toolFlows).where(isNull(toolFlows.workspaceId));
      await this.drizzleDb.delete(feedbackSteps).where(isNull(feedbackSteps.workspaceId));
      await this.drizzleDb.delete(mcpServerMappings);

      // Insert global data using type-safe Drizzle inserts
      await this.drizzleDb.insert(feedbackSteps).values(GLOBAL_FEEDBACK_STEPS_SEED);
      await this.drizzleDb.insert(toolFlows).values(GLOBAL_TOOL_FLOWS_SEED);
      await this.drizzleDb.insert(toolFlowSteps).values(GLOBAL_TOOL_FLOW_STEPS_SEED);
      await this.drizzleDb.insert(mcpServerMappings).values(MCP_SERVER_MAPPINGS_SEED);

      if (!isStdioMode()) {
        console.log('Global seed data initialized successfully');
      }
    } catch (error) {
      console.error('Error initializing global seed data:', error);
      throw error;
    }
  }

  /**
   * Get global tool flow by name using type-safe Drizzle query
   */
  async getGlobalToolFlow(toolName: string): Promise<ToolFlow | null> {
    try {
      const result = await this.drizzleDb
        .select()
        .from(toolFlows)
        .where(and(
          eq(toolFlows.toolName, toolName),
          isNull(toolFlows.workspaceId)
        ))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      console.error('Error getting global tool flow:', error);
      throw error;
    }
  }

  /**
   * Get tool flow with workspace fallback using type-safe Drizzle queries
   */
  async getToolFlow(toolName: string, workspaceId: string): Promise<ToolFlow | null> {
    try {
      // First check for workspace-specific flow
      let result = await this.drizzleDb
        .select()
        .from(toolFlows)
        .where(and(
          eq(toolFlows.toolName, toolName),
          eq(toolFlows.workspaceId, workspaceId)
        ))
        .limit(1);

      // Fallback to global flow if workspace flow doesn't exist
      if (result.length === 0) {
        result = await this.drizzleDb
          .select()
          .from(toolFlows)
          .where(and(
            eq(toolFlows.toolName, toolName),
            isNull(toolFlows.workspaceId)
          ))
          .limit(1);
      }

      return result[0] || null;
    } catch (error) {
      console.error('Error getting tool flow:', error);
      throw error;
    }
  }

  /**
   * Get global feedback step by name using type-safe Drizzle query
   */
  async getGlobalFeedbackStep(name: string): Promise<FeedbackStep | null> {
    try {
      const result = await this.drizzleDb
        .select()
        .from(feedbackSteps)
        .where(and(
          eq(feedbackSteps.name, name),
          isNull(feedbackSteps.workspaceId)
        ))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      console.error('Error getting global feedback step:', error);
      throw error;
    }
  }

  /**
   * Get feedback step with workspace fallback using type-safe Drizzle queries
   */
  async getFeedbackStep(name: string, workspaceId: string): Promise<FeedbackStep | null> {
    try {
      // First check for workspace-specific step
      let result = await this.drizzleDb
        .select()
        .from(feedbackSteps)
        .where(and(
          eq(feedbackSteps.name, name),
          eq(feedbackSteps.workspaceId, workspaceId)
        ))
        .limit(1);

      // Fallback to global step if workspace step doesn't exist
      if (result.length === 0) {
        result = await this.drizzleDb
          .select()
          .from(feedbackSteps)
          .where(and(
            eq(feedbackSteps.name, name),
            isNull(feedbackSteps.workspaceId)
          ))
          .limit(1);
      }

      return result[0] || null;
    } catch (error) {
      console.error('Error getting feedback step:', error);
      throw error;
    }
  }

  /**
   * Clone global tool flow to workspace using type-safe Drizzle operations
   */
  async cloneGlobalToolFlowToWorkspace(toolName: string, workspaceId: string): Promise<ToolFlow | null> {
    try {
      const globalFlow = await this.getGlobalToolFlow(toolName);
      if (!globalFlow) {
        throw new Error(`Global tool flow '${toolName}' not found`);
      }

      // Create new tool flow for workspace using type-safe insert
      const newToolFlow: NewToolFlow = {
        id: uuidv4(),
        toolName,
        description: globalFlow.description,
        feedbackStepId: globalFlow.feedbackStepId,
        nextTool: globalFlow.nextTool,
        isGlobal: false,
        workspaceId
      };

      await this.drizzleDb.insert(toolFlows).values(newToolFlow);

      return await this.getToolFlow(toolName, workspaceId);
    } catch (error) {
      console.error('Error cloning global tool flow to workspace:', error);
      throw error;
    }
  }

  /**
   * Clone global feedback step to workspace using type-safe Drizzle operations
   */
  async cloneGlobalFeedbackStepToWorkspace(name: string, workspaceId: string): Promise<FeedbackStep | null> {
    try {
      const globalStep = await this.getGlobalFeedbackStep(name);
      if (!globalStep) {
        throw new Error(`Global feedback step '${name}' not found`);
      }

      // Create new feedback step for workspace using type-safe insert
      const newFeedbackStep: NewFeedbackStep = {
        id: uuidv4(),
        name,
        description: globalStep.description,
        templateContent: globalStep.templateContent,
        variableSchema: globalStep.variableSchema,
        isGlobal: false,
        workspaceId
      };

      await this.drizzleDb.insert(feedbackSteps).values(newFeedbackStep);

      return await this.getFeedbackStep(name, workspaceId);
    } catch (error) {
      console.error('Error cloning global feedback step to workspace:', error);
      throw error;
    }
  }
}