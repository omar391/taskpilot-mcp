import { z } from 'zod';
import type { TaskPilotToolResult, ToolStepResult, MultiStepToolInput } from '../types/index.js';
import { BaseTool, BaseToolConfig, ToolDefinition, createBaseToolSchema } from './base-tool.js';
import type { DrizzleDatabaseManager } from '../database/drizzle-connection.js';
import { WorkspaceDatabaseService } from '../database/workspace-queries.js';
import { 
  ToolFlowExecutor, 
  type StepHandlerMap, 
  type DatabaseDrivenTool 
} from '../services/tool-flow-executor.js';
import { DatabaseService } from '../services/database-service.js';
import { WorkspaceRegistry } from '../services/workspace-registry.js';
import { ToolNames } from '../constants/tool-names.js';

export const statusToolSchema = createBaseToolSchema(ToolNames.STATUS, {}, ['workspace_path']);

export type StatusToolInput = z.infer<typeof statusToolSchema>;

/**
 * TaskPilot Status Tool - Database-Driven Flow Execution
 * 
 * Uses ToolFlowExecutor for dynamic step routing instead of hardcoded switch statements.
 * Provides comprehensive project status with task analysis and recommendations.
 */
export class StatusToolNew extends BaseTool implements DatabaseDrivenTool {
  private flowExecutor: ToolFlowExecutor;

  constructor(drizzleDb: DrizzleDatabaseManager) {
    const config: BaseToolConfig = {
      name: ToolNames.STATUS,
      description: 'Generate comprehensive project status report with analysis and recommendations. Uses database-driven flow execution.',
      requiredFields: ['workspace_path'],
      additionalProperties: {}
    };

    super(drizzleDb, config);
    this.flowExecutor = new ToolFlowExecutor(drizzleDb);
  }

  /**
   * Execute taskpilot_status tool with database-driven step routing
   */
  async execute(input: MultiStepToolInput): Promise<ToolStepResult | TaskPilotToolResult> {
    try {
      const { stepId, workspace_path } = input;

      // Use base class workspace validation
      const workspaceValidation = await this.validateWorkspace(workspace_path);
      if (!workspaceValidation.isValid) {
        return this.createErrorResult(workspaceValidation.error!, { workspace_path });
      }

      // Execute step using database-driven flow
      return await this.flowExecutor.executeStep(
        this.getToolName(),
        stepId,
        input,
        this.getStepHandlers()
      );

    } catch (error) {
      const errorMessage = `Error in taskpilot_status: ${error instanceof Error ? error.message : String(error)}`;
      return this.createErrorResult(errorMessage, { input });
    }
  }

  /**
   * Get tool name for database lookup
   */
  getToolName(): string {
    return ToolNames.STATUS;
  }

  /**
   * Get map of step handlers for this tool
   */
  getStepHandlers(): StepHandlerMap {
    return {
      'initial': this.handleOverviewStep.bind(this),
      'overview': this.handleOverviewStep.bind(this),
      'detailed': this.handleDetailedStep.bind(this),
      'recommendations': this.handleRecommendationsStep.bind(this),
      'rules': this.handleRulesStep.bind(this)
    };
  }

