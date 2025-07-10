/**
 * TaskPilot API Client
 * 
 * Provides typed API access to the TaskPilot REST API with:
 * - Type-safe requests and responses
 * - Error handling and retry logic
 * - Real-time updates via Server-Sent Events (SSE)
 * - Loading state management
 */

// ========================================
// Types (matching backend API schema)
// ========================================

export interface WorkspaceMetadata {
  id: string
  name: string
  path: string
  status: 'active' | 'idle' | 'inactive' | 'disconnected' | 'error'
  last_activity: string
  task_count: number
  active_task: string | null
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  title: string
  description: string
  status: 'backlog' | 'in-progress' | 'blocked' | 'review' | 'done' | 'dropped'
  priority: 'high' | 'medium' | 'low'
  progress: number
  dependencies: string[]
  notes: string
  connected_files: string[]
  created_at: string
  updated_at: string
}

export interface ToolFlow {
  id: string
  tool_name: string
  description: string
  feedback_step_id: string | null
  next_tool: string | null
  is_global: boolean
  workspace_id?: string
}

export interface FeedbackStep {
  id: string
  name: string
  description: string
  template_content: string
  variable_schema: Record<string, any>
  is_global: boolean
  workspace_id?: string
}

export interface ApiResponse<T> {
  data: T
  error?: string
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  version: string
  activeMCPConnections: number
  activeSSEClients: number
  timestamp: string
}

// ========================================
// SSE Event Types
// ========================================

export interface SSEEvent {
  type: 'workspace.status_changed' | 'task.updated' | 'task.created' | 'connection.status'
  data: any
  timestamp: string
}

export type SSEEventHandler = (event: SSEEvent) => void

// ========================================
// API Client Configuration
// ========================================

export interface ApiClientConfig {
  baseUrl?: string
  timeout?: number
  retryAttempts?: number
  retryDelay?: number
  autoConnectSSE?: boolean
}

// ========================================
// API Client Implementation
// ========================================

export class TaskPilotApiClient {
  private baseUrl: string
  private timeout: number
  private retryAttempts: number
  private retryDelay: number
  private sseConnection: EventSource | null = null
  private sseEventHandlers: Map<string, Set<SSEEventHandler>> = new Map()

  constructor(config: ApiClientConfig = {}) {
    // Use environment variable or fallback to config or default
    // Handle case where import.meta.env might be undefined
    const envApiUrl = typeof import.meta !== 'undefined' &&
      import.meta.env &&
      import.meta.env.VITE_API_BASE_URL
      ? import.meta.env.VITE_API_BASE_URL
      : null;

    this.baseUrl = config.baseUrl ||
      envApiUrl ||
      'http://localhost:8989'
    this.timeout = config.timeout || 10000
    this.retryAttempts = config.retryAttempts || 3
    this.retryDelay = config.retryDelay || 1000

    console.log(`TaskPilot API Client initialized with base URL: ${this.baseUrl}`)
  }

