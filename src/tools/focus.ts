import { z } from 'zod';
import type { TaskPilotToolResult, ToolStepResult, MultiStepToolInput } from '../types/index.js';
import { BaseTool, BaseToolConfig, ToolDefinition, createBaseToolSchema } from './base-tool.js';
import type { DrizzleDatabaseManager } from '../database/drizzle-connection.js';

// Input schema using the new base pattern
export const focusToolSchema = createBaseToolSchema('taskpilot_focus', {
  task_id: z.string().describe('Task ID to focus on (e.g., TP-001)')
}, ['task_id', 'workspace_path']);

export type FocusToolInput = z.infer<typeof focusToolSchema>;

/**
 * TaskPilot Focus Tool - Refactored using BaseTool interface
 * 
 * Enhanced with database-driven stepId enumeration and common error handling.
 */
export class FocusToolNew extends BaseTool {
  constructor(drizzleDb: DrizzleDatabaseManager) {
    const config: BaseToolConfig = {
      name: 'taskpilot_focus',
      description: 'Focus on specific task and provide implementation guidance. Supports multi-step workflow.',
      requiredFields: ['task_id', 'workspace_path'],
      additionalProperties: {
        task_id: {
          type: 'string',
          description: 'Task ID to focus on (e.g., TP-001)'
        }
      }
    };

    super(drizzleDb, config);
  }

  /**
   * Execute taskpilot_focus tool with multi-step support using base class validation
   */
  async execute(input: MultiStepToolInput): Promise<ToolStepResult | TaskPilotToolResult> {
    try {
      const { stepId, workspace_path } = input;
      const { task_id } = input as FocusToolInput;

      // Use base class workspace validation
      const workspaceValidation = await this.validateWorkspace(workspace_path);
      if (!workspaceValidation.isValid) {
        return {
          isFinalStep: true,
          feedback: workspaceValidation.error!,
          data: { error: true, workspace_path }
        };
      }

      const workspace = workspaceValidation.workspace;

      // Route to appropriate step handler
      switch (stepId) {
        case 'analyze':
          return await this.handleAnalyzeStep(input as FocusToolInput, workspace);
        case 'plan':
          return await this.handlePlanStep(input as FocusToolInput, workspace);
        case 'implement':
          return await this.handleImplementStep(input as FocusToolInput, workspace);
        default:
          return await this.handleInitialStep(input as FocusToolInput, workspace);
      }

    } catch (error) {
      const errorMessage = `Error in taskpilot_focus: ${error instanceof Error ? error.message : String(error)}`;
      return {
        isFinalStep: true,
        feedback: errorMessage,
        data: { error: true, input }
      };
    }
  }

  /**
   * Initial step - basic task focus
   */
  private async handleInitialStep(input: FocusToolInput, workspace: any): Promise<ToolStepResult> {
    const { task_id } = input;

    const orchestrationResult = await this.orchestrator.orchestratePrompt(
      'taskpilot_focus',
      workspace.id,
      {
        task_id,
        step: 'initial'
      }
    );

    return {
      isFinalStep: false,
      nextStepId: 'analyze',
      feedback: orchestrationResult.prompt_text,
      data: { task_id, focused: true }
    };
  }

  /**
   * Analyze step - detailed task analysis
   */
  private async handleAnalyzeStep(input: FocusToolInput, workspace: any): Promise<ToolStepResult> {
    const { task_id } = input;

    const orchestrationResult = await this.orchestrator.orchestratePrompt(
      'taskpilot_focus',
      workspace.id,
      {
        task_id,
        step: 'analyze'
      }
    );

    return {
      isFinalStep: false,
      nextStepId: 'plan',
      feedback: orchestrationResult.prompt_text,
      data: { task_id, analysis_complete: true }
    };
  }

  /**
   * Plan step - implementation planning
   */
  private async handlePlanStep(input: FocusToolInput, workspace: any): Promise<ToolStepResult> {
    const { task_id } = input;

    const orchestrationResult = await this.orchestrator.orchestratePrompt(
      'taskpilot_focus',
      workspace.id,
      {
        task_id,
        step: 'plan'
      }
    );

    return {
      isFinalStep: false,
      nextStepId: 'implement',
      feedback: orchestrationResult.prompt_text,
      data: { task_id, plan_ready: true }
    };
  }

  /**
   * Implement step - implementation guidance (final step)
   */
  private async handleImplementStep(input: FocusToolInput, workspace: any): Promise<ToolStepResult> {
    const { task_id } = input;

    const orchestrationResult = await this.orchestrator.orchestratePrompt(
      'taskpilot_focus',
      workspace.id,
      {
        task_id,
        step: 'implement'
      }
    );

    return {
      isFinalStep: true,
      feedback: orchestrationResult.prompt_text,
      data: {
        task_id,
        implementation_ready: true,
        workspace_id: workspace.id
      }
    };
  }

  /**
   * Get tool definition with dynamic stepId enumeration
   */
  static async getToolDefinitionDynamic(drizzleDb: DrizzleDatabaseManager): Promise<ToolDefinition> {
    const instance = new FocusToolNew(drizzleDb);
    return await instance.getToolDefinition();
  }

  /**
   * Static tool definition for immediate use (fallback)
   */
  static getToolDefinition(): ToolDefinition {
    return {
      name: 'taskpilot_focus',
      description: 'Focus on specific task and provide implementation guidance. Supports multi-step workflow.',
      inputSchema: {
        type: 'object',
        properties: {
          stepId: {
            type: 'string',
            enum: ['analyze', 'plan', 'implement'],
            description: 'Optional step ID for multi-step workflow: analyze, plan, implement'
          },
          task_id: {
            type: 'string',
            description: 'Task ID to focus on (e.g., TP-001)'
          },
          workspace_path: {
            type: 'string',
            description: 'Absolute path to the workspace directory'
          }
        },
        required: ['task_id', 'workspace_path']
      }
    };
  }
}
