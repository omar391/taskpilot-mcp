import { z } from 'zod';
import type { DrizzleDatabaseManager } from '../database/drizzle-connection.js';
import type { TaskPilotToolResult } from '../types/index.js';
import { PromptOrchestrator } from '../services/prompt-orchestrator.js';
import { GlobalDatabaseService } from '../database/global-queries.js';

// Input schema for taskpilot_focus tool
export const focusToolSchema = z.object({
  task_id: z.string().describe('Task ID to focus on (e.g., TP-001)'),
  workspace_path: z.string().describe('Absolute path to the workspace directory')
});

export type FocusToolInput = z.infer<typeof focusToolSchema>;

/**
 * TaskPilot Focus Tool - Task Focusing (Pure TypeScript/Drizzle)
 * 
 * MCP tool for setting active task context and providing implementation guidance.
 * Provides comprehensive context about the focused task including dependencies,
 * connected files, and implementation recommendations.
 */
export class FocusTool {
  private orchestrator: PromptOrchestrator;
  private globalDb: GlobalDatabaseService;

  constructor(private drizzleDb: DrizzleDatabaseManager) {
    this.orchestrator = new PromptOrchestrator(drizzleDb);
    this.globalDb = new GlobalDatabaseService(drizzleDb);
  }

  /**
   * Execute taskpilot_focus tool
   */
  async execute(input: FocusToolInput): Promise<TaskPilotToolResult> {
    try {
      const { task_id, workspace_path } = input;

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

      // Update workspace active task
      await this.globalDb.updateWorkspace(workspace.id, {
        activeTask: task_id,
        updatedAt: new Date().toISOString()
      });

      // Generate orchestrated prompt for task focus
      const orchestrationResult = await this.orchestrator.orchestratePrompt(
        'taskpilot_focus',
        workspace.id,
        {
          task_id,
          workspace_path,
          workspace_name: workspace.name,
          timestamp: new Date().toISOString(),
          // Include instructions for file-based task analysis
          task_file_path: `${workspace_path}/.task/todo/current.md`,
          project_file_path: `${workspace_path}/.task/project.md`,
          rules_file_path: `${workspace_path}/.task/rules/workspace_rules.md`,
          focus_instructions: `Set focus on task ${task_id} and provide comprehensive context from .task folder files`
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
   * Get tool definition for MCP server
   */
  static getToolDefinition() {
    return {
      name: 'taskpilot_focus',
      description: 'Focus on a specific task and provide comprehensive implementation context',
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
