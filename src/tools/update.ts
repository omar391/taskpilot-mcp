import { z } from 'zod';
import type { DatabaseManager } from '../database/connection.js';
import type { TaskPilotToolResult } from '../types/index.js';
import { PromptOrchestrator } from '../services/prompt-orchestrator.js';

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
 * TaskPilot Update Tool - Task Property Updates
 * 
 * MCP tool for modifying task properties with audit trail. Supports updating
 * title, description, priority, status, progress, notes, connected files,
 * and blocking relationships while maintaining data integrity.
 */
export class UpdateTool {
  private orchestrator: PromptOrchestrator;

  constructor(private db: DatabaseManager) {
    this.orchestrator = new PromptOrchestrator(db);
  }

  /**
   * Execute taskpilot_update tool
   */
  async execute(input: UpdateToolInput): Promise<TaskPilotToolResult> {
    try {
      const { task_id, workspace_path, field, value, reason } = input;

      // Get workspace
      const workspace = await this.getWorkspace(workspace_path);
      if (!workspace) {
        return {
          content: [{
            type: 'text',
            text: `Error: Workspace not found at path: ${workspace_path}. Please run taskpilot_start first to initialize the workspace.`
          }],
          isError: true
        };
      }

      // Get the task to update
      const task = await this.getTask(task_id, workspace.id);
      if (!task) {
        return {
          content: [{
            type: 'text',
            text: `Error: Task '${task_id}' not found in workspace.`
          }],
          isError: true
        };
      }

      // Validate the update
      const validationResult = await this.validateUpdate(field, value, task, workspace.id);
      if (!validationResult.valid) {
        return {
          content: [{
            type: 'text',
            text: `Error: ${validationResult.error}`
          }],
          isError: true
        };
      }

      // Store old value for audit trail
      const oldValue = await this.getOldValue(task, field);

      // Perform the update
      await this.performUpdate(task_id, workspace.id, field, validationResult.processedValue);

      // Set completion time if status changed to Done
      if (field === 'status' && value === 'Done') {
        await this.db.run(
          'UPDATE tasks SET completed_at = CURRENT_TIMESTAMP WHERE id = ? AND workspace_id = ?',
          [task_id, workspace.id]
        );
      }

      // Get updated task for response
      const updatedTask = await this.getTask(task_id, workspace.id);

      // Generate orchestrated prompt with update confirmation
      const orchestrationResult = await this.orchestrator.orchestratePrompt(
        'taskpilot_update',
        workspace.id,
        {
          task_id: task.id,
          task_title: updatedTask.title,
          field_updated: field,
          old_value: oldValue,
          new_value: validationResult.processedValue,
          reason: reason || 'No reason provided',
          updated_at: new Date().toISOString(),
          task_status: updatedTask.status,
          task_progress: updatedTask.progress,
          workspace_name: workspace.name,
          workspace_path,
          timestamp: new Date().toISOString()
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
   * Validate the update operation
   */
  private async validateUpdate(field: string, value: string, task: any, workspaceId: string): Promise<{valid: boolean, error?: string, processedValue?: any}> {
    switch (field) {
      case 'priority':
        if (!['High', 'Medium', 'Low'].includes(value)) {
          return { valid: false, error: 'Priority must be High, Medium, or Low' };
        }
        return { valid: true, processedValue: value };

      case 'status':
        if (!['Backlog', 'In-Progress', 'Blocked', 'Review', 'Done', 'Dropped'].includes(value)) {
          return { valid: false, error: 'Status must be Backlog, In-Progress, Blocked, Review, Done, or Dropped' };
        }
        return { valid: true, processedValue: value };

      case 'progress':
        const progress = parseInt(value, 10);
        if (isNaN(progress) || progress < 0 || progress > 100) {
          return { valid: false, error: 'Progress must be a number between 0 and 100' };
        }
        return { valid: true, processedValue: progress };

      case 'connected_files':
        try {
          const files = JSON.parse(value);
          if (!Array.isArray(files)) {
            return { valid: false, error: 'Connected files must be a JSON array of file paths' };
          }
          return { valid: true, processedValue: JSON.stringify(files) };
        } catch {
          return { valid: false, error: 'Connected files must be valid JSON array' };
        }

      case 'blocked_by':
        if (value && value !== 'null') {
          // Check if the blocking task exists
          const blockingTask = await this.getTask(value, workspaceId);
          if (!blockingTask) {
            return { valid: false, error: `Blocking task '${value}' not found in workspace` };
          }
          // Prevent circular dependencies
          if (value === task.id) {
            return { valid: false, error: 'Task cannot be blocked by itself' };
          }
        }
        return { valid: true, processedValue: value === 'null' ? null : value };

      case 'title':
      case 'description':
      case 'notes':
        if (value.trim().length === 0) {
          return { valid: false, error: `${field} cannot be empty` };
        }
        return { valid: true, processedValue: value.trim() };

      default:
        return { valid: false, error: `Unknown field: ${field}` };
    }
  }

  /**
   * Get old value for audit trail
   */
  private async getOldValue(task: any, field: string): Promise<string> {
    switch (field) {
      case 'connected_files':
        return task[field] || '[]';
      case 'blocked_by':
        return task.blocked_by_task_id || 'null';
      default:
        return String(task[field] || '');
    }
  }

  /**
   * Perform the database update
   */
  private async performUpdate(taskId: string, workspaceId: string, field: string, value: any): Promise<void> {
    const dbField = field === 'blocked_by' ? 'blocked_by_task_id' : field;
    
    await this.db.run(
      `UPDATE tasks SET ${dbField} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND workspace_id = ?`,
      [value, taskId, workspaceId]
    );
  }

  /**
   * Get workspace by path
   */
  private async getWorkspace(workspacePath: string): Promise<any> {
    return await this.db.get<any>(
      'SELECT * FROM workspaces WHERE path = ?',
      [workspacePath]
    );
  }

  /**
   * Get task by ID within workspace
   */
  private async getTask(taskId: string, workspaceId: string): Promise<any> {
    return await this.db.get<any>(
      'SELECT * FROM tasks WHERE id = ? AND workspace_id = ?',
      [taskId, workspaceId]
    );
  }

  /**
   * Get tool definition for MCP server
   */
  static getToolDefinition() {
    return {
      name: 'taskpilot_update',
      description: 'Update task properties with audit trail',
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
