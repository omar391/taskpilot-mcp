/**
 * Embedded seed data for TaskPilot initialization
 * Uses Drizzle ORM types for compile-time type safety
 */

import {
  type NewToolFlow,
  type NewFeedbackStep,
  type NewMcpServerMapping,
  type NewToolFlowStep
} from '../database/schema/global-schema.js';

// Tool Flows - Drizzle typed seed data
export const GLOBAL_TOOL_FLOWS_SEED: NewToolFlow[] = [
  {
    id: 'tf_start_001',
    toolName: 'taskpilot_start',
    description: 'Initialize workspace context with comprehensive rules and guidelines',
    feedbackStepId: 'start_feedback',
    nextTool: 'end',
    isGlobal: true
  },
  {
    id: 'tf_init_001',
    toolName: 'taskpilot_init',
    description: 'Initialize new project with workspace structure and rules',
    feedbackStepId: 'init_feedback',
    nextTool: 'taskpilot_start',
    isGlobal: true
  },
  {
    id: 'tf_add_001',
    toolName: 'taskpilot_add',
    description: 'Add new task with analytical validation and creation',
    feedbackStepId: 'task_creation_success',
    nextTool: 'end',
    isGlobal: true
  },
  {
    id: 'tf_status_001',
    toolName: 'taskpilot_status',
    description: 'Analyze project status and provide comprehensive report',
    feedbackStepId: 'status_analysis',
    nextTool: 'end',
    isGlobal: true
  },
  {
    id: 'tf_update_001',
    toolName: 'taskpilot_update',
    description: 'Update task and provide confirmation',
    feedbackStepId: 'task_update_confirmation',
    nextTool: 'end',
    isGlobal: true
  },
  {
    id: 'tf_focus_001',
    toolName: 'taskpilot_focus',
    description: 'Focus on specific task with full context',
    feedbackStepId: 'task_focus_context',
    nextTool: 'end',
    isGlobal: true
  },
  {
    id: 'tf_audit_001',
    toolName: 'taskpilot_audit',
    description: 'Perform comprehensive project audit',
    feedbackStepId: 'audit_analysis',
    nextTool: 'end',
    isGlobal: true
  },
  {
    id: 'tf_github_001',
    toolName: 'taskpilot_github',
    description: 'GitHub integration with validation and task updates',
    feedbackStepId: 'github_validation',
    nextTool: 'taskpilot_update',
    isGlobal: true
  },
  {
    id: 'tf_rule_update_001',
    toolName: 'taskpilot_rule_update',
    description: 'Update workspace rules (no feedback needed)',
    feedbackStepId: null,
    nextTool: 'end',
    isGlobal: true
  },
  {
    id: 'tf_update_resources_001',
    toolName: 'taskpilot_update_resources',
    description: 'Update project documentation resources',
    feedbackStepId: 'update_resources_success',
    nextTool: 'end',
    isGlobal: true
  },
  {
    id: 'tf_update_steps_001',
    toolName: 'taskpilot_update_steps',
    description: 'Update workspace-specific feedback steps',
    feedbackStepId: 'update_steps_success',
    nextTool: 'end',
    isGlobal: true
  }
];

