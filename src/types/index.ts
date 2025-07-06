export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Backlog' | 'In-Progress' | 'Blocked' | 'Review' | 'Done' | 'Dropped';
  progress: number;
  parent_task_id?: string;
  blocked_by_task_id?: string;
  connected_files: string[];
  notes?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface Workspace {
  id: string;
  path: string;
  name: string;
  created_at: string;
  updated_at: string;
  last_activity?: string;
  is_active: boolean;
}

export interface Session {
  id: string;
  workspace_id: string;
  created_at: string;
  last_activity: string;
  is_active: boolean;
}

export interface ToolFlow {
  id: string;
  tool_name: string;
  workspace_id?: string; // null for global flows
  flow_steps: ToolFlowStep[];
  created_at: string;
  updated_at: string;
}

export interface ToolFlowStep {
  id: string;
  tool_flow_id: string;
  step_order: number;
  system_tool_fn: string;
  feedback_step?: string;
  next_tool?: string;
}

export interface FeedbackStep {
  id: string;
  name: string;
  instructions: string;
  workspace_id?: string; // null for global feedback steps
  metadata: FeedbackStepMetadata;
  created_at: string;
  updated_at: string;
}

export interface FeedbackStepMetadata {
  category: string;
  timeout_minutes: number;
  required_for: string[];
  [key: string]: any;
}

export interface GlobalSeedData {
  global_tool_flows: GlobalToolFlow[];
  global_feedback_steps: GlobalFeedbackStep[];
}

export interface GlobalToolFlow {
  tool_name: string;
  flow_steps: GlobalToolFlowStep[];
}

export interface GlobalToolFlowStep {
  step_order: number;
  system_tool_fn: string;
  feedback_step?: string;
  next_tool?: string;
}

export interface GlobalFeedbackStep {
  name: string;
  instructions: string;
  metadata: FeedbackStepMetadata;
}

export interface PromptOrchestrationResult {
  prompt_text: string;
  next_tool?: string;
  session_data?: any;
}

export interface TaskPilotToolResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

export interface MCPToolResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}