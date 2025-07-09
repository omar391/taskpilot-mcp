import { sqliteTable, text, integer, blob } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Global database tables - stored in ~/.taskpilot/global.db

export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  path: text('path').notNull().unique(),
  name: text('name').notNull(),
  status: text('status', { 
    enum: ['active', 'idle', 'inactive', 'disconnected', 'error'] 
  }).default('disconnected'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
  lastActivity: text('last_activity'),
  taskCount: integer('task_count').default(0),
  activeTask: text('active_task')
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  lastActivity: text('last_activity').default(sql`CURRENT_TIMESTAMP`),
  isActive: integer('is_active', { mode: 'boolean' }).default(true)
});

export const toolFlows = sqliteTable('tool_flows', {
  id: text('id').primaryKey(),
  toolName: text('tool_name').notNull(),
  description: text('description'),
  feedbackStepId: text('feedback_step_id'),
  nextTool: text('next_tool'),
  isGlobal: integer('is_global', { mode: 'boolean' }).default(true),
  workspaceId: text('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

export const feedbackSteps = sqliteTable('feedback_steps', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  templateContent: text('template_content').notNull(),
  variableSchema: text('variable_schema', { mode: 'json' }).default({}),
  isGlobal: integer('is_global', { mode: 'boolean' }).default(true),
  workspaceId: text('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

export const toolFlowSteps = sqliteTable('tool_flow_steps', {
  id: text('id').primaryKey(),
  toolFlowId: text('tool_flow_id')
    .notNull()
    .references(() => toolFlows.id, { onDelete: 'cascade' }),
  stepOrder: integer('step_order').notNull(),
  systemToolFn: text('system_tool_fn').notNull(),
  feedbackStep: text('feedback_step'),
  nextTool: text('next_tool'),
  metadata: text('metadata', { mode: 'json' }).default({}),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

export const mcpServerMappings = sqliteTable('mcp_server_mappings', {
  id: text('id').primaryKey(),
  interfaceType: text('interface_type', { 
    enum: ['github', 'jira', 'linear', 'asana', 'trello', 'custom'] 
  }).notNull(),
  mcpServerName: text('mcp_server_name').notNull(),
  description: text('description'),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

// Export types for use in other files
export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type ToolFlow = typeof toolFlows.$inferSelect;
export type NewToolFlow = typeof toolFlows.$inferInsert;
export type ToolFlowStep = typeof toolFlowSteps.$inferSelect;
export type NewToolFlowStep = typeof toolFlowSteps.$inferInsert;
export type FeedbackStep = typeof feedbackSteps.$inferSelect;
export type NewFeedbackStep = typeof feedbackSteps.$inferInsert;
export type McpServerMapping = typeof mcpServerMappings.$inferSelect;
export type NewMcpServerMapping = typeof mcpServerMappings.$inferInsert;