  /**
   * Overview step - provide high-level status summary
   */
  private async handleOverviewStep(input: MultiStepToolInput): Promise<TaskPilotToolResult> {
    const { workspace_path } = input;

    try {
      const workspaceValidation = await this.validateWorkspace(workspace_path);
      if (!workspaceValidation.isValid) {
        return this.createErrorResult(workspaceValidation.error!, { workspace_path });
      }

      const workspace = workspaceValidation.workspace;
      const workspaceDb = new WorkspaceDatabaseService(workspace.path);
      await workspaceDb.initialize();
      const tasks = await workspaceDb.getAllTasks();

      // Calculate status metrics
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.status === 'done').length;
      const inProgressTasks = tasks.filter(t => t.status === 'in-progress').length;
      const blockedTasks = tasks.filter(t => t.status === 'blocked').length;

      // Generate status prompt
      const orchestrationResult = await this.orchestrator.orchestratePrompt(
        ToolNames.STATUS,
        workspace.id,
        {
          total_tasks: totalTasks,
          completed_tasks: completedTasks,
          in_progress_tasks: inProgressTasks,
          blocked_tasks: blockedTasks,
          completion_percentage: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
          step: 'overview'
        }
      );

      return this.createSuccessResult(
        orchestrationResult.prompt_text,
        {
          isFinalStep: false,
          nextStepId: 'detailed', // This will be overridden by ToolFlowExecutor
          feedback: 'Status overview generated. Use detailed step for comprehensive analysis.',
          data: {
            summary: {
              total_tasks: totalTasks,
              completed_tasks: completedTasks,
              in_progress_tasks: inProgressTasks,
              blocked_tasks: blockedTasks,
              completion_percentage: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
            }
          }
        }
      );

    } catch (error) {
      return this.createErrorResult(
        `Failed to generate status overview: ${error instanceof Error ? error.message : String(error)}`,
        { workspace_path }
      );
    }
  }

  /**
   * Detailed step - provide comprehensive analysis
   */
  private async handleDetailedStep(input: MultiStepToolInput): Promise<TaskPilotToolResult> {
    const { workspace_path } = input;

    try {
      const workspaceValidation = await this.validateWorkspace(workspace_path);
      if (!workspaceValidation.isValid) {
        return this.createErrorResult(workspaceValidation.error!, { workspace_path });
      }

      const workspace = workspaceValidation.workspace;
      const workspaceDb = new WorkspaceDatabaseService(workspace.path);
      await workspaceDb.initialize();
      const tasks = await workspaceDb.getAllTasks();

      // Group tasks by status
      const tasksByStatus = {
        backlog: tasks.filter(t => t.status === 'backlog'),
        'in-progress': tasks.filter(t => t.status === 'in-progress'),
        blocked: tasks.filter(t => t.status === 'blocked'),
        review: tasks.filter(t => t.status === 'review'),
        done: tasks.filter(t => t.status === 'done'),
        dropped: tasks.filter(t => t.status === 'dropped')
      };

      // Generate detailed analysis prompt
      const orchestrationResult = await this.orchestrator.orchestratePrompt(
        ToolNames.STATUS,
        workspace.id,
        {
          tasks_by_status: tasksByStatus,
          step: 'detailed'
        }
      );

      return this.createSuccessResult(
        orchestrationResult.prompt_text,
        {
          isFinalStep: false,
          nextStepId: 'recommendations', // This will be overridden by ToolFlowExecutor
          feedback: 'Detailed analysis completed. Use recommendations step for actionable insights.',
          data: {
            tasks_by_status: Object.fromEntries(
              Object.entries(tasksByStatus).map(([status, tasks]) => [
                status,
                tasks.map(t => ({ id: t.id, title: t.title, priority: t.priority }))
              ])
            )
          }
        }
      );

    } catch (error) {
      return this.createErrorResult(
        `Failed to generate detailed analysis: ${error instanceof Error ? error.message : String(error)}`,
        { workspace_path }
      );
    }
  }

  /**
   * Recommendations step - provide actionable recommendations
   */
  private async handleRecommendationsStep(input: MultiStepToolInput): Promise<TaskPilotToolResult> {
    const { workspace_path } = input;

    try {
      const workspaceValidation = await this.validateWorkspace(workspace_path);
      if (!workspaceValidation.isValid) {
        return this.createErrorResult(workspaceValidation.error!, { workspace_path });
      }

      const workspace = workspaceValidation.workspace;
      const workspaceDb = new WorkspaceDatabaseService(workspace.path);
      await workspaceDb.initialize();
      const tasks = await workspaceDb.getAllTasks();

      // Analyze for recommendations
      const highPriorityBacklog = tasks.filter(t => t.priority === 'high' && t.status === 'backlog');
      const staleInProgress = tasks.filter(t => {
        if (t.status !== 'in-progress') return false;
        const updatedDate = new Date(t.updatedAt || t.createdAt || Date.now());
        const daysSinceUpdate = (Date.now() - updatedDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceUpdate > 7;
      });

      // Generate recommendations prompt
      const orchestrationResult = await this.orchestrator.orchestratePrompt(
        ToolNames.STATUS,
        workspace.id,
        {
          high_priority_backlog: highPriorityBacklog.length,
          stale_in_progress: staleInProgress.length,
          step: 'recommendations'
        }
      );

      return this.createSuccessResult(
        orchestrationResult.prompt_text,
        {
          isFinalStep: false,
          nextStepId: 'rules', // This will be overridden by ToolFlowExecutor
          feedback: 'Recommendations generated. Use rules step to review workspace compliance.',
          data: {
            recommendations: {
              high_priority_backlog: highPriorityBacklog.map(t => ({ id: t.id, title: t.title })),
              stale_in_progress: staleInProgress.map(t => ({ id: t.id, title: t.title }))
            }
          }
        }
      );

    } catch (error) {
      return this.createErrorResult(
        `Failed to generate recommendations: ${error instanceof Error ? error.message : String(error)}`,
        { workspace_path }
      );
    }
  }

  /**
   * Rules step - analyze workspace rule compliance
   */
  private async handleRulesStep(input: MultiStepToolInput): Promise<TaskPilotToolResult> {
    const { workspace_path } = input;

    try {
      const workspaceValidation = await this.validateWorkspace(workspace_path);
      if (!workspaceValidation.isValid) {
        return this.createErrorResult(workspaceValidation.error!, { workspace_path });
      }

      const workspace = workspaceValidation.workspace;

      // Generate rules compliance prompt
      const orchestrationResult = await this.orchestrator.orchestratePrompt(
        ToolNames.STATUS,
        workspace.id,
        {
          step: 'rules'
        }
      );

      return this.createSuccessResult(
        orchestrationResult.prompt_text,
        {
          isFinalStep: true,
          feedback: 'Complete status analysis with workspace rule compliance review completed.',
          data: {
            rules_analysis: true,
            analysis_complete: true
          }
        }
      );

    } catch (error) {
      return this.createErrorResult(
        `Failed to analyze rules compliance: ${error instanceof Error ? error.message : String(error)}`,
        { workspace_path }
      );
    }
  }

  /**
   * Get tool definition with dynamic stepId enumeration from database
   */
  static async getToolDefinitionDynamic(drizzleDb: DrizzleDatabaseManager): Promise<ToolDefinition> {
    const flowExecutor = new ToolFlowExecutor(drizzleDb);
    const availableSteps = await flowExecutor.getAvailableStepIds(ToolNames.STATUS);

    return {
      name: ToolNames.STATUS,
      description: 'Generate comprehensive project status report with analysis and recommendations. Uses database-driven flow execution.',
      inputSchema: {
        type: 'object',
        properties: {
          stepId: {
            type: 'string',
            enum: availableSteps,
            description: `Optional step ID for multi-step workflow: ${availableSteps.join(', ')}`
          },
          workspace_path: {
            type: 'string',
            description: 'Absolute path to the workspace directory'
          }
        },
        required: ['workspace_path']
      }
    };
  }

  /**
   * Static tool definition for immediate use (fallback)
   */
  static getToolDefinition(): ToolDefinition {
    return {
      name: ToolNames.STATUS,
      description: 'Generate comprehensive project status report with analysis and recommendations. Uses database-driven flow execution.',
      inputSchema: {
        type: 'object',
        properties: {
          stepId: {
            type: 'string',
            enum: ['detailed', 'recommendations', 'rules'],
            description: 'Optional step ID for multi-step workflow: detailed, recommendations, rules'
          },
          workspace_path: {
            type: 'string',
            description: 'Absolute path to the workspace directory'
          }
        },
        required: ['workspace_path']
      }
    };
  }
}
