/**
 * Feedback Steps API Routes
 * GET /api/workspaces/{id}/feedback-steps - Get feedback steps for workspace
 */

import { Request, Response } from 'express';
import { DatabaseService } from '../services/database-service.js';
import { FeedbackStepsResponse, FeedbackStep, WorkspaceRule, FeedbackStepsQueryParams } from './types.js';
import { createSuccessResponse, createErrorResponse } from './middleware.js';
import { WorkspacesController } from './workspaces.js';

export class FeedbackStepsController {
  constructor(
    private databaseService: DatabaseService,
    private workspacesController: WorkspacesController
  ) {}

  /**
   * GET /api/workspaces/{workspaceId}/feedback-steps
   * Get feedback steps and workspace rules for a workspace
   */
  async getFeedbackSteps(req: Request, res: Response): Promise<void> {
    try {
      const { workspaceId } = req.params;
      const query: FeedbackStepsQueryParams = req.query;

      // Verify workspace exists
      const workspace = await this.workspacesController.getWorkspaceById(workspaceId);

      let globalSteps: FeedbackStep[] = [];
      let workspaceSteps: FeedbackStep[] = [];
      let workspaceRules: WorkspaceRule[] = [];

      // Get global feedback steps if requested
      if (query.type === 'global' || query.type === 'all' || !query.type) {
        const globalStepsData = await this.databaseService.globalAll(`
          SELECT 
            id,
            name,
            instructions,
            metadata,
            created_at,
            updated_at
          FROM feedback_steps 
          WHERE workspace_id IS NULL 
          ORDER BY name
        `);

        globalSteps = globalStepsData.map((step: any) => ({
          id: step.id,
          name: step.name,
          instructions: step.instructions,
          metadata: step.metadata ? JSON.parse(step.metadata) : {},
          created_at: step.created_at,
          updated_at: step.updated_at
        }));
      }

      // Get workspace-specific feedback steps if requested
      if (query.type === 'workspace' || query.type === 'all' || !query.type) {
        try {
          const workspaceStepsData = await this.databaseService.workspaceAll(workspace.path, `
            SELECT 
              id,
              name,
              instructions,
              metadata,
              created_at,
              updated_at
            FROM feedback_steps 
            WHERE workspace_id = ?
            ORDER BY name
          `, [workspaceId]);

          workspaceSteps = workspaceStepsData.map((step: any) => ({
            id: step.id,
            name: step.name,
            instructions: step.instructions,
            metadata: step.metadata ? JSON.parse(step.metadata) : {},
            created_at: step.created_at,
            updated_at: step.updated_at
          }));
        } catch (error) {
          // If workspace doesn't have feedback_steps table yet, return empty array
          console.warn(`No feedback steps table in workspace ${workspace.path}:`, error);
          workspaceSteps = [];
        }

        // Get workspace rules
        try {
          const workspaceRulesData = await this.databaseService.workspaceAll(workspace.path, `
            SELECT 
              id,
              category,
              type,
              content,
              confidence,
              created_at
            FROM workspace_rules 
            ORDER BY created_at DESC
          `);

          workspaceRules = workspaceRulesData.map((rule: any) => ({
            id: rule.id,
            category: rule.category,
            type: rule.type,
            content: rule.content,
            confidence: rule.confidence,
            created_at: rule.created_at
          }));
        } catch (error) {
          // If workspace doesn't have workspace_rules table yet, return empty array
          console.warn(`No workspace rules table in workspace ${workspace.path}:`, error);
          workspaceRules = [];
        }
      }

      const response: FeedbackStepsResponse = {
        global_steps: globalSteps,
        workspace_steps: workspaceSteps,
        workspace_rules: workspaceRules,
        workspace: {
          id: workspace.id,
          name: workspace.name,
          path: workspace.path
        }
      };

      res.json(createSuccessResponse(response));
    } catch (error) {
      console.error('Error fetching feedback steps:', error);
      throw error;
    }
  }
}
