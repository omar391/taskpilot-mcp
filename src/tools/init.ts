import { z } from 'zod';
import type { TaskPilotToolResult, ToolStepResult, MultiStepToolInput } from '../types/index.js';
import { BaseTool, BaseToolConfig, ToolDefinition, createBaseToolSchema } from './base-tool.js';
import type { DrizzleDatabaseManager } from '../database/drizzle-connection.js';
import { WorkspaceDatabaseService } from '../database/workspace-queries.js';
import { ToolNames } from '../constants/tool-names.js';

// Input schema using the new base pattern
export const initToolSchema = createBaseToolSchema(ToolNames.INIT, {
    project_requirements: z.string().describe('Initial project requirements and description')
}, ['project_requirements', 'workspace_path']);

export type InitToolInput = z.infer<typeof initToolSchema>;

/**
 * TaskPilot Init Tool - Refactored using BaseTool interface
 * 
 * Enhanced with database-driven stepId enumeration and common error handling.
 */
export class InitToolNew extends BaseTool {
  constructor(drizzleDb: DrizzleDatabaseManager) {
    const config: BaseToolConfig = {
      name: ToolNames.INIT,
      description: 'Initialize TaskPilot workspace with folder structure and initial configuration. Supports multi-step workflow.',
      requiredFields: ['workspace_path'],
      additionalProperties: {
        project_requirements: {
          type: 'string',
          description: 'Initial project requirements or description'
        }
      }
    };

    super(drizzleDb, config);
  }

  /**
   * Execute taskpilot_init tool with multi-step support using base class validation
   */
  async execute(input: MultiStepToolInput): Promise<ToolStepResult | TaskPilotToolResult> {
    try {
      const { stepId, workspace_path } = input;
      const { project_requirements } = input as InitToolInput;

      // Note: For init, we don't validate workspace exists as we're creating it

      // Route to appropriate step handler
      switch (stepId) {
        case 'confirm':
          return await this.handleConfirmStep(input as InitToolInput);
        case 'setup_structure':
          return await this.handleSetupStructureStep(input as InitToolInput);
        case 'configure_project':
          return await this.handleConfigureProjectStep(input as InitToolInput);
        default:
          return await this.handleInitialStep(input as InitToolInput);
      }

    } catch (error) {
      const errorMessage = `Error in taskpilot_init: ${error instanceof Error ? error.message : String(error)}`;
      return this.createErrorResult(errorMessage, { input });
    }
  }

  /**
   * Initial step - validate workspace and show initialization plan
   */
  private async handleInitialStep(input: InitToolInput): Promise<TaskPilotToolResult> {
    const { workspace_path, project_requirements } = input;

    try {
      // Check if workspace already exists and is initialized
      try {
        const workspace = await this.globalDb.getWorkspaceByPath(workspace_path);
        if (workspace) {
          return this.createErrorResult(
            'Workspace is already initialized. Use other TaskPilot tools to manage tasks.',
            { workspace_path }
          );
        }
      } catch (error) {
        // Workspace doesn't exist, which is expected for initialization
      }

      // Generate initialization plan prompt
      const orchestrationResult = await this.orchestrator.orchestratePrompt(
        'taskpilot_init',
        'global', // Use global context since workspace doesn't exist yet
        {
          workspace_path,
          project_requirements: project_requirements || 'No specific requirements provided',
          step: 'initial'
        }
      );

      return this.createSuccessResult(
        orchestrationResult.prompt_text,
        {
          isFinalStep: false,
          nextStepId: 'confirm',
          feedback: 'Initialization plan generated. Use confirm step to proceed.',
          data: {
            workspace_path,
            project_requirements,
            initialization_plan: {
              structure_creation: true,
              database_setup: true,
              config_files: true,
              initial_tasks: project_requirements ? true : false
            }
          }
        }
      );

    } catch (error) {
      return this.createErrorResult(
        `Failed to plan workspace initialization: ${error instanceof Error ? error.message : String(error)}`,
        { workspace_path }
      );
    }
  }

  /**
   * Confirm step - confirm initialization parameters
   */
  private async handleConfirmStep(input: InitToolInput): Promise<TaskPilotToolResult> {
    const { workspace_path, project_requirements } = input;

    // Generate confirmation prompt
    const orchestrationResult = await this.orchestrator.orchestratePrompt(
      'taskpilot_init',
      'global',
      {
        workspace_path,
        project_requirements: project_requirements || 'No specific requirements provided',
        step: 'confirm'
      }
    );

    return this.createSuccessResult(
      orchestrationResult.prompt_text,
      {
        isFinalStep: false,
        nextStepId: 'setup_structure',
        feedback: 'Ready to initialize workspace. Use setup_structure step to proceed.',
        data: {
          workspace_path,
          project_requirements,
          confirmed: true
        }
      }
    );
  }

