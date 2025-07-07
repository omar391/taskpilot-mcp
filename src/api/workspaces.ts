/**
 * Workspaces API Routes
 * GET /api/workspaces - List all workspaces
 */

import { Request, Response } from 'express';
import { DatabaseService } from '../services/database-service.js';
import { WorkspacesResponse, WorkspaceSummary } from './types.js';
import { createSuccessResponse, createErrorResponse, NotFoundError } from './middleware.js';

export class WorkspacesController {
  constructor(private databaseService: DatabaseService) {}

  /**
   * GET /api/workspaces
   * List all TaskPilot workspaces with summary information
   */
  async getWorkspaces(req: Request, res: Response): Promise<void> {
    try {
      // Query workspaces from global database
      const workspaces = await this.databaseService.globalAll(`
        SELECT 
          id,
          name,
          path,
          status,
          last_activity,
          created_at,
          updated_at
        FROM workspaces 
        ORDER BY last_activity DESC
      `);

      // For each workspace, get task counts and active task
      const enrichedWorkspaces: WorkspaceSummary[] = await Promise.all(
        workspaces.map(async (workspace: any) => {
          try {
            // Get task count from workspace database
            const taskCountResult = await this.databaseService.workspaceGet(
              workspace.path,
              'SELECT COUNT(*) as count FROM tasks WHERE status != "Done" AND status != "Dropped"'
            );
            const taskCount = taskCountResult?.count || 0;

            // Get active task (highest priority in-progress task)
            const activeTaskResult = await this.databaseService.workspaceGet(
              workspace.path,
              `SELECT title FROM tasks 
               WHERE status = "In-Progress" 
               ORDER BY 
                 CASE priority 
                   WHEN "High" THEN 1 
                   WHEN "Medium" THEN 2 
                   WHEN "Low" THEN 3 
                 END,
                 updated_at DESC 
               LIMIT 1`
            );
            const activeTask = activeTaskResult?.title || null;

            return {
              id: workspace.id,
              name: workspace.name,
              path: workspace.path,
              status: workspace.status || 'disconnected',
              last_activity: workspace.last_activity,
              task_count: taskCount,
              active_task: activeTask,
              created_at: workspace.created_at,
              updated_at: workspace.updated_at
            };
          } catch (error) {
            // If workspace database is inaccessible, return basic info with error status
            console.warn(`Warning: Cannot access workspace database for ${workspace.path}:`, error);
            return {
              id: workspace.id,
              name: workspace.name,
              path: workspace.path,
              status: 'error' as const,
              last_activity: workspace.last_activity,
              task_count: 0,
              active_task: null,
              created_at: workspace.created_at,
              updated_at: workspace.updated_at
            };
          }
        })
      );

      const response: WorkspacesResponse = {
        workspaces: enrichedWorkspaces
      };

      res.json(createSuccessResponse(response));
    } catch (error) {
      console.error('Error fetching workspaces:', error);
      throw error;
    }
  }

  /**
   * Helper method to get workspace info by ID
   */
  async getWorkspaceById(workspaceId: string): Promise<any> {
    const workspace = await this.databaseService.globalGet(
      'SELECT * FROM workspaces WHERE id = ?',
      [workspaceId]
    );

    if (!workspace) {
      throw new NotFoundError(`Workspace not found: ${workspaceId}`);
    }

    return workspace;
  }
}
