/**
 * API Types and Interfaces for TaskPilot REST API
 */

// Common response wrapper
export interface ApiResponse<T = any> {
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

// Workspace types
export interface WorkspaceSummary {
  id: string;
  name: string;
  path: string;
  status: 'connected' | 'disconnected' | 'error';
  last_activity: string;
  task_count: number;
  active_task: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspacesResponse {
  workspaces: WorkspaceSummary[];
}

// Task types
export interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Backlog' | 'In-Progress' | 'Blocked' | 'Review' | 'Done' | 'Dropped';
  progress: number;
  parent_task_id: string | null;
  blocked_by_task_id: string | null;
  connected_files: string[];
  notes: string | null;
  github_issue_number: number | null;
  github_url: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface TasksResponse {
  tasks: Task[];
  workspace: {
    id: string;
    name: string;
    path: string;
  };
  total: number;
  page: number;
}

export interface CreateTaskRequest {
  title: string;
  description: string;
  priority: 'High' | 'Medium' | 'Low';
  parent_task_id?: string | null;
}

export interface UpdateTaskRequest {
  field: 'title' | 'description' | 'priority' | 'status' | 'progress' | 'notes';
  value: string | number;
  reason: string;
}

// Tool Flow types
export interface ToolFlowStep {
  id: string;
  step_order: number;
  system_tool_fn: string;
  feedback_step: string | null;
  next_tool: string | null;
}

export interface ToolFlow {
  id: string;
  tool_name: string;
  workspace_id?: string;
  steps: ToolFlowStep[];
  created_at: string;
  updated_at: string;
}

export interface ToolFlowsResponse {
  global_flows: ToolFlow[];
  workspace_flows: ToolFlow[];
  available_tools: string[];
  workspace: {
    id: string;
    name: string;
    path: string;
  };
}

// Feedback Step types
export interface FeedbackStep {
  id: string;
  name: string;
  instructions: string;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceRule {
  id: string;
  category: string;
  type: 'never' | 'always' | 'remember' | "don't" | 'preference';
  content: string;
  confidence: number;
  created_at: string;
}

export interface FeedbackStepsResponse {
  global_steps: FeedbackStep[];
  workspace_steps: FeedbackStep[];
  workspace_rules: WorkspaceRule[];
  workspace: {
    id: string;
    name: string;
    path: string;
  };
}

// SSE Event types
export interface WorkspaceStatusChangedEvent {
  type: 'workspace.status_changed';
  data: {
    workspace_id: string;
    status: 'connected' | 'disconnected' | 'error';
    last_activity: string;
  };
}

export interface TaskUpdatedEvent {
  type: 'task.updated';
  data: {
    workspace_id: string;
    task: {
      id: string;
      status: string;
      progress: number;
      updated_at: string;
    };
  };
}

export interface TaskCreatedEvent {
  type: 'task.created';
  data: {
    workspace_id: string;
    task: {
      id: string;
      title: string;
      status: string;
      created_at: string;
    };
  };
}

export type SSEEvent = WorkspaceStatusChangedEvent | TaskUpdatedEvent | TaskCreatedEvent;

// Query parameters
export interface TasksQueryParams {
  status?: 'current' | 'history';
  limit?: number;
  offset?: number;
}

export interface ToolFlowsQueryParams {
  type?: 'global' | 'workspace' | 'all';
}

export interface FeedbackStepsQueryParams {
  type?: 'global' | 'workspace' | 'all';
}
