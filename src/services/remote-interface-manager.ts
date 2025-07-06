import { DatabaseManager } from '../database/connection.js';

export interface RemoteInterface {
    id: string;
    workspace_id: string;
    interface_type: 'github' | 'jira' | 'linear' | 'asana' | 'trello' | 'custom';
    name: string;
    base_url: string;
    api_token: string;
    project_id?: string; // Jira project key, Linear team ID, etc.
    sync_enabled: boolean;
    sync_direction: 'bidirectional' | 'import_only' | 'export_only';
    field_mappings: string; // JSON string of field mappings
    mcp_server_name?: string; // Name of the specialized MCP server to delegate operations to
    last_sync: string | null;
    created_at: string;
    updated_at: string;
}

export interface MCPServerMapping {
  id: string;
  interface_type: RemoteInterface['interface_type'];
  mcp_server_name: string;
  description: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface FieldMapping {
    taskpilot_field: string;
    remote_field: string;
    transformation?: 'direct' | 'uppercase' | 'lowercase' | 'custom';
    custom_transform?: string; // Custom transformation logic
}

export interface SyncResult {
    interface_id: string;
    items_imported: number;
    items_exported: number;
    items_updated: number;
    items_failed: number;
    errors: string[];
    last_sync: string;
}

export class RemoteInterfaceManager {
    private db: DatabaseManager;

    constructor(db: DatabaseManager) {
        this.db = db;
    }

    /**
     * Register a new remote interface
     */
    async registerInterface(
        workspaceId: string,
        interfaceType: RemoteInterface['interface_type'],
        name: string,
        baseUrl: string,
        apiToken: string,
        options: {
            projectId?: string;
            syncEnabled?: boolean;
            syncDirection?: RemoteInterface['sync_direction'];
            fieldMappings?: FieldMapping[];
            mcpServerName?: string;
        } = {}
    ): Promise<RemoteInterface> {
        const interfaceId = `ri_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date().toISOString();

        // Get default MCP server name if not provided
        const mcpServerName = options.mcpServerName || await this.getDefaultMCPServer(interfaceType);

        const defaultFieldMappings = this.getDefaultFieldMappings(interfaceType);
        const fieldMappings = options.fieldMappings || defaultFieldMappings;

        const remoteInterface: RemoteInterface = {
            id: interfaceId,
            workspace_id: workspaceId,
            interface_type: interfaceType,
            name,
            base_url: baseUrl,
            api_token: apiToken,
            project_id: options.projectId,
            sync_enabled: options.syncEnabled ?? true,
            sync_direction: options.syncDirection ?? 'bidirectional',
            field_mappings: JSON.stringify(fieldMappings),
            mcp_server_name: mcpServerName,
            last_sync: null,
            created_at: now,
            updated_at: now
        };

        await this.db.run(
            `INSERT INTO remote_interfaces 
       (id, workspace_id, interface_type, name, base_url, api_token, project_id, 
        sync_enabled, sync_direction, field_mappings, mcp_server_name, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                remoteInterface.id,
                remoteInterface.workspace_id,
                remoteInterface.interface_type,
                remoteInterface.name,
                remoteInterface.base_url,
                remoteInterface.api_token,
                remoteInterface.project_id,
                remoteInterface.sync_enabled,
                remoteInterface.sync_direction,
                remoteInterface.field_mappings,
                remoteInterface.mcp_server_name,
                remoteInterface.created_at,
                remoteInterface.updated_at
            ]
        );

        return remoteInterface;
    }

    /**
     * Get all remote interfaces for a workspace
     */
    async getWorkspaceInterfaces(workspaceId: string): Promise<RemoteInterface[]> {
        const interfaces = await this.db.all<RemoteInterface>(
            'SELECT * FROM remote_interfaces WHERE workspace_id = ? ORDER BY created_at DESC',
            [workspaceId]
        ) as RemoteInterface[];

        return interfaces;
    }

    /**
     * Get a specific remote interface
     */
    async getInterface(interfaceId: string): Promise<RemoteInterface | null> {
        const result = await this.db.get<RemoteInterface>(
            'SELECT * FROM remote_interfaces WHERE id = ?',
            [interfaceId]
        );
        return result || null;
    }

    /**
     * Update remote interface configuration
     */
    async updateInterface(
        interfaceId: string,
        updates: Partial<Pick<RemoteInterface, 'name' | 'base_url' | 'api_token' | 'project_id' | 'sync_enabled' | 'sync_direction' | 'field_mappings' | 'mcp_server_name'>>
    ): Promise<void> {
        const setClause = [];
        const values = [];

        for (const [key, value] of Object.entries(updates)) {
            if (value !== undefined) {
                setClause.push(`${key} = ?`);
                values.push(typeof value === 'object' ? JSON.stringify(value) : value);
            }
        }

        if (setClause.length === 0) {
            return;
        }

        values.push(new Date().toISOString(), interfaceId);

        await this.db.run(
            `UPDATE remote_interfaces SET ${setClause.join(', ')}, updated_at = ? WHERE id = ?`,
            values
        );
    }

