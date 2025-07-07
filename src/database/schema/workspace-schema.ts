import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Workspace-specific database tables - stored in {workspace}/.taskpilot/task.db

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status', {
    enum: ['backlog', 'in-progress', 'blocked', 'review', 'done', 'dropped']
  }).default('backlog'),
  priority: text('priority', {
    enum: ['high', 'medium', 'low']
  }).default('medium'),
  progress: integer('progress').default(0),
  dependencies: text('dependencies', { mode: 'json' }).default([]),
  notes: text('notes'),
  connectedFiles: text('connected_files', { mode: 'json' }).default([]),
  githubIssueNumber: integer('github_issue_number'),
  githubUrl: text('github_url'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
  completedAt: text('completed_at')
});

export const githubConfigs = sqliteTable('github_configs', {
  id: text('id').primaryKey(),
  repoUrl: text('repo_url').notNull(),
  repoOwner: text('repo_owner').notNull(),
  repoName: text('repo_name').notNull(),
  githubToken: text('github_token').notNull(),
  autoSync: integer('auto_sync', { mode: 'boolean' }).default(false),
  syncDirection: text('sync_direction', {
    enum: ['bidirectional', 'github_to_taskpilot', 'taskpilot_to_github']
  }).default('bidirectional'),
  lastSync: text('last_sync'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

export const remoteInterfaces = sqliteTable('remote_interfaces', {
  id: text('id').primaryKey(),
  interfaceType: text('interface_type', {
    enum: ['github', 'jira', 'linear', 'asana', 'trello', 'custom']
  }).notNull(),
  name: text('name').notNull(),
  baseUrl: text('base_url').notNull(),
  apiToken: text('api_token').notNull(),
  projectId: text('project_id'),
  syncEnabled: integer('sync_enabled', { mode: 'boolean' }).default(true),
  syncDirection: text('sync_direction', {
    enum: ['bidirectional', 'import_only', 'export_only']
  }).default('bidirectional'),
  fieldMappings: text('field_mappings', { mode: 'json' }).default([]),
  lastSync: text('last_sync'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

export const workspaceToolFlows = sqliteTable('workspace_tool_flows', {
  id: text('id').primaryKey(),
  toolName: text('tool_name').notNull(),
  description: text('description'),
  feedbackStepId: text('feedback_step_id'),
  nextTool: text('next_tool'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

export const workspaceFeedbackSteps = sqliteTable('workspace_feedback_steps', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  templateContent: text('template_content').notNull(),
  variableSchema: text('variable_schema', { mode: 'json' }).default({}),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

// Export types for use in other files
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type GithubConfig = typeof githubConfigs.$inferSelect;
export type NewGithubConfig = typeof githubConfigs.$inferInsert;
export type RemoteInterface = typeof remoteInterfaces.$inferSelect;
export type NewRemoteInterface = typeof remoteInterfaces.$inferInsert;
export type WorkspaceToolFlow = typeof workspaceToolFlows.$inferSelect;
export type NewWorkspaceToolFlow = typeof workspaceToolFlows.$inferInsert;
export type WorkspaceFeedbackStep = typeof workspaceFeedbackSteps.$inferSelect;
export type NewWorkspaceFeedbackStep = typeof workspaceFeedbackSteps.$inferInsert;
