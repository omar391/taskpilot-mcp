import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import type { DrizzleDatabaseManager } from '../database/drizzle-connection.js';
import type { TaskPilotToolResult } from '../types/index.js';
import { PromptOrchestrator } from '../services/prompt-orchestrator.js';
import { GlobalDatabaseService } from '../database/global-queries.js';

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
 * TaskPilot Create Task Tool - Direct Task Creation (Pure TypeScript/Drizzle)
 * 
 * Direct execution tool for task creation after validation passes. 
 * Creates task entry and generates unique task ID. 
 * 
 * Note: This version focuses on orchestration. Full task management requires
 * workspace-specific database implementation.
 */
export class CreateTaskTool {
  private orchestrator: PromptOrchestrator;
  private globalDb: GlobalDatabaseService;

  constructor(private drizzleDb: DrizzleDatabaseManager) {
    this.orchestrator = new PromptOrchestrator(drizzleDb);
    this.globalDb = new GlobalDatabaseService(drizzleDb);
  }

  /**
   * Execute taskpilot_create_task tool
   */
  async execute(input: CreateTaskToolInput): Promise<TaskPilotToolResult> {
    try {
      const { task_description, workspace_path, priority = 'Medium', parent_task_id, title } = input;

      // Get workspace
      const workspace = await this.globalDb.getWorkspaceByPath(workspace_path);
      if (!workspace) {
        return {
          content: [{
            type: 'text',
            text: `Error: Workspace not found at path: ${workspace_path}`
          }],
          isError: true
        };
      }

      // Generate task ID and title
      const taskId = await this.generateTaskId(workspace.id);
      const taskTitle = title || this.generateTitleFromDescription(task_description);

      // Generate orchestrated prompt response with task creation instructions
      const orchestrationResult = await this.orchestrator.orchestratePrompt(
        'taskpilot_create_task',
        workspace.id,
        {
          task_id: taskId,
          task_title: taskTitle,
          task_description,
          priority,
          parent_task_id,
          workspace_name: workspace.name,
          created_at: new Date().toISOString(),
          timestamp: new Date().toISOString(),
          // Include instructions for file-based task creation
          task_file_path: `${workspace_path}/.task/todo/current.md`,
          task_creation_instructions: 'Create task entry in .task/todo/current.md file with proper formatting'
        }
      );

      return {
        content: [{
          type: 'text',
          text: orchestrationResult.prompt_text
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
   * Note: This is a simplified version. Full implementation would query workspace tasks.
   */
  private async generateTaskId(workspaceId: string): Promise<string> {
    // Generate a simple incremental ID for now
    // Full implementation would query workspace-specific task database
    const timestamp = Date.now().toString().slice(-6);
    return `TP-${timestamp}`;
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