    /**
     * Delete a remote interface
     */
    async deleteInterface(interfaceId: string): Promise<void> {
        await this.db.run(
            'DELETE FROM remote_interfaces WHERE id = ?',
            [interfaceId]
        );
    }

    /**
     * Get default MCP server name for an interface type
     */
    async getDefaultMCPServer(interfaceType: RemoteInterface['interface_type']): Promise<string> {
        const mapping = await this.db.get<MCPServerMapping>(
            'SELECT * FROM mcp_server_mappings WHERE interface_type = ? AND is_default = 1',
            [interfaceType]
        );

        return mapping?.mcp_server_name || `${interfaceType}-mcp`;
    }

    /**
     * Get all MCP server mappings
     */
    async getMCPServerMappings(): Promise<MCPServerMapping[]> {
        const mappings = await this.db.all<MCPServerMapping>(
            'SELECT * FROM mcp_server_mappings ORDER BY interface_type, is_default DESC',
            []
        ) as MCPServerMapping[];

        return mappings;
    }

    /**
     * Get MCP server mapping for a specific interface type
     */
    async getMCPServerMapping(interfaceType: RemoteInterface['interface_type']): Promise<MCPServerMapping | null> {
        const mapping = await this.db.get<MCPServerMapping>(
            'SELECT * FROM mcp_server_mappings WHERE interface_type = ? AND is_default = 1',
            [interfaceType]
        );

        return mapping || null;
    }

