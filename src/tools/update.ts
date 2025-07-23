import { z } from 'zod';
import type { DrizzleDatabaseManager } from '../database/drizzle-connection.js';
import type { TaskPilotToolResult, ToolStepResult, MultiStepToolInput } from '../types/index.js';
import { PromptOrchestrator } from '../services/prompt-orchestrator.js';
import { GlobalDatabaseService } from '../database/global-queries.js';

// Input schema for taskpilot_update tool with multi-step support
export const updateToolSchema = z.object({
  stepId: z.string().optional().describe('Step ID for multi-step flow: validate, confirm'),
  task_id: z.string().describe('Task ID to update (e.g., TP-001)'),
  workspace_path: z.string().describe('Absolute path to the workspace directory'),
  field: z.enum(['title', 'description', 'priority', 'status', 'progress', 'notes', 'connected_files', 'blocked_by']).describe('Field to update'),
  value: z.string().describe('New value for the field'),
  reason: z.string().optional().describe('Reason for the update (for audit trail)')
});

export type UpdateToolInput = z.infer<typeof updateToolSchema> & MultiStepToolInput;

/**
 * TaskPilot Update Tool - Task Property Updates (Pure TypeScript/Drizzle)
 * 
 * MCP tool for modifying task properties with audit trail. Supports updating
 * title, description, priority, status, progress, notes, connected files,
 * and blocking relationships while maintaining data integrity.
 */
export class UpdateTool {
  private orchestrator: PromptOrchestrator;
  private globalDb: GlobalDatabaseService;

  constructor(private drizzleDb: DrizzleDatabaseManager) {
    this.orchestrator = new PromptOrchestrator(drizzleDb);
    this.globalDb = new GlobalDatabaseService(drizzleDb);
  }

  /**
   * Execute taskpilot_update tool with multi-step support
   */
  async execute(input: UpdateToolInput): Promise<ToolStepResult> {
    try {
      const { task_id, workspace_path, field, value, reason, stepId } = input;

      // Get workspace
      const workspace = await this.globalDb.getWorkspaceByPath(workspace_path);
      if (!workspace) {
        return {
          isFinalStep: true,
          feedback: `Error: Workspace not found at path: ${workspace_path}. Please run taskpilot_start first to initialize the workspace.`,
          data: { error: true, workspace_path: workspace_path }
        };
      }

      // Handle multi-step flow
      if (stepId === 'validate') {
        return await this.handleValidateStep(workspace, task_id, workspace_path, field, value, reason);
      } else if (stepId === 'confirm') {
        return await this.handleConfirmStep(workspace, task_id, workspace_path, field, value, reason);
      }

      // Default: direct update (backward compatibility)
      return await this.handleDirectUpdate(workspace, task_id, workspace_path, field, value, reason);

    } catch (error) {
      console.error('Error in taskpilot_update:', error);
      return {
        isFinalStep: true,
        feedback: `Error updating task: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: { error: true, workspace_path: input.workspace_path }
      };
    }
  }

  private async handleDirectUpdate(workspace: any, task_id: string, workspace_path: string, field: string, value: string, reason?: string): Promise<ToolStepResult> {
    // Generate orchestrated prompt for immediate task update
    const orchestrationResult = await this.orchestrator.orchestratePrompt(
      'taskpilot_update',
      workspace.id,
      {
        task_id,
        workspace_path,
        field,
        value,
        reason,
        workspace_name: workspace.name,
        timestamp: new Date().toISOString(),
        task_file_path: `${workspace_path}/.task/todo/current.md`,
        update_instructions: `Update task ${task_id} field '${field}' to '${value}' in .task/todo/current.md file${reason ? ` (Reason: ${reason})` : ''}`
      }
    );

    return {
      isFinalStep: true,
      feedback: orchestrationResult.prompt_text,
      data: {
        task_id,
        field,
        value,
        updated: true,
        workspace_id: workspace.id
      }
    };
  }

  private async handleValidateStep(workspace: any, task_id: string, workspace_path: string, field: string, value: string, reason?: string): Promise<ToolStepResult> {
    // Generate validation analysis
    const orchestrationResult = await this.orchestrator.orchestratePrompt(
      'taskpilot_update',
      workspace.id,
      {
        task_id,
        workspace_path,
        field,
        value,
        reason,
        validation_mode: true,
        workspace_name: workspace.name,
        timestamp: new Date().toISOString(),
        task_file_path: `${workspace_path}/.task/todo/current.md`,
        update_instructions: `Validate proposed update: task ${task_id} field '${field}' to '${value}'. Check for conflicts, dependencies, and rule compliance.`
      }
    );

    return {
      isFinalStep: false,
      nextStepId: 'confirm',
      feedback: orchestrationResult.prompt_text + '\n\n*Proceed to confirm step to apply the update*',
      data: {
        task_id,
        field,
        value,
        reason,
        validated: true,
        workspace_id: workspace.id
      }
    };
  }

  private async handleConfirmStep(workspace: any, task_id: string, workspace_path: string, field: string, value: string, reason?: string): Promise<ToolStepResult> {
    // Generate confirmation and perform update
    const orchestrationResult = await this.orchestrator.orchestratePrompt(
      'taskpilot_update',
      workspace.id,
      {
        task_id,
        workspace_path,
        field,
        value,
        reason,
        confirm_mode: true,
        workspace_name: workspace.name,
        timestamp: new Date().toISOString(),
        task_file_path: `${workspace_path}/.task/todo/current.md`,
        update_instructions: `CONFIRMED: Update task ${task_id} field '${field}' to '${value}' in .task/todo/current.md file${reason ? ` (Reason: ${reason})` : ''}`
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
        confirmed: true,
        updated: true,
        workspace_id: workspace.id
      }
    };
  }

  /**
   * Get tool definition for MCP server with multi-step support
   */
  static getToolDefinition() {
    return {
      name: 'taskpilot_update',
      description: 'Update task properties with validation and audit trail. Supports stepId parameter.',
      inputSchema: {
        type: 'object',
        properties: {
          stepId: {
            type: 'string',
            enum: ['validate', 'confirm'],
            description: 'Optional step ID: validate (check update validity), confirm (apply after validation)'
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
