-- TaskPilot MCP Server Database Schema
-- SQLite3 database for task management and prompt orchestration

-- Workspaces table - tracks project workspaces
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  path TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_activity DATETIME,
  is_active BOOLEAN DEFAULT 0
);

-- Sessions table - tracks active LLM sessions per workspace
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT 1
);

-- Tasks table - replaces ./.task/todo/*.md files
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
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

-- Tool flows table - configurable workflow sequences
CREATE TABLE IF NOT EXISTS tool_flows (
  id TEXT PRIMARY KEY,
  tool_name TEXT NOT NULL,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE, -- NULL for global flows
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tool flow steps table - individual steps in workflow sequences
CREATE TABLE IF NOT EXISTS tool_flow_steps (
  id TEXT PRIMARY KEY,
  tool_flow_id TEXT NOT NULL REFERENCES tool_flows(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  system_tool_fn TEXT NOT NULL,
  feedback_step TEXT, -- references feedback_steps.name
  next_tool TEXT, -- next tool name or "end"
  UNIQUE(tool_flow_id, step_order)
);

-- Feedback steps table - instruction templates for LLM guidance
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_workspace_id ON tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_sessions_workspace_id ON sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_tool_flows_workspace_id ON tool_flows(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tool_flows_tool_name ON tool_flows(tool_name);
CREATE INDEX IF NOT EXISTS idx_feedback_steps_workspace_id ON feedback_steps(workspace_id);
CREATE INDEX IF NOT EXISTS idx_feedback_steps_name ON feedback_steps(name);

-- Triggers to update timestamps
CREATE TRIGGER IF NOT EXISTS update_workspaces_updated_at
  AFTER UPDATE ON workspaces
  BEGIN
    UPDATE workspaces SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS update_tasks_updated_at
  AFTER UPDATE ON tasks
  BEGIN
    UPDATE tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
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

-- Trigger to update workspace last_activity on task changes
CREATE TRIGGER IF NOT EXISTS update_workspace_activity_on_task_change
  AFTER UPDATE ON tasks
  BEGIN
    UPDATE workspaces SET last_activity = CURRENT_TIMESTAMP WHERE id = NEW.workspace_id;
  END;

-- Trigger to update session last_activity
CREATE TRIGGER IF NOT EXISTS update_session_activity
  AFTER UPDATE ON sessions
  BEGIN
    UPDATE sessions SET last_activity = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;