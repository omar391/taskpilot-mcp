import { z } from 'zod';
import type { DrizzleDatabaseManager } from '../database/drizzle-connection.js';
import type { TaskPilotToolResult, ToolStepResult, MultiStepToolInput } from '../types/index.js';
import { PromptOrchestrator } from '../services/prompt-orchestrator.js';
import { GlobalDatabaseService } from '../database/global-queries.js';

// Input schema for taskpilot_add tool with multi-step support
export const addToolSchema = z.object({
  stepId: z.string().optional().describe('Optional step ID for multi-step workflow'),
  task_description: z.string().describe('Description of the task to be created'),
  workspace_path: z.string().describe('Absolute path to the workspace directory'),
  priority: z.enum(['High', 'Medium', 'Low']).optional().describe('Task priority level (defaults to Medium)'),
  parent_task_id: z.string().optional().describe('ID of parent task if this is a subtask')
});

export type AddToolInput = z.infer<typeof addToolSchema>;

/**
 * TaskPilot Add Tool - Multi-Step Task Creation Workflow
 * 
 * Enhanced with multi-step support where LLM can call the same tool with different stepIds:
 * - No stepId: Initial validation step
 * - stepId="validate": Analytical validation step  
 * - stepId="create": Final task creation step
 * 
 * This replaces the old orchestration pattern with direct step management.
 */
export class AddTool {
  private orchestrator: PromptOrchestrator;
  private globalDb: GlobalDatabaseService;

  constructor(private drizzleDb: DrizzleDatabaseManager) {
    this.orchestrator = new PromptOrchestrator(drizzleDb);
    this.globalDb = new GlobalDatabaseService(drizzleDb);
  }

  /**
   * Execute taskpilot_add tool with multi-step support
   */
  async execute(input: AddToolInput): Promise<ToolStepResult | TaskPilotToolResult> {
    try {
      const { stepId, task_description, workspace_path, priority = 'Medium', parent_task_id } = input;

      // Ensure workspace exists for all steps
      const workspace = await this.globalDb.getWorkspaceByPath(workspace_path);
      if (!workspace) {
        return {
          content: [{
            type: 'text',
            text: `Error: Workspace not found at path: ${workspace_path}. Please run taskpilot_start first to initialize the workspace.`
          }],
          isError: true
        };
      }

      // Route to appropriate step handler
      switch (stepId) {
        case 'validate':
          return await this.handleValidationStep(input, workspace);
        case 'create':
          return await this.handleCreationStep(input, workspace);
        default:
          return await this.handleInitialStep(input, workspace);
      }
    } catch (error) {
      console.error('Error in taskpilot_add:', error);
      return {
        content: [{
          type: 'text',
          text: `Error processing task creation: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  /**
   * Initial step - provide analytical validation framework
   */
  private async handleInitialStep(input: AddToolInput, workspace: any): Promise<TaskPilotToolResult> {
    const { task_description, priority, parent_task_id } = input;

    // Generate orchestrated prompt for initial guidance
    const orchestrationResult = await this.orchestrator.orchestratePrompt(
      'taskpilot_add',
      workspace.id,
      {
        task_description,
        priority,
        parent_task_id,
        step: 'initial'
      }
    );

    const stepResult: ToolStepResult = {
      isFinalStep: false,
      nextStepId: 'validate',
      feedback: `Apply analytical validation to the task description: "${task_description}"`,
      data: { task_description, priority, parent_task_id }
    };

    return {
      content: [{
        type: 'text',
        text: `${orchestrationResult.prompt_text}\n\n**NEXT STEP:** Call taskpilot_add with stepId="validate" after applying analytical validation.`
      }],
      stepResult
    };
  }

  /**
   * Validation step - process analytical feedback
   */
  private async handleValidationStep(input: AddToolInput, workspace: any): Promise<TaskPilotToolResult> {
    const { task_description, priority, parent_task_id } = input;

    // Generate validation-specific prompt
    const orchestrationResult = await this.orchestrator.orchestratePrompt(
      'taskpilot_add',
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

    return {
      content: [{
        type: 'text',
        text: `${orchestrationResult.prompt_text}\n\n**NEXT STEP:** Call taskpilot_add with stepId="create" to create the validated task.`
      }],
      stepResult
    };
  }

  /**
   * Creation step - call taskpilot_create_task
   */
  private async handleCreationStep(input: AddToolInput, workspace: any): Promise<TaskPilotToolResult> {
    const { task_description, priority, parent_task_id } = input;

    const stepResult: ToolStepResult = {
      isFinalStep: true,
      feedback: `Task validation complete. Now call taskpilot_create_task to create the task.`,
      data: {
        task_description,
        priority,
        parent_task_id,
        workspace_path: workspace.path,
        ready_for_creation: true
      }
    };

    return {
      content: [{
        type: 'text',
        text: `Task requirements validated successfully!\n\n**FINAL ACTION:** Call \`taskpilot_create_task\` with:\n- task_description: "${task_description}"\n- workspace_path: "${workspace.path}"\n- priority: "${priority}"${parent_task_id ? `\n- parent_task_id: "${parent_task_id}"` : ''}`
      }],
      stepResult
    };
  }

  /**
   * Get tool definition for MCP server with multi-step support
   */
  static getToolDefinition() {
    return {
      name: 'taskpilot_add',
      description: 'Multi-step task creation workflow with analytical validation. Supports stepId parameter for iterative LLM calls.',
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
