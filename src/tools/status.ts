import { z } from 'zod';
import type { DrizzleDatabaseManager } from '../database/drizzle-connection.js';
import type { TaskPilotToolResult, ToolStepResult, MultiStepToolInput } from '../types/index.js';
import { PromptOrchestrator } from '../services/prompt-orchestrator.js';
import { GlobalDatabaseService } from '../database/global-queries.js';

// Input schema for taskpilot_status tool with multi-step support
export const statusToolSchema = z.object({
  stepId: z.string().optional().describe('Step ID for multi-step flow: detailed, recommendations, rules'),
  workspace_path: z.string().describe('Absolute path to the workspace directory'),
  detailed: z.boolean().optional().describe('Include detailed analysis and recommendations (defaults to false)')
});

export type StatusToolInput = z.infer<typeof statusToolSchema> & MultiStepToolInput;

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
   * Execute taskpilot_status tool with multi-step support
   */
  async execute(input: StatusToolInput): Promise<ToolStepResult> {
    try {
      const { workspace_path, stepId, detailed = false } = input;

      // Ensure workspace exists
      const workspace = await this.globalDb.getWorkspaceByPath(workspace_path);
      if (!workspace) {
        return {
          isFinalStep: true,
          feedback: `Error: Workspace not found at path: ${workspace_path}. Please run taskpilot_start first to initialize the workspace.`,
          data: { error: true, workspace_path: workspace_path }
        };
      }

      // Handle multi-step flow
      if (stepId === 'detailed') {
        return await this.handleDetailedStep(workspace, workspace_path);
      } else if (stepId === 'recommendations') {
        return await this.handleRecommendationsStep(workspace, workspace_path);
      } else if (stepId === 'rules') {
        return await this.handleRulesStep(workspace, workspace_path);
      }

      // Default: overview status
      return await this.handleOverviewStep(workspace, workspace_path, detailed);

    } catch (error) {
      console.error('Error in taskpilot_status:', error);
      return {
        isFinalStep: true,
        feedback: `Error generating status report: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: { error: true, workspace_path: input.workspace_path }
      };
    }
  }

  private async handleOverviewStep(workspace: any, workspace_path: string, detailed: boolean): Promise<ToolStepResult> {
    // Generate orchestrated prompt for overview status
    const orchestrationResult = await this.orchestrator.orchestratePrompt(
      'taskpilot_status',
      workspace.id,
      {
        workspace_path,
        workspace_name: workspace.name,
        detailed: false, // Force overview for first step
        timestamp: new Date().toISOString(),
        task_file_path: `${workspace_path}/.task/todo/current.md`,
        status_analysis_instructions: 'Provide high-level status summary with task counts and priority overview'
      }
    );

    return {
      isFinalStep: false,
      nextStepId: 'detailed',
      feedback: orchestrationResult.prompt_text + '\n\n*Available next steps: detailed, recommendations, rules*',
      data: {
        workspace_id: workspace.id,
        overview: true,
        available_steps: ['detailed', 'recommendations', 'rules']
      }
    };
  }

  private async handleDetailedStep(workspace: any, workspace_path: string): Promise<ToolStepResult> {
    // Generate detailed analysis
    const orchestrationResult = await this.orchestrator.orchestratePrompt(
      'taskpilot_status',
      workspace.id,
      {
        workspace_path,
        workspace_name: workspace.name,
        detailed: true,
        timestamp: new Date().toISOString(),
        task_file_path: `${workspace_path}/.task/todo/current.md`,
        status_analysis_instructions: 'Provide detailed task analysis with progress metrics, blockers, and file connections'
      }
    );

    return {
      isFinalStep: false,
      nextStepId: 'recommendations',
      feedback: orchestrationResult.prompt_text + '\n\n*Next: recommendations for task prioritization and workflow improvements*',
      data: {
        workspace_id: workspace.id,
        detailed: true,
        next_available: ['recommendations', 'rules']
      }
    };
  }

  private async handleRecommendationsStep(workspace: any, workspace_path: string): Promise<ToolStepResult> {
    // Generate recommendations based on current status
    const orchestrationResult = await this.orchestrator.orchestratePrompt(
      'taskpilot_status',
      workspace.id,
      {
        workspace_path,
        workspace_name: workspace.name,
        focus: 'recommendations',
        timestamp: new Date().toISOString(),
        task_file_path: `${workspace_path}/.task/todo/current.md`,
        status_analysis_instructions: 'Analyze task status and provide actionable recommendations for improving workflow efficiency and resolving blockers'
      }
    );

    return {
      isFinalStep: false,
      nextStepId: 'rules',
      feedback: orchestrationResult.prompt_text + '\n\n*Next: rules compliance analysis and workspace guidelines review*',
      data: {
        workspace_id: workspace.id,
        recommendations: true,
        next_available: ['rules']
      }
    };
  }

  private async handleRulesStep(workspace: any, workspace_path: string): Promise<ToolStepResult> {
    // Generate rules compliance analysis
    const orchestrationResult = await this.orchestrator.orchestratePrompt(
      'taskpilot_status',
      workspace.id,
      {
        workspace_path,
        workspace_name: workspace.name,
        focus: 'rules',
        timestamp: new Date().toISOString(),
        task_file_path: `${workspace_path}/.task/todo/current.md`,
        rules_files: [`${workspace_path}/.task/rules/standard_rules.md`, `${workspace_path}/.task/rules/workspace_rules.md`],
        status_analysis_instructions: 'Review task compliance with established rules and identify any violations or areas for improvement'
      }
    );

    return {
      isFinalStep: true,
      feedback: orchestrationResult.prompt_text,
      data: {
        workspace_id: workspace.id,
        rules_analysis: true,
        completed_flow: true
      }
    };
  }

  /**
   * Get tool definition for MCP server with multi-step support
   */
  static getToolDefinition() {
    return {
      name: 'taskpilot_status',
      description: 'Generate comprehensive project status report with multi-step analysis. Supports stepId parameter.',
      inputSchema: {
        type: 'object',
        properties: {
          stepId: {
            type: 'string',
            enum: ['detailed', 'recommendations', 'rules'],
            description: 'Optional step ID: detailed (full analysis), recommendations (workflow improvements), rules (compliance check)'
          },
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
