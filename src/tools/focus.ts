import { z } from 'zod';
import type { DatabaseManager } from '../database/connection.js';
import type { TaskPilotToolResult } from '../types/index.js';
import { PromptOrchestrator } from '../services/prompt-orchestrator.js';

// Input schema for taskpilot_focus tool
export const focusToolSchema = z.object({
  task_id: z.string().describe('Task ID to focus on (e.g., TP-001)'),
  workspace_path: z.string().describe('Absolute path to the workspace directory')
});

export type FocusToolInput = z.infer<typeof focusToolSchema>;

/**
 * TaskPilot Focus Tool - Task Focusing
 * 
 * MCP tool for setting active task context and providing implementation guidance.
 * Provides comprehensive context about the focused task including dependencies,
 * connected files, and implementation recommendations.
 */
export class FocusTool {
  private orchestrator: PromptOrchestrator;

  constructor(private db: DatabaseManager) {
    this.orchestrator = new PromptOrchestrator(db);
  }

  /**
   * Execute taskpilot_focus tool
   */
  async execute(input: FocusToolInput): Promise<TaskPilotToolResult> {
    try {
      const { task_id, workspace_path } = input;

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

      // Get the task to focus on
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

      // Get related tasks and dependencies
      const dependencies = await this.getTaskDependencies(task_id, workspace.id);
      const subtasks = await this.getSubtasks(task_id, workspace.id);
      const blockedBy = await this.getBlockedByTask(task.blocked_by_task_id, workspace.id);

      // Update task status to In-Progress if it's currently Backlog
      if (task.status === 'Backlog') {
        await this.updateTaskStatus(task_id, workspace.id, 'In-Progress');
        task.status = 'In-Progress';
      }

      // Update session with active task
      await this.updateActiveTask(workspace.id, task_id);

      // Generate orchestrated prompt with comprehensive task context
      const orchestrationResult = await this.orchestrator.orchestratePrompt(
        'taskpilot_focus',
        workspace.id,
        {
          task_id: task.id,
          task_title: task.title,
          task_description: task.description,
          task_priority: task.priority,
          task_status: task.status,
          task_progress: task.progress,
          parent_task_id: task.parent_task_id,
          connected_files: JSON.parse(task.connected_files || '[]'),
          notes: task.notes || '',
          dependencies_count: dependencies.length,
          subtasks_count: subtasks.length,
          blocked_by_task: blockedBy ? `${blockedBy.id}: ${blockedBy.title}` : null,
          workspace_name: workspace.name,
          workspace_path,
          created_at: task.created_at,
          updated_at: task.updated_at,
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
      console.error('Error in taskpilot_focus:', error);
      return {
        content: [{
          type: 'text',
          text: `Error focusing on task: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
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
   * Get tasks that depend on this task (children)
   */
  private async getTaskDependencies(taskId: string, workspaceId: string): Promise<any[]> {
    return await this.db.all<any[]>(
      'SELECT * FROM tasks WHERE parent_task_id = ? AND workspace_id = ?',
      [taskId, workspaceId]
    );
  }

  /**
   * Get subtasks of this task
   */
  private async getSubtasks(taskId: string, workspaceId: string): Promise<any[]> {
    return await this.db.all<any[]>(
      'SELECT * FROM tasks WHERE parent_task_id = ? AND workspace_id = ?',
      [taskId, workspaceId]
    );
  }

  /**
   * Get task that blocks this task
   */
  private async getBlockedByTask(blockedByTaskId: string | null, workspaceId: string): Promise<any> {
    if (!blockedByTaskId) return null;
    return await this.db.get<any>(
      'SELECT * FROM tasks WHERE id = ? AND workspace_id = ?',
      [blockedByTaskId, workspaceId]
    );
  }

  /**
   * Update task status
   */
  private async updateTaskStatus(taskId: string, workspaceId: string, newStatus: string): Promise<void> {
    await this.db.run(
      'UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND workspace_id = ?',
      [newStatus, taskId, workspaceId]
    );
  }

  /**
   * Update session with active task
   */
  private async updateActiveTask(workspaceId: string, taskId: string): Promise<void> {
    // Update the most recent active session for this workspace
    await this.db.run(
      `UPDATE sessions 
       SET last_activity = CURRENT_TIMESTAMP 
       WHERE workspace_id = ? AND is_active = 1
       ORDER BY started_at DESC
       LIMIT 1`,
      [workspaceId]
    );
  }

  /**
   * Get tool definition for MCP server
   */
  static getToolDefinition() {
    return {
      name: 'taskpilot_focus',
      description: 'Focus on a specific task and provide implementation context',
      inputSchema: {
        type: 'object',
        properties: {
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
