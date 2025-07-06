import { z } from 'zod';
import type { DatabaseManager } from '../database/connection.js';
import type { TaskPilotToolResult } from '../types/index.js';
import { PromptOrchestrator } from '../services/prompt-orchestrator.js';

// Input schema for taskpilot_status tool
export const statusToolSchema = z.object({
  workspace_path: z.string().describe('Absolute path to the workspace directory'),
  detailed: z.boolean().optional().describe('Include detailed analysis and recommendations (defaults to false)')
});

export type StatusToolInput = z.infer<typeof statusToolSchema>;

/**
 * TaskPilot Status Tool - Project Status Reporting
 * 
 * Orchestration tool for project status analysis (aka //status) that 
 * provides comprehensive reporting on task progress, rule violations,
 * bottlenecks, and recommendations for project advancement.
 */
export class StatusTool {
  private orchestrator: PromptOrchestrator;

  constructor(private db: DatabaseManager) {
    this.orchestrator = new PromptOrchestrator(db);
  }

  /**
   * Execute taskpilot_status tool
   */
  async execute(input: StatusToolInput): Promise<TaskPilotToolResult> {
    try {
      const { workspace_path, detailed = false } = input;

      // Ensure workspace exists
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

      // Get all tasks for analysis
      const tasks = await this.getTasks(workspace.id);
      
        // Generate status summary data for context
      const statusSummary = this.generateStatusSummary(tasks);
      
      // Generate orchestrated prompt using the flow system
      const orchestrationResult = await this.orchestrator.orchestratePrompt(
        'taskpilot_status',
        workspace.id,
        {
          workspace_path,
          workspace_name: workspace.name,
          task_count: tasks.length,
            total_progress: statusSummary.totalProgress,
            avg_progress: (statusSummary.totalProgress / Math.max(tasks.length, 1)).toFixed(1),
            status_breakdown: JSON.stringify(statusSummary.byStatus),
            priority_breakdown: JSON.stringify(statusSummary.byPriority),
            blocked_count: statusSummary.byStatus.Blocked || 0,
            high_priority_count: statusSummary.byPriority.High || 0,
            detailed,
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
   * Generate status summary from tasks
   */
  private generateStatusSummary(tasks: any[]) {
    const summary = {
      byStatus: {} as Record<string, number>,
      byPriority: {} as Record<string, number>,
      totalProgress: 0
    };

    // Initialize status counts
    const statuses = ['Backlog', 'In-Progress', 'Blocked', 'Review', 'Done', 'Dropped'];
    statuses.forEach(status => summary.byStatus[status] = 0);

    // Initialize priority counts
    const priorities = ['High', 'Medium', 'Low'];
    priorities.forEach(priority => summary.byPriority[priority] = 0);

    // Count tasks and calculate totals
    tasks.forEach(task => {
      summary.byStatus[task.status] = (summary.byStatus[task.status] || 0) + 1;
      summary.byPriority[task.priority] = (summary.byPriority[task.priority] || 0) + 1;
      summary.totalProgress += task.progress || 0;
    });

    return summary;
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
   * Get all tasks for workspace
   */
  private async getTasks(workspaceId: string): Promise<any[]> {
    return await this.db.all<any[]>(
      `SELECT * FROM tasks 
       WHERE workspace_id = ? 
       ORDER BY 
         CASE priority 
           WHEN 'High' THEN 1 
           WHEN 'Medium' THEN 2 
           WHEN 'Low' THEN 3 
         END,
         CASE status
           WHEN 'In-Progress' THEN 1
           WHEN 'Review' THEN 2
           WHEN 'Blocked' THEN 3
           WHEN 'Backlog' THEN 4
           WHEN 'Done' THEN 5
           WHEN 'Dropped' THEN 6
         END,
         created_at DESC`,
      [workspaceId]
    );
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