  /**
   * Setup structure step - create folder structure and database
   */
  private async handleSetupStructureStep(input: InitToolInput): Promise<TaskPilotToolResult> {
    const { workspace_path, project_requirements } = input;

    try {
      // Initialize workspace database
      const workspaceDb = new WorkspaceDatabaseService(workspace_path);
      await workspaceDb.initialize();

      // Register workspace
      const workspaceRecord = await this.globalDb.createWorkspace({
        id: workspace_path.split('/').pop() || 'workspace',
        name: workspace_path.split('/').pop() || 'TaskPilot Workspace',
        path: workspace_path,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Generate setup completion prompt
      const orchestrationResult = await this.orchestrator.orchestratePrompt(
        'taskpilot_init',
        workspaceRecord.id,
        {
          workspace_path,
          project_requirements: project_requirements || 'No specific requirements provided',
          workspace_id: workspaceRecord.id,
          step: 'setup_structure'
        }
      );

      return this.createSuccessResult(
        orchestrationResult.prompt_text,
        {
          isFinalStep: false,
          nextStepId: 'configure_project',
          feedback: 'Workspace structure created successfully. Use configure_project step to finalize setup.',
          data: {
            workspace_id: workspaceRecord.id,
            workspace_path,
            structure_created: true,
            database_initialized: true
          }
        }
      );

    } catch (error) {
      return this.createErrorResult(
        `Failed to setup workspace structure: ${error instanceof Error ? error.message : String(error)}`,
        { workspace_path }
      );
    }
  }

  /**
   * Configure project step - finalize configuration and create initial tasks
   */
  private async handleConfigureProjectStep(input: InitToolInput): Promise<TaskPilotToolResult> {
    const { workspace_path, project_requirements } = input;

    try {
      const workspaceDb = new WorkspaceDatabaseService(workspace_path);
      await workspaceDb.initialize();
      const workspace = await this.globalDb.getWorkspaceByPath(workspace_path);

      if (!workspace) {
        return this.createErrorResult(
          'Workspace not found. Please run setup_structure step first.',
          { workspace_path }
        );
      }

      // Create initial task if project requirements provided
      let initialTaskId = null;
      if (project_requirements && project_requirements.trim().length > 0) {
        const taskId = `TP-${String(Date.now()).slice(-6)}`;
        await workspaceDb.createTask({
          id: taskId,
          title: 'Project Setup and Requirements Analysis',
          description: project_requirements,
          priority: 'high',
          status: 'backlog',
          progress: 0,
          dependencies: [],
          notes: 'Initial task created during workspace initialization',
          connectedFiles: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        initialTaskId = taskId;
      }

      // Generate final configuration prompt
      const orchestrationResult = await this.orchestrator.orchestratePrompt(
        'taskpilot_init',
        workspace.id,
        {
          workspace_path,
          project_requirements: project_requirements || 'No specific requirements provided',
          workspace_id: workspace.id,
          initial_task_id: initialTaskId,
          step: 'configure_project'
        }
      );

      return this.createSuccessResult(
        orchestrationResult.prompt_text,
        {
          isFinalStep: true,
          feedback: 'Workspace initialization completed successfully.',
          data: {
            workspace_id: workspace.id,
            workspace_path,
            initial_task_id: initialTaskId,
            configuration_complete: true,
            ready_for_use: true
          }
        }
      );

    } catch (error) {
      return this.createErrorResult(
        `Failed to configure project: ${error instanceof Error ? error.message : String(error)}`,
        { workspace_path }
      );
    }
  }

  /**
   * Get tool definition with dynamic stepId enumeration
   */
  static async getToolDefinitionDynamic(drizzleDb: DrizzleDatabaseManager): Promise<ToolDefinition> {
    const instance = new InitToolNew(drizzleDb);
    return await instance.getToolDefinition();
  }

  /**
   * Static tool definition for immediate use (fallback)
   */
  static getToolDefinition(): ToolDefinition {
    return {
      name: 'taskpilot_init',
      description: 'Initialize TaskPilot workspace with folder structure and initial configuration. Supports multi-step workflow.',
      inputSchema: {
        type: 'object',
        properties: {
          stepId: {
            type: 'string',
            enum: ['confirm', 'setup_structure', 'configure_project'],
            description: 'Optional step ID for multi-step workflow: confirm, setup_structure, configure_project'
          },
          workspace_path: {
            type: 'string',
            description: 'Absolute path to the workspace directory'
          },
          project_requirements: {
            type: 'string',
            description: 'Initial project requirements or description'
          }
        },
        required: ['workspace_path']
      }
    };
  }
}
