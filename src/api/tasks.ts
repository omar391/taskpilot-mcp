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
      let sql = `
        SELECT 
          id,
          title,
          description,
          priority,
          status,
          progress,
          parent_task_id,
          blocked_by_task_id,
          connected_files,
          notes,
          github_issue_number,
          github_url,
          created_at,
          updated_at,
          completed_at
        FROM tasks
      `;

      const params: any[] = [];

      // Add status filter
      if (query.status === 'current') {
        sql += ` WHERE status NOT IN ('Done', 'Dropped')`;
      } else if (query.status === 'history') {
        sql += ` WHERE status IN ('Done', 'Dropped')`;
      }

      // Add ordering
      sql += ` ORDER BY 
        CASE status 
          WHEN 'In-Progress' THEN 1
          WHEN 'Blocked' THEN 2
          WHEN 'Review' THEN 3
          WHEN 'Backlog' THEN 4
          WHEN 'Done' THEN 5
          WHEN 'Dropped' THEN 6
        END,
        CASE priority 
          WHEN 'High' THEN 1 
          WHEN 'Medium' THEN 2 
          WHEN 'Low' THEN 3 
        END,
        updated_at DESC
      `;

      // Add pagination
      const limit = query.limit ? Math.min(query.limit, 100) : 50; // Max 100, default 50
      const offset = query.offset || 0;
      sql += ` LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      // Execute query
      const tasks = await this.databaseService.workspaceAll<any>(workspace.path, sql, params);

      // Get total count for pagination
      let countSql = 'SELECT COUNT(*) as total FROM tasks';
      if (query.status === 'current') {
        countSql += ` WHERE status NOT IN ('Done', 'Dropped')`;
      } else if (query.status === 'history') {
        countSql += ` WHERE status IN ('Done', 'Dropped')`;
      }
      
      const countResult = await this.databaseService.workspaceGet<{ total: number }>(
        workspace.path, 
        countSql
      );
      const total = countResult?.total || 0;

      // Transform tasks (parse connected_files JSON)
      const transformedTasks: Task[] = tasks.map(task => ({
        ...task,
        connected_files: task.connected_files ? JSON.parse(task.connected_files) : []
      }));

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
        const parentTask = await this.databaseService.workspaceGet(
          workspace.path,
          'SELECT id FROM tasks WHERE id = ?',
          [taskData.parent_task_id]
        );
        
        if (!parentTask) {
          throw new ValidationError(`Parent task not found: ${taskData.parent_task_id}`);
        }
      }

      // Insert new task
      const insertSql = `
        INSERT INTO tasks (
          id, title, description, priority, status, progress,
          parent_task_id, connected_files, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await this.databaseService.workspaceRun(workspace.path, insertSql, [
        taskId,
        taskData.title.trim(),
        taskData.description.trim(),
        taskData.priority,
        'Backlog',
        0,
        taskData.parent_task_id || null,
        '[]', // Empty connected files array
        now,
        now
      ]);

      // Fetch the created task
      const createdTask = await this.databaseService.workspaceGet(
        workspace.path,
        'SELECT * FROM tasks WHERE id = ?',
        [taskId]
      );

      if (!createdTask) {
        throw new Error('Failed to create task');
      }

      // Transform connected_files
      const responseTask: Task = {
        ...createdTask,
        connected_files: JSON.parse(createdTask.connected_files || '[]')
      };

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
      const existingTask = await this.databaseService.workspaceGet(
        workspace.path,
        'SELECT * FROM tasks WHERE id = ?',
        [taskId]
      );

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
      let updateSql = `UPDATE tasks SET ${updateData.field} = ?, updated_at = ?`;
      const params = [updateData.value, now];

      // Add completed_at for Done status
      if (updateData.field === 'status' && updateData.value === 'Done') {
        updateSql += ', completed_at = ?';
        params.push(now);
      }

      updateSql += ' WHERE id = ?';
      params.push(taskId);

      await this.databaseService.workspaceRun(workspace.path, updateSql, params);

      // Fetch updated task
      const updatedTask = await this.databaseService.workspaceGet(
        workspace.path,
        'SELECT * FROM tasks WHERE id = ?',
        [taskId]
      );

      if (!updatedTask) {
        throw new Error('Failed to update task');
      }

      res.json(createSuccessResponse({
        task: {
          id: updatedTask.id,
          updated_at: updatedTask.updated_at,
          [updateData.field]: updatedTask[updateData.field]
        }
      }));
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  }
}
