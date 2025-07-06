import { DatabaseManager } from '../database/connection.js';
import { PromptOrchestrator } from '../services/prompt-orchestrator.js';
import * as RemoteInterfaceManagerModule from '../services/remote-interface-manager.js';
import { z } from 'zod';

type RemoteInterface = RemoteInterfaceManagerModule.RemoteInterface;
type RemoteInterfaceManagerType = RemoteInterfaceManagerModule.RemoteInterfaceManager;

// Schema for remote interface tool arguments
export const remoteInterfaceToolSchema = z.object({
  workspace_id: z.string().describe('Workspace ID to manage interfaces for'),
  action: z.enum(['register', 'list', 'update', 'delete', 'test', 'sync', 'stats'])
    .describe('Remote interface action to perform'),
  interface_id: z.string().optional().describe('Interface ID for specific operations'),
  interface_type: z.enum(['github', 'jira', 'linear', 'asana', 'trello', 'custom']).optional()
    .describe('Type of remote interface to register'),
  name: z.string().optional().describe('Display name for the interface'),
  base_url: z.string().optional().describe('Base URL for the remote service API'),
  api_token: z.string().optional().describe('API token or access key for authentication'),
  project_id: z.string().optional().describe('Platform-specific project identifier'),
  sync_enabled: z.boolean().optional().describe('Enable automatic synchronization'),
  sync_direction: z.enum(['bidirectional', 'import_only', 'export_only']).optional()
    .describe('Direction of synchronization'),
  field_mappings: z.array(z.object({
    taskpilot_field: z.string(),
    remote_field: z.string(),
    transformation: z.enum(['direct', 'uppercase', 'lowercase', 'custom']).optional(),
    custom_transform: z.string().optional()
  })).optional().describe('Custom field mappings')
});

interface RemoteInterfaceToolArgs {
  workspace_id: string;
  action: 'register' | 'list' | 'update' | 'delete' | 'test' | 'sync' | 'stats';
  interface_id?: string;
  interface_type?: 'github' | 'jira' | 'linear' | 'asana' | 'trello' | 'custom';
  name?: string;
  base_url?: string;
  api_token?: string;
  project_id?: string;
  sync_enabled?: boolean;
  sync_direction?: 'bidirectional' | 'import_only' | 'export_only';
  field_mappings?: Array<{
    taskpilot_field: string;
    remote_field: string;
    transformation?: 'direct' | 'uppercase' | 'lowercase' | 'custom';
    custom_transform?: string;
  }>;
}

export class RemoteInterfaceTool {
  private db: DatabaseManager;
  private promptOrchestrator: PromptOrchestrator;
  private interfaceManager: RemoteInterfaceManagerType;

  constructor(db: DatabaseManager) {
    this.db = db;
    this.promptOrchestrator = new PromptOrchestrator(db);
    this.interfaceManager = new RemoteInterfaceManagerModule.RemoteInterfaceManager(db);
  }

  /**
   * Get tool definition for MCP server
   */
  static getToolDefinition() {
    return {
      name: 'taskpilot_remote_interface',
      description: 'Manage remote task management interface connections (Jira, Linear, Asana, etc.) for multi-platform task synchronization',
      inputSchema: {
        type: 'object',
        properties: {
          workspace_id: {
            type: 'string',
            description: 'Workspace ID to manage interfaces for'
          },
          action: {
            type: 'string',
            enum: ['register', 'list', 'update', 'delete', 'test', 'sync', 'stats'],
            description: 'Action: register (add new interface), list (show all), update (modify settings), delete (remove), test (check connection), sync (synchronize data), stats (sync statistics)'
          },
          interface_id: {
            type: 'string',
            description: 'Interface ID for update, delete, test, or sync actions'
          },
          interface_type: {
            type: 'string',
            enum: ['github', 'jira', 'linear', 'asana', 'trello', 'custom'],
            description: 'Type of remote interface (required for register action)'
          },
          name: {
            type: 'string',
            description: 'Display name for the interface (required for register action)'
          },
          base_url: {
            type: 'string',
            description: 'Base URL for the remote service API (required for register action)'
          },
          api_token: {
            type: 'string',
            description: 'API token or access key for authentication (required for register action)'
          },
          project_id: {
            type: 'string',
            description: 'Platform-specific project identifier (Jira project key, Linear team ID, etc.)'
          },
          sync_enabled: {
            type: 'boolean',
            description: 'Enable automatic synchronization',
            default: true
          },
          sync_direction: {
            type: 'string',
            enum: ['bidirectional', 'import_only', 'export_only'],
            description: 'Direction of synchronization',
            default: 'bidirectional'
          },
          field_mappings: {
            type: 'array',
            description: 'Custom field mappings between TaskPilot and remote platform',
            items: {
              type: 'object',
              properties: {
                taskpilot_field: { type: 'string' },
                remote_field: { type: 'string' },
                transformation: {
                  type: 'string',
                  enum: ['direct', 'uppercase', 'lowercase', 'custom']
                },
                custom_transform: { type: 'string' }
              },
              required: ['taskpilot_field', 'remote_field']
            }
          }
        },
        required: ['workspace_id', 'action']
      }
    };
  }

