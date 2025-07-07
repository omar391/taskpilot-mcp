-- Initial schema for global database (workspaces, sessions, tool flows, feedback steps, MCP server mappings)

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  path TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'disconnected' CHECK (status IN ('active', 'idle', 'inactive', 'disconnected', 'error')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_activity TEXT,
  task_count INTEGER DEFAULT 0,
  active_task TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_activity TEXT DEFAULT CURRENT_TIMESTAMP,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS tool_flows (
  id TEXT PRIMARY KEY,
  tool_name TEXT NOT NULL,
  description TEXT,
  feedback_step_id TEXT,
  next_tool TEXT,
  is_global INTEGER DEFAULT 1,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS feedback_steps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  template_content TEXT NOT NULL,
  variable_schema TEXT DEFAULT '{}',
  is_global INTEGER DEFAULT 1,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mcp_server_mappings (
  id TEXT PRIMARY KEY,
  interface_type TEXT NOT NULL CHECK(interface_type IN ('github', 'jira', 'linear', 'asana', 'trello', 'custom')),
  mcp_server_name TEXT NOT NULL,
  description TEXT,
  is_default INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for global database
CREATE INDEX IF NOT EXISTS idx_sessions_workspace_id ON sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_tool_flows_workspace_id ON tool_flows(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tool_flows_tool_name ON tool_flows(tool_name);
CREATE INDEX IF NOT EXISTS idx_feedback_steps_workspace_id ON feedback_steps(workspace_id);
CREATE INDEX IF NOT EXISTS idx_feedback_steps_name ON feedback_steps(name);
CREATE INDEX IF NOT EXISTS idx_mcp_server_mappings_interface_type ON mcp_server_mappings(interface_type);
CREATE INDEX IF NOT EXISTS idx_mcp_server_mappings_default ON mcp_server_mappings(is_default);
