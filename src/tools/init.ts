import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import type { DatabaseManager } from '../database/connection.js';
import type { TaskPilotToolResult } from '../types/index.js';
import { PromptOrchestrator } from '../services/prompt-orchestrator.js';
import { ProjectInitializer } from '../services/project-initializer.js';

// Input schema for taskpilot_init tool
export const initToolSchema = z.object({
  workspace_path: z.string().describe('Absolute path to the workspace directory'),
  project_requirements: z.string().optional().describe('Project requirements and specifications'),
  tech_stack: z.string().optional().describe('Technology stack preferences'),
  project_name: z.string().optional().describe('Custom project name (defaults to directory name)')
});

export type InitToolInput = z.infer<typeof initToolSchema>;

/**
 * TaskPilot Init Tool - Project Initialization
 * 
 * MCP tool for project initialization (aka //init). Creates project configuration 
 * entries, sets up standard rules, generates initial workspace rules, and 
 * initializes task tracking in database.
 */
export class InitTool {
  private orchestrator: PromptOrchestrator;
  private projectInitializer: ProjectInitializer;

  constructor(private db: DatabaseManager) {
    this.orchestrator = new PromptOrchestrator(db);
    this.projectInitializer = new ProjectInitializer(db);
  }

  /**
   * Execute taskpilot_init tool
   */
  async execute(input: InitToolInput): Promise<TaskPilotToolResult> {
    try {
      const { workspace_path, project_requirements, tech_stack, project_name } = input;

      // Initialize the project
      const initResult = await this.projectInitializer.initializeProject({
        workspace_path,
        project_requirements: project_requirements || 'Standard project setup',
        tech_stack: tech_stack || 'TypeScript/Node.js',
        project_name: project_name || this.extractProjectNameFromPath(workspace_path)
      });

      // Get workspace rules after initialization
      const workspaceRules = await this.getWorkspaceRules(initResult.workspace.id);

      // Generate orchestrated prompt with comprehensive context
      const orchestrationResult = await this.orchestrator.orchestratePrompt(
        'taskpilot_init',
        initResult.workspace.id,
        {
          workspace_name: initResult.workspace.name,
          workspace_path,
          session_id: `init-${Date.now()}`,
          timestamp: new Date().toISOString(),
          workspace_rules: workspaceRules,
          project_requirements,
          tech_stack,
          initialization_complete: true,
          created_tasks: initResult.initialTasks
        }
      );

      return {
        content: [{
          type: 'text',
          text: orchestrationResult.prompt_text
        }]
      };
    } catch (error) {
      console.error('Error in taskpilot_init:', error);
      return {
        content: [{
          type: 'text',
          text: `Error initializing TaskPilot project: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  /**
   * Get workspace-specific rules from feedback steps
   */
  private async getWorkspaceRules(workspaceId: string): Promise<string | null> {
    try {
      const workspaceRulesStep = await this.db.get<any>(
        'SELECT instructions FROM feedback_steps WHERE name = ? AND workspace_id = ?',
        ['workspace_rules', workspaceId]
      );
      
      return workspaceRulesStep?.instructions || null;
    } catch (error) {
      console.error('Error fetching workspace rules:', error);
      return null;
    }
  }

  /**
   * Extract project name from workspace path
   */
  private extractProjectNameFromPath(workspacePath: string): string {
    const pathParts = workspacePath.split('/');
    return pathParts[pathParts.length - 1] || 'TaskPilot Project';
  }

  /**
   * Get tool definition for MCP server
   */
  static getToolDefinition() {
    return {
      name: 'taskpilot_init',
      description: 'Initialize a new TaskPilot project with workspace setup, task tracking, and configuration',
      inputSchema: {
        type: 'object',
        properties: {
          workspace_path: {
            type: 'string',
            description: 'Absolute path to the workspace directory'
          },
          project_requirements: {
            type: 'string',
            description: 'Project requirements and specifications'
          },
          tech_stack: {
            type: 'string',
            description: 'Technology stack preferences'
          },
          project_name: {
            type: 'string',
            description: 'Custom project name (defaults to directory name)'
          }
        },
        required: ['workspace_path']
      }
    };
  }
}
