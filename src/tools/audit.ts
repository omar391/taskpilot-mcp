import { z } from 'zod';
import type { TaskPilotToolResult, ToolStepResult, MultiStepToolInput } from '../types/index.js';
import { BaseTool, BaseToolConfig, ToolDefinition, createBaseToolSchema } from './base-tool.js';
import type { DrizzleDatabaseManager } from '../database/drizzle-connection.js';
import { WorkspaceDatabaseService } from '../database/workspace-queries.js';

// Input schema using the new base pattern
export const auditToolSchema = createBaseToolSchema('taskpilot_audit', {}, ['workspace_path']);

export type AuditToolInput = z.infer<typeof auditToolSchema>;

/**
 * TaskPilot Audit Tool - Refactored using BaseTool interface
 * 
 * Enhanced with database-driven stepId enumeration and common error handling.
 */
export class AuditToolNew extends BaseTool {
  constructor(drizzleDb: DrizzleDatabaseManager) {
    const config: BaseToolConfig = {
      name: 'taskpilot_audit',
      description: 'Audit workspace tasks to identify completion readiness and rule violations. Supports multi-step workflow.',
      requiredFields: ['workspace_path'],
      additionalProperties: {}
    };

    super(drizzleDb, config);
  }

  /**
   * Execute taskpilot_audit tool with multi-step support using base class validation
   */
  async execute(input: MultiStepToolInput): Promise<ToolStepResult | TaskPilotToolResult> {
    try {
      const { stepId, workspace_path } = input;

      // Use base class workspace validation
      const workspaceValidation = await this.validateWorkspace(workspace_path);
      if (!workspaceValidation.isValid) {
        return this.createErrorResult(workspaceValidation.error!, { workspace_path });
      }

      const workspace = workspaceValidation.workspace;

      // Route to appropriate step handler
      switch (stepId) {
        case 'detailed':
          return await this.handleDetailedStep(workspace);
        case 'violations':
          return await this.handleViolationsStep(workspace);
        case 'completion_check':
          return await this.handleCompletionCheckStep(workspace);
        default:
          return await this.handleOverviewStep(workspace);
      }

    } catch (error) {
      const errorMessage = `Error in taskpilot_audit: ${error instanceof Error ? error.message : String(error)}`;
      return this.createErrorResult(errorMessage, { input });
    }
  }

