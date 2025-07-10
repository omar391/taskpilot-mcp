/**
 * Tasks API Routes
 * GET /api/workspaces/{id}/tasks - Get tasks for workspace
 * POST /api/workspaces/{id}/tasks - Create new task
 * PUT /api/workspaces/{id}/tasks/{taskId} - Update task
 */

import { Request, Response } from 'express';
import { DatabaseService } from '../services/database-service.js';
import { TasksResponse, Task, CreateTaskRequest, UpdateTaskRequest, TasksQueryParams } from './types.js';
import { createSuccessResponse, createErrorResponse, NotFoundError, ValidationError } from './middleware.js';
import { WorkspacesController } from './workspaces.js';
import { v4 as uuidv4 } from 'uuid';

export class TasksController {
  constructor(
    private databaseService: DatabaseService,
    private workspacesController: WorkspacesController
  ) {}

  /**
   * GET /api/workspaces/{workspaceId}/tasks
   * Get all tasks for a workspace with optional filtering
   */
  async getTasks(req: Request, res: Response): Promise<void> {
    try {
      const { workspaceId } = req.params;
      const query: TasksQueryParams = req.query;

      // Verify workspace exists
      const workspace = await this.workspacesController.getWorkspaceById(workspaceId);

      // Build SQL query based on filters
      const limit = query.limit ? Math.min(query.limit, 100) : 50; // Max 100, default 50
      const offset = query.offset || 0;
      const workspaceDb = await this.databaseService.getWorkspace(workspace.path);
      const tasks = await workspaceDb.getTasksPaginated(query.status, limit, offset);
      const total = await workspaceDb.countTasks(query.status);
      const transformedTasks: Task[] = tasks.map((task: any) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        progress: task.progress,
        parent_task_id: task.parent_task_id,
        blocked_by_task_id: task.blocked_by_task_id,
        connected_files: task.connected_files ? JSON.parse(task.connected_files) : [],
        notes: task.notes,
        github_issue_number: task.github_issue_number,
        github_url: task.github_url,
        created_at: task.created_at,
        updated_at: task.updated_at,
        completed_at: task.completed_at
      }));

      // Transform tasks (parse connected_files JSON)

      const response: TasksResponse = {
        tasks: transformedTasks,
        workspace: {
          id: workspace.id,
          name: workspace.name,
          path: workspace.path
        },
        total,
        page: Math.floor(offset / limit) + 1
      };


