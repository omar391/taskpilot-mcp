import { z } from 'zod';
import type { DatabaseManager } from '../database/connection.js';
import type { TaskPilotToolResult } from '../types/index.js';
import { PromptOrchestrator } from '../services/prompt-orchestrator.js';

// Input schema for taskpilot_audit tool
export const auditToolSchema = z.object({
  workspace_path: z.string().describe('Absolute path to the workspace directory'),
  scope: z.enum(['full', 'tasks', 'dependencies', 'files']).optional().describe('Audit scope (defaults to full)'),
  fix_issues: z.boolean().optional().describe('Automatically fix detected issues (defaults to false)')
});

export type AuditToolInput = z.infer<typeof auditToolSchema>;

/**
 * TaskPilot Audit Tool - Project Health Checking
 * 
 * MCP tool for comprehensive project audit including task completion verification,
 * orphaned dependencies detection, file connectivity validation, and cleanup
 * action recommendations.
 */
export class AuditTool {
  private orchestrator: PromptOrchestrator;

  constructor(private db: DatabaseManager) {
    this.orchestrator = new PromptOrchestrator(db);
  }

  /**
   * Execute taskpilot_audit tool
   */
  async execute(input: AuditToolInput): Promise<TaskPilotToolResult> {
    try {
      const { workspace_path, scope = 'full', fix_issues = false } = input;

      // Get workspace
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

      // Perform comprehensive audit
      const auditResults = await this.performAudit(workspace.id, scope, fix_issues);

      // Generate orchestrated prompt with audit findings
      const orchestrationResult = await this.orchestrator.orchestratePrompt(
        'taskpilot_audit',
        workspace.id,
        {
          workspace_path,
          workspace_name: workspace.name,
          audit_scope: scope,
          total_tasks: auditResults.taskStats.total,
          completed_tasks: auditResults.taskStats.completed,
          in_progress_tasks: auditResults.taskStats.inProgress,
          blocked_tasks: auditResults.taskStats.blocked,
          orphaned_dependencies: auditResults.orphanedDependencies.length,
          circular_dependencies: auditResults.circularDependencies.length,
          missing_files: auditResults.missingFiles.length,
          inconsistent_progress: auditResults.inconsistentProgress.length,
          overdue_tasks: auditResults.overdueTasks.length,
          critical_issues_count: auditResults.criticalIssues.length,
          warning_issues_count: auditResults.warningIssues.length,
          info_issues_count: auditResults.infoIssues.length,
          issues_fixed: fix_issues ? auditResults.issuesFixed : 0,
          audit_summary: JSON.stringify(auditResults.summary),
          recommendations: JSON.stringify(auditResults.recommendations),
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
      console.error('Error in taskpilot_audit:', error);
      return {
        content: [{
          type: 'text',
          text: `Error performing audit: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  /**
   * Perform comprehensive project audit
   */
  private async performAudit(workspaceId: string, scope: string, fixIssues: boolean): Promise<any> {
    const results = {
      taskStats: await this.getTaskStatistics(workspaceId),
      orphanedDependencies: [] as any[],
      circularDependencies: [] as any[],
      missingFiles: [] as any[],
      inconsistentProgress: [] as any[],
      overdueTasks: [] as any[],
      criticalIssues: [] as any[],
      warningIssues: [] as any[],
      infoIssues: [] as any[],
      issuesFixed: 0,
      summary: {},
      recommendations: [] as string[]
    };

    // Audit tasks and dependencies
    if (scope === 'full' || scope === 'tasks') {
      results.orphanedDependencies = await this.findOrphanedDependencies(workspaceId);
      results.circularDependencies = await this.findCircularDependencies(workspaceId);
      results.inconsistentProgress = await this.findInconsistentProgress(workspaceId);
    }

    // Audit dependencies specifically
    if (scope === 'full' || scope === 'dependencies') {
      const dependencyIssues = await this.auditDependencies(workspaceId);
      results.orphanedDependencies.push(...dependencyIssues.orphaned);
      results.circularDependencies.push(...dependencyIssues.circular);
    }

    // Audit file connectivity
    if (scope === 'full' || scope === 'files') {
      results.missingFiles = await this.auditFileConnectivity(workspaceId);
    }

    // Find overdue tasks (In-Progress for more than reasonable time)
    results.overdueTasks = await this.findOverdueTasks(workspaceId);

    // Categorize issues by severity
    this.categorizeIssues(results);

    // Auto-fix issues if requested
    if (fixIssues) {
      results.issuesFixed = await this.autoFixIssues(workspaceId, results);
    }

    // Generate summary and recommendations
    results.summary = this.generateAuditSummary(results);
    results.recommendations = this.generateRecommendations(results);

    return results;
  }

  /**
   * Get task statistics
   */
  private async getTaskStatistics(workspaceId: string): Promise<any> {
    const stats = await this.db.get<any>(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'Done' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'In-Progress' THEN 1 END) as inProgress,
        COUNT(CASE WHEN status = 'Blocked' THEN 1 END) as blocked,
        COUNT(CASE WHEN status = 'Backlog' THEN 1 END) as backlog,
        COUNT(CASE WHEN status = 'Review' THEN 1 END) as review,
        COUNT(CASE WHEN status = 'Dropped' THEN 1 END) as dropped,
        AVG(progress) as avgProgress
       FROM tasks WHERE workspace_id = ?`,
      [workspaceId]
    );

    return stats || { total: 0, completed: 0, inProgress: 0, blocked: 0, backlog: 0, review: 0, dropped: 0, avgProgress: 0 };
  }

  /**
   * Find orphaned dependencies (tasks referencing non-existent parent/blocking tasks)
   */
  private async findOrphanedDependencies(workspaceId: string): Promise<any[]> {
    const orphaned = await this.db.all<any[]>(
      `SELECT t1.id, t1.title, t1.parent_task_id, t1.blocked_by_task_id,
              'parent' as issue_type
       FROM tasks t1 
       LEFT JOIN tasks t2 ON t1.parent_task_id = t2.id AND t2.workspace_id = ?
       WHERE t1.workspace_id = ? AND t1.parent_task_id IS NOT NULL AND t2.id IS NULL
       
       UNION
       
       SELECT t1.id, t1.title, t1.parent_task_id, t1.blocked_by_task_id,
              'blocked_by' as issue_type
       FROM tasks t1 
       LEFT JOIN tasks t2 ON t1.blocked_by_task_id = t2.id AND t2.workspace_id = ?
       WHERE t1.workspace_id = ? AND t1.blocked_by_task_id IS NOT NULL AND t2.id IS NULL`,
      [workspaceId, workspaceId, workspaceId, workspaceId]
    );

    return orphaned || [];
  }

  /**
   * Find circular dependencies
   */
  private async findCircularDependencies(workspaceId: string): Promise<any[]> {
    const tasks = await this.db.all<any>(
      'SELECT id, parent_task_id, blocked_by_task_id FROM tasks WHERE workspace_id = ?',
      [workspaceId]
    ) as any[];

    const circular = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    for (const task of tasks) {
      if (!visited.has(task.id)) {
        const cycle = this.detectCycle(task, tasks, visited, recursionStack, []);
        if (cycle.length > 0) {
          circular.push({
            cycle_tasks: cycle,
            cycle_type: 'dependency_chain'
          });
        }
      }
    }

    return circular;
  }

  /**
   * Detect dependency cycles using DFS
   */
  private detectCycle(task: any, allTasks: any[], visited: Set<string>, recursionStack: Set<string>, path: string[]): string[] {
    visited.add(task.id);
    recursionStack.add(task.id);
    path.push(task.id);

    // Check parent dependency
    if (task.parent_task_id) {
      if (recursionStack.has(task.parent_task_id)) {
        const cycleStart = path.indexOf(task.parent_task_id);
        return path.slice(cycleStart);
      }
      if (!visited.has(task.parent_task_id)) {
        const parentTask = allTasks.find(t => t.id === task.parent_task_id);
        if (parentTask) {
          const cycle = this.detectCycle(parentTask, allTasks, visited, recursionStack, [...path]);
          if (cycle.length > 0) return cycle;
        }
      }
    }

    // Check blocking dependency
    if (task.blocked_by_task_id) {
      if (recursionStack.has(task.blocked_by_task_id)) {
        const cycleStart = path.indexOf(task.blocked_by_task_id);
        return path.slice(cycleStart);
      }
      if (!visited.has(task.blocked_by_task_id)) {
        const blockingTask = allTasks.find(t => t.id === task.blocked_by_task_id);
        if (blockingTask) {
          const cycle = this.detectCycle(blockingTask, allTasks, visited, recursionStack, [...path]);
          if (cycle.length > 0) return cycle;
        }
      }
    }

    recursionStack.delete(task.id);
    return [];
  }

  /**
   * Find tasks with inconsistent progress (Done status but progress < 100, etc.)
   */
  private async findInconsistentProgress(workspaceId: string): Promise<any[]> {
    const inconsistent = await this.db.all<any[]>(
      `SELECT id, title, status, progress,
              CASE 
                WHEN status = 'Done' AND progress < 100 THEN 'done_incomplete_progress'
                WHEN status = 'Backlog' AND progress > 0 THEN 'backlog_has_progress'
                WHEN status = 'In-Progress' AND progress = 0 THEN 'inprogress_no_progress'
                WHEN status = 'In-Progress' AND progress = 100 THEN 'inprogress_complete_progress'
              END as issue_type
       FROM tasks 
       WHERE workspace_id = ?
         AND (
           (status = 'Done' AND progress < 100) OR
           (status = 'Backlog' AND progress > 0) OR
           (status = 'In-Progress' AND progress = 0) OR
           (status = 'In-Progress' AND progress = 100)
         )`,
      [workspaceId]
    );

    return inconsistent || [];
  }

  /**
   * Audit file connectivity (check if connected files exist)
   */
  private async auditFileConnectivity(workspaceId: string): Promise<any[]> {
    const fs = await import('fs');
    const path = await import('path');
    
    const tasks = await this.db.all<any>(
      'SELECT id, title, connected_files FROM tasks WHERE workspace_id = ? AND connected_files IS NOT NULL',
      [workspaceId]
    ) as any[];

    const workspace = await this.db.get<any>('SELECT path FROM workspaces WHERE id = ?', [workspaceId]);
    const workspacePath = workspace?.path;

    const missingFiles = [];

    for (const task of tasks) {
      try {
        const files = JSON.parse(task.connected_files || '[]');
        for (const file of files) {
          if (workspacePath) {
            const fullPath = path.resolve(workspacePath, file);
            if (!fs.existsSync(fullPath)) {
              missingFiles.push({
                task_id: task.id,
                task_title: task.title,
                missing_file: file,
                full_path: fullPath
              });
            }
          }
        }
      } catch (error) {
        // Invalid JSON in connected_files
        missingFiles.push({
          task_id: task.id,
          task_title: task.title,
          missing_file: 'Invalid JSON in connected_files',
          full_path: 'N/A'
        });
      }
    }

    return missingFiles;
  }

  /**
   * Find potentially overdue tasks
   */
  private async findOverdueTasks(workspaceId: string): Promise<any[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7); // 7 days ago

    const overdue = await this.db.all<any[]>(
      `SELECT id, title, status, updated_at, progress
       FROM tasks 
       WHERE workspace_id = ? 
         AND status = 'In-Progress' 
         AND updated_at < ?
         AND progress < 100`,
      [workspaceId, cutoffDate.toISOString()]
    );

    return overdue || [];
  }

  /**
   * Audit dependency relationships
   */
  private async auditDependencies(workspaceId: string): Promise<any> {
    const orphaned = await this.findOrphanedDependencies(workspaceId);
    const circular = await this.findCircularDependencies(workspaceId);

    return { orphaned, circular };
  }

  /**
   * Categorize issues by severity
   */
  private categorizeIssues(results: any): void {
    // Critical issues
    results.criticalIssues = [
      ...results.circularDependencies.map((dep: any) => ({ type: 'circular_dependency', ...dep })),
      ...results.orphanedDependencies.map((dep: any) => ({ type: 'orphaned_dependency', ...dep }))
    ];

    // Warning issues
    results.warningIssues = [
      ...results.inconsistentProgress.map((task: any) => ({ type: 'inconsistent_progress', ...task })),
      ...results.overdueTasks.map((task: any) => ({ type: 'overdue_task', ...task }))
    ];

    // Info issues
    results.infoIssues = [
      ...results.missingFiles.map((file: any) => ({ type: 'missing_file', ...file }))
    ];
  }

  /**
   * Auto-fix detected issues
   */
  private async autoFixIssues(workspaceId: string, results: any): Promise<number> {
    let fixedCount = 0;

    // Fix orphaned dependencies by removing invalid references
    for (const orphan of results.orphanedDependencies) {
      if (orphan.issue_type === 'parent') {
        await this.db.run(
          'UPDATE tasks SET parent_task_id = NULL WHERE id = ? AND workspace_id = ?',
          [orphan.id, workspaceId]
        );
        fixedCount++;
      } else if (orphan.issue_type === 'blocked_by') {
        await this.db.run(
          'UPDATE tasks SET blocked_by_task_id = NULL WHERE id = ? AND workspace_id = ?',
          [orphan.id, workspaceId]
        );
        fixedCount++;
      }
    }

    // Fix some inconsistent progress issues
    for (const inconsistent of results.inconsistentProgress) {
      if (inconsistent.issue_type === 'done_incomplete_progress') {
        await this.db.run(
          'UPDATE tasks SET progress = 100 WHERE id = ? AND workspace_id = ?',
          [inconsistent.id, workspaceId]
        );
        fixedCount++;
      } else if (inconsistent.issue_type === 'backlog_has_progress') {
        await this.db.run(
          'UPDATE tasks SET progress = 0 WHERE id = ? AND workspace_id = ?',
          [inconsistent.id, workspaceId]
        );
        fixedCount++;
      }
    }

    return fixedCount;
  }

  /**
   * Generate audit summary
   */
  private generateAuditSummary(results: any): any {
    return {
      health_score: this.calculateHealthScore(results),
      total_issues: results.criticalIssues.length + results.warningIssues.length + results.infoIssues.length,
      project_status: this.determineProjectStatus(results),
      completion_rate: Math.round((results.taskStats.completed / Math.max(results.taskStats.total, 1)) * 100)
    };
  }

  /**
   * Calculate project health score (0-100)
   */
  private calculateHealthScore(results: any): number {
    let score = 100;
    
    // Deduct for critical issues
    score -= results.criticalIssues.length * 20;
    
    // Deduct for warning issues
    score -= results.warningIssues.length * 10;
    
    // Deduct for info issues
    score -= results.infoIssues.length * 5;
    
    // Boost for high completion rate
    const completionRate = results.taskStats.completed / Math.max(results.taskStats.total, 1);
    score += completionRate * 20;
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Determine overall project status
   */
  private determineProjectStatus(results: any): string {
    if (results.criticalIssues.length > 0) return 'Critical Issues';
    if (results.warningIssues.length > 5) return 'Needs Attention';
    if (results.taskStats.completed / Math.max(results.taskStats.total, 1) > 0.8) return 'Near Completion';
    if (results.taskStats.inProgress > 0) return 'Active Development';
    return 'Stable';
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(results: any): string[] {
    const recommendations = [];

    if (results.criticalIssues.length > 0) {
      recommendations.push('Fix critical issues immediately: orphaned dependencies and circular references');
    }

    if (results.overdueTasks.length > 0) {
      recommendations.push(`Review ${results.overdueTasks.length} overdue tasks for status updates or completion`);
    }

    if (results.inconsistentProgress.length > 0) {
      recommendations.push('Update task progress to match current status');
    }

    if (results.missingFiles.length > 0) {
      recommendations.push('Update connected file lists to reflect current project structure');
    }

    if (results.taskStats.blocked > 0) {
      recommendations.push('Review blocked tasks and resolve blocking dependencies');
    }

    if (recommendations.length === 0) {
      recommendations.push('Project health is good. Continue current development pace.');
    }

    return recommendations;
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
   * Get tool definition for MCP server
   */
  static getToolDefinition() {
    return {
      name: 'taskpilot_audit',
      description: 'Perform comprehensive project audit and health check',
      inputSchema: {
        type: 'object',
        properties: {
          workspace_path: {
            type: 'string',
            description: 'Absolute path to the workspace directory'
          },
          scope: {
            type: 'string',
            enum: ['full', 'tasks', 'dependencies', 'files'],
            description: 'Audit scope (defaults to full)'
          },
          fix_issues: {
            type: 'boolean',
            description: 'Automatically fix detected issues (defaults to false)'
          }
        },
        required: ['workspace_path']
      }
    };
  }
}
