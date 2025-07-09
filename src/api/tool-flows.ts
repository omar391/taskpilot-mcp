/**
 * Tool Flows API Routes
 * GET /api/workspaces/{id}/tool-flows - Get tool flows for workspace
 */

import { Request, Response } from 'express';
import { DatabaseService } from '../services/database-service.js';
import { ToolFlowsResponse, ToolFlow, ToolFlowsQueryParams } from './types.js';
import { createSuccessResponse, createErrorResponse } from './middleware.js';
import { WorkspacesController } from './workspaces.js';

export class ToolFlowsController {
  constructor(
    private databaseService: DatabaseService,
    private workspacesController: WorkspacesController
  ) {}

  /**
   * GET /api/workspaces/{workspaceId}/tool-flows
   * Get tool flows (global and workspace-specific) for a workspace
   */
  async getToolFlows(req: Request, res: Response): Promise<void> {
    try {
      const { workspaceId } = req.params;
      const query: ToolFlowsQueryParams = req.query;

      // Verify workspace exists
      const workspace = await this.workspacesController.getWorkspaceById(workspaceId);

      let globalFlows: ToolFlow[] = [];
      let workspaceFlows: ToolFlow[] = [];

      // Get global tool flows if requested
      if (query.type === 'global' || query.type === 'all' || !query.type) {
        try {
          const globalDb = this.databaseService.getGlobal();
          
          // Get all tool flows from the global database
          const globalToolFlows = await globalDb.getAllToolFlows?.() || [];
          
          // Format the response to match the expected structure
          globalFlows = await Promise.all(globalToolFlows.map(async (flow: any) => {
            const toolFlow: ToolFlow = {
              id: flow.id,
              tool_name: flow.toolName || flow.tool_name || '',
              description: flow.description || null,
              feedback_step_id: flow.feedbackStepId || flow.feedback_step_id || null,
              next_tool: flow.nextTool || flow.next_tool || null,
              is_global: flow.isGlobal || flow.is_global || true,
              workspace_id: flow.workspaceId || flow.workspace_id || null,
              created_at: flow.createdAt || flow.created_at || new Date().toISOString(),
              updated_at: flow.updatedAt || flow.updated_at || new Date().toISOString(),
              steps: []
            };
            
            // If we need to include steps, fetch them separately
            if (query.include === 'steps' && globalDb.getToolFlowSteps) {
              try {
                const steps = await globalDb.getToolFlowSteps(flow.id);
                toolFlow.steps = steps.map((step: any) => ({
                  id: step.id,
                  step_order: step.stepOrder || step.step_order || 0,
                  system_tool_fn: step.systemToolFn || step.system_tool_fn || '',
                  feedback_step: step.feedbackStep || step.feedback_step || null,
                  next_tool: step.nextTool || step.next_tool || null,
                  created_at: step.createdAt || step.created_at || new Date().toISOString(),
                  updated_at: step.updatedAt || step.updated_at || new Date().toISOString()
                }));
              } catch (error) {
                console.error(`Error fetching steps for tool flow ${flow.id}:`, error);
                toolFlow.steps = [];
              }
            }
            
            return toolFlow;
          }));
        } catch (error) {
          console.error('Error fetching global tool flows:', error);
          globalFlows = [];
        }
      }

      // Get workspace-specific tool flows if requested
      if (query.type === 'workspace' || query.type === 'all' || !query.type) {
        try {
          const workspaceDb = await this.databaseService.getWorkspace(workspace.path);
          
          // Get all tool flows from the workspace database
          const workspaceToolFlows = await (workspaceDb as any).getAllToolFlows?.() || [];
          
          // Filter for flows that belong to this workspace
          const workspaceSpecificFlows = workspaceToolFlows.filter(
            (flow: any) => (flow.workspaceId || flow.workspace_id) === workspaceId
          );
          
          // Format the response to match the expected structure
          workspaceFlows = await Promise.all(workspaceSpecificFlows.map(async (flow: any) => {
            const toolFlow: ToolFlow = {
              id: flow.id,
              tool_name: flow.toolName || flow.tool_name || '',
              description: flow.description || null,
              feedback_step_id: flow.feedbackStepId || flow.feedback_step_id || null,
              next_tool: flow.nextTool || flow.next_tool || null,
              is_global: flow.isGlobal || flow.is_global || false,
              workspace_id: flow.workspaceId || flow.workspace_id || workspaceId,
              created_at: flow.createdAt || flow.created_at || new Date().toISOString(),
              updated_at: flow.updatedAt || flow.updated_at || new Date().toISOString(),
              steps: []
            };
            
            // If we need to include steps, fetch them separately
            if (query.include === 'steps' && (workspaceDb as any).getToolFlowSteps) {
              try {
                const steps = await (workspaceDb as any).getToolFlowSteps(flow.id);
                toolFlow.steps = steps.map((step: any) => ({
                  id: step.id,
                  step_order: step.stepOrder || step.step_order || 0,
                  system_tool_fn: step.systemToolFn || step.system_tool_fn || '',
                  feedback_step: step.feedbackStep || step.feedback_step || null,
                  next_tool: step.nextTool || step.next_tool || null,
                  created_at: step.createdAt || step.created_at || new Date().toISOString(),
                  updated_at: step.updatedAt || step.updated_at || new Date().toISOString()
                }));
              } catch (error) {
                console.error(`Error fetching steps for workspace tool flow ${flow.id}:`, error);
                toolFlow.steps = [];
              }
            }
            
            return toolFlow;
          }));
        } catch (error) {
          console.error(`Error fetching workspace tool flows for ${workspace.path}:`, error);
          workspaceFlows = [];
        }
      }

      // Get available tools from global flows
      const availableTools = Array.from(new Set([
        ...globalFlows.map(flow => flow.tool_name),
        ...workspaceFlows.map(flow => flow.tool_name)
      ])).sort();

      const response: ToolFlowsResponse = {
        global_flows: globalFlows,
        workspace_flows: workspaceFlows,
        available_tools: availableTools,
        workspace: {
          id: workspace.id,
          name: workspace.name,
          path: workspace.path
        }
      };

      res.json(createSuccessResponse(response));
    } catch (error) {
      console.error('Error fetching tool flows:', error);
      throw error;
    }
  }
}
