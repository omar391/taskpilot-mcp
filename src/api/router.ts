/**
 * Main API Router
 * Combines all API controllers and sets up routes
 */

import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/database-service.js';
import { WorkspacesController } from './workspaces.js';
import { TasksController } from './tasks.js';
import { ToolFlowsController } from './tool-flows.js';
import { FeedbackStepsController } from './feedback-steps.js';
import { 
  errorHandler, 
  notFoundHandler, 
  requestLogger, 
  corsHandler, 
  rateLimit,
  validateWorkspaceId,
  validateTaskId
} from './middleware.js';

/**
 * Create API router with all endpoints
 */
export function createApiRouter(databaseService: DatabaseService): Router {
  const router = Router();

  // Initialize controllers
  const workspacesController = new WorkspacesController(databaseService);
  const tasksController = new TasksController(databaseService, workspacesController);
  const toolFlowsController = new ToolFlowsController(databaseService, workspacesController);
  const feedbackStepsController = new FeedbackStepsController(databaseService, workspacesController);

  // Apply middleware
  router.use(corsHandler);
  router.use(requestLogger);

  // Rate limiting - different limits for read vs write operations
  const readRateLimit = rateLimit(100, 60 * 1000); // 100 requests per minute
  const writeRateLimit = rateLimit(30, 60 * 1000); // 30 requests per minute

  // API Routes (register specific routes first)

  // 1. GET /api/workspaces - List all workspaces
  router.get('/workspaces', readRateLimit, async (req, res, next) => {
    try {
      await workspacesController.getWorkspaces(req, res);
    } catch (error) {
      next(error);
    }
  });

  // 2. GET /api/workspaces/{id}/tasks - Get tasks for workspace
  router.get('/workspaces/:workspaceId/tasks', readRateLimit, validateWorkspaceId, async (req, res, next) => {
    try {
      await tasksController.getTasks(req, res);
    } catch (error) {
      next(error);
    }
// Get feedback steps for all global tool flows
router.get(
  '/workspaces/:workspaceId/tool-flows/global-feedback-steps',
  readRateLimit,
  validateWorkspaceId,
  async (req, res, next) => {
    try {
      await toolFlowsController.getGlobalToolFlowFeedbackSteps(req, res);
    } catch (error) {
      next(error);
    }
  }
);
// Delete a global tool flow
router.delete(
  '/workspaces/:workspaceId/tool-flows/:flowId',
  writeRateLimit,
  validateWorkspaceId,
  async (req, res, next) => {
    try {
      await toolFlowsController.deleteToolFlow(req, res);
    } catch (error) {
      next(error);
    }
  }
);
// Clone a global tool flow to a workspace
router.post(
  '/workspaces/:workspaceId/tool-flows/:flowId/clone',
  writeRateLimit,
  validateWorkspaceId,
  async (req, res, next) => {
    try {
      await toolFlowsController.cloneToolFlow(req, res);
    } catch (error) {
      next(error);
    }
  }
);
  });

  // 3. GET /api/workspaces/{id}/tool-flows - Get tool flows for workspace
  router.get('/workspaces/:workspaceId/tool-flows', readRateLimit, validateWorkspaceId, async (req, res, next) => {
    try {
      await toolFlowsController.getToolFlows(req, res);
    } catch (error) {
      next(error);
    }
  });

  // 4. GET /api/workspaces/{id}/feedback-steps - Get feedback steps for workspace
  router.get('/workspaces/:workspaceId/feedback-steps', readRateLimit, validateWorkspaceId, async (req, res, next) => {
    try {
      await feedbackStepsController.getFeedbackSteps(req, res);
    } catch (error) {
      next(error);
    }
  });

  // 5. POST /api/workspaces/{id}/tasks - Create new task
  router.post('/workspaces/:workspaceId/tasks', writeRateLimit, validateWorkspaceId, async (req, res, next) => {
    try {
      await tasksController.createTask(req, res);
    } catch (error) {
      next(error);
    }
  });

  // 6. PUT /api/workspaces/{id}/tasks/{taskId} - Update task
  router.put('/workspaces/:workspaceId/tasks/:taskId', writeRateLimit, validateWorkspaceId, validateTaskId, async (req, res, next) => {
    try {
      await tasksController.updateTask(req, res);
    } catch (error) {
      next(error);
    }
  });

  // Error handling middleware
  router.use(notFoundHandler);
  router.use(errorHandler);

  return router;
}

/**
 * SSE Event Manager
 * Manages Server-Sent Events for real-time updates
 */
export class SSEEventManager {
  private clients: Map<string, Response> = new Map();

  /**
   * Add SSE client
   */
  addClient(clientId: string, req: Request, res: Response): void {
    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    this.clients.set(clientId, res);
    
    // Send initial connection event
    this.sendToClient(clientId, {
      type: 'connection.established',
      data: { clientId, timestamp: new Date().toISOString() }
    });

    // Clean up on connection close
    const cleanup = () => {
      this.clients.delete(clientId);
      console.log(`SSE client disconnected: ${clientId}`);
    };

    req.on('close', cleanup);
    req.on('aborted', cleanup);
  }

  /**
   * Send event to specific client
   */
  sendToClient(clientId: string, event: any): void {
    const client = this.clients.get(clientId);
    if (client && !client.headersSent) {
      try {
        client.write(`data: ${JSON.stringify(event)}\n\n`);
      } catch (error) {
        console.error(`Error sending SSE event to client ${clientId}:`, error);
        this.clients.delete(clientId);
      }
    }
  }

  /**
   * Broadcast event to all clients
   */
  broadcast(event: any): void {
    const clientsToRemove: string[] = [];
    
    for (const [clientId, client] of this.clients.entries()) {
      try {
        if (!client.headersSent) {
          client.write(`data: ${JSON.stringify(event)}\n\n`);
        } else {
          clientsToRemove.push(clientId);
        }
      } catch (error) {
        console.error(`Error broadcasting SSE event to client ${clientId}:`, error);
        clientsToRemove.push(clientId);
      }
    }
    
    // Clean up disconnected clients
    clientsToRemove.forEach(clientId => this.clients.delete(clientId));
  }

  /**
   * Send workspace status change event
   */
  sendWorkspaceStatusChanged(workspaceId: string, status: string, lastActivity: string): void {
    this.broadcast({
      type: 'workspace.status_changed',
      data: {
        workspace_id: workspaceId,
        status,
        last_activity: lastActivity
      }
    });
  }

  /**
   * Send task updated event
   */
  sendTaskUpdated(workspaceId: string, task: any): void {
    this.broadcast({
      type: 'task.updated',
      data: {
        workspace_id: workspaceId,
        task: {
          id: task.id,
          status: task.status,
          progress: task.progress,
          updated_at: task.updated_at
        }
      }
    });
  }

  /**
   * Send task created event
   */
  sendTaskCreated(workspaceId: string, task: any): void {
    this.broadcast({
      type: 'task.created',
      data: {
        workspace_id: workspaceId,
        task: {
          id: task.id,
          title: task.title,
          status: task.status,
          created_at: task.created_at
        }
      }
    });
  }

  /**
   * Get active client count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Close all connections
   */
  closeAll(): void {
    for (const client of this.clients.values()) {
      try {
        client.end();
      } catch (error) {
        console.error('Error closing SSE client:', error);
      }
    }
    this.clients.clear();
  }
}