  /**
   * Overview step - provide high-level audit summary
   */
  private async handleOverviewStep(workspace: any): Promise<TaskPilotToolResult> {
    try {
      const workspaceDb = new WorkspaceDatabaseService(workspace.path, this.drizzleDb);
      const tasks = await workspaceDb.getAllTasks();

      // Calculate task statistics
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.status === 'done').length;
      const inProgressTasks = tasks.filter(t => t.status === 'in-progress').length;
      const blockedTasks = tasks.filter(t => t.status === 'blocked').length;
      const reviewTasks = tasks.filter(t => t.status === 'review').length;

      // Identify high-priority tasks
      const highPriorityTasks = tasks.filter(t => t.priority === 'high' && t.status !== 'done');

      // Generate audit prompt
      const orchestrationResult = await this.orchestrator.orchestratePrompt(
        'taskpilot_audit',
        workspace.id,
        {
          total_tasks: totalTasks,
          completed_tasks: completedTasks,
          in_progress_tasks: inProgressTasks,
          blocked_tasks: blockedTasks,
          review_tasks: reviewTasks,
          high_priority_tasks: highPriorityTasks.length,
          completion_percentage: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
          step: 'overview'
        }
      );

      return this.createSuccessResult(
        orchestrationResult.prompt_text,
        {
          isFinalStep: false,
          nextStepId: 'detailed',
          feedback: 'Workspace audit overview completed. Use detailed step for more information.',
          data: {
            summary: {
              total_tasks: totalTasks,
              completed_tasks: completedTasks,
              in_progress_tasks: inProgressTasks,
              blocked_tasks: blockedTasks,
              review_tasks: reviewTasks,
              high_priority_tasks: highPriorityTasks.length,
              completion_percentage: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
            },
            high_priority_tasks: highPriorityTasks.map(t => ({
              id: t.id,
              title: t.title,
              status: t.status,
              priority: t.priority
            }))
          }
        }
      );

    } catch (error) {
      return this.createErrorResult(
        `Failed to generate audit overview: ${error instanceof Error ? error.message : String(error)}`,
        { workspace_path: workspace.path }
      );
    }
  }

  /**
   * Detailed step - provide comprehensive task analysis
   */
  private async handleDetailedStep(workspace: any): Promise<TaskPilotToolResult> {
    try {
      const workspaceDb = new WorkspaceDatabaseService(workspace.path, this.drizzleDb);
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

      // Identify potential issues
      const staleInProgress = tasksByStatus['in-progress'].filter(t => {
        const updatedDate = new Date(t.updatedAt || t.createdAt || Date.now());
        const daysSinceUpdate = (Date.now() - updatedDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceUpdate > 7; // Tasks not updated in 7 days
      });

      const tasksWithoutDescription = tasks.filter(t => !t.description || t.description.trim().length < 10);

      // Generate detailed audit prompt
      const orchestrationResult = await this.orchestrator.orchestratePrompt(
        'taskpilot_audit',
        workspace.id,
        {
          tasks_by_status: tasksByStatus,
          stale_in_progress: staleInProgress.length,
          tasks_without_description: tasksWithoutDescription.length,
          step: 'detailed'
        }
      );

      return this.createSuccessResult(
        orchestrationResult.prompt_text,
        {
          isFinalStep: false,
          nextStepId: 'violations',
          feedback: 'Detailed audit analysis completed. Use violations step for rule compliance check.',
          data: {
            tasks_by_status: Object.fromEntries(
              Object.entries(tasksByStatus).map(([status, tasks]) => [
                status,
                tasks.map(t => ({ id: t.id, title: t.title, priority: t.priority }))
              ])
            ),
            issues: {
              stale_in_progress: staleInProgress.map(t => ({
                id: t.id,
                title: t.title,
                days_since_update: Math.floor((Date.now() - new Date(t.updatedAt || t.createdAt || Date.now()).getTime()) / (1000 * 60 * 60 * 24))
              })),
              tasks_without_description: tasksWithoutDescription.map(t => ({
                id: t.id,
                title: t.title
              }))
            }
          }
        }
      );

    } catch (error) {
      return this.createErrorResult(
        `Failed to generate detailed audit: ${error instanceof Error ? error.message : String(error)}`,
        { workspace_path: workspace.path }
      );
    }
  }

  /**
   * Violations step - check for rule violations and compliance issues
   */
  private async handleViolationsStep(workspace: any): Promise<TaskPilotToolResult> {
    try {
      const workspaceDb = new WorkspaceDatabaseService(workspace.path, this.drizzleDb);
      const tasks = await workspaceDb.getAllTasks();

      // Check for various rule violations
      const violations = {
        high_priority_in_backlog: tasks.filter(t => t.priority === 'high' && t.status === 'backlog'),
        tasks_missing_details: tasks.filter(t => !t.description || t.description.trim().length < 20),
        long_running_in_progress: tasks.filter(t => {
          if (t.status !== 'in-progress') return false;
          const createdDate = new Date(t.createdAt || Date.now());
          const daysSinceCreated = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
          return daysSinceCreated > 14; // Tasks in progress for more than 14 days
        }),
        review_tasks_pending: tasks.filter(t => t.status === 'review'),
        blocked_without_notes: tasks.filter(t => t.status === 'blocked' && (!t.notes || t.notes.trim().length < 10))
      };

      const totalViolations = Object.values(violations).reduce((sum, arr) => sum + arr.length, 0);

      // Generate violations audit prompt
      const orchestrationResult = await this.orchestrator.orchestratePrompt(
        'taskpilot_audit',
        workspace.id,
        {
          violations,
          total_violations: totalViolations,
          step: 'violations'
        }
      );

      return this.createSuccessResult(
        orchestrationResult.prompt_text,
        {
          isFinalStep: false,
          nextStepId: 'completion_check',
          feedback: 'Rule violations audit completed. Use completion_check step for readiness assessment.',
          data: {
            violations: Object.fromEntries(
              Object.entries(violations).map(([type, tasks]) => [
                type,
                tasks.map(t => ({ id: t.id, title: t.title, status: t.status, priority: t.priority }))
              ])
            ),
            total_violations: totalViolations,
            compliance_score: Math.max(0, 100 - (totalViolations * 5)) // Deduct 5 points per violation
          }
        }
      );

    } catch (error) {
      return this.createErrorResult(
        `Failed to check rule violations: ${error instanceof Error ? error.message : String(error)}`,
        { workspace_path: workspace.path }
      );
    }
  }

  /**
   * Completion check step - assess readiness for project completion
   */
  private async handleCompletionCheckStep(workspace: any): Promise<TaskPilotToolResult> {
    try {
      const workspaceDb = new WorkspaceDatabaseService(workspace.path, this.drizzleDb);
      const tasks = await workspaceDb.getAllTasks();

      // Assess completion readiness
      const openTasks = tasks.filter(t => !['done', 'dropped'].includes(t.status || ''));
      const criticalTasks = tasks.filter(t => t.priority === 'high' && t.status !== 'done');
      const tasksInReview = tasks.filter(t => t.status === 'review');
      const blockedTasks = tasks.filter(t => t.status === 'blocked');

      const isReadyForCompletion = openTasks.length === 0;
      const blockerCount = criticalTasks.length + blockedTasks.length;

      // Generate completion check prompt
      const orchestrationResult = await this.orchestrator.orchestratePrompt(
        'taskpilot_audit',
        workspace.id,
        {
          open_tasks: openTasks.length,
          critical_tasks: criticalTasks.length,
          tasks_in_review: tasksInReview.length,
          blocked_tasks: blockedTasks.length,
          is_ready_for_completion: isReadyForCompletion,
          blocker_count: blockerCount,
          step: 'completion_check'
        }
      );

      return this.createSuccessResult(
        orchestrationResult.prompt_text,
        {
          isFinalStep: true,
          feedback: 'Completion readiness assessment completed.',
          data: {
            readiness_assessment: {
              is_ready_for_completion: isReadyForCompletion,
              open_tasks: openTasks.length,
              critical_tasks: criticalTasks.length,
              tasks_in_review: tasksInReview.length,
              blocked_tasks: blockedTasks.length,
              blocker_count: blockerCount
            },
            remaining_work: {
              critical_tasks: criticalTasks.map(t => ({ id: t.id, title: t.title })),
              blocked_tasks: blockedTasks.map(t => ({ id: t.id, title: t.title, notes: t.notes })),
              review_tasks: tasksInReview.map(t => ({ id: t.id, title: t.title }))
            }
          }
        }
      );

    } catch (error) {
      return this.createErrorResult(
        `Failed to assess completion readiness: ${error instanceof Error ? error.message : String(error)}`,
        { workspace_path: workspace.path }
      );
    }
  }

  /**
   * Get tool definition with dynamic stepId enumeration
   */
  static async getToolDefinitionDynamic(drizzleDb: DrizzleDatabaseManager): Promise<ToolDefinition> {
    const instance = new AuditToolNew(drizzleDb);
    return await instance.getToolDefinition();
  }

  /**
   * Static tool definition for immediate use (fallback)
   */
  static getToolDefinition(): ToolDefinition {
    return {
      name: 'taskpilot_audit',
      description: 'Audit workspace tasks to identify completion readiness and rule violations. Supports multi-step workflow.',
      inputSchema: {
        type: 'object',
        properties: {
          stepId: {
            type: 'string',
            enum: ['detailed', 'violations', 'completion_check'],
            description: 'Optional step ID for multi-step workflow: detailed, violations, completion_check'
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
