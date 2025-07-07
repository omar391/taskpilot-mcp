-- TaskPilot MCP Server Database Schema
-- SQLite3 database for task management and prompt orchestration
-- Supports dual database architecture: global and workspace-specific databases

-- @global-only
-- Workspaces table - tracks project workspaces (GLOBAL ONLY)
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  path TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_activity DATETIME,
  is_active BOOLEAN DEFAULT 0
);

-- Sessions table - tracks active LLM sessions per workspace (GLOBAL ONLY)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT 1
);

-- Global tool flows table - global workflow sequences (GLOBAL ONLY)
CREATE TABLE IF NOT EXISTS tool_flows (
  id TEXT PRIMARY KEY,
  tool_name TEXT NOT NULL,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE, -- NULL for global flows
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Global tool flow steps table - individual steps in workflow sequences (GLOBAL ONLY)
CREATE TABLE IF NOT EXISTS tool_flow_steps (
  id TEXT PRIMARY KEY,
  tool_flow_id TEXT NOT NULL REFERENCES tool_flows(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  system_tool_fn TEXT NOT NULL,
  feedback_step TEXT, -- references feedback_steps.name
  next_tool TEXT, -- next tool name or "end"
  UNIQUE(tool_flow_id, step_order)
);

-- Global feedback steps table - instruction templates for LLM guidance (GLOBAL ONLY)
CREATE TABLE IF NOT EXISTS feedback_steps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  instructions TEXT NOT NULL,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE, -- NULL for global feedback steps
  metadata TEXT DEFAULT '{}', -- JSON metadata
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(name, workspace_id)
);

-- MCP server mappings table - predefined mappings of interface types to MCP server names (GLOBAL ONLY)
CREATE TABLE IF NOT EXISTS mcp_server_mappings (
  id TEXT PRIMARY KEY,
  interface_type TEXT NOT NULL CHECK(interface_type IN ('github', 'jira', 'linear', 'asana', 'trello', 'custom')),
  mcp_server_name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
-- @end

-- @workspace-only
-- Tasks table - replaces ./.task/todo/*.md files (WORKSPACE ONLY)
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT CHECK(priority IN ('High', 'Medium', 'Low')) DEFAULT 'Medium',
  status TEXT CHECK(status IN ('Backlog', 'In-Progress', 'Blocked', 'Review', 'Done', 'Dropped')) DEFAULT 'Backlog',
  progress INTEGER DEFAULT 0 CHECK(progress >= 0 AND progress <= 100),
  parent_task_id TEXT REFERENCES tasks(id),
  blocked_by_task_id TEXT REFERENCES tasks(id),
  connected_files TEXT DEFAULT '[]', -- JSON array of file paths
  notes TEXT,
  github_issue_number INTEGER, -- GitHub issue number for sync
  github_url TEXT, -- GitHub issue/PR URL
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

-- GitHub configurations table - GitHub repository integration settings (WORKSPACE ONLY)
CREATE TABLE IF NOT EXISTS github_configs (
  id TEXT PRIMARY KEY,
  repo_url TEXT NOT NULL,
  repo_owner TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  github_token TEXT NOT NULL,
  auto_sync BOOLEAN DEFAULT 0,
  sync_direction TEXT CHECK(sync_direction IN ('bidirectional', 'github_to_taskpilot', 'taskpilot_to_github')) DEFAULT 'bidirectional',
  last_sync DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Remote interfaces table - Generic external task management platform integrations (WORKSPACE ONLY)
CREATE TABLE IF NOT EXISTS remote_interfaces (
  id TEXT PRIMARY KEY,
  interface_type TEXT NOT NULL CHECK(interface_type IN ('github', 'jira', 'linear', 'asana', 'trello', 'custom')),
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  api_token TEXT NOT NULL,
  project_id TEXT, -- Platform-specific project identifier
  sync_enabled BOOLEAN DEFAULT 1,
  sync_direction TEXT CHECK(sync_direction IN ('bidirectional', 'import_only', 'export_only')) DEFAULT 'bidirectional',
  field_mappings TEXT DEFAULT '[]', -- JSON array of field mappings
  last_sync DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Workspace-specific tool flows table (WORKSPACE ONLY)
CREATE TABLE IF NOT EXISTS workspace_tool_flows (
  id TEXT PRIMARY KEY,
  tool_name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Workspace-specific tool flow steps table (WORKSPACE ONLY)
CREATE TABLE IF NOT EXISTS workspace_tool_flow_steps (
  id TEXT PRIMARY KEY,
  tool_flow_id TEXT NOT NULL REFERENCES workspace_tool_flows(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  system_tool_fn TEXT NOT NULL,
  feedback_step TEXT, -- references workspace_feedback_steps.name
  next_tool TEXT, -- next tool name or "end"
  UNIQUE(tool_flow_id, step_order)
);

-- Workspace-specific feedback steps table (WORKSPACE ONLY)
CREATE TABLE IF NOT EXISTS workspace_feedback_steps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  instructions TEXT NOT NULL,
  metadata TEXT DEFAULT '{}', -- JSON metadata
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
-- @end

-- @global-only
-- Indexes for performance (GLOBAL ONLY)
CREATE INDEX IF NOT EXISTS idx_sessions_workspace_id ON sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_tool_flows_workspace_id ON tool_flows(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tool_flows_tool_name ON tool_flows(tool_name);
CREATE INDEX IF NOT EXISTS idx_feedback_steps_workspace_id ON feedback_steps(workspace_id);
CREATE INDEX IF NOT EXISTS idx_feedback_steps_name ON feedback_steps(name);
CREATE INDEX IF NOT EXISTS idx_mcp_server_mappings_interface_type ON mcp_server_mappings(interface_type);
CREATE INDEX IF NOT EXISTS idx_mcp_server_mappings_default ON mcp_server_mappings(is_default);
-- @end

-- @workspace-only
-- Indexes for performance (WORKSPACE ONLY)
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_github_issue_number ON tasks(github_issue_number);
CREATE INDEX IF NOT EXISTS idx_remote_interfaces_type ON remote_interfaces(interface_type);
CREATE INDEX IF NOT EXISTS idx_workspace_tool_flows_tool_name ON workspace_tool_flows(tool_name);
CREATE INDEX IF NOT EXISTS idx_workspace_feedback_steps_name ON workspace_feedback_steps(name);
-- @end

-- @global-only
-- Triggers to update timestamps (GLOBAL ONLY)
CREATE TRIGGER IF NOT EXISTS update_workspaces_updated_at
  AFTER UPDATE ON workspaces
  BEGIN
    UPDATE workspaces SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS update_tool_flows_updated_at
  AFTER UPDATE ON tool_flows
  BEGIN
    UPDATE tool_flows SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS update_feedback_steps_updated_at
  AFTER UPDATE ON feedback_steps
  BEGIN
    UPDATE feedback_steps SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS update_mcp_server_mappings_updated_at
  AFTER UPDATE ON mcp_server_mappings
  BEGIN
    UPDATE mcp_server_mappings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

-- Trigger to update session last_activity
CREATE TRIGGER IF NOT EXISTS update_session_activity
  AFTER UPDATE ON sessions
  BEGIN
    UPDATE sessions SET last_activity = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;
-- @end

-- @workspace-only
-- Triggers to update timestamps (WORKSPACE ONLY)
CREATE TRIGGER IF NOT EXISTS update_tasks_updated_at
  AFTER UPDATE ON tasks
  BEGIN
    UPDATE tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS update_workspace_tool_flows_updated_at
  AFTER UPDATE ON workspace_tool_flows
  BEGIN
    UPDATE workspace_tool_flows SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS update_workspace_feedback_steps_updated_at
  AFTER UPDATE ON workspace_feedback_steps
  BEGIN
    UPDATE workspace_feedback_steps SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;
-- @end