// Feedback Steps - Drizzle typed seed data
export const GLOBAL_FEEDBACK_STEPS_SEED: NewFeedbackStep[] = [
  {
    id: 'fs_analytical_validation',
    name: 'analytical_validation',
    description: 'Apply 6-step analytical thinking framework for task validation',
    templateContent: "Apply the 6-step analytical thinking framework to {{context.task_description}}:\n\n1. **Logical Consistency**: Evaluate statements for internal coherence and contradictions\n2. **Evidence Quality**: Assess the strength and reliability of supporting data/reasoning\n3. **Hidden Assumptions**: Identify unstated premises that may affect outcomes\n4. **Cognitive Biases**: Detect emotional reasoning, confirmation bias, or wishful thinking\n5. **Causal Relationships**: Verify claimed cause-and-effect relationships are valid\n6. **Alternative Perspectives**: Consider competing explanations or approaches\n\nIf validation passes, proceed to call the next tool. If validation fails, provide constructive feedback with specific suggestions for improvement.",
    isGlobal: true
  },
  {
    id: 'fs_post_task_validation',
    name: 'post_task_validation',
    description: 'Quality standards validation after task completion',
    templateContent: "After completing {{context.task_id}}, ensure quality standards:\n\n1. Run all relevant unit tests for modified code\n2. Check code formatting and linting compliance\n3. Verify task progress is accurately recorded (0-100%)\n4. Update connected file list with all modified files\n5. Create git commit with task ID reference\n6. Move completed task to done file\n\nOnly mark task as 100% complete when ALL checks pass. If any checks fail, provide specific remediation steps.",
    isGlobal: true
  },
  {
    id: 'fs_status_analysis',
    name: 'status_analysis',
    description: 'Comprehensive project status analysis and reporting',
    templateContent: "# TaskPilot Status Report for {{context.workspace_name}}\n\n**Workspace:** {{context.workspace_name}}\n**Path:** {{context.workspace_path}}\n**Analysis Time:** {{context.timestamp}}\n\n## Task Distribution\n**Total Tasks:** {{context.task_count}}\n**Average Progress:** {{context.avg_progress}}%\n**Status Breakdown:** {{context.status_breakdown}}\n**Priority Breakdown:** {{context.priority_breakdown}}\n\n## Analysis\n{{context.blocked_count}} blocked tasks require attention.\n{{context.high_priority_count}} high priority tasks need focus.\n\n**Instructions:** Provide comprehensive project status analysis:\n1. Summarize tasks by status (Backlog, In-Progress, Blocked, Review, Done)\n2. Identify rule violations and compliance issues\n3. Highlight overdue or blocked tasks with reasons\n4. Calculate progress metrics and velocity trends\n5. Suggest priority adjustments based on dependencies\n6. Recommend next actions for project advancement\n\nPresent findings in a clear, actionable format with specific recommendations.",
    isGlobal: true
  },
  {
    id: 'fs_task_creation_success',
    name: 'task_creation_success',
    description: 'Confirmation message for successful task creation',
    templateContent: "# Task Created Successfully\n\n**Task ID:** {{context.task_id}}\n**Title:** {{context.task_title}}\n**Description:** {{context.task_description}}\n**Priority:** {{context.priority}}\n**Status:** Backlog\n**Progress:** 0%\n{{context.parent_task_id ? '**Parent Task:** ' + context.parent_task_id + '\\n' : ''}}**Workspace:** {{context.workspace_name}}\n**Created:** {{context.created_at}}\n\nTask has been successfully created and added to the project backlog. The task is ready for development and can be started using `taskpilot_focus {{context.task_id}}`.",
    isGlobal: true
  },
  {
    id: 'fs_audit_analysis',
    name: 'audit_analysis',
    description: 'Thorough project audit analysis and recommendations',
    templateContent: "Perform thorough project audit for {{context.workspace_path}}:\n\n1. Review all task completion verification\n2. Identify orphaned dependencies and broken links\n3. Check for inconsistent task status updates\n4. Verify connected file lists are accurate\n5. Validate git commit references match tasks\n6. Suggest cleanup actions for project health\n\nProvide detailed findings with priority-ranked remediation steps.",
    isGlobal: true
  },
  {
    id: 'fs_github_validation',
    name: 'github_validation',
    description: 'GitHub integration validation and sync checking',
    templateContent: "Validate GitHub integration for {{context.repository_url}}:\n\n1. Verify repository connection and credentials\n2. Check bidirectional sync between tasks and issues\n3. Validate webhook configurations and event handling\n4. Ensure task status updates reflect GitHub changes\n5. Confirm issue creation from tasks is working\n6. Review any sync conflicts or missing data\n\nRecommend corrective actions for any integration issues found.",
    isGlobal: true
  },
  {
    id: 'fs_task_focus_context',
    name: 'task_focus_context',
    description: 'Provide comprehensive context when focusing on a task',
    templateContent: "# Focused on Task: {{context.task_id}}\n\n**Title:** {{context.task_title}}\n**Description:** {{context.task_description}}\n**Priority:** {{context.task_priority}}\n**Status:** {{context.task_status}}\n**Progress:** {{context.task_progress}}%\n{{context.parent_task_id ? '**Parent Task:** ' + context.parent_task_id + '\\n' : ''}}{{context.blocked_by_task ? '**Blocked By:** ' + context.blocked_by_task + '\\n' : ''}}\n**Connected Files:** {{context.connected_files}}\n**Dependencies:** {{context.dependencies_count}} tasks depend on this\n**Subtasks:** {{context.subtasks_count}} subtasks\n\n## Implementation Context\n{{context.notes}}\n\n**Last Updated:** {{context.updated_at}}\n**Workspace:** {{context.workspace_name}}\n\n## Next Steps\nYou are now focused on this task. Use this context to guide your implementation approach. If status was changed to In-Progress, begin working on the requirements. Consider the connected files and dependencies when making changes.",
    isGlobal: true
  },
  {
    id: 'fs_task_update_confirmation',
    name: 'task_update_confirmation',
    description: 'Confirmation message for task updates',
    templateContent: "# Task Updated Successfully\n\n**Task ID:** {{context.task_id}}\n**Task Title:** {{context.task_title}}\n**Field Updated:** {{context.field_updated}}\n**Previous Value:** {{context.old_value}}\n**New Value:** {{context.new_value}}\n**Reason:** {{context.reason}}\n**Updated At:** {{context.updated_at}}\n\n**Current Status:** {{context.task_status}}\n**Current Progress:** {{context.task_progress}}%\n**Workspace:** {{context.workspace_name}}\n\nThe task has been successfully updated with the new {{context.field_updated}} value. All changes are tracked for audit purposes.",
    isGlobal: true
  },
  {
    id: 'fs_remote_interface_result',
    name: 'remote_interface_result',
    description: 'Results and status from remote interface management operations',
    templateContent: "# Remote Interface Management - {{context.action | title}} Action\n\n**Workspace:** {{context.workspace_name}}\n**Action:** {{context.action}}\n{{context.interface_type ? '**Interface Type:** ' + context.interface_type + '\\n' : ''}}\n{{context.mcp_server_name ? '**MCP Server:** ' + context.mcp_server_name + '\\n' : ''}}\n**Timestamp:** {{context.timestamp}}\n\n## Result Summary\n{{context.result.success ? '✅ **SUCCESS**' : '❌ **FAILED**'}}\n\n{{context.result.message ? '**Message:** ' + context.result.message + '\\n\\n' : ''}}\n\n{{context.result.interface ? '**Interface Registered:**\\n' +\n'- **ID:** ' + context.result.interface.id + '\\n' +\n'- **Name:** ' + context.result.interface.name + '\\n' +\n'- **Type:** ' + context.result.interface.interface_type + '\\n' +\n'- **MCP Server:** ' + context.result.interface.mcp_server_name + '\\n\\n' : ''}}\n\n{{context.result.interfaces ? '**Workspace Interfaces:**\\n' +\ncontext.result.interfaces.map(iface => \n'### ' + iface.name + ' (' + iface.type + ')\\n' +\n'- **ID:** ' + iface.id + '\\n' +\n'- **MCP Server:** ' + iface.mcp_server_name + '\\n' +\n'- **Sync:** ' + (iface.sync_enabled ? 'Enabled' : 'Disabled') + '\\n'\\n).join('') + '\\n' : ''}}\n\n{{context.mcp_delegation ? '## 🔗 MCP Server Delegation\\n' +\n'The remote interface is connected and ready. Use the specialized `' + context.mcp_server_name + '` MCP server to perform platform-specific operations while TaskPilot coordinates the workflow.\\n\\n' +\n'**Multi-step Tool Flow:** For complex operations like synchronization, TaskPilot may orchestrate multiple calls to the ' + context.mcp_server_name + ' server through configured tool flows.\\n\\n' : ''}}\n\n**Next Steps:** {{context.action === 'register' && context.result.success ? 'Use the `' + context.mcp_server_name + '` MCP server for platform operations, or test the connection first.' : ''}}\n{{context.action === 'test' && context.result.success ? 'Connection verified! Use the specialized MCP server for platform operations.' : ''}}\n{{context.action === 'list' && context.result.interfaces && context.result.interfaces.length === 0 ? 'No interfaces registered. Use register action to connect platforms.' : ''}}",
    isGlobal: true
  },
  {
    id: 'fs_workspace_context',
    name: 'workspace_context',
    description: 'Comprehensive workspace context with rules and guidelines',
    templateContent: "# 🚀 TaskPilot Workspace Context - {{context.workspace_name}}\n\n**Workspace:** {{context.workspace_name}}\n**Path:** {{context.workspace_path}}\n**Session ID:** {{context.session_id}}\n**Initialized:** {{context.timestamp}}\n\n---\n\n## 📋 STANDARD RULES (Global)\n\n### Core Workflow Principles\n- Always review `./.task/project.md` and both rules files before starting work\n- Check for existing code before creating new functionality\n- Workspace rules override standard rules when conflicts exist\n- Apply Analytical Thinking Framework to all technical decisions\n\n### Task Management\n- Decompose work into individually testable units\n- Structure tasks to deliver incremental value\n- Mark 100% complete only when lint and unit tests pass\n- Update connected file lists with all modified files\n\n### Development Standards\n- Favor pure functions with clear inputs and outputs\n- Always audit existing codebase before creating new implementations\n- Follow established technology stack and architectural patterns\n- Create git commits with task ID references\n\n---\n\n## 🏠 WORKSPACE RULES (Specific)\n\n{{context.workspace_rules ? context.workspace_rules : '_No workspace-specific rules defined yet._'}}\n\n---\n\n## 🧠 ANALYTICAL THINKING FRAMEWORK\n\n**Apply this 6-step framework to all technical decisions:**\n\n1. **Logical Consistency** - Evaluate statements for internal coherence and contradictions\n2. **Evidence Quality** - Assess the strength and reliability of supporting data/reasoning\n3. **Hidden Assumptions** - Identify unstated premises that may affect outcomes\n4. **Cognitive Biases** - Detect emotional reasoning, confirmation bias, or wishful thinking\n5. **Causal Relationships** - Verify claimed cause-and-effect relationships are valid\n6. **Alternative Perspectives** - Consider competing explanations or approaches\n\n**Response Protocol:**\n- Use \"I notice...\" statements for constructive challenges\n- Require concrete justification for technical decisions\n- Question the source and validity of beliefs/requirements\n- Explore strongest version of opposing views\n- Reward self-correction and acknowledge strong reasoning\n\n---\n\n## ⚡ READY FOR COMMANDS\n\nWorkspace is initialized and ready. You now have full context of:\n- ✅ Global development standards and principles\n- ✅ Workspace-specific rules and constraints\n- ✅ Analytical framework for decision-making\n- ✅ Task management and workflow processes\n\n**Next:** Use TaskPilot commands like `taskpilot_add`, `taskpilot_status`, or `taskpilot_focus` to manage your development workflow.",
    isGlobal: true
  },
  {
    id: 'fs_standard_global_rules',
    name: 'standard_global_rules',
    description: 'Base global development rules and standards',
    templateContent: "## Core Workflow Principles\n- Always review `./.task/project.md` and both rules files before starting work\n- Check for existing code before creating new functionality\n- Workspace rules override standard rules when conflicts exist\n- Apply Analytical Thinking Framework to all technical decisions\n\n## Task Management\n- Decompose work into individually testable units\n- Structure tasks to deliver incremental value\n- Mark 100% complete only when lint and unit tests pass\n- Update connected file lists with all modified files\n\n## Development Standards\n- Favor pure functions with clear inputs and outputs\n- Always audit existing codebase before creating new implementations\n- Follow established technology stack and architectural patterns\n- Create git commits with task ID references\n\n## Analytical Thinking Framework\n**Apply this 6-step framework to all technical decisions:**\n1. **Logical Consistency** - Evaluate statements for internal coherence and contradictions\n2. **Evidence Quality** - Assess the strength and reliability of supporting data/reasoning\n3. **Hidden Assumptions** - Identify unstated premises that may affect outcomes\n4. **Cognitive Biases** - Detect emotional reasoning, confirmation bias, or wishful thinking\n5. **Causal Relationships** - Verify claimed cause-and-effect relationships are valid\n6. **Alternative Perspectives** - Consider competing explanations or approaches",
    isGlobal: true
  },
  {
    id: 'fs_init_feedback',
    name: 'init_feedback',
    description: 'Feedback steps for project initialization process',
    templateContent: "Use the following analytic framework steps to ask questions and gather information about the project requirements in a structured and detailed way:\n{{context.analysis_framework_feedback}}\n\nAsk user all detailed questions about the project requirements, architecture, and design decisions. Then after you get the ideal project requirements, you can create/update the \"project.md\" and \"design.md\" resources using \"update_resources\" tool call. Also use `update_steps` tool to update the `workspace_rules_feedback` step.\n\n--\n\nHowever if the project is not empty or the user wants to reinitialize the project, we will follow these steps along with the analysis framework:\n\nFocus on discovering the essential knowledge that would help an AI agents be immediately productive in this codebase. Consider aspects like:\n- The \"big picture\" architecture that requires reading multiple files to understand - major components, service boundaries, data flows, and the \"why\" behind structural decisions\n- Critical developer workflows (builds, tests, debugging) especially commands that aren't obvious from file inspection alone\n- Project-specific conventions and patterns that differ from common practices\n- Integration points, external dependencies, and cross-component communication patterns\n\nSource existing AI conventions from `**/{.github/copilot-instructions.md,AGENT.md,AGENTS.md,CLAUDE.md,.cursorrules,.windsurfrules,.clinerules,.cursor/rules/**,.windsurf/rules/**,.clinerules/**,README.md}` (do one glob search).\n\nGuidelines:\n- If such rules files exist, merge intelligently - collect valuable content while updating outdated sections\n- Write concise, actionable instructions (~20-50 lines) using markdown structure\n- Include specific examples from the codebase when describing patterns\n- Avoid generic advice (\"write tests\", \"handle errors\") - focus on THIS project's specific approaches\n- Document only discoverable patterns, not aspirational practices\n- Reference key files/directories that exemplify important patterns\n\nuse update_workspace_rules tool to update the workspace_rules feedback step.",
    isGlobal: true
  },
  {
    id: 'fs_start_feedback',
    name: 'start_feedback',
    description: 'Feedback for start command with global and workspace rules',
    templateContent: "Our global standard rules are:\n{{context.standard_global_rules}}\n\nAnd the workspace rules are:\n{{context.workspace_rules}}\n\nRemember: workspace rules are more important than global rules, so if there is a conflict, use the workspace rules.",
    isGlobal: true
  },
  {
    id: 'fs_update_resources_success',
    name: 'update_resources_success',
    description: 'Confirmation message for resource file updates',
    templateContent: "# Resource Updated Successfully\n\n**Resource Type:** {{context.resource_type}}\n**Workspace:** {{context.workspace_name}}\n**File Path:** {{context.resource_file_path}}\n**Updated At:** {{context.timestamp}}\n{{context.reason ? '**Reason:** ' + context.reason + '\\n' : ''}}\n\nThe {{context.resource_type}} resource has been successfully updated with the new content. The file is now available in the .taskpilot directory structure.\n\n**Next Steps:** The updated documentation will be available for future TaskPilot operations and can be referenced by other tools and commands.",
    isGlobal: true
  },
  {
    id: 'fs_update_steps_success',
    name: 'update_steps_success',
    description: 'Confirmation message for feedback step updates',
    templateContent: "# Feedback Step Updated Successfully\n\n**Step Name:** {{context.step_name}}\n**Workspace:** {{context.workspace_name}}\n**Updated At:** {{context.timestamp}}\n{{context.reason ? '**Reason:** ' + context.reason + '\\n' : ''}}\n\nThe feedback step '{{context.step_name}}' has been successfully updated in the workspace database. This step will now be used in future tool orchestration and workflow processes.\n\n**Next Steps:** The updated feedback step will be applied automatically in relevant tool flows and will influence how the system provides guidance and validation.",
    isGlobal: true
  }
];

