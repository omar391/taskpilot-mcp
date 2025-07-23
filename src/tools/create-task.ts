import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import type { DrizzleDatabaseManager } from '../database/drizzle-connection.js';
import type { TaskPilotToolResult, ToolStepResult } from '../types/index.js';
import { PromptOrchestrator } from '../services/prompt-orchestrator.js';
import { GlobalDatabaseService } from '../database/global-queries.js';
import { WorkspaceDatabaseService } from '../database/workspace-queries.js';
import type { NewTask } from '../database/schema/workspace-schema.js';

// Input schema for taskpilot_create_task tool with multi-step support
export const createTaskToolSchema = z.object({
  stepId: z.string().optional().describe('Optional step ID for multi-step workflow'),
  task_description: z.string().describe('Description of the task to be created'),
  workspace_path: z.string().describe('Absolute path to the workspace directory'),
  priority: z.enum(['High', 'Medium', 'Low']).optional().describe('Task priority level (defaults to Medium)'),
  parent_task_id: z.string().optional().describe('ID of parent task if this is a subtask'),
  title: z.string().optional().describe('Concise task title (will be generated from description if not provided)')
});

export type CreateTaskToolInput = z.infer<typeof createTaskToolSchema>;

/**
 * TaskPilot Create Task Tool - Multi-Step Task Creation
 * 
 * Enhanced with multi-step support, typically called as the final step
 * after validation from taskpilot_add. Can also be used independently.
 * 
 * Steps:
 * - No stepId: Direct task creation
 * - stepId="confirm": Final confirmation step
 */
export class CreateTaskTool {
  private orchestrator: PromptOrchestrator;
  private globalDb: GlobalDatabaseService;

  constructor(private drizzleDb: DrizzleDatabaseManager) {
    this.orchestrator = new PromptOrchestrator(drizzleDb);
    this.globalDb = new GlobalDatabaseService(drizzleDb);
  }

  /**
   * Execute taskpilot_create_task tool with multi-step support
   */
  async execute(input: CreateTaskToolInput): Promise<TaskPilotToolResult> {
    try {
      const { stepId, task_description, workspace_path, priority = 'Medium', parent_task_id, title } = input;

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

      // Route to appropriate step handler
      switch (stepId) {
        case 'confirm':
          return await this.handleConfirmationStep(input, workspace);
        default:
          return await this.handleDirectCreation(input, workspace);
      }
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
   * Direct creation step - create task immediately
   */
  private async handleDirectCreation(input: CreateTaskToolInput, workspace: any): Promise<TaskPilotToolResult> {
    const { task_description, priority = 'Medium', parent_task_id, title } = input;

    // Generate task ID and title
    const taskId = await this.generateTaskId(workspace.id);
    const taskTitle = title || this.generateTitleFromDescription(task_description);

    // Create task in workspace database
    const workspaceDb = new WorkspaceDatabaseService(workspace.path);
    await workspaceDb.initialize();

    const newTask: NewTask = {
      id: taskId,
      title: taskTitle,
      description: task_description,
      priority: priority.toLowerCase() as 'high' | 'medium' | 'low',
      status: 'backlog',
      progress: 0,
      dependencies: JSON.stringify([]),
      connectedFiles: JSON.stringify([]),
      notes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null
    };

    const createdTask = await workspaceDb.createTask(newTask);

    // Generate orchestrated prompt response
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
        created_at: createdTask.createdAt,
        timestamp: new Date().toISOString()
      }
    );

    const stepResult: ToolStepResult = {
      isFinalStep: true,
      feedback: `Task created successfully: ${taskId}`,
      data: {
        task_id: taskId,
        task_title: taskTitle,
        created_task: createdTask
      }
    };

    return {
      content: [{
        type: 'text',
        text: orchestrationResult.prompt_text
      }],
      stepResult
    };
  }

  /**
   * Confirmation step - show task details before creation
   */
  private async handleConfirmationStep(input: CreateTaskToolInput, workspace: any): Promise<TaskPilotToolResult> {
    const { task_description, priority = 'Medium', parent_task_id, title } = input;

    const taskTitle = title || this.generateTitleFromDescription(task_description);

    const stepResult: ToolStepResult = {
      isFinalStep: false,
      nextStepId: undefined, // User can call create-task again without stepId to proceed
      feedback: `Task ready for creation`,
      data: { task_description, priority, parent_task_id, title: taskTitle }
    };

    return {
      content: [{
        type: 'text',
        text: `**TASK CONFIRMATION**\n\nTask Details:\n- Title: ${taskTitle}\n- Description: ${task_description}\n- Priority: ${priority}\n- Workspace: ${workspace.name}${parent_task_id ? `\n- Parent Task: ${parent_task_id}` : ''}\n\n**NEXT ACTION:** Call taskpilot_create_task again without stepId to create the task.`
      }],
      stepResult
    };
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
   * Get tool definition for MCP server with multi-step support
   */
  static getToolDefinition() {
    return {
      name: 'taskpilot_create_task',
      description: 'Create a new task with optional multi-step confirmation. Supports stepId parameter.',
      inputSchema: {
        type: 'object',
        properties: {
          stepId: {
            type: 'string',
            enum: ['confirm'],
            description: 'Optional step ID: confirm (show details before creation)'
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
