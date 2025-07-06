import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import type { DatabaseManager } from '../database/connection.js';
import type { TaskPilotToolResult } from '../types/index.js';
import { PromptOrchestrator } from '../services/prompt-orchestrator.js';

// Input schema for taskpilot_start tool
export const startToolSchema = z.object({
  workspace_path: z.string().describe('Absolute path to the workspace directory')
});

export type StartToolInput = z.infer<typeof startToolSchema>;

/**
 * TaskPilot Start Tool - Session Initiation
 * 
 * Core MCP tool that initiates workspace sessions and returns comprehensive 
 * prompt_text for LLM context. Includes workspace setup, active task 
 * identification, and analytical framework instructions.
 */
export class StartTool {
  private orchestrator: PromptOrchestrator;

  constructor(private db: DatabaseManager) {
    this.orchestrator = new PromptOrchestrator(db);
  }

  /**
   * Execute taskpilot_start tool
   */
  async execute(input: StartToolInput): Promise<TaskPilotToolResult> {
    try {
      const { workspace_path } = input;

      // Create or get workspace
      const workspace = await this.ensureWorkspace(workspace_path);
      
      // Create new session
      const session = await this.createSession(workspace.id);
      
      // Generate orchestrated prompt
      const orchestrationResult = await this.orchestrator.orchestratePrompt(
        'taskpilot_start',
        workspace.id,
        { workspace_path }
      );

      // Update workspace activity
      await this.updateWorkspaceActivity(workspace.id);

      return {
        content: [{
          type: 'text',
          text: orchestrationResult.prompt_text
        }]
      };
    } catch (error) {
      console.error('Error in taskpilot_start:', error);
      return {
        content: [{
          type: 'text',
          text: `Error initiating TaskPilot session: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  /**
   * Ensure workspace exists in database, create if necessary
   */
  private async ensureWorkspace(workspacePath: string): Promise<any> {
    // Check if workspace already exists
    let workspace = await this.db.get<any>(
      'SELECT * FROM workspaces WHERE path = ?',
      [workspacePath]
    );

    if (!workspace) {
      // Create new workspace
      const workspaceId = uuidv4();
      const workspaceName = workspacePath.split('/').pop() || 'Unknown Project';
      
      await this.db.run(
        `INSERT INTO workspaces (id, path, name, created_at, updated_at, is_active)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)`,
        [workspaceId, workspacePath, workspaceName]
      );

      workspace = await this.db.get<any>(
        'SELECT * FROM workspaces WHERE id = ?',
        [workspaceId]
      );
    } else {
      // Activate existing workspace
      await this.db.run(
        'UPDATE workspaces SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [workspace.id]
      );
    }

    return workspace;
  }

  /**
   * Create new session for the workspace
   */
  private async createSession(workspaceId: string): Promise<any> {
    // Deactivate any existing active sessions for this workspace
    await this.db.run(
      'UPDATE sessions SET is_active = 0 WHERE workspace_id = ? AND is_active = 1',
      [workspaceId]
    );

    // Create new session
    const sessionId = uuidv4();
    await this.db.run(
      `INSERT INTO sessions (id, workspace_id, created_at, last_activity, is_active)
       VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)`,
      [sessionId, workspaceId]
    );

    return await this.db.get<any>(
      'SELECT * FROM sessions WHERE id = ?',
      [sessionId]
    );
  }

  /**
   * Update workspace last activity timestamp
   */
  private async updateWorkspaceActivity(workspaceId: string): Promise<void> {
    await this.db.run(
      'UPDATE workspaces SET last_activity = CURRENT_TIMESTAMP WHERE id = ?',
      [workspaceId]
    );
  }

  /**
   * Get tool definition for MCP server
   */
  static getToolDefinition() {
    return {
      name: 'taskpilot_start',
      description: 'Initialize TaskPilot session for a workspace and provide comprehensive project context',
      inputSchema: {
        type: 'object',
        properties: {
          workspace_path: {
            type: 'string',
            description: 'Absolute path to the workspace directory'
          }
        },
        required: ['workspace_path']
      }
    };
  }
}