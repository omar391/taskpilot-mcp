import type { DrizzleDatabaseManager } from '../database/drizzle-connection.js';
import type { PromptOrchestrationResult, ToolFlow, FeedbackStep } from '../types/index.js';
import { SeedManager } from './seed-manager.js';
import { NextStepTemplateGenerator } from './next-step-generator.js';
import { ToolNames } from '../constants/tool-names.js';

export class PromptOrchestrator {
  private seedManager: SeedManager;
  private nextStepGenerator: NextStepTemplateGenerator;

  constructor(private drizzleDb: DrizzleDatabaseManager) {
    // Pure TypeScript approach - use DrizzleDatabaseManager directly
    this.seedManager = new SeedManager(drizzleDb);
    this.nextStepGenerator = new NextStepTemplateGenerator(drizzleDb);
  }

  /**
   * Orchestrate prompt generation for a tool call
   */
  async orchestratePrompt(
    toolName: string,
    workspaceId: string,
    args: Record<string, any> = {}
  ): Promise<PromptOrchestrationResult> {
    try {
      // Get tool flow (workspace-specific or fallback to global)
      const toolFlow = await this.seedManager.getToolFlow(toolName, workspaceId);
      
      if (!toolFlow) {
        throw new Error(`Tool flow for '${toolName}' not found`);
      }

      // Note: Current schema doesn't have flow_steps as a direct property
      // This may need to be refactored to load steps separately or use relations
      // For now, treat each tool flow as having basic step information
      const feedbackStepId = toolFlow.feedbackStepId;

      // Generate basic prompt for the tool
      let promptText = await this.generateBasicPrompt(toolName, args);

      // If there's a feedback step, include its instructions with context substitution
      if (feedbackStepId) {
        const feedbackStep = await this.seedManager.getFeedbackStep(
          feedbackStepId,
          workspaceId
        );
        
        if (feedbackStep) {
          // Replace context variables in feedback step instructions
          // Note: Using templateContent instead of instructions for new schema
          const contextualInstructions = this.replaceContextVariables(
            feedbackStep.templateContent,
            this.buildContext(args, workspaceId)
          );
          
          promptText += `\n\n**FEEDBACK STEP INSTRUCTIONS:**\n${contextualInstructions}`;
        }
      }

      return {
        prompt_text: promptText,
        next_tool: (toolFlow.nextTool && toolFlow.nextTool !== 'end') ? toolFlow.nextTool : undefined,
        session_data: {
          current_tool: toolName,
          current_step: 1,
          tool_flow_id: toolFlow.id,
          workspace_id: workspaceId
        }
      };
    } catch (error) {
      console.error('Error orchestrating prompt:', error);
      throw error;
    }
  }

