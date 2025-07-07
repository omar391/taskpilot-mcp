-- Initial schema for workspace database (tasks, GitHub configs, remote interfaces, workspace tool flows, workspace feedback steps)

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'backlog' CHECK(status IN ('backlog', 'in-progress', 'blocked', 'review', 'done', 'dropped')),
  priority TEXT DEFAULT 'medium' CHECK(priority IN ('high', 'medium', 'low')),
  progress INTEGER DEFAULT 0 CHECK(progress >= 0 AND progress <= 100),
  dependencies TEXT DEFAULT '[]',
  notes TEXT,
  connected_files TEXT DEFAULT '[]',
  github_issue_number INTEGER,
  github_url TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS github_configs (
  id TEXT PRIMARY KEY,
  repo_url TEXT NOT NULL,
  repo_owner TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  github_token TEXT NOT NULL,
  auto_sync INTEGER DEFAULT 0,
  sync_direction TEXT CHECK(sync_direction IN ('bidirectional', 'github_to_taskpilot', 'taskpilot_to_github')) DEFAULT 'bidirectional',
  last_sync TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS remote_interfaces (
  id TEXT PRIMARY KEY,
  interface_type TEXT NOT NULL CHECK(interface_type IN ('github', 'jira', 'linear', 'asana', 'trello', 'custom')),
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  api_token TEXT NOT NULL,
  project_id TEXT,
  sync_enabled INTEGER DEFAULT 1,
  sync_direction TEXT CHECK(sync_direction IN ('bidirectional', 'import_only', 'export_only')) DEFAULT 'bidirectional',
  field_mappings TEXT DEFAULT '[]',
  last_sync TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workspace_tool_flows (
  id TEXT PRIMARY KEY,
  tool_name TEXT NOT NULL,
  description TEXT,
  feedback_step_id TEXT,
  next_tool TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workspace_feedback_steps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  template_content TEXT NOT NULL,
  variable_schema TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for workspace database
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_github_issue_number ON tasks(github_issue_number);
CREATE INDEX IF NOT EXISTS idx_remote_interfaces_type ON remote_interfaces(interface_type);
CREATE INDEX IF NOT EXISTS idx_workspace_tool_flows_tool_name ON workspace_tool_flows(tool_name);
CREATE INDEX IF NOT EXISTS idx_workspace_feedback_steps_name ON workspace_feedback_steps(name);