      // Only one response object needed, already declared above.
      res.json(createSuccessResponse(response));
    } catch (error) {
      console.error('Error fetching tasks:', error);
      throw error;
    }
  }

  /**
   * POST /api/workspaces/{workspaceId}/tasks
   * Create a new task in the workspace
   */
  async createTask(req: Request, res: Response): Promise<void> {
    try {
      const { workspaceId } = req.params;
      const taskData: CreateTaskRequest = req.body;

      // Validate required fields
      if (!taskData.title?.trim()) {
        throw new ValidationError('Task title is required');
      }
      if (!taskData.description?.trim()) {
        throw new ValidationError('Task description is required');
      }
      if (!['High', 'Medium', 'Low'].includes(taskData.priority)) {
        throw new ValidationError('Priority must be High, Medium, or Low');
      }

      // Verify workspace exists
      const workspace = await this.workspacesController.getWorkspaceById(workspaceId);

      // Generate task ID and timestamp
      const taskId = `TP-${Date.now().toString().slice(-6)}`;
      const now = new Date().toISOString();

      // Verify parent task exists if specified
      if (taskData.parent_task_id) {
        const workspaceDb = await this.databaseService.getWorkspace(workspace.path);
        const parentTask = await workspaceDb.getTask(taskData.parent_task_id);

        if (!parentTask) {
          throw new ValidationError(`Parent task not found: ${taskData.parent_task_id}`);
        }
      }

      // Insert new task
      const workspaceDb = await this.databaseService.getWorkspace(workspace.path);
      // Prepare DB object in snake_case
      const dbTask = {
        id: taskId,
        title: taskData.title.trim(),
        description: taskData.description.trim(),
        priority: (taskData.priority ? taskData.priority.toLowerCase() : undefined) as 'high' | 'medium' | 'low' | null | undefined,
        status: 'backlog' as 'backlog',
        progress: 0,
        parent_task_id: taskData.parent_task_id || null,
        connected_files: '[]',
        created_at: now,
        updated_at: now,
        notes: null,
        github_issue_number: null,
        github_url: null,
        blocked_by_task_id: null,
        completed_at: null,
      };

      const createdTask = await workspaceDb.createTask(dbTask as any);

      if (!createdTask) {
        throw new Error('Failed to create task');
      }

      // Map DB result to camelCase for API response
      function mapTaskDbToApi(task: any): Task {
        return {
          id: task.id,
          title: task.title,
          description: task.description ?? '',
          priority: task.priority ?? 'medium',
          status: task.status ?? 'backlog',
          progress: task.progress ?? 0,
          parent_task_id: task.parent_task_id ?? null,
          blocked_by_task_id: task.blocked_by_task_id ?? null,
          connected_files: task.connected_files ? JSON.parse(task.connected_files) : [],
          notes: task.notes ?? null,
          github_issue_number: task.github_issue_number ?? null,
          github_url: task.github_url ?? null,
          created_at: task.created_at ?? null,
          updated_at: task.updated_at ?? null,
          completed_at: task.completed_at ?? null,
        };
      }
      const responseTask: Task = mapTaskDbToApi(createdTask);

      res.status(201).json(createSuccessResponse({ task: responseTask }));
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  }

  /**
   * PUT /api/workspaces/{workspaceId}/tasks/{taskId}
   * Update a task property
   */
  async updateTask(req: Request, res: Response): Promise<void> {
    try {
      const { workspaceId, taskId } = req.params;
      const updateData: UpdateTaskRequest = req.body;

      // Validate required fields
      if (!updateData.field) {
        throw new ValidationError('Field to update is required');
      }
      if (updateData.value === undefined || updateData.value === null) {
        throw new ValidationError('Value is required');
      }
      if (!updateData.reason?.trim()) {
        throw new ValidationError('Reason for update is required');
      }

      // Verify workspace exists
      const workspace = await this.workspacesController.getWorkspaceById(workspaceId);

      // Verify task exists
      const workspaceDb = await this.databaseService.getWorkspace(workspace.path);
      const existingTask = await workspaceDb.getTask(taskId);

      if (!existingTask) {
        throw new NotFoundError(`Task not found: ${taskId}`);
      }

      // Validate field and value
      const allowedFields = ['title', 'description', 'priority', 'status', 'progress', 'notes'];
      if (!allowedFields.includes(updateData.field)) {
        throw new ValidationError(`Invalid field: ${updateData.field}`);
      }

      // Validate specific field values
      if (updateData.field === 'priority' && !['High', 'Medium', 'Low'].includes(updateData.value as string)) {
        throw new ValidationError('Priority must be High, Medium, or Low');
      }

      if (updateData.field === 'status' && !['Backlog', 'In-Progress', 'Blocked', 'Review', 'Done', 'Dropped'].includes(updateData.value as string)) {
        throw new ValidationError('Invalid status value');
      }

      if (updateData.field === 'progress') {
        const progress = Number(updateData.value);
        if (isNaN(progress) || progress < 0 || progress > 100) {
          throw new ValidationError('Progress must be a number between 0 and 100');
        }
      }

      // Update task
      const now = new Date().toISOString();
      // Reuse workspaceDb, do not redeclare
      let updates: any = { [updateData.field]: updateData.value, updated_at: now };
      if (updateData.field === 'status' && updateData.value === 'Done') {
        updates.completed_at = now;
      }

      await workspaceDb.updateTask(taskId, updates);

      // Fetch updated task
      const updatedTask = await workspaceDb.getTask(taskId);

      if (!updatedTask) {
        throw new Error('Failed to update task');
      }

      res.json(createSuccessResponse({
        task: {
          id: updatedTask.id,
          updatedAt: updatedTask.updatedAt,
          [updateData.field]: updatedTask[updateData.field]
        }
      }));
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  }
}
