import { z } from 'zod';
import type { DrizzleDatabaseManager } from '../database/drizzle-connection.js';
import type { TaskPilotToolResult } from '../types/index.js';
import { PromptOrchestrator } from '../services/prompt-orchestrator.js';
import { GlobalDatabaseService } from '../database/global-queries.js';

// Input schema for taskpilot_status tool
export const statusToolSchema = z.object({
  workspace_path: z.string().describe('Absolute path to the workspace directory'),
  detailed: z.boolean().optional().describe('Include detailed analysis and recommendations (defaults to false)')
});

export type StatusToolInput = z.infer<typeof statusToolSchema>;

/**
 * TaskPilot Status Tool - Project Status Reporting (Pure TypeScript/Drizzle)
 * 
 * Orchestration tool for project status analysis (aka //status) that 
 * provides comprehensive reporting on task progress, rule violations,
 * bottlenecks, and recommendations for project advancement.
 */
export class StatusTool {
  private orchestrator: PromptOrchestrator;
  private globalDb: GlobalDatabaseService;

  constructor(private drizzleDb: DrizzleDatabaseManager) {
    this.orchestrator = new PromptOrchestrator(drizzleDb);
    this.globalDb = new GlobalDatabaseService(drizzleDb);
  }

  /**
   * Execute taskpilot_status tool
   */
  async execute(input: StatusToolInput): Promise<TaskPilotToolResult> {
    try {
      const { workspace_path, detailed = false } = input;

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

      // Generate orchestrated prompt using the flow system
      // Note: Task analysis would require workspace-specific database
      const orchestrationResult = await this.orchestrator.orchestratePrompt(
        'taskpilot_status',
        workspace.id,
        {
          workspace_path,
          workspace_name: workspace.name,
          detailed,
          timestamp: new Date().toISOString(),
          // Include instructions for file-based status analysis
          task_file_path: `${workspace_path}/.task/todo/current.md`,
          status_analysis_instructions: 'Analyze .task/todo/current.md file for task status summary and recommendations'
        }
      );

      return {
        content: [{
          type: 'text',
          text: orchestrationResult.prompt_text
        }]
      };
    } catch (error) {
      console.error('Error in taskpilot_status:', error);
      return {
        content: [{
          type: 'text',
          text: `Error generating status report: ${error instanceof Error ? error.message : 'Unknown error'}`
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
      name: 'taskpilot_status',
      description: 'Generate comprehensive project status report with analysis and recommendations',
      inputSchema: {
        type: 'object',
        properties: {
          workspace_path: {
            type: 'string',
            description: 'Absolute path to the workspace directory'
          },
          detailed: {
            type: 'boolean',
            description: 'Include detailed analysis and recommendations (defaults to false)'
          }
        },
        required: ['workspace_path']
      }
    };
  }
}