// MCP Server Mappings - Drizzle typed seed data
export const MCP_SERVER_MAPPINGS_SEED: NewMcpServerMapping[] = [
  {
    id: "msm_github_001",
    interfaceType: "github",
    mcpServerName: "github-mcp",
    description: "GitHub MCP Server for repository and issue management",
    isDefault: true
  },
  {
    id: "msm_jira_001",
    interfaceType: "jira",
    mcpServerName: "jira-mcp",
    description: "Jira MCP Server for project and issue tracking",
    isDefault: true
  },
  {
    id: "msm_linear_001",
    interfaceType: "linear",
    mcpServerName: "linear-mcp",
    description: "Linear MCP Server for team issue tracking",
    isDefault: true
  },
  {
    id: "msm_asana_001",
    interfaceType: "asana",
    mcpServerName: "asana-mcp",
    description: "Asana MCP Server for project management",
    isDefault: true
  },
  {
    id: "msm_trello_001",
    interfaceType: "trello",
    mcpServerName: "trello-mcp",
    description: "Trello MCP Server for board management",
    isDefault: true
  },
  {
    id: "msm_custom_001",
    interfaceType: "custom",
    mcpServerName: "custom-rest-mcp",
    description: "Generic REST API MCP Server for custom integrations",
    isDefault: true
  }
];

