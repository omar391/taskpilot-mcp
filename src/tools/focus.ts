import { z } from 'zod';
import type { DrizzleDatabaseManager } from '../database/drizzle-connection.js';
import type { TaskPilotToolResult, ToolStepResult, MultiStepToolInput } from '../types/index.js';
import { PromptOrchestrator } from '../services/prompt-orchestrator.js';
import { GlobalDatabaseService } from '../database/global-queries.js';

// Input schema for taskpilot_focus tool with multi-step support
export const focusToolSchema = z.object({
  stepId: z.string().optional().describe('Step ID for multi-step flow: analyze, plan, implement'),
  task_id: z.string().describe('Task ID to focus on (e.g., TP-001)'),
  workspace_path: z.string().describe('Absolute path to the workspace directory')
});

export type FocusToolInput = z.infer<typeof focusToolSchema> & MultiStepToolInput;

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
   * Execute taskpilot_focus tool with multi-step support
   */
  async execute(input: FocusToolInput): Promise<ToolStepResult> {
    try {
      const { task_id, workspace_path, stepId } = input;

      // Get workspace
      const workspace = await this.globalDb.getWorkspaceByPath(workspace_path);
      if (!workspace) {
        return {
          isFinalStep: true,
          feedback: `Error: Workspace not found at path: ${workspace_path}. Please run taskpilot_start first to initialize the workspace.`,
          data: { error: true, workspace_path: workspace_path }
        };
      }

      // Update workspace active task
      await this.globalDb.updateWorkspace(workspace.id, {
        activeTask: task_id,
        updatedAt: new Date().toISOString()
      });

      // Handle multi-step flow
      if (stepId === 'analyze') {
        return await this.handleAnalyzeStep(workspace, task_id, workspace_path);
      } else if (stepId === 'plan') {
        return await this.handlePlanStep(workspace, task_id, workspace_path);
      } else if (stepId === 'implement') {
        return await this.handleImplementStep(workspace, task_id, workspace_path);
      }

      // Default: overview and context setting
      return await this.handleFocusOverview(workspace, task_id, workspace_path);

    } catch (error) {
      console.error('Error in taskpilot_focus:', error);
      return {
        isFinalStep: true,
        feedback: `Error focusing on task: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: { error: true, workspace_path: input.workspace_path }
      };
    }
  }

  private async handleFocusOverview(workspace: any, task_id: string, workspace_path: string): Promise<ToolStepResult> {
    // Generate orchestrated prompt for task overview and context
    const orchestrationResult = await this.orchestrator.orchestratePrompt(
      'taskpilot_focus',
      workspace.id,
      {
        task_id,
        workspace_path,
        workspace_name: workspace.name,
        timestamp: new Date().toISOString(),
        task_file_path: `${workspace_path}/.task/todo/current.md`,
        project_file_path: `${workspace_path}/.task/project.md`,
        rules_file_path: `${workspace_path}/.task/rules/workspace_rules.md`,
        focus_instructions: `Set focus on task ${task_id} and provide task overview with dependencies and context`
      }
    );

    return {
      isFinalStep: false,
      nextStepId: 'analyze',
      feedback: orchestrationResult.prompt_text + '\n\n*Next steps available: analyze (task breakdown), plan (implementation strategy), implement (execution guidance)*',
      data: {
        task_id,
        workspace_id: workspace.id,
        focused: true,
        available_steps: ['analyze', 'plan', 'implement']
      }
    };
  }

  private async handleAnalyzeStep(workspace: any, task_id: string, workspace_path: string): Promise<ToolStepResult> {
    // Generate detailed task analysis
    const orchestrationResult = await this.orchestrator.orchestratePrompt(
      'taskpilot_focus',
      workspace.id,
      {
        task_id,
        workspace_path,
        workspace_name: workspace.name,
        analysis_mode: true,
        timestamp: new Date().toISOString(),
        task_file_path: `${workspace_path}/.task/todo/current.md`,
        project_file_path: `${workspace_path}/.task/project.md`,
        rules_file_path: `${workspace_path}/.task/rules/workspace_rules.md`,
        focus_instructions: `Analyze task ${task_id} for complexity, dependencies, file connections, and potential challenges`
      }
    );

    return {
      isFinalStep: false,
      nextStepId: 'plan',
      feedback: orchestrationResult.prompt_text + '\n\n*Proceed to plan step for implementation strategy*',
      data: {
        task_id,
        workspace_id: workspace.id,
        analyzed: true,
        next_available: ['plan', 'implement']
      }
    };
  }

  private async handlePlanStep(workspace: any, task_id: string, workspace_path: string): Promise<ToolStepResult> {
    // Generate implementation planning
    const orchestrationResult = await this.orchestrator.orchestratePrompt(
      'taskpilot_focus',
      workspace.id,
      {
        task_id,
        workspace_path,
        workspace_name: workspace.name,
        planning_mode: true,
        timestamp: new Date().toISOString(),
        task_file_path: `${workspace_path}/.task/todo/current.md`,
        project_file_path: `${workspace_path}/.task/project.md`,
        rules_file_path: `${workspace_path}/.task/rules/workspace_rules.md`,
        focus_instructions: `Create implementation plan for task ${task_id} with step-by-step approach and resource requirements`
      }
    );

    return {
      isFinalStep: false,
      nextStepId: 'implement',
      feedback: orchestrationResult.prompt_text + '\n\n*Proceed to implement step for execution guidance*',
      data: {
        task_id,
        workspace_id: workspace.id,
        planned: true,
        next_available: ['implement']
      }
    };
  }

  private async handleImplementStep(workspace: any, task_id: string, workspace_path: string): Promise<ToolStepResult> {
    // Generate implementation guidance
    const orchestrationResult = await this.orchestrator.orchestratePrompt(
      'taskpilot_focus',
      workspace.id,
      {
        task_id,
        workspace_path,
        workspace_name: workspace.name,
        implementation_mode: true,
        timestamp: new Date().toISOString(),
        task_file_path: `${workspace_path}/.task/todo/current.md`,
        project_file_path: `${workspace_path}/.task/project.md`,
        rules_file_path: `${workspace_path}/.task/rules/workspace_rules.md`,
        focus_instructions: `Provide detailed implementation guidance for task ${task_id} with code examples and testing approach`
      }
    );

    return {
      isFinalStep: true,
      feedback: orchestrationResult.prompt_text,
      data: {
        task_id,
        workspace_id: workspace.id,
        implementation_ready: true,
        completed_flow: true
      }
    };
  }

  /**
   * Get tool definition for MCP server with multi-step support
   */
  static getToolDefinition() {
    return {
      name: 'taskpilot_focus',
      description: 'Focus on a specific task with multi-step analysis and implementation guidance. Supports stepId parameter.',
      inputSchema: {
        type: 'object',
        properties: {
          stepId: {
            type: 'string',
            enum: ['analyze', 'plan', 'implement'],
            description: 'Optional step ID: analyze (breakdown task), plan (strategy), implement (execution guidance)'
          },
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
