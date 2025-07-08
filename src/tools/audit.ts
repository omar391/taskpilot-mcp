import { z } from 'zod';
import type { DrizzleDatabaseManager } from '../database/drizzle-connection.js';
import type { TaskPilotToolResult } from '../types/index.js';
import { PromptOrchestrator } from '../services/prompt-orchestrator.js';
import { GlobalDatabaseService } from '../database/global-queries.js';

// Input schema for taskpilot_audit tool
export const auditToolSchema = z.object({
  workspace_path: z.string().describe('Absolute path to the workspace directory'),
  scope: z.enum(['full', 'tasks', 'dependencies', 'files']).optional().describe('Audit scope (defaults to full)'),
  fix_issues: z.boolean().optional().describe('Automatically fix detected issues (defaults to false)')
});

export type AuditToolInput = z.infer<typeof auditToolSchema>;

/**
 * TaskPilot Audit Tool - Project Health Checking (Pure TypeScript/Drizzle)
 * 
 * MCP tool for comprehensive project audit including task completion verification,
 * orphaned dependencies detection, file connectivity validation, and cleanup
 * action recommendations.
 */
export class AuditTool {
  private orchestrator: PromptOrchestrator;
  private globalDb: GlobalDatabaseService;

  constructor(private drizzleDb: DrizzleDatabaseManager) {
    this.orchestrator = new PromptOrchestrator(drizzleDb);
    this.globalDb = new GlobalDatabaseService(drizzleDb);
  }

  /**
   * Execute taskpilot_audit tool
   */
  async execute(input: AuditToolInput): Promise<TaskPilotToolResult> {
    try {
      const { workspace_path, scope = 'full', fix_issues = false } = input;

      // Get workspace
      const workspace = await this.globalDb.getWorkspaceByPath(workspace_path);
      if (!workspace) {
        return {
          content: [{
            type: 'text',
            text: `Error: Workspace not found at path: ${workspace_path}. Please run taskpilot_start first to initialize the workspace.`
          }],
          isError: true
        };
      }

      // Generate orchestrated prompt for audit process
      const orchestrationResult = await this.orchestrator.orchestratePrompt(
        'taskpilot_audit',
        workspace.id,
        {
          workspace_path,
          workspace_name: workspace.name,
          scope,
          fix_issues,
          timestamp: new Date().toISOString(),
          // Include instructions for file-based audit
          task_file_path: `${workspace_path}/.task/todo/current.md`,
          done_files_pattern: `${workspace_path}/.task/todo/done_*.md`,
          project_file_path: `${workspace_path}/.task/project.md`,
          rules_file_path: `${workspace_path}/.task/rules/workspace_rules.md`,
          audit_instructions: `Perform ${scope} audit on .task folder structure and validate task completion, dependencies, and file connectivity`
        }
      );

      return {
        content: [{
          type: 'text',
          text: orchestrationResult.prompt_text
        }]
      };
    } catch (error) {
      console.error('Error in taskpilot_audit:', error);
      return {
        content: [{
          type: 'text',
          text: `Error performing audit: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  /**
   * Get tool definition for MCP server
   */
  static getToolDefinition() {
    return {
      name: 'taskpilot_audit',
      description: 'Perform comprehensive project audit with health checking and cleanup recommendations',
      inputSchema: {
        type: 'object',
        properties: {
          workspace_path: {
            type: 'string',
            description: 'Absolute path to the workspace directory'
          },
          scope: {
            type: 'string',
            enum: ['full', 'tasks', 'dependencies', 'files'],
            description: 'Audit scope (defaults to full)'
          },
          fix_issues: {
            type: 'boolean',
            description: 'Automatically fix detected issues (defaults to false)'
          }
        },
        required: ['workspace_path']
      }
    };
  }
}
