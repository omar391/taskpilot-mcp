import { z } from 'zod';
import type { DrizzleDatabaseManager } from '../database/drizzle-connection.js';
import type { TaskPilotToolResult } from '../types/index.js';
import { PromptOrchestrator } from '../services/prompt-orchestrator.js';
import { GlobalDatabaseService } from '../database/global-queries.js';

// Input schema for taskpilot_add tool
export const addToolSchema = z.object({
  task_description: z.string().describe('Description of the task to be created'),
  workspace_path: z.string().describe('Absolute path to the workspace directory'),
  priority: z.enum(['High', 'Medium', 'Low']).optional().describe('Task priority level (defaults to Medium)'),
  parent_task_id: z.string().optional().describe('ID of parent task if this is a subtask')
});

export type AddToolInput = z.infer<typeof addToolSchema>;

/**
 * TaskPilot Add Tool - Task Creation Orchestration (Pure TypeScript/Drizzle)
 * 
 * Orchestration tool for task creation (aka //add) that looks up tool flow 
 * configuration and returns prompt_text with analytical validation instructions. 
 * Guides LLM through configurable feedback steps and next tool calls.
 */
export class AddTool {
  private orchestrator: PromptOrchestrator;
  private globalDb: GlobalDatabaseService;

  constructor(private drizzleDb: DrizzleDatabaseManager) {
    this.orchestrator = new PromptOrchestrator(drizzleDb);
    this.globalDb = new GlobalDatabaseService(drizzleDb);
  }

  /**
   * Execute taskpilot_add tool
   */
  async execute(input: AddToolInput): Promise<TaskPilotToolResult> {
    try {
      const { task_description, workspace_path, priority = 'Medium', parent_task_id } = input;

      // Ensure workspace exists
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

      // Validate parent task if specified
      if (parent_task_id) {
        // Note: Task validation would require workspace-specific database operations
        // For now, we'll include this in the orchestration prompt for LLM validation
      }

      // Generate orchestrated prompt using the flow system
      const orchestrationResult = await this.orchestrator.orchestratePrompt(
        'taskpilot_add',
        workspace.id,
        {
          task_description,
          workspace_path,
          priority,
          parent_task_id
        }
      );

      // Add specific instructions for next steps
      let promptText = orchestrationResult.prompt_text;
      
      if (orchestrationResult.next_tool) {
        promptText += `\n\n**NEXT ACTION:**\nIf validation passes, call \`${orchestrationResult.next_tool}\` with the validated task data:`;
        promptText += `\n- task_description: "${task_description}"`;
        promptText += `\n- workspace_path: "${workspace_path}"`;
        promptText += `\n- priority: "${priority}"`;
        if (parent_task_id) {
          promptText += `\n- parent_task_id: "${parent_task_id}"`;
        }
      }

      return {
        content: [{
          type: 'text',
          text: promptText
        }]
      };
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
   * Get tool definition for MCP server
   */
  static getToolDefinition() {
    return {
      name: 'taskpilot_add',
      description: 'Orchestrate task creation workflow with analytical validation',
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
          }
        },
        required: ['task_description', 'workspace_path']
      }
    };
  }
}