  // ========================================
  // Core HTTP Methods
  // ========================================

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`

    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    }

    let lastError: Error | null = null

    for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), this.timeout)

        const response = await fetch(url, {
          ...defaultOptions,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()
        return data as ApiResponse<T>

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')

        if (attempt < this.retryAttempts) {
          await this.delay(this.retryDelay * Math.pow(2, attempt))
        }
      }
    }

    return {
      data: null as any,
      error: `Failed after ${this.retryAttempts + 1} attempts: ${lastError?.message}`,
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // ========================================
  // Workspace API
  // ========================================

  async getWorkspaces(): Promise<ApiResponse<{ workspaces: WorkspaceMetadata[] }>> {
    return this.makeRequest<{ workspaces: WorkspaceMetadata[] }>('/api/workspaces')
  }

  // ========================================
  // Task API
  // ========================================

  async getTasks(workspaceId: string): Promise<ApiResponse<{ tasks: Task[] }>> {
    return this.makeRequest<{ tasks: Task[] }>(`/api/workspaces/${workspaceId}/tasks`)
  }

  async createTask(workspaceId: string, task: Partial<Task>): Promise<ApiResponse<{ task: Task }>> {
    return this.makeRequest<{ task: Task }>(`/api/workspaces/${workspaceId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(task),
    })
  }

  async updateTask(workspaceId: string, taskId: string, updates: Partial<Task>): Promise<ApiResponse<{ task: Task }>> {
    return this.makeRequest<{ task: Task }>(`/api/workspaces/${workspaceId}/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  }

  // ========================================
  // Tool Flow API
  // ========================================

  async getToolFlows(workspaceId: string): Promise<ApiResponse<{
    global_flows: ToolFlow[];
    workspace_flows: ToolFlow[];
    available_tools: string[];
    workspace: {
      id: string;
      name: string;
      path: string;
    };
  }>> {
    return this.makeRequest<{
      global_flows: ToolFlow[];
      workspace_flows: ToolFlow[];
      available_tools: string[];
      workspace: {
        id: string;
        name: string;
        path: string;
      };
    }>(`/api/workspaces/${workspaceId}/tool-flows`)
  }

  async createToolFlow(workspaceId: string, flow: Partial<ToolFlow>): Promise<ApiResponse<{ toolFlow: ToolFlow }>> {
    return this.makeRequest<{ toolFlow: ToolFlow }>(`/api/workspaces/${workspaceId}/tool-flows`, {
      method: 'POST',
      body: JSON.stringify(flow),
    })
  }

  // ========================================
  // Feedback Steps API
  // ========================================

  async getFeedbackSteps(workspaceId: string): Promise<ApiResponse<{ feedbackSteps: FeedbackStep[] }>> {
    const response = await this.makeRequest<{
      global_steps: Array<{
        id: string;
        name: string;
        description: string;
        template_content: string;
        variable_schema: Record<string, any>;
        is_global: boolean;
      }>;
      workspace_steps: Array<{
        id: string;
        name: string;
        description: string;
        template_content: string;
        variable_schema: Record<string, any>;
        is_global: boolean;
        workspace_id?: string;
      }>;
    }>(`/api/workspaces/${workspaceId}/feedback-steps`);

    if (response.error) {
      return { data: { feedbackSteps: [] }, error: response.error };
    }

    // Map the API response to the expected FeedbackStep format
    const globalSteps = (response.data?.global_steps || []).map(step => ({
      ...step,
      is_global: true,
    }));

    const workspaceSteps = (response.data?.workspace_steps || []).map(step => ({
      ...step,
      is_global: false,
      workspace_id: step.workspace_id,
    }));

    return {
      data: {
        feedbackSteps: [...globalSteps, ...workspaceSteps],
      },
    };
  }

  // ========================================
  // Health Check API
  // ========================================

  async getHealth(): Promise<ApiResponse<HealthStatus>> {
    return this.makeRequest<HealthStatus>('/health')
  }

  // ========================================
  // Server-Sent Events (Real-time Updates)
  // ========================================

  connectSSE(clientId?: string): void {
    if (this.sseConnection) {
      this.disconnectSSE()
    }

    // Use environment variable for SSE URL or construct from base URL
    const envSseUrl = typeof import.meta !== 'undefined' &&
      import.meta.env &&
      import.meta.env.VITE_MCP_SSE_URL
      ? import.meta.env.VITE_MCP_SSE_URL
      : null;

    const sseUrl = envSseUrl || `${this.baseUrl}/mcp`
    const url = `${sseUrl}${clientId ? `?clientId=${clientId}` : ''}`

    console.log(`Connecting to SSE: ${url}`)
    this.sseConnection = new EventSource(url)

    this.sseConnection.onopen = () => {
      console.log('SSE connection opened')
      this.emitEvent('connection.status', { status: 'connected' })
    }

    this.sseConnection.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        this.emitEvent(data.type, data)
      } catch (error) {
        console.error('Failed to parse SSE event:', error)
      }
    }

    this.sseConnection.onerror = (error) => {
      console.error('SSE connection error:', error)
      this.emitEvent('connection.status', { status: 'error', error })
    }
  }

  disconnectSSE(): void {
    if (this.sseConnection) {
      this.sseConnection.close()
      this.sseConnection = null
      this.emitEvent('connection.status', { status: 'disconnected' })
    }
  }

  onSSEEvent(eventType: string, handler: SSEEventHandler): () => void {
    if (!this.sseEventHandlers.has(eventType)) {
      this.sseEventHandlers.set(eventType, new Set())
    }

    this.sseEventHandlers.get(eventType)!.add(handler)

    // Return cleanup function
    return () => {
      const handlers = this.sseEventHandlers.get(eventType)
      if (handlers) {
        handlers.delete(handler)
        if (handlers.size === 0) {
          this.sseEventHandlers.delete(eventType)
        }
      }
    }
  }

  private emitEvent(eventType: string, data: any): void {
    const handlers = this.sseEventHandlers.get(eventType)
    if (handlers) {
      const event: SSEEvent = {
        type: eventType as any,
        data,
        timestamp: new Date().toISOString(),
      }
      handlers.forEach(handler => handler(event))
    }
  }

  // ========================================
  // Cleanup
  // ========================================

  destroy(): void {
    this.disconnectSSE()
    this.sseEventHandlers.clear()
  }
  // Clone a global tool flow to a workspace
  async cloneToolFlow(workspaceId: string, flowId: string): Promise<ApiResponse<{ toolFlow: ToolFlow }>> {
    return this.makeRequest<{ toolFlow: ToolFlow }>(
      `/api/workspaces/${workspaceId}/tool-flows/${flowId}/clone`,
      { method: 'POST' }
    );
  }

  // Delete a global tool flow
  async deleteToolFlow(workspaceId: string, flowId: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.makeRequest<{ success: boolean }>(
      `/api/workspaces/${workspaceId}/tool-flows/${flowId}`,
      { method: 'DELETE' }
    );
  }

  // Fetch feedback steps for all global tool flows
  async getGlobalToolFlowFeedbackSteps(workspaceId: string): Promise<ApiResponse<{ feedbackStepsByFlow: Record<string, any[]> }>> {
    try {
      // First, get all feedback steps
      const response = await this.makeRequest<{ 
        global_steps: Array<{ id: string; name: string }>,
        workspace_steps: Array<{ id: string; name: string }>
      }>(`/api/workspaces/${workspaceId}/feedback-steps`);

      if (response.error) {
        return { data: { feedbackStepsByFlow: {} }, error: response.error };
      }

      // Get all tool flows to map feedback steps to
      const toolFlowsResponse = await this.getToolFlows(workspaceId);
      if (toolFlowsResponse.error) {
        return { data: { feedbackStepsByFlow: {} }, error: toolFlowsResponse.error };
      }

      // Create a map of flowId to its feedback steps
      const feedbackStepsByFlow: Record<string, any[]> = {};
      
      // Initialize with empty arrays for all flows
      toolFlowsResponse.data?.global_flows?.forEach(flow => {
        feedbackStepsByFlow[flow.id] = [];
      });
      toolFlowsResponse.data?.workspace_flows?.forEach(flow => {
        feedbackStepsByFlow[flow.id] = [];
      });

      // Add feedback steps to their respective flows
      const allFeedbackSteps = [
        ...(response.data?.global_steps || []),
        ...(response.data?.workspace_steps || [])
      ];

      // For each flow, find its feedback steps
      Object.keys(feedbackStepsByFlow).forEach(flowId => {
        const flow = [
          ...(toolFlowsResponse.data?.global_flows || []),
          ...(toolFlowsResponse.data?.workspace_flows || [])
        ].find(f => f.id === flowId);

        if (flow?.feedback_step_id) {
          const step = allFeedbackSteps.find(s => s.id === flow.feedback_step_id);
          if (step) {
            feedbackStepsByFlow[flowId] = [{
              id: step.id,
              name: step.name || `Feedback Step ${step.id.slice(0, 6)}`
            }];
          }
        }
      });

      return { data: { feedbackStepsByFlow } };
    } catch (error) {
      console.error('Error in getGlobalToolFlowFeedbackSteps:', error);
      return { data: { feedbackStepsByFlow: {} }, error: 'Failed to fetch feedback steps' };
    }
  }
}

// ========================================
// React Hook for API Client
// ========================================

import { useState, useEffect, useRef } from 'react'

export interface UseApiClientOptions extends ApiClientConfig {
  autoConnectSSE?: boolean
  sseClientId?: string
}

export function useApiClient(options: UseApiClientOptions = {}) {
  const [isConnected, setIsConnected] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const clientRef = useRef<TaskPilotApiClient | null>(null)

  useEffect(() => {
    const client = new TaskPilotApiClient(options)
    clientRef.current = client

    if (options.autoConnectSSE !== false) {
      // Set up connection status monitoring
      const unsubscribe = client.onSSEEvent('connection.status', (event) => {
        setIsConnected(event.data.status === 'connected')
        setConnectionError(event.data.status === 'error' ? event.data.error : null)
      })

      // Connect to SSE
      client.connectSSE(options.sseClientId)

      return () => {
        unsubscribe()
        client.destroy()
      }
    }

    return () => {
      client.destroy()
    }
  }, [])

  return {
    client: clientRef.current,
    isConnected,
    connectionError,
  }
}

// ========================================
// Singleton API Client Instance
// ========================================

// Create API client without automatic SSE connection
export const apiClient = new TaskPilotApiClient({
  // Disable auto-connect by default
  autoConnectSSE: false
})
