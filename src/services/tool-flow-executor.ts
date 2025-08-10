import type { DrizzleDatabaseManager } from '../database/drizzle-connection.js';
import { GlobalDatabaseService } from '../database/global-queries.js';
import { PromptOrchestrator } from './prompt-orchestrator.js';
import { 
  toolFlows,
  toolFlowSteps,
  feedbackSteps
} from '../database/schema/global-schema.js';
import { eq, and, isNull } from 'drizzle-orm';
import type { 
  ToolStepResult, 
  TaskPilotToolResult, 
  MultiStepToolInput 
} from '../types/index.js';

/**
 * Database-driven tool flow execution service
 * 
 * Replaces hardcoded switch statements with dynamic step routing
 * based on tool flow steps stored in the database.
 */
export class ToolFlowExecutor {
  private globalDb: GlobalDatabaseService;
  private orchestrator: PromptOrchestrator;
  private drizzleDb: DrizzleDatabaseManager;

  constructor(drizzleDb: DrizzleDatabaseManager) {
    this.drizzleDb = drizzleDb;
    this.globalDb = new GlobalDatabaseService(drizzleDb);
    this.orchestrator = new PromptOrchestrator(drizzleDb);
  }

  /**
   * Execute a tool flow step based on database configuration
   */
  async executeStep(
    toolName: string,
    stepId: string | undefined,
    input: MultiStepToolInput,
    stepHandler: StepHandlerMap
  ): Promise<ToolStepResult | TaskPilotToolResult> {
    try {
      // Get tool flow configuration from database
      const toolFlow = await this.getToolFlowByName(toolName);
      if (!toolFlow) {
        throw new Error(`Tool flow not found for tool: ${toolName}`);
      }

      // Get step configuration
      const stepConfig = await this.getStepConfiguration(toolFlow.id, stepId);
      if (!stepConfig) {
        // Default to initial step if no stepId provided or step not found
        return this.executeInitialStep(toolName, input, stepHandler);
      }

      // Execute step using the appropriate handler
      const stepFunction = stepConfig.systemToolFn;
      const handler = stepHandler[stepFunction];
      
      if (!handler) {
        throw new Error(`Step handler not found for function: ${stepFunction}`);
      }

      // Execute the step
      const result = await handler(input);

      // Enhance result with database-driven next step information
      if ('isFinalStep' in result && !result.isFinalStep) {
        const nextStepInfo = await this.getNextStepInfo(toolFlow.id, stepConfig.stepOrder);
        if (nextStepInfo) {
          result.nextStepId = nextStepInfo.systemToolFn;
          
          // Generate dynamic next step instructions
          if (result.feedback) {
            result.feedback += `\n\n**NEXT STEP:** Call ${toolName} with stepId="${nextStepInfo.systemToolFn}"`;
          }
        }
      }

      return result;

    } catch (error) {
      throw new Error(`Tool flow execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get tool flow configuration by tool name
   */
  private async getToolFlowByName(toolName: string) {
    try {
      return await this.globalDb.getToolFlowByName(toolName);
    } catch (error) {
      return null;
    }
  }

  /**
   * Get step configuration for a specific step in a tool flow
   */
  private async getStepConfiguration(toolFlowId: string, stepId: string | undefined) {
    if (!stepId) return null;

    try {
      const steps = await this.globalDb.getToolFlowSteps(toolFlowId);
      return steps.find(step => step.systemToolFn === stepId) || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get next step information based on current step order
   */
  private async getNextStepInfo(toolFlowId: string, currentStepOrder: number) {
    try {
      const steps = await this.globalDb.getToolFlowSteps(toolFlowId);
      const sortedSteps = steps.sort((a, b) => a.stepOrder - b.stepOrder);
      const currentIndex = sortedSteps.findIndex(step => step.stepOrder === currentStepOrder);
      
      if (currentIndex >= 0 && currentIndex < sortedSteps.length - 1) {
        return sortedSteps[currentIndex + 1];
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Execute initial step when no stepId is provided
   */
  private async executeInitialStep(
    toolName: string,
    input: MultiStepToolInput,
    stepHandler: StepHandlerMap
  ): Promise<ToolStepResult | TaskPilotToolResult> {
    // Look for initial step handler
    const initialHandler = stepHandler['initial'] || stepHandler['start'];
    
    if (!initialHandler) {
      throw new Error(`Initial step handler not found for tool: ${toolName}`);
    }

    return initialHandler(input);
  }

  /**
   * Get available step IDs for a tool from database
   */
  async getAvailableStepIds(toolName: string, workspaceId?: string): Promise<string[]> {
    try {
      const db = this.drizzleDb.getDb();
      
      // First get the tool flow
      const toolFlowQuery = await db
        .select()
        .from(toolFlows)
        .where(
          workspaceId 
            ? and(eq(toolFlows.toolName, toolName), eq(toolFlows.workspaceId, workspaceId))
            : and(eq(toolFlows.toolName, toolName), isNull(toolFlows.workspaceId))
        )
        .limit(1);

      if (toolFlowQuery.length === 0) {
        // Fall back to global if workspace-specific doesn't exist
        if (workspaceId) {
          const globalFlowQuery = await db
            .select()
            .from(toolFlows)
            .where(and(eq(toolFlows.toolName, toolName), isNull(toolFlows.workspaceId)))
            .limit(1);
          
          if (globalFlowQuery.length === 0) {
            return [];
          }
          
          // Get steps for global flow
          const steps = await db
            .select({ systemToolFn: toolFlowSteps.systemToolFn })
            .from(toolFlowSteps)
            .where(eq(toolFlowSteps.toolFlowId, globalFlowQuery[0].id))
            .orderBy(toolFlowSteps.stepOrder);
          
          return steps.map((step: { systemToolFn: string }) => step.systemToolFn);
        }
        return [];
      }

      // Get steps for the tool flow
      const steps = await db
        .select({ systemToolFn: toolFlowSteps.systemToolFn })
        .from(toolFlowSteps)
        .where(eq(toolFlowSteps.toolFlowId, toolFlowQuery[0].id))
        .orderBy(toolFlowSteps.stepOrder);

      return steps.map((step: { systemToolFn: string }) => step.systemToolFn);
    } catch (error) {
      console.error('Error getting available step IDs:', error);
      return [];
    }
  }  /**
   * Generate dynamic next step instructions from database
   */
  async generateNextStepInstructions(
    toolName: string,
    currentStepId: string,
    context: Record<string, any> = {}
  ): Promise<string | null> {
    try {
      const toolFlow = await this.getToolFlowByName(toolName);
      if (!toolFlow) return null;

      const currentStep = await this.getStepConfiguration(toolFlow.id, currentStepId);
      if (!currentStep) return null;

      const nextStep = await this.getNextStepInfo(toolFlow.id, currentStep.stepOrder);
      if (!nextStep) return null;

      // Generate contextual instruction based on next step metadata
      const metadata = nextStep.metadata as any || {};
      const instruction = metadata.instruction || `Proceed to next step`;

      return `**NEXT STEP:** Call ${toolName} with stepId="${nextStep.systemToolFn}" - ${instruction}`;
    } catch (error) {
      return null;
    }
  }

  /**
   * Validate if a step transition is valid for a tool
   */
  async validateStepTransition(
    toolName: string, 
    fromStep: string | undefined, 
    toStep: string,
    workspaceId?: string
  ): Promise<boolean> {
    try {
      const availableSteps = await this.getAvailableStepIds(toolName, workspaceId);
      
      // If no steps are available, transition is invalid
      if (availableSteps.length === 0) {
        return false;
      }
      
      // Check if the target step exists
      if (!availableSteps.includes(toStep)) {
        return false;
      }
      
      // If fromStep is undefined (starting), allow any first step
      if (!fromStep) {
        return true;
      }
      
      // Check if fromStep exists
      if (!availableSteps.includes(fromStep)) {
        return false;
      }
      
      // For now, allow any step to transition to any other step
      // In future versions, we could add more sophisticated transition rules
      return true;
    } catch (error) {
      console.error('Error validating step transition:', error);
      return false;
    }
  }
}

/**
 * Type definition for step handler functions
 */
export type StepHandler = (input: MultiStepToolInput) => Promise<ToolStepResult | TaskPilotToolResult>;

/**
 * Map of step function names to their handlers
 */
export type StepHandlerMap = {
  [stepFunctionName: string]: StepHandler;
};

/**
 * Interface for tools that support database-driven step execution
 */
export interface DatabaseDrivenTool {
  /**
   * Get map of step handlers for this tool
   */
  getStepHandlers(): StepHandlerMap;

  /**
   * Get tool name for database lookup
   */
  getToolName(): string;
}
