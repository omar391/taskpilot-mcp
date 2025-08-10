import { z } from 'zod';
import type { DrizzleDatabaseManager } from '../database/drizzle-connection.js';
import type { TaskPilotToolResult, ToolStepResult, MultiStepToolInput } from '../types/index.js';
import { PromptOrchestrator } from '../services/prompt-orchestrator.js';
import { GlobalDatabaseService } from '../database/global-queries.js';
import { DynamicSchemaGenerator } from '../services/dynamic-schema-generator.js';

/**
 * Base Tool Interface - Common schema and functionality for all MCP tools
 * 
 * Provides:
 * - Dynamic stepId enumeration from database tool flows
 * - Common workspace validation
 * - Standardized error handling
 * - Shared orchestrator and database services
 */

export interface BaseToolConfig {
  name: string;
  description: string;
  requiredFields: string[];
  additionalProperties?: Record<string, any>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
}

/**
 * Abstract base class that all TaskPilot MCP tools should extend
 */
export abstract class BaseTool {
  protected orchestrator: PromptOrchestrator;
  protected globalDb: GlobalDatabaseService;
  protected toolConfig: BaseToolConfig;
  protected dbManager: DrizzleDatabaseManager;

  constructor(
    protected drizzleDb: DrizzleDatabaseManager,
    config: BaseToolConfig
  ) {
    this.orchestrator = new PromptOrchestrator(drizzleDb);
    this.globalDb = new GlobalDatabaseService(drizzleDb);
    this.toolConfig = config;
    this.dbManager = drizzleDb;
  }

  /**
   * Get available step IDs for this tool from database tool flows
   * This replaces hardcoded enum values with dynamic database queries
   */
  protected async getAvailableStepIds(): Promise<string[]> {
    try {
      // Query global tool flow for this tool name
      const toolFlow = await this.globalDb.getToolFlowByName(this.toolConfig.name);
      
      if (!toolFlow) {
        return []; // No step IDs if no flows defined
      }

      // Extract step IDs from tool flow steps
      const stepIds: Set<string> = new Set();
      const steps = await this.globalDb.getToolFlowSteps(toolFlow.id);
      
      for (const step of steps) {
        // Extract step identifiers from feedback step names
        if (step.feedbackStep) {
          // Use feedback step name as step identifier, removing tool prefix if present
          let stepId = step.feedbackStep;
          const toolPrefix = `${this.toolConfig.name}_`;
          if (stepId.startsWith(toolPrefix)) {
            stepId = stepId.replace(toolPrefix, '');
          }
          
          // Common step ID patterns
          if (stepId.includes('validate')) stepIds.add('validate');
          if (stepId.includes('create')) stepIds.add('create');
          if (stepId.includes('detailed')) stepIds.add('detailed');
          if (stepId.includes('recommendations')) stepIds.add('recommendations');
          if (stepId.includes('rules')) stepIds.add('rules');
          if (stepId.includes('analyze')) stepIds.add('analyze');
          if (stepId.includes('plan')) stepIds.add('plan');
          if (stepId.includes('implement')) stepIds.add('implement');
          if (stepId.includes('confirm')) stepIds.add('confirm');
        }
      }

      return Array.from(stepIds).sort();
    } catch (error) {
      console.warn(`Warning: Could not load step IDs for tool ${this.toolConfig.name}:`, error);
      return []; // Fallback to no step support
    }
  }

  /**
   * Generate dynamic tool definition with database-driven stepId enums
   */
  async getToolDefinition(): Promise<ToolDefinition> {
    const availableStepIds = await this.getAvailableStepIds();
    
    const baseProperties: Record<string, any> = {
      workspace_path: {
        type: 'string',
        description: 'Absolute path to the workspace directory'
      }
    };

    // Add stepId property with dynamic enum if steps are available
    if (availableStepIds.length > 0) {
      baseProperties.stepId = {
        type: 'string',
        enum: availableStepIds,
        description: `Optional step ID for multi-step workflow: ${availableStepIds.join(', ')}`
      };
    }

    // Merge additional properties from tool config
    const allProperties = {
      ...baseProperties,
      ...this.toolConfig.additionalProperties
    };

    return {
      name: this.toolConfig.name,
      description: this.toolConfig.description,
      inputSchema: {
        type: 'object',
        properties: allProperties,
        required: this.toolConfig.requiredFields
      }
    };
  }

  /**
   * Dynamically validate input arguments with database-driven stepId enums
   */
  protected async validateInputDynamically(input: any): Promise<{ isValid: boolean; validatedInput?: any; error?: string }> {
    try {
      const schemaGenerator = new DynamicSchemaGenerator(this.dbManager);
      const dynamicSchema = await schemaGenerator.generateToolSchema(
        this.toolConfig.name,
        this.toolConfig.additionalProperties || {},
        this.toolConfig.requiredFields
      );

      const validatedInput = dynamicSchema.parse(input);
      return {
        isValid: true,
        validatedInput
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(err => 
          `${err.path.join('.')}: ${err.message}`
        ).join(', ');
        return {
          isValid: false,
          error: `Input validation failed: ${errorMessages}`
        };
      }
      return {
        isValid: false,
        error: `Dynamic validation error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Common workspace validation that all tools need
   */
  protected async validateWorkspace(workspacePath: string): Promise<{
    isValid: boolean;
    workspace?: any;
    error?: string;
  }> {
    try {
      const workspace = await this.globalDb.getWorkspaceByPath(workspacePath);
      
      if (!workspace) {
        return {
          isValid: false,
          error: `Workspace not found at path: ${workspacePath}. Please run taskpilot_start first to initialize the workspace.`
        };
      }

      return {
        isValid: true,
        workspace
      };
    } catch (error) {
      return {
        isValid: false,
        error: `Error validating workspace: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Create standardized error result
   */
  protected createErrorResult(message: string, data?: any): TaskPilotToolResult {
    return {
      content: [{
        type: 'text',
        text: message
      }],
      isError: true,
      stepResult: {
        isFinalStep: true,
        feedback: message,
        data: { error: true, ...data }
      }
    };
  }

  /**
   * Create standardized success result
   */
  protected createSuccessResult(
    text: string, 
    stepResult?: ToolStepResult
  ): TaskPilotToolResult {
    return {
      content: [{
        type: 'text',
        text
      }],
      isError: false,
      stepResult
    };
  }

  /**
   * Execute tool with common validation and error handling
   * Subclasses must implement this method
   */
  abstract execute(input: MultiStepToolInput): Promise<ToolStepResult | TaskPilotToolResult>;

  /**
   * Static method for getting tool definition (for compatibility)
   * Subclasses should implement this for immediate schema access
   */
  static getToolDefinition(): ToolDefinition {
    throw new Error('Static getToolDefinition() must be implemented by subclass');
  }
}

/**
 * Helper function to create base tool schema with common stepId pattern
 * This can be used by tools that don't want to extend the full BaseTool class
 */
export function createBaseToolSchema(
  toolName: string,
  additionalProperties: Record<string, any> = {},
  requiredFields: string[] = ['workspace_path']
): z.ZodObject<any> {
  const baseSchema = {
    stepId: z.string().optional().describe('Optional step ID for multi-step workflow'),
    workspace_path: z.string().describe('Absolute path to the workspace directory'),
    ...additionalProperties
  };

  return z.object(baseSchema);
}

/**
 * Type guard to check if a result is an error
 */
export function isToolError(result: TaskPilotToolResult | ToolStepResult): boolean {
  if ('isError' in result) {
    return result.isError === true;
  }
  if ('data' in result && result.data) {
    return result.data.error === true;
  }
  return false;
}