// Tool Flow Steps - Define actual steps for each tool flow
export const GLOBAL_TOOL_FLOW_STEPS_SEED: NewToolFlowStep[] = [
  // Status tool flow steps
  {
    id: 'step_status_overview',
    toolFlowId: 'tf_status_001',
    stepOrder: 1,
    systemToolFn: 'status_overview',
    feedbackStep: 'status_analysis',
    nextTool: 'end',
    metadata: {
      description: 'Get comprehensive project status overview',
      requiredContext: ['workspace_name', 'workspace_path']
    }
  },
  {
    id: 'step_status_details',
    toolFlowId: 'tf_status_001',
    stepOrder: 2,
    systemToolFn: 'status_details',
    feedbackStep: 'status_analysis',
    nextTool: 'end',
    metadata: {
      description: 'Get detailed task breakdown and metrics',
      requiredContext: ['task_count', 'status_breakdown']
    }
  },
  // Add tool flow steps
  {
    id: 'step_add_validate',
    toolFlowId: 'tf_add_001',
    stepOrder: 1,
    systemToolFn: 'add_task',
    feedbackStep: 'analytical_validation',
    nextTool: 'taskpilot_add',
    metadata: {
      description: 'Validate task description with analytical framework',
      requiredContext: ['task_description', 'workspace_path'],
      stepId: 'validate',
      nextStepId: 'create'
    }
  },
  {
    id: 'step_add_create',
    toolFlowId: 'tf_add_001',
    stepOrder: 2,
    systemToolFn: 'add_task',
    feedbackStep: 'task_creation_success',
    nextTool: 'end',
    metadata: {
      description: 'Create task in database and generate confirmation',
      requiredContext: ['task_title', 'task_description'],
      stepId: 'create'
    }
  },
  // Update tool flow steps
  {
    id: 'step_update_task',
    toolFlowId: 'tf_update_001',
    stepOrder: 1,
    systemToolFn: 'update_task',
    feedbackStep: 'task_update_confirmation',
    nextTool: 'end',
    metadata: {
      description: 'Update task field and provide confirmation',
      requiredContext: ['task_id', 'field_updated', 'new_value']
    }
  },
  // Focus tool flow steps
  {
    id: 'step_focus_task',
    toolFlowId: 'tf_focus_001',
    stepOrder: 1,
    systemToolFn: 'focus_task',
    feedbackStep: 'task_focus_context',
    nextTool: 'end',
    metadata: {
      description: 'Focus on specific task with full context',
      requiredContext: ['task_id', 'task_title', 'task_status']
    }
  },
  // Audit tool flow steps
  {
    id: 'step_audit_tasks',
    toolFlowId: 'tf_audit_001',
    stepOrder: 1,
    systemToolFn: 'audit_tasks',
    feedbackStep: 'audit_analysis',
    nextTool: 'end',
    metadata: {
      description: 'Perform comprehensive project audit',
      requiredContext: ['workspace_path', 'task_count']
    }
  },
  // Init tool flow steps
  {
    id: 'step_init_project',
    toolFlowId: 'tf_init_001',
    stepOrder: 1,
    systemToolFn: 'init_project',
    feedbackStep: 'init_feedback',
    nextTool: 'taskpilot_start',
    metadata: {
      description: 'Initialize project structure and rules',
      requiredContext: ['project_requirements', 'workspace_path']
    }
  },
  // Start tool flow steps
  {
    id: 'step_start_workspace',
    toolFlowId: 'tf_start_001',
    stepOrder: 1,
    systemToolFn: 'start_workspace',
    feedbackStep: 'start_feedback',
    nextTool: 'end',
    metadata: {
      description: 'Initialize workspace context with rules',
      requiredContext: ['workspace_name', 'workspace_path']
    }
  }
];