  async execute(args: RemoteInterfaceToolArgs): Promise<any> {
    try {
      // Validate workspace exists
      const workspace = await this.db.get<any>(
        'SELECT * FROM workspaces WHERE id = ?',
        [args.workspace_id]
      );

      if (!workspace) {
        return {
          content: [{
            type: 'text',
            text: 'Error: Workspace not found'
          }],
          isError: true
        };
      }

      let actionResult;
      switch (args.action) {
        case 'register':
          actionResult = await this.registerInterface(args);
          break;
        case 'list':
          actionResult = await this.listInterfaces(args.workspace_id);
          break;
        case 'update':
          actionResult = await this.updateInterface(args);
          break;
        case 'delete':
          actionResult = await this.deleteInterface(args);
          break;
        case 'test':
          actionResult = await this.testInterface(args);
          break;
        case 'sync':
          actionResult = await this.syncInterface(args);
          break;
        case 'stats':
          actionResult = await this.getStats(args.workspace_id);
          break;
        default:
          throw new Error(`Unknown action: ${args.action}`);
      }

      // Prepare context for prompt orchestration
      const context = {
        workspace_id: args.workspace_id,
        workspace_name: workspace.name,
        workspace_path: workspace.path,
        action: args.action,
        result: actionResult,
        interface_id: args.interface_id,
        interface_type: args.interface_type,
        timestamp: new Date().toISOString()
      };

      // Get orchestrated prompt response
      const orchestrationResult = await this.promptOrchestrator.orchestratePrompt(
        'taskpilot_remote_interface',
        args.workspace_id,
        context
      );

      return {
        content: [{
          type: 'text',
          text: orchestrationResult.prompt_text
        }]
      };
    } catch (error) {
      console.error('Error in taskpilot_remote_interface:', error);
      return {
        content: [{
          type: 'text',
          text: `Error in remote interface management: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  /**
   * Register a new remote interface
   */
  private async registerInterface(args: RemoteInterfaceToolArgs): Promise<any> {
    if (!args.interface_type || !args.name || !args.base_url || !args.api_token) {
      throw new Error('interface_type, name, base_url, and api_token are required for registration');
    }

    try {
      const remoteInterface = await this.interfaceManager.registerInterface(
        args.workspace_id,
        args.interface_type,
        args.name,
        args.base_url,
        args.api_token,
        {
          projectId: args.project_id,
          syncEnabled: args.sync_enabled,
          syncDirection: args.sync_direction,
          fieldMappings: args.field_mappings
        }
      );

      return {
        success: true,
        interface: {
          id: remoteInterface.id,
          type: remoteInterface.interface_type,
          name: remoteInterface.name,
          base_url: remoteInterface.base_url,
          project_id: remoteInterface.project_id,
          sync_enabled: remoteInterface.sync_enabled,
          sync_direction: remoteInterface.sync_direction
        },
        message: 'Remote interface registered successfully'
      };
    } catch (error) {
      throw new Error(`Failed to register interface: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List all remote interfaces for workspace
   */
  private async listInterfaces(workspaceId: string): Promise<any> {
    try {
      const interfaces = await this.interfaceManager.getWorkspaceInterfaces(workspaceId);
      
      return {
        success: true,
        total_interfaces: interfaces.length,
        interfaces: interfaces.map((i: RemoteInterface) => ({
          id: i.id,
          type: i.interface_type,
          name: i.name,
          base_url: i.base_url,
          project_id: i.project_id,
          sync_enabled: i.sync_enabled,
          sync_direction: i.sync_direction,
          last_sync: i.last_sync,
          created_at: i.created_at
        }))
      };
    } catch (error) {
      throw new Error(`Failed to list interfaces: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update remote interface configuration
   */
  private async updateInterface(args: RemoteInterfaceToolArgs): Promise<any> {
    if (!args.interface_id) {
      throw new Error('interface_id is required for update action');
    }

    try {
      const updates: any = {};
      if (args.name !== undefined) updates.name = args.name;
      if (args.base_url !== undefined) updates.base_url = args.base_url;
      if (args.api_token !== undefined) updates.api_token = args.api_token;
      if (args.project_id !== undefined) updates.project_id = args.project_id;
      if (args.sync_enabled !== undefined) updates.sync_enabled = args.sync_enabled;
      if (args.sync_direction !== undefined) updates.sync_direction = args.sync_direction;
      if (args.field_mappings !== undefined) updates.field_mappings = args.field_mappings;

      await this.interfaceManager.updateInterface(args.interface_id, updates);

      const updatedInterface = await this.interfaceManager.getInterface(args.interface_id);

      return {
        success: true,
        interface: updatedInterface ? {
          id: updatedInterface.id,
          type: updatedInterface.interface_type,
          name: updatedInterface.name,
          sync_enabled: updatedInterface.sync_enabled,
          sync_direction: updatedInterface.sync_direction
        } : null,
        updated_fields: Object.keys(updates),
        message: 'Interface updated successfully'
      };
    } catch (error) {
      throw new Error(`Failed to update interface: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete remote interface
   */
  private async deleteInterface(args: RemoteInterfaceToolArgs): Promise<any> {
    if (!args.interface_id) {
      throw new Error('interface_id is required for delete action');
    }

    try {
      const remoteInterface = await this.interfaceManager.getInterface(args.interface_id);
      if (!remoteInterface) {
        throw new Error('Interface not found');
      }

      await this.interfaceManager.deleteInterface(args.interface_id);

      return {
        success: true,
        deleted_interface: {
          id: remoteInterface.id,
          name: remoteInterface.name,
          type: remoteInterface.interface_type
        },
        message: 'Interface deleted successfully'
      };
    } catch (error) {
      throw new Error(`Failed to delete interface: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Test remote interface connection
   */
  private async testInterface(args: RemoteInterfaceToolArgs): Promise<any> {
    if (!args.interface_id) {
      throw new Error('interface_id is required for test action');
    }

    try {
      const testResult = await this.interfaceManager.testConnection(args.interface_id);
      const remoteInterface = await this.interfaceManager.getInterface(args.interface_id);

      return {
        success: testResult.success,
        interface: remoteInterface ? {
          id: remoteInterface.id,
          name: remoteInterface.name,
          type: remoteInterface.interface_type,
          base_url: remoteInterface.base_url
        } : null,
        connection_info: testResult.info,
        error: testResult.error,
        message: testResult.success ? 'Connection test successful' : 'Connection test failed'
      };
    } catch (error) {
      throw new Error(`Failed to test interface: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Synchronize with remote interface
   */
  private async syncInterface(args: RemoteInterfaceToolArgs): Promise<any> {
    if (!args.interface_id) {
      throw new Error('interface_id is required for sync action');
    }

    try {
      const syncResult = await this.interfaceManager.syncInterface(args.interface_id);
      const remoteInterface = await this.interfaceManager.getInterface(args.interface_id);

      return {
        success: syncResult.errors.length === 0,
        interface: remoteInterface ? {
          id: remoteInterface.id,
          name: remoteInterface.name,
          type: remoteInterface.interface_type
        } : null,
        sync_results: {
          items_imported: syncResult.items_imported,
          items_exported: syncResult.items_exported,
          items_updated: syncResult.items_updated,
          items_failed: syncResult.items_failed,
          errors: syncResult.errors
        },
        last_sync: syncResult.last_sync,
        message: syncResult.errors.length === 0 ? 'Synchronization completed successfully' : 'Synchronization completed with errors'
      };
    } catch (error) {
      throw new Error(`Failed to sync interface: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get synchronization statistics
   */
  private async getStats(workspaceId: string): Promise<any> {
    try {
      const stats = await this.interfaceManager.getWorkspaceSyncStats(workspaceId);

      return {
        success: true,
        statistics: stats,
        message: 'Synchronization statistics retrieved successfully'
      };
    } catch (error) {
      throw new Error(`Failed to get stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