  /**
   * Generate basic prompt text for a tool
   */
  private async generateBasicPrompt(
    toolName: string,
    args: Record<string, any>
  ): Promise<string> {
    switch (toolName) {
      case ToolNames.START: // 'taskpilot_start'
        return `# TaskPilot Session Started\n\n` +
               `Workspace: ${args.workspace_path || 'current directory'}\n` +
               `Session ready for task management.`;

      case ToolNames.INIT: // 'taskpilot_init'
        return `# TaskPilot Project Initialization\n\n` +
               `Project: ${args.project_name || 'TaskPilot Project'}\n` +
               `Workspace: ${args.workspace_path || 'current directory'}\n` +
               `Tech Stack: ${args.tech_stack || 'Not specified'}\n` +
               `Requirements: ${args.project_requirements || 'No specific requirements'}\n\n` +
               `Ready to initialize project structure and rules.`;

      case ToolNames.ADD: // 'taskpilot_add'
        return `# Task Creation Workflow\n\n` +
               `Task Description: ${args.description || args.task_description || 'No description provided'}\n\n` +
               `Ready to validate and create task.`;

      case 'taskpilot_create_task':
        return `Task creation executed. Task details processed and stored.`;

      case ToolNames.STATUS: // 'taskpilot_status'
        return `# Project Status Analysis\n\n` +
               `Generate comprehensive status report for the current workspace.`;

      case ToolNames.UPDATE: // 'taskpilot_update'
        return `# Task Update Request\n\n` +
               `Target: ${args.target || 'unspecified target'}\n` +
               `Updates: ${args.updates || args.changes || 'No updates specified'}\n\n` +
               `Ready to apply changes.`;

      case ToolNames.FOCUS: // 'taskpilot_focus'
        return `# Task Focus Mode\n\n` +
               `Target Task: ${args.task_id || 'No task specified'}\n\n` +
               `Ready to begin focused work on specified task.`;

      case ToolNames.AUDIT: // 'taskpilot_audit'
        return `# Project Audit Workflow\n\n` +
               `Execute comprehensive project health assessment.`;

      case ToolNames.GITHUB: // 'taskpilot_github'
        return `# GitHub Integration Workflow\n\n` +
               `Action: ${args.action || 'sync'}\n\n` +
               `Ready to execute GitHub synchronization and management.`;

      case ToolNames.RULE_UPDATE: // 'taskpilot_rule_update'
        return `# Workspace Rules Update\n\n` +
               `User Feedback: ${args.user_feedback || args.feedback || 'No feedback provided'}\n\n` +
               `Ready to process rule updates from user feedback.`;

      default:
        return `Execute system function: ${toolName}`;
    }
  }

  /**
   * Build context object for variable substitution
   */
  private buildContext(args: Record<string, any>, workspaceId: string): Record<string, string> {
    return {
      workspace_path: args.workspace_path || 'current directory',
      workspace_id: workspaceId,
      workspace_name: args.workspace_name || 'TaskPilot Project',
      task_description: args.description || args.task_description || 'No description',
      task_id: args.task_id || 'Unknown task',
      task_title: args.task_title || 'Untitled Task',
      task_priority: args.priority || 'Medium',
      task_status: args.task_status || 'Backlog',
      task_progress: args.task_progress?.toString() || '0',
      repository_url: args.repository_url || 'No repository specified',
      timestamp: new Date().toISOString(),
      created_at: args.created_at || new Date().toISOString(),
      updated_at: args.updated_at || new Date().toISOString(),
      project_name: args.project_name || 'TaskPilot Project',
      tech_stack: args.tech_stack || 'Not specified',
      workspace_rules: args.workspace_rules || '',
      session_id: args.session_id || 'unknown',
      parent_task_id: args.parent_task_id || '',
      connected_files: args.connected_files || '',
      notes: args.notes || '',
      field_updated: args.field_updated || '',
      old_value: args.old_value || '',
      new_value: args.new_value || '',
      reason: args.reason || ''
    };
  }

  /**
   * Generate dynamic next step instructions instead of hardcoded text
   */
  async generateNextStepInstructions(
    toolName: string,
    currentStepId?: string,
    workspaceId?: string,
    context?: string
  ): Promise<string> {
    try {
      const nextStepInstruction = await this.nextStepGenerator.generateNextStepInstructions(
        toolName,
        currentStepId,
        workspaceId,
        context
      );

      if (nextStepInstruction) {
        return nextStepInstruction.instructionText;
      }

      // Fallback to completion instructions
      const completionInstruction = await this.nextStepGenerator.generateCompletionInstructions(
        toolName,
        workspaceId,
        context
      );

      return completionInstruction.instructionText;
    } catch (error) {
      console.error('Error generating next step instructions:', error);
      // Fallback to basic instruction
      return `Continue with ${toolName} workflow as needed.`;
    }
  }

  /**
   * Replace {{context.variable}} placeholders with actual values
   */
  private replaceContextVariables(
    text: string,
    context: Record<string, string>
  ): string {
    let result = text;
    
    // Replace {{context.variable}} patterns
    for (const [key, value] of Object.entries(context)) {
      const pattern = new RegExp(`{{context\\.${key}}}`, 'g');
      result = result.replace(pattern, value);
    }
    
    return result;
  }
}
