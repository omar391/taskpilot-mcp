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
        const globalFlowsData = await this.databaseService.globalAll(`
          SELECT tf.*, 
                 json_group_array(
                   json_object(
                     'id', tfs.id,
                     'step_order', tfs.step_order,
                     'system_tool_fn', tfs.system_tool_fn,
                     'feedback_step', tfs.feedback_step,
                     'next_tool', tfs.next_tool
                   )
                 ) as flow_steps
          FROM tool_flows tf
          LEFT JOIN tool_flow_steps tfs ON tf.id = tfs.tool_flow_id
          WHERE tf.workspace_id IS NULL
          GROUP BY tf.id
          ORDER BY tf.tool_name
        `);

        globalFlows = globalFlowsData.map((flow: any) => ({
          id: flow.id,
          tool_name: flow.tool_name,
          steps: flow.flow_steps ? JSON.parse(flow.flow_steps).filter((step: any) => step.id !== null) : [],
          created_at: flow.created_at,
          updated_at: flow.updated_at
        }));
      }

      // Get workspace-specific tool flows if requested
      if (query.type === 'workspace' || query.type === 'all' || !query.type) {
        try {
          const workspaceFlowsData = await this.databaseService.workspaceAll(workspace.path, `
            SELECT tf.*, 
                   json_group_array(
                     json_object(
                       'id', tfs.id,
                       'step_order', tfs.step_order,
                       'system_tool_fn', tfs.system_tool_fn,
                       'feedback_step', tfs.feedback_step,
                       'next_tool', tfs.next_tool
                     )
                   ) as flow_steps
            FROM tool_flows tf
            LEFT JOIN tool_flow_steps tfs ON tf.id = tfs.tool_flow_id
            WHERE tf.workspace_id = ?
            GROUP BY tf.id
            ORDER BY tf.tool_name
          `, [workspaceId]);

          workspaceFlows = workspaceFlowsData.map((flow: any) => ({
            id: flow.id,
            tool_name: flow.tool_name,
            workspace_id: flow.workspace_id,
            steps: flow.flow_steps ? JSON.parse(flow.flow_steps).filter((step: any) => step.id !== null) : [],
            created_at: flow.created_at,
            updated_at: flow.updated_at
          }));
        } catch (error) {
          // If workspace doesn't have tool_flows table yet, return empty array
          console.warn(`No tool flows table in workspace ${workspace.path}:`, error);
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
