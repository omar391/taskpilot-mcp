import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import type { DatabaseManager } from '../database/connection.js';
import type { TaskPilotToolResult } from '../types/index.js';
import { PromptOrchestrator } from '../services/prompt-orchestrator.js';

// Input schema for taskpilot_create_task tool
export const createTaskToolSchema = z.object({
  task_description: z.string().describe('Description of the task to be created'),
  workspace_path: z.string().describe('Absolute path to the workspace directory'),
  priority: z.enum(['High', 'Medium', 'Low']).optional().describe('Task priority level (defaults to Medium)'),
  parent_task_id: z.string().optional().describe('ID of parent task if this is a subtask'),
  title: z.string().optional().describe('Concise task title (will be generated from description if not provided)')
});

export type CreateTaskToolInput = z.infer<typeof createTaskToolSchema>;

/**
 * TaskPilot Create Task Tool - Direct Task Creation
 * 
 * Direct execution tool for task creation after validation passes. 
 * Creates task entry in database and generates unique task ID.
 */
export class CreateTaskTool {
  private orchestrator: PromptOrchestrator;

  constructor(private db: DatabaseManager) {
    this.orchestrator = new PromptOrchestrator(db);
  }

  /**
   * Execute taskpilot_create_task tool
   */
  async execute(input: CreateTaskToolInput): Promise<TaskPilotToolResult> {
    try {
      const { task_description, workspace_path, priority = 'Medium', parent_task_id, title } = input;

      // Get workspace
      const workspace = await this.getWorkspace(workspace_path);
      if (!workspace) {
        return {
          content: [{
            type: 'text',
            text: `Error: Workspace not found at path: ${workspace_path}`
          }],
          isError: true
        };
      }

      // Validate parent task if specified
      if (parent_task_id) {
        const parentTask = await this.getTask(parent_task_id, workspace.id);
        if (!parentTask) {
          return {
            content: [{
              type: 'text',
              text: `Error: Parent task '${parent_task_id}' not found in workspace.`
            }],
            isError: true
          };
        }
      }

      // Generate task ID and title
      const taskId = await this.generateTaskId(workspace.id);
      const taskTitle = title || this.generateTitleFromDescription(task_description);

      // Create task in database
      await this.db.run(
        `INSERT INTO tasks (
          id, title, description, priority, status, progress, 
          parent_task_id, workspace_id, connected_files, 
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          taskId,
          taskTitle,
          task_description,
          priority,
          'Backlog',
          0,
          parent_task_id || null,
          workspace.id,
          JSON.stringify([]) // Empty connected files array
        ]
      );

      // Get the created task for confirmation
      const createdTask = await this.getTask(taskId, workspace.id);

      // Generate orchestrated prompt response
      const orchestrationResult = await this.orchestrator.orchestratePrompt(
        'taskpilot_create_task',
        workspace.id,
        {
          task_id: taskId,
          task_title: taskTitle,
          task_description,
          priority,
          parent_task_id
        }
      );

      // Build success response
      let responseText = `# Task Created Successfully\n\n`;
      responseText += `**Task ID:** ${taskId}\n`;
      responseText += `**Title:** ${taskTitle}\n`;
      responseText += `**Description:** ${task_description}\n`;
      responseText += `**Priority:** ${priority}\n`;
      responseText += `**Status:** Backlog\n`;
      responseText += `**Progress:** 0%\n`;
      
      if (parent_task_id) {
        responseText += `**Parent Task:** ${parent_task_id}\n`;
      }
      
      responseText += `**Workspace:** ${workspace.name}\n`;
      responseText += `**Created:** ${new Date().toISOString()}\n\n`;
      responseText += orchestrationResult.prompt_text;

      return {
        content: [{
          type: 'text',
          text: responseText
        }]
      };
    } catch (error) {
      console.error('Error in taskpilot_create_task:', error);
      return {
        content: [{
          type: 'text',
          text: `Error creating task: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  /**
   * Generate unique task ID with TP prefix
   */
  private async generateTaskId(workspaceId: string): Promise<string> {
    // Get the highest task number for this workspace
    const result = await this.db.get<any>(
      `SELECT id FROM tasks 
       WHERE workspace_id = ? AND id LIKE 'TP-%' 
       ORDER BY CAST(SUBSTR(id, 4) AS INTEGER) DESC 
       LIMIT 1`,
      [workspaceId]
    );

    let nextNumber = 1;
    if (result && result.id) {
      const currentNumber = parseInt(result.id.replace('TP-', ''), 10);
      nextNumber = currentNumber + 1;
    }

    return `TP-${nextNumber.toString().padStart(3, '0')}`;
  }

  /**
   * Generate concise title from task description
   */
  private generateTitleFromDescription(description: string): string {
    // Take first sentence or first 50 characters, whichever is shorter
    const firstSentence = description.split('.')[0];
    const truncated = firstSentence.length > 50 
      ? firstSentence.substring(0, 47) + '...'
      : firstSentence;
    
    return truncated.trim();
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
      name: 'taskpilot_create_task',
      description: 'Create a new task after validation passes',
      inputSchema: {
        type: 'object',
        properties: {
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
          },
          title: {
            type: 'string',
            description: 'Concise task title (will be generated from description if not provided)'
          }
        },
        required: ['task_description', 'workspace_path']
      }
    };
  }
}
