import { v4 as uuidv4 } from 'uuid';
import type { GlobalSeedData, FeedbackStep, ToolFlow } from '../types/index.js';
import type { DatabaseManager } from '../database/connection.js';
import { 
  GLOBAL_TOOL_FLOWS_SEED, 
  GLOBAL_FEEDBACK_STEPS_SEED, 
  MCP_SERVER_MAPPINGS_SEED 
} from '../data/embedded-seed-data.js';

export class SeedManager {
  private globalSeedData: GlobalSeedData | null = null;

  constructor(private db: DatabaseManager) {}

  /**
   * Load global tool flows from embedded data
   */
  private loadGlobalToolFlows(): any {
    return GLOBAL_TOOL_FLOWS_SEED;
  }

  /**
   * Load global feedback steps from embedded data
   */
  private loadGlobalFeedbackSteps(): any {
    return GLOBAL_FEEDBACK_STEPS_SEED;
  }

  /**
   * Load MCP server mappings from embedded data
   */
  private loadMCPServerMappings(): any {
    return MCP_SERVER_MAPPINGS_SEED;
  }

  /**
   * Initialize global tool flows and feedback steps in database
   */
  async initializeGlobalData(): Promise<void> {
    const toolFlowsData = this.loadGlobalToolFlows();
    const feedbackStepsData = this.loadGlobalFeedbackSteps();
    const mcpMappingsData = this.loadMCPServerMappings();

    try {
      await this.db.transaction([
        // Clear existing global data
        { sql: 'DELETE FROM tool_flows WHERE workspace_id IS NULL' },
        { sql: 'DELETE FROM feedback_steps WHERE workspace_id IS NULL' },
        { sql: 'DELETE FROM mcp_server_mappings' },
        
        // Insert global feedback steps (now direct array)
        ...feedbackStepsData.map((step: any) => ({
          sql: `INSERT INTO feedback_steps (id, name, instructions, workspace_id, metadata, created_at, updated_at)
                VALUES (?, ?, ?, NULL, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          params: [
            step.id,
            step.name,
            step.templateContent,
            JSON.stringify({})
          ]
        })),

        // Insert global tool flows (now direct array - individual tool flows)
        ...toolFlowsData.map((flow: any) => ({
          sql: `INSERT INTO tool_flows (id, tool_name, workspace_id, created_at, updated_at)
                VALUES (?, ?, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          params: [flow.id, flow.toolName]
        })),

        // Insert tool flow steps (create individual steps for each tool flow)
        ...toolFlowsData.map((flow: any) => ({
          sql: `INSERT INTO tool_flow_steps (id, tool_flow_id, step_order, system_tool_fn, feedback_step, next_tool)
                VALUES (?, ?, ?, ?, ?, ?)`,
          params: [
            `${flow.id}_step_1`,
            flow.id,
            1,
            flow.toolName,
            flow.feedbackStepId || null,
            flow.nextTool || null
          ]
        })),

        // Insert MCP server mappings (now direct array)
        ...mcpMappingsData.map((mapping: any) => ({
          sql: `INSERT INTO mcp_server_mappings 
                (id, interface_type, mcp_server_name, description, is_default, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          params: [
            mapping.id,
            mapping.interfaceType,
            mapping.mcpServerName,
            mapping.description || '',
            mapping.isDefault
          ]
        }))
      ]);

      console.log('Global seed data initialized successfully');
    } catch (error) {
      console.error('Error initializing global seed data:', error);
      throw error;
    }
  }

  /**
   * Get global tool flow by name
   */
  async getGlobalToolFlow(toolName: string): Promise<ToolFlow | null> {
    try {
      const flow = await this.db.get<any>(
        'SELECT * FROM tool_flows WHERE tool_name = ? AND workspace_id IS NULL',
        [toolName]
      );

      if (!flow) {
        return null;
      }

      const steps = await this.db.all<any>(
        'SELECT * FROM tool_flow_steps WHERE tool_flow_id = ? ORDER BY step_order',
        [flow.id]
      );

      return {
        id: flow.id,
        tool_name: flow.tool_name,
        workspace_id: undefined,
        flow_steps: steps,
        created_at: flow.created_at,
        updated_at: flow.updated_at
      };
    } catch (error) {
      console.error('Error getting global tool flow:', error);
      throw error;
    }
  }

  /**
   * Get workspace tool flow by name, fallback to global if not found
   */
  async getToolFlow(toolName: string, workspaceId: string): Promise<ToolFlow | null> {
    try {
      // First check for workspace-specific flow
      let flow = await this.db.get<any>(
        'SELECT * FROM tool_flows WHERE tool_name = ? AND workspace_id = ?',
        [toolName, workspaceId]
      );

      // Fallback to global flow if workspace flow doesn't exist
      if (!flow) {
        flow = await this.db.get<any>(
          'SELECT * FROM tool_flows WHERE tool_name = ? AND workspace_id IS NULL',
          [toolName]
        );
      }

      if (!flow) {
        return null;
      }

      const steps = await this.db.all<any>(
        'SELECT * FROM tool_flow_steps WHERE tool_flow_id = ? ORDER BY step_order',
        [flow.id]
      );

      return {
        id: flow.id,
        tool_name: flow.tool_name,
        workspace_id: flow.workspace_id || undefined,
        flow_steps: steps,
        created_at: flow.created_at,
        updated_at: flow.updated_at
      };
    } catch (error) {
      console.error('Error getting tool flow:', error);
      throw error;
    }
  }

  /**
   * Get global feedback step by name
   */
  async getGlobalFeedbackStep(name: string): Promise<FeedbackStep | null> {
    try {
      const step = await this.db.get<any>(
        'SELECT * FROM feedback_steps WHERE name = ? AND workspace_id IS NULL',
        [name]
      );

      if (!step) {
        return null;
      }

      return {
        id: step.id,
        name: step.name,
        instructions: step.template_content,
        workspace_id: undefined,
        metadata: JSON.parse(step.metadata || '{}'),
        created_at: step.created_at,
        updated_at: step.updated_at
      };
    } catch (error) {
      console.error('Error getting global feedback step:', error);
      throw error;
    }
  }

  /**
   * Get workspace feedback step by name, fallback to global if not found
   */
  async getFeedbackStep(name: string, workspaceId: string): Promise<FeedbackStep | null> {
    try {
      // First check for workspace-specific step
      let step = await this.db.get<any>(
        'SELECT * FROM feedback_steps WHERE name = ? AND workspace_id = ?',
        [name, workspaceId]
      );

      // Fallback to global step if workspace step doesn't exist
      if (!step) {
        step = await this.db.get<any>(
          'SELECT * FROM feedback_steps WHERE name = ? AND workspace_id IS NULL',
          [name]
        );
      }

      if (!step) {
        return null;
      }

      return {
        id: step.id,
        name: step.name,
        instructions: step.template_content,
        workspace_id: step.workspace_id || undefined,
        metadata: JSON.parse(step.metadata || '{}'),
        created_at: step.created_at,
        updated_at: step.updated_at
      };
    } catch (error) {
      console.error('Error getting feedback step:', error);
      throw error;
    }
  }

  /**
   * Clone global tool flow to workspace for customization
   */
  async cloneGlobalToolFlowToWorkspace(toolName: string, workspaceId: string): Promise<ToolFlow | null> {
    try {
      const globalFlow = await this.getGlobalToolFlow(toolName);
      if (!globalFlow) {
        throw new Error(`Global tool flow '${toolName}' not found`);
      }

      const newFlowId = uuidv4();

      await this.db.transaction([
        // Insert workspace tool flow
        {
          sql: `INSERT INTO tool_flows (id, tool_name, workspace_id, created_at, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          params: [newFlowId, toolName, workspaceId]
        },
        // Insert flow steps
        ...globalFlow.flow_steps.map(step => ({
          sql: `INSERT INTO tool_flow_steps (id, tool_flow_id, step_order, system_tool_fn, feedback_step, next_tool)
                VALUES (?, ?, ?, ?, ?, ?)`,
          params: [
            uuidv4(),
            newFlowId,
            step.step_order,
            step.system_tool_fn,
            step.feedback_step || null,
            step.next_tool || null
          ]
        }))
      ]);

      return await this.getToolFlow(toolName, workspaceId);
    } catch (error) {
      console.error('Error cloning global tool flow to workspace:', error);
      throw error;
    }
  }

  /**
   * Clone global feedback step to workspace for customization
   */
  async cloneGlobalFeedbackStepToWorkspace(name: string, workspaceId: string): Promise<FeedbackStep | null> {
    try {
      const globalStep = await this.getGlobalFeedbackStep(name);
      if (!globalStep) {
        throw new Error(`Global feedback step '${name}' not found`);
      }

      await this.db.run(
        `INSERT INTO feedback_steps (id, name, instructions, workspace_id, metadata, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          uuidv4(),
          name,
          globalStep.instructions,
          workspaceId,
          JSON.stringify(globalStep.metadata)
        ]
      );

      return await this.getFeedbackStep(name, workspaceId);
    } catch (error) {
      console.error('Error cloning global feedback step to workspace:', error);
      throw error;
    }
  }
}