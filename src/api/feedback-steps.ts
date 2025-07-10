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
        const globalStepsRaw = await this.databaseService.getGlobal().getGlobalFeedbackSteps();
        globalSteps = globalStepsRaw.map((step: any) => ({
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
          const workspaceDb = await this.databaseService.getWorkspace(workspace.path);
          const workspaceStepsData = await workspaceDb.getAllWorkspaceFeedbackSteps();

          workspaceSteps = workspaceStepsData.map((step: any) => {
            let metadataObj = {};
            if (step.metadata) {
              try {
                metadataObj = JSON.parse(step.metadata);
              } catch (e) {
                metadataObj = {};
              }
            }
            return {
              id: step.id,
              name: step.name,
              instructions: step.instructions,
              metadata: metadataObj,
              created_at: step.created_at,
              updated_at: step.updated_at
            };
          });
        } catch (error) {
          // If workspace doesn't have feedback_steps table yet, return empty array
          console.warn(`No feedback steps table in workspace ${workspace.path}:`, error);
          workspaceSteps = [];
        }

        // Workspace rules table does not exist; set empty array
        workspaceRules = [];
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
