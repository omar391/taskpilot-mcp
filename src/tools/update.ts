import { z } from 'zod';
import type { TaskPilotToolResult, ToolStepResult, MultiStepToolInput } from '../types/index.js';
import { BaseTool, BaseToolConfig, ToolDefinition, createBaseToolSchema } from './base-tool.js';
import type { DrizzleDatabaseManager } from '../database/drizzle-connection.js';
import { WorkspaceDatabaseService } from '../database/workspace-queries.js';
import { DatabaseService } from '../services/database-service.js';
import { ToolNames } from '../constants/tool-names.js';

export const updateToolSchema = createBaseToolSchema(ToolNames.UPDATE, {
  task_id: z.string().describe('Task ID to update (e.g., TP-001)'),
  field: z.enum(['title', 'description', 'priority', 'status', 'progress', 'notes', 'connected_files', 'blocked_by']).describe('Field to update'),
  value: z.string().describe('New value for the field'),
  reason: z.string().optional().describe('Reason for the update (for audit trail)')
}, ['task_id', 'workspace_path', 'field', 'value']);

export type UpdateToolInput = z.infer<typeof updateToolSchema>;

/**
 * TaskPilot Update Tool - Refactored using BaseTool interface
 * 
 * Enhanced with database-driven stepId enumeration and common error handling.
 */
export class UpdateToolNew extends BaseTool {
  constructor(drizzleDb: DrizzleDatabaseManager) {
    const config: BaseToolConfig = {
      name: ToolNames.UPDATE,
      description: 'Update task properties with validation and audit trail. Supports multi-step workflow.',
      requiredFields: ['task_id', 'workspace_path', 'field', 'value'],
      additionalProperties: {
        task_id: {
          type: 'string',
          description: 'Task ID to update (e.g., TP-001)'
        },
        field: {
          type: 'string',
          enum: ['title', 'description', 'priority', 'status', 'progress', 'notes', 'connected_files', 'blocked_by'],
          description: 'Field to update'
        },
        value: {
          type: 'string',
          description: 'New value for the field'
        },
        reason: {
          type: 'string',
          description: 'Reason for the update (for audit trail)'
        }
      }
    };

    super(drizzleDb, config);
  }

  /**
   * Execute taskpilot_update tool with multi-step support using base class validation
   */
  async execute(input: MultiStepToolInput): Promise<ToolStepResult | TaskPilotToolResult> {
    try {
      const { stepId, workspace_path } = input;
      const { task_id, field, value, reason } = input as UpdateToolInput;

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
        case 'validate':
          return await this.handleValidationStep(input as UpdateToolInput, workspace);
        case 'confirm':
          return await this.handleConfirmStep(input as UpdateToolInput, workspace);
        default:
          return await this.handleInitialStep(input as UpdateToolInput, workspace);
      }

    } catch (error) {
      const errorMessage = `Error in taskpilot_update: ${error instanceof Error ? error.message : String(error)}`;
      return {
        isFinalStep: true,
        feedback: errorMessage,
        data: { error: true, input }
      };
    }
  }

  /**
   * Initial step - validate update request
   */
  private async handleInitialStep(input: UpdateToolInput, workspace: any): Promise<ToolStepResult> {
    const { task_id, field, value, reason } = input;

    const orchestrationResult = await this.orchestrator.orchestratePrompt(
      ToolNames.UPDATE,
      workspace.id,
      {
        task_id,
        field,
        value,
        reason: reason || 'No reason provided',
        step: 'initial'
      }
    );

    return {
      isFinalStep: false,
      nextStepId: 'validate',
      feedback: orchestrationResult.prompt_text,
      data: { task_id, field, value, reason }
    };
  }

  /**
   * Validation step - verify update safety
   */
  private async handleValidationStep(input: UpdateToolInput, workspace: any): Promise<ToolStepResult> {
    const { task_id, field, value, reason } = input;

    const orchestrationResult = await this.orchestrator.orchestratePrompt(
      'taskpilot_update',
      workspace.id,
      {
        task_id,
        field,
        value,
        reason: reason || 'No reason provided',
        step: 'validation'
      }
    );

    return {
      isFinalStep: false,
      nextStepId: 'confirm',
      feedback: orchestrationResult.prompt_text,
      data: { task_id, field, value, reason, validated: true }
    };
  }

  /**
   * Confirmation step - apply the update (final step)
   */
  private async handleConfirmStep(input: UpdateToolInput, workspace: any): Promise<ToolStepResult> {
    const { task_id, field, value, reason } = input;

    const orchestrationResult = await this.orchestrator.orchestratePrompt(
      'taskpilot_update',
      workspace.id,
      {
        task_id,
        field,
        value,
        reason: reason || 'No reason provided',
        step: 'confirm'
      }
    );

    return {
      isFinalStep: true,
      feedback: orchestrationResult.prompt_text,
      data: {
        task_id,
        field,
        value,
        reason,
        update_applied: true,
        workspace_id: workspace.id
      }
    };
  }

  /**
   * Get tool definition with dynamic stepId enumeration
   */
  static async getToolDefinitionDynamic(drizzleDb: DrizzleDatabaseManager): Promise<ToolDefinition> {
    const instance = new UpdateToolNew(drizzleDb);
    return await instance.getToolDefinition();
  }

  /**
   * Static tool definition for immediate use (fallback)
   */
  static getToolDefinition(): ToolDefinition {
    return {
      name: 'taskpilot_update',
      description: 'Update task properties with validation and audit trail. Supports multi-step workflow.',
      inputSchema: {
        type: 'object',
        properties: {
          stepId: {
            type: 'string',
            enum: ['validate', 'confirm'],
            description: 'Optional step ID for multi-step workflow: validate, confirm'
          },
          task_id: {
            type: 'string',
            description: 'Task ID to update (e.g., TP-001)'
          },
          workspace_path: {
            type: 'string',
            description: 'Absolute path to the workspace directory'
          },
          field: {
            type: 'string',
            enum: ['title', 'description', 'priority', 'status', 'progress', 'notes', 'connected_files', 'blocked_by'],
            description: 'Field to update'
          },
          value: {
            type: 'string',
            description: 'New value for the field'
          },
          reason: {
            type: 'string',
            description: 'Reason for the update (for audit trail)'
          }
        },
        required: ['task_id', 'workspace_path', 'field', 'value']
      }
    };
  }
}
