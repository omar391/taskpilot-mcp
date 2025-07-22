import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import type { DrizzleDatabaseManager } from '../database/drizzle-connection.js';
import type { TaskPilotToolResult } from '../types/index.js';
import { PromptOrchestrator } from '../services/prompt-orchestrator.js';
import { ProjectInitializer } from '../services/project-initializer.js';
import { workspaceFeedbackSteps } from '../database/schema/workspace-schema.js';
import { eq } from 'drizzle-orm';

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

  constructor(private drizzleDb: DrizzleDatabaseManager) {
    // For now, pass the drizzleDb as any to maintain backward compatibility during migration
    this.orchestrator = new PromptOrchestrator(drizzleDb as any);
    this.projectInitializer = new ProjectInitializer(drizzleDb);
  }

  /**
   * Execute taskpilot_init tool
   */
  async execute(input: InitToolInput): Promise<TaskPilotToolResult> {
    try {
      const { workspace_path, project_requirements, tech_stack, project_name } = input;

      // Initialize the project structure and database
      const initResult = await this.projectInitializer.initializeProject({
        workspace_path,
        project_requirements: project_requirements || 'Standard project setup',
        tech_stack: tech_stack || 'TypeScript/Node.js',
        project_name: project_name || this.extractProjectNameFromPath(workspace_path)
      });

      // Generate orchestrated prompt with init_feedback that will guide the LLM through
      // the analytical framework and resource creation process
      const orchestrationResult = await this.orchestrator.orchestratePrompt(
        'taskpilot_init',
        initResult.workspace.id,
        {
          workspace_name: initResult.workspace.name,
          workspace_path,
          session_id: `init-${Date.now()}`,
          timestamp: new Date().toISOString(),
          project_requirements: project_requirements || 'Standard project setup',
          tech_stack: tech_stack || 'TypeScript/Node.js',
          initialization_complete: true,
          is_empty_project: initResult.isEmpty || false,
          analysis_framework_feedback: this.getAnalysisFrameworkFeedback()
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
   * Get analysis framework feedback steps
   */
  private getAnalysisFrameworkFeedback(): string {
    return `1. **Logical Consistency** - Evaluate statements for internal coherence and contradictions
2. **Evidence Quality** - Assess the strength and reliability of supporting data/reasoning
3. **Hidden Assumptions** - Identify unstated premises that may affect outcomes
4. **Cognitive Biases** - Detect emotional reasoning, confirmation bias, or wishful thinking
5. **Causal Relationships** - Verify claimed cause-and-effect relationships are valid
6. **Alternative Perspectives** - Consider competing explanations or approaches`;
  }

  /**
   * Get workspace-specific rules from feedback steps
   */
  private async getWorkspaceRules(workspaceId: string): Promise<string | null> {
    try {
      const workspaceRulesStep = await this.drizzleDb.getDb().select()
        .from(workspaceFeedbackSteps)
        .where(eq(workspaceFeedbackSteps.name, 'workspace_rules'))
        .get();
      
      return workspaceRulesStep?.templateContent || null;
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
