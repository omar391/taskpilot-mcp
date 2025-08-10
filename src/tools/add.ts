import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import type { TaskPilotToolResult, ToolStepResult, MultiStepToolInput } from '../types/index.js';
import { BaseTool, BaseToolConfig, ToolDefinition, createBaseToolSchema } from './base-tool.js';
import type { DrizzleDatabaseManager } from '../database/drizzle-connection.js';
import { WorkspaceDatabaseService } from '../database/workspace-queries.js';
import type { NewTask } from '../database/schema/workspace-schema.js';
import { DatabaseService } from '../services/database-service.js';
import { ToolFlowExecutor, type StepHandlerMap, type DatabaseDrivenTool } from '../services/tool-flow-executor.js';
import { ToolNames } from '../constants/tool-names.js';

export const addToolSchema = createBaseToolSchema(ToolNames.ADD, {
  task_description: z.string().describe('Description of the task to add'),
}, ['task_description', 'workspace_path']);

export type AddToolInput = z.infer<typeof addToolSchema>;

/**
 * TaskPilot Add Tool - Refactored using BaseTool interface
 * 
 * Enhanced with database-driven stepId enumeration and common error handling.
 * Demonstrates the new pattern all tools should follow.
 */
export class AddToolNew extends BaseTool {
  constructor(drizzleDb: DrizzleDatabaseManager) {
    const config: BaseToolConfig = {
      name: ToolNames.ADD,
      description: 'Multi-step task creation workflow with analytical validation and creation. Supports dynamic stepId parameter for iterative LLM calls.',
      requiredFields: ['task_description', 'workspace_path'],
      additionalProperties: {
        task_description: {
          type: 'string',
          description: 'Description of the task to be created'
        },
        priority: {
          type: 'string',
          enum: ['High', 'Medium', 'Low'],
          description: 'Task priority level (defaults to Medium)'
        },
        parent_task_id: {
          type: 'string',
          description: 'ID of parent task if this is a subtask'
        },
        title: {
          type: 'string',
          description: 'Concise task title (will be generated from description if not provided)'
        }
      }
    };

    super(drizzleDb, config);
  }

  /**
   * Execute taskpilot_add tool with multi-step support using base class validation
   */
  async execute(input: MultiStepToolInput): Promise<ToolStepResult | TaskPilotToolResult> {
    try {
      const { stepId, workspace_path } = input;
      const { task_description, priority = 'Medium', parent_task_id, title } = input as AddToolInput;

      // Use base class workspace validation
      const workspaceValidation = await this.validateWorkspace(workspace_path);
      if (!workspaceValidation.isValid) {
        return this.createErrorResult(workspaceValidation.error!, { workspace_path });
      }

      const workspace = workspaceValidation.workspace;

      // Route to appropriate step handler using database-driven flow
      switch (stepId) {
        case 'validate':
          return await this.handleValidationStep(input as AddToolInput, workspace);
        case 'create':
          return await this.handleCreationStep(input as AddToolInput, workspace);
        default:
          return await this.handleInitialStep(input as AddToolInput, workspace);
      }

    } catch (error) {
      const errorMessage = `Error in taskpilot_add: ${error instanceof Error ? error.message : String(error)}`;
      return this.createErrorResult(errorMessage, { input });
    }
  }

  /**
   * Initial step - start analytical validation workflow
   */
  private async handleInitialStep(input: AddToolInput, workspace: any): Promise<TaskPilotToolResult> {
    const { task_description, priority, parent_task_id } = input;

    // Generate initial prompt using orchestrator
    const orchestrationResult = await this.orchestrator.orchestratePrompt(
      ToolNames.ADD,
      workspace.id,
      {
        task_description,
        priority: priority || 'Medium',
        parent_task_id,
        step: 'initial'
      }
    );

    const stepResult: ToolStepResult = {
      isFinalStep: false,
      nextStepId: 'validate',
      feedback: `Apply analytical validation to the task description: \"${task_description}\"`,
      data: { task_description, priority, parent_task_id }
    };

    return this.createSuccessResult(
      `${orchestrationResult.prompt_text}\\n\\n**NEXT STEP:** Call taskpilot_add with stepId=\"validate\" after applying analytical validation.`,
      stepResult
    );
  }