    /**
     * Test connection to a remote interface
     */
    async testConnection(interfaceId: string): Promise<{ success: boolean; error?: string; info?: any }> {
        const remoteInterface = await this.getInterface(interfaceId);
        if (!remoteInterface) {
            return { success: false, error: 'Interface not found' };
        }

        try {
            switch (remoteInterface.interface_type) {
                case 'github':
                    return await this.testGitHubConnection(remoteInterface);
                case 'jira':
                    return await this.testJiraConnection(remoteInterface);
                case 'linear':
                    return await this.testLinearConnection(remoteInterface);
                default:
                    return await this.testGenericConnection(remoteInterface);
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Synchronize tasks with a remote interface
     */
    async syncInterface(interfaceId: string): Promise<SyncResult> {
        const remoteInterface = await this.getInterface(interfaceId);
        if (!remoteInterface) {
            throw new Error('Interface not found');
        }

        if (!remoteInterface.sync_enabled) {
            throw new Error('Synchronization is disabled for this interface');
        }

        const result: SyncResult = {
            interface_id: interfaceId,
            items_imported: 0,
            items_exported: 0,
            items_updated: 0,
            items_failed: 0,
            errors: [],
            last_sync: new Date().toISOString()
        };

        try {
            switch (remoteInterface.interface_type) {
                case 'github':
                    // GitHub sync is handled by GitHubTool
                    throw new Error('GitHub synchronization should use taskpilot_github tool');
                case 'jira':
                    await this.syncJiraInterface(remoteInterface, result);
                    break;
                case 'linear':
                    await this.syncLinearInterface(remoteInterface, result);
                    break;
                default:
                    throw new Error(`Synchronization not implemented for ${remoteInterface.interface_type}`);
            }

            // Update last sync timestamp
            await this.db.run(
                'UPDATE remote_interfaces SET last_sync = ? WHERE id = ?',
                [result.last_sync, interfaceId]
            );

        } catch (error) {
            result.errors.push(error instanceof Error ? error.message : 'Unknown sync error');
        }

        return result;
    }

    /**
     * Get default field mappings for an interface type
     */
    private getDefaultFieldMappings(interfaceType: RemoteInterface['interface_type']): FieldMapping[] {
        const baseMapping: FieldMapping[] = [
            { taskpilot_field: 'title', remote_field: 'title' },
            { taskpilot_field: 'description', remote_field: 'description' },
            { taskpilot_field: 'status', remote_field: 'status' }
        ];

        switch (interfaceType) {
            case 'github':
                return [
                    ...baseMapping,
                    { taskpilot_field: 'status', remote_field: 'state', transformation: 'custom' },
                    { taskpilot_field: 'priority', remote_field: 'labels', transformation: 'custom' }
                ];
            case 'jira':
                return [
                    ...baseMapping,
                    { taskpilot_field: 'priority', remote_field: 'priority.name' },
                    { taskpilot_field: 'status', remote_field: 'status.name' },
                    { taskpilot_field: 'assignee', remote_field: 'assignee.displayName' }
                ];
            case 'linear':
                return [
                    ...baseMapping,
                    { taskpilot_field: 'priority', remote_field: 'priority', transformation: 'custom' },
                    { taskpilot_field: 'status', remote_field: 'state.name' },
                    { taskpilot_field: 'assignee', remote_field: 'assignee.name' }
                ];
            default:
                return baseMapping;
        }
    }

    /**
     * Test GitHub connection
     */
    private async testGitHubConnection(remoteInterface: RemoteInterface): Promise<{ success: boolean; error?: string; info?: any }> {
        try {
            const response = await fetch(`${remoteInterface.base_url}/user`, {
                headers: {
                    'Authorization': `token ${remoteInterface.api_token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (response.ok) {
                const user = await response.json();
                return {
                    success: true,
                    info: {
                        user: user.login,
                        name: user.name,
                        type: user.type
                    }
                };
            } else {
                return {
                    success: false,
                    error: `GitHub API error: ${response.status} ${response.statusText}`
                };
            }
        } catch (error) {
            return {
                success: false,
                error: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Test Jira connection
     */
    private async testJiraConnection(remoteInterface: RemoteInterface): Promise<{ success: boolean; error?: string; info?: any }> {
        try {
            const response = await fetch(`${remoteInterface.base_url}/rest/api/2/myself`, {
                headers: {
                    'Authorization': `Bearer ${remoteInterface.api_token}`,
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                const user = await response.json();
                return {
                    success: true,
                    info: {
                        user: user.key,
                        name: user.displayName,
                        email: user.emailAddress
                    }
                };
            } else {
                return {
                    success: false,
                    error: `Jira API error: ${response.status} ${response.statusText}`
                };
            }
        } catch (error) {
            return {
                success: false,
                error: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Test Linear connection
     */
    private async testLinearConnection(remoteInterface: RemoteInterface): Promise<{ success: boolean; error?: string; info?: any }> {
        try {
            const response = await fetch(`${remoteInterface.base_url}/graphql`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${remoteInterface.api_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    query: 'query { viewer { id name email } }'
                })
            });

            if (response.ok) {
                const result = await response.json();
                if (result.data?.viewer) {
                    return {
                        success: true,
                        info: {
                            user: result.data.viewer.id,
                            name: result.data.viewer.name,
                            email: result.data.viewer.email
                        }
                    };
                } else {
                    return {
                        success: false,
                        error: `Linear API error: ${result.errors?.[0]?.message || 'Unknown error'}`
                    };
                }
            } else {
                return {
                    success: false,
                    error: `Linear API error: ${response.status} ${response.statusText}`
                };
            }
        } catch (error) {
            return {
                success: false,
                error: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Test generic REST API connection
     */
    private async testGenericConnection(remoteInterface: RemoteInterface): Promise<{ success: boolean; error?: string; info?: any }> {
        try {
            const response = await fetch(remoteInterface.base_url, {
                headers: {
                    'Authorization': `Bearer ${remoteInterface.api_token}`,
                    'Accept': 'application/json'
                }
            });

            return {
                success: response.ok,
                error: response.ok ? undefined : `API error: ${response.status} ${response.statusText}`,
                info: response.ok ? { status: response.status } : undefined
            };
        } catch (error) {
            return {
                success: false,
                error: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Sync with Jira interface (placeholder implementation)
     */
    private async syncJiraInterface(remoteInterface: RemoteInterface, result: SyncResult): Promise<void> {
        // Placeholder for Jira synchronization logic
        // This would implement bidirectional sync between TaskPilot tasks and Jira issues
        throw new Error('Jira synchronization not yet implemented');
    }

    /**
     * Sync with Linear interface (placeholder implementation)
     */
    private async syncLinearInterface(remoteInterface: RemoteInterface, result: SyncResult): Promise<void> {
        // Placeholder for Linear synchronization logic
        // This would implement bidirectional sync between TaskPilot tasks and Linear issues
        throw new Error('Linear synchronization not yet implemented');
    }

    /**
     * Get sync statistics for all interfaces in a workspace
     */
    async getWorkspaceSyncStats(workspaceId: string): Promise<{
        total_interfaces: number;
        sync_enabled: number;
        last_sync_24h: number;
        interfaces: Array<{
            id: string;
            name: string;
            type: string;
            sync_enabled: boolean;
            last_sync: string | null;
            mcp_server_name?: string;
        }>;
    }> {
        const interfaces = await this.getWorkspaceInterfaces(workspaceId);
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const syncEnabled = interfaces.filter(i => i.sync_enabled).length;
        const lastSync24h = interfaces.filter(i =>
            i.last_sync && new Date(i.last_sync) > yesterday
        ).length;

        return {
            total_interfaces: interfaces.length,
            sync_enabled: syncEnabled,
            last_sync_24h: lastSync24h,
            interfaces: interfaces.map(i => ({
                id: i.id,
                name: i.name,
                type: i.interface_type,
                sync_enabled: i.sync_enabled,
                last_sync: i.last_sync,
                mcp_server_name: i.mcp_server_name
            }))
        };
    }
}
