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
      const globalDb = this.databaseService.getGlobal();
      const workspaces = await globalDb.getAllWorkspaces();

      // For each workspace, get task counts and active task
      const enrichedWorkspaces: WorkspaceSummary[] = await Promise.all(
        workspaces.map(async (workspace: any) => {
          try {
            // Get workspace database service
            const workspaceDb = await this.databaseService.getWorkspace(workspace.path);
            
            // Get all tasks to calculate task count and find active task
            const allTasks = await workspaceDb.getAllTasks();
            const activeTasks = allTasks.filter(task => 
              task.status !== 'done' && task.status !== 'dropped'
            );
            const taskCount = activeTasks.length;

            // Get active task (highest priority in-progress task)
            const inProgressTasks = allTasks.filter(task => task.status === 'in-progress');
            const priorityOrder: Record<string, number> = { 'high': 1, 'medium': 2, 'low': 3 };
            const activeTask = inProgressTasks
              .sort((a, b) => {
                const priorityDiff = (priorityOrder[a.priority || 'medium'] || 4) - (priorityOrder[b.priority || 'medium'] || 4);
                if (priorityDiff !== 0) return priorityDiff;
                const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
                const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
                return bTime - aTime;
              })[0];

            return {
              id: workspace.id,
              name: workspace.name,
              path: workspace.path,
              status: workspace.status || 'disconnected',
              last_activity: workspace.lastActivity,
              task_count: taskCount,
              active_task: activeTask?.title || null,
              created_at: workspace.createdAt,
              updated_at: workspace.updatedAt
            };
          } catch (error) {
            // If workspace database is inaccessible, return basic info with error status
            console.warn(`Warning: Cannot access workspace database for ${workspace.path}:`, error);
            return {
              id: workspace.id,
              name: workspace.name,
              path: workspace.path,
              status: 'error' as const,
              last_activity: workspace.lastActivity,
              task_count: 0,
              active_task: null,
              created_at: workspace.createdAt,
              updated_at: workspace.updatedAt,
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
    const globalDb = this.databaseService.getGlobal();
    const workspace = await globalDb.getWorkspace(workspaceId);

    if (!workspace) {
      throw new NotFoundError(`Workspace not found: ${workspaceId}`);
    }

    return workspace;
  }
}