  /**
   * Validation step - process analytical feedback
   */
  private async handleValidationStep(input: AddToolInput, workspace: any): Promise<TaskPilotToolResult> {
    const { task_description, priority, parent_task_id } = input;

    // Generate validation-specific prompt
    const orchestrationResult = await this.orchestrator.orchestratePrompt(
      ToolNames.ADD,
      workspace.id,
      {
        task_description,
        priority,
        parent_task_id,
        step: 'validation'
      }
    );

    const stepResult: ToolStepResult = {
      isFinalStep: false,
      nextStepId: 'create',
      feedback: `Validation complete. Ready to create task.`,
      data: { task_description, priority, parent_task_id, validated: true }
    };

    return this.createSuccessResult(
      `${orchestrationResult.prompt_text}\\n\\n**NEXT STEP:** Call taskpilot_add with stepId=\"create\" to create the validated task.`,
      stepResult
    );
  }

    /**
   * Handle creation step - create task directly
   */
  private async handleCreationStep(input: AddToolInput, workspace: any): Promise<TaskPilotToolResult> {
    const { task_description, priority, parent_task_id, title } = input;

    try {
      // Generate task ID and title if not provided
      const taskId = `TP-${String(Date.now()).slice(-6)}`;
      const taskTitle = title || this.generateTaskTitle(task_description);

      // Create task in workspace database
      const workspaceDb = new WorkspaceDatabaseService(workspace.path);
      await workspaceDb.initialize();

      const newTask: NewTask = {
        id: taskId,
        title: taskTitle,
        description: task_description,
        priority: (priority?.toLowerCase() as 'high' | 'medium' | 'low') || 'medium',
        status: 'backlog',
        progress: 0,
        dependencies: [],
        notes: '',
        connectedFiles: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await workspaceDb.createTask(newTask);

      // Generate success prompt
      const orchestrationResult = await this.orchestrator.orchestratePrompt(
        ToolNames.ADD,
        workspace.id,
        {
          task_id: taskId,
          task_title: taskTitle,
          task_description,
          priority,
          parent_task_id,
          step: 'created'
        }
      );

      return this.createSuccessResult(
        orchestrationResult.prompt_text,
        {
          isFinalStep: true,
          feedback: `Task ${taskId} created successfully`,
          data: {
            task_id: taskId,
            task_title: taskTitle,
            created: true,
            workspace_id: workspace.id
          }
        }
      );

    } catch (error) {
      return this.createErrorResult(
        `Failed to create task: ${error instanceof Error ? error.message : String(error)}`,
        { task_description, workspace_path: workspace.path }
      );
    }
  }

  /**
   * Generate a concise task title from description
   */
  private generateTaskTitle(description: string): string {
    // Extract first sentence or first 50 characters
    const sentences = description.split(/[.!?]+/);
    const firstSentence = sentences[0]?.trim();

    if (firstSentence && firstSentence.length <= 60) {
      return firstSentence;
    }

    // Fallback to first 50 characters with ellipsis
    return description.substring(0, 50).trim() + (description.length > 50 ? '...' : '');
  }

  /**
   * Get tool definition with dynamic stepId enumeration
   */
  static async getToolDefinitionDynamic(drizzleDb: DrizzleDatabaseManager): Promise<ToolDefinition> {
    const instance = new AddToolNew(drizzleDb);
    return await instance.getToolDefinition();
  }

  /**
   * Static tool definition for immediate use (fallback)
   */
  static getToolDefinition(): ToolDefinition {
    return {
      name: ToolNames.ADD,
      description: 'Multi-step task creation workflow with analytical validation. Supports dynamic stepId parameter for iterative LLM calls.',
      inputSchema: {
        type: 'object',
        properties: {
          stepId: {
            type: 'string',
            enum: ['validate', 'create'],
            description: 'Optional step ID for multi-step workflow: validate, create'
          },
          task_description: {
            type: 'string',
            description: 'Description of the task to be created'
          },
          workspace_path: {
            type: 'string',
            description: 'Absolute path to the workspace directory'
          },
          priority: {
            type: 'string',
            enum: ['High', 'Medium', 'Low'],
            description: 'Task priority level (defaults to Medium)'
          },
          parent_task_id: {
            type: 'string',
            description: 'ID of parent task if this is a subtask'
          }
        },
        required: ['task_description', 'workspace_path']
      }
    };
  }
}
