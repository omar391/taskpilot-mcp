import { z } from 'zod';
import type { DrizzleDatabaseManager } from '../database/drizzle-connection.js';
import type { TaskPilotToolResult } from '../types/index.js';
import { PromptOrchestrator } from '../services/prompt-orchestrator.js';
import { GlobalDatabaseService } from '../database/global-queries.js';

// Input schema for taskpilot_update tool
export const updateToolSchema = z.object({
  task_id: z.string().describe('Task ID to update (e.g., TP-001)'),
  workspace_path: z.string().describe('Absolute path to the workspace directory'),
  field: z.enum(['title', 'description', 'priority', 'status', 'progress', 'notes', 'connected_files', 'blocked_by']).describe('Field to update'),
  value: z.string().describe('New value for the field'),
  reason: z.string().optional().describe('Reason for the update (for audit trail)')
});

export type UpdateToolInput = z.infer<typeof updateToolSchema>;

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
   * Execute taskpilot_update tool
   */
  async execute(input: UpdateToolInput): Promise<TaskPilotToolResult> {
    try {
      const { task_id, workspace_path, field, value, reason } = input;

      // Get workspace
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

      // Generate orchestrated prompt for task update
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
          // Include instructions for file-based task updates
          task_file_path: `${workspace_path}/.task/todo/current.md`,
          update_instructions: `Update task ${task_id} field '${field}' to '${value}' in .task/todo/current.md file`
        }
      );

      return {
        content: [{
          type: 'text',
          text: orchestrationResult.prompt_text
        }]
      };
    } catch (error) {
      console.error('Error in taskpilot_update:', error);
      return {
        content: [{
          type: 'text',
          text: `Error updating task: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  /**
   * Get tool definition for MCP server
   */
  static getToolDefinition() {
    return {
      name: 'taskpilot_update',
      description: 'Update task properties with audit trail and validation',
      inputSchema: {
        type: 'object',
        properties: {
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
