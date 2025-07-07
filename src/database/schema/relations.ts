import { relations } from 'drizzle-orm';
import { 
  workspaces, 
  sessions, 
  toolFlows, 
  feedbackSteps 
} from './global-schema.js';

// Define relationships between tables for better query experience

export const workspaceRelations = relations(workspaces, ({ many }) => ({
  sessions: many(sessions),
  toolFlows: many(toolFlows),
  feedbackSteps: many(feedbackSteps)
}));

export const sessionRelations = relations(sessions, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [sessions.workspaceId],
    references: [workspaces.id]
  })
}));

export const toolFlowRelations = relations(toolFlows, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [toolFlows.workspaceId],
    references: [workspaces.id]
  }),
  feedbackStep: one(feedbackSteps, {
    fields: [toolFlows.feedbackStepId],
    references: [feedbackSteps.id]
  })
}));

export const feedbackStepRelations = relations(feedbackSteps, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [feedbackSteps.workspaceId],
    references: [workspaces.id]
  }),
  toolFlows: many(toolFlows)
}));
