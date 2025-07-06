import type { DatabaseManager } from '../database/connection.js';
import type { PromptOrchestrationResult, ToolFlow, FeedbackStep } from '../types/index.js';
import { SeedManager } from './seed-manager.js';

export class PromptOrchestrator {
  private seedManager: SeedManager;

  constructor(private db: DatabaseManager) {
    this.seedManager = new SeedManager(db);
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

      // Get the first step in the flow
      const firstStep = toolFlow.flow_steps.find(step => step.step_order === 1);
      if (!firstStep) {
        throw new Error(`No steps found in tool flow for '${toolName}'`);
      }

      // Generate prompt based on step configuration
      let promptText = await this.generateStepPrompt(firstStep, workspaceId, args);

      // If there's a feedback step, include its instructions
      if (firstStep.feedback_step) {
        const feedbackStep = await this.seedManager.getFeedbackStep(
          firstStep.feedback_step,
          workspaceId
        );
        
        if (feedbackStep) {
          promptText += `\n\n**FEEDBACK STEP INSTRUCTIONS:**\n${feedbackStep.instructions}`;
        }
      }

      return {
        prompt_text: promptText,
        next_tool: firstStep.next_tool === 'end' ? undefined : firstStep.next_tool,
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
   * Generate prompt text for a specific tool flow step
   */
  private async generateStepPrompt(
    step: any,
    workspaceId: string,
    args: Record<string, any>
  ): Promise<string> {
    const { system_tool_fn } = step;

    switch (system_tool_fn) {
      case 'taskpilot_start':
        return this.generateStartPrompt(workspaceId, args);
      
      case 'taskpilot_init':
        return this.generateInitPrompt(workspaceId, args);
      
      case 'taskpilot_add':
        return this.generateAddPrompt(workspaceId, args);
      
      case 'taskpilot_create_task':
        return this.generateCreateTaskPrompt(workspaceId, args);
      
      case 'taskpilot_status':
        return this.generateStatusPrompt(workspaceId, args);
      
      case 'taskpilot_update':
        return this.generateUpdatePrompt(workspaceId, args);
      
      case 'taskpilot_focus':
        return this.generateFocusPrompt(workspaceId, args);
      
      case 'taskpilot_audit':
        return this.generateAuditPrompt(workspaceId, args);
      
      case 'taskpilot_github':
        return this.generateGithubPrompt(workspaceId, args);
      
      case 'taskpilot_rule_update':
        return this.generateRuleUpdatePrompt(workspaceId, args);
      
      default:
        return `Execute system function: ${system_tool_fn}`;
    }
  }

  /**
   * Generate workspace session initiation prompt
   */
  private async generateStartPrompt(workspaceId: string, args: Record<string, any>): Promise<string> {
    const workspacePath = args.workspace_path || 'current directory';
    
    // Get workspace info
    const workspace = await this.db.get<any>(
      'SELECT * FROM workspaces WHERE path = ?',
      [workspacePath]
    );

    // Get active tasks
    const activeTasks = await this.db.all<any>(
      `SELECT * FROM tasks 
       WHERE workspace_id = ? AND status IN ('In-Progress', 'Blocked', 'Review')
       ORDER BY priority DESC, updated_at DESC`,
      [workspaceId]
    );

    // Get workspace rules (if any)
    const workspaceRules = await this.seedManager.getFeedbackStep('workspace_rules', workspaceId);

    let prompt = `# TaskPilot Session Initiated

**Workspace:** ${workspacePath}
**Session ID:** ${workspaceId}
**Timestamp:** ${new Date().toISOString()}

## Current Project Context

`;

    if (workspace) {
      prompt += `- **Project Name:** ${workspace.name}
- **Last Activity:** ${workspace.last_activity || 'Never'}
- **Workspace Status:** ${workspace.is_active ? 'Active' : 'Inactive'}

`;
    }

    if (activeTasks.length > 0) {
      prompt += `## Active Tasks (${activeTasks.length})

`;
      activeTasks.forEach(task => {
        prompt += `### ${task.id}: ${task.title}
- **Status:** ${task.status}
- **Priority:** ${task.priority}
- **Progress:** ${task.progress}%
- **Description:** ${task.description || 'No description'}

`;
      });
    } else {
      prompt += `## No Active Tasks
All tasks are either completed or in backlog. Use \`taskpilot_status\` to see full task overview.

`;
    }

    if (workspaceRules) {
      prompt += `## Workspace Rules
${workspaceRules.instructions}

`;
    }

    prompt += `## Next Steps
You are now connected to the TaskPilot workspace. You can:
- Use \`taskpilot_status\` for complete project overview
- Use \`taskpilot_add\` to create new tasks
- Use \`taskpilot_focus\` to work on specific tasks
- Use \`taskpilot_update\` to modify existing tasks

**The TaskPilot session is now active and ready for task management.**`;

    return prompt;
  }

  /**
   * Generate project initialization prompt
   */
  private async generateInitPrompt(workspaceId: string, args: Record<string, any>): Promise<string> {
    const requirements = args.project_requirements || 'No specific requirements provided';
    const techStack = args.tech_stack || 'No tech stack specified';
    const workspacePath = args.workspace_path || 'current directory';
    const projectName = args.project_name || 'TaskPilot Project';
    const initializationComplete = args.initialization_complete || false;
    const createdTasks = args.created_tasks || [];
    
    if (initializationComplete) {
      // Project has been initialized, provide completion summary
      let prompt = `# TaskPilot Project Initialization Complete

**Project:** ${projectName}
**Workspace:** ${workspacePath}
**Technology Stack:** ${techStack}
**Requirements:** ${requirements}

## Initialization Summary

✅ **Workspace Configuration**
- Project workspace created and configured
- Workspace tracking system initialized
- Session management activated

✅ **Task Structure Created**
- ${createdTasks.length} initial tasks created
- Task dependencies and priorities established
- Project breakdown structure initialized

✅ **Standard Rules Established**
- Global development practices activated
- Workspace-specific rules configured for ${techStack}
- Quality assurance processes established

✅ **Analytical Framework Configured**
- 6-step validation workflows activated
- Feedback step instructions configured
- Task orchestration system ready

## Initial Tasks Created

`;

      if (createdTasks.length > 0) {
        createdTasks.forEach((task: any, index: number) => {
          prompt += `${index + 1}. **${task.id}: ${task.title}**
   - Priority: ${task.priority}
   - Status: ${task.status}
   - Description: ${task.description}

`;
        });
      }

      prompt += `## Next Steps

The TaskPilot project is fully initialized and ready for development. You can now:

1. **Review Tasks**: Use \`taskpilot_status\` to see the complete task overview
2. **Start Development**: Use \`taskpilot_focus [Task ID]\` to begin work on specific tasks
3. **Add New Tasks**: Use \`taskpilot_add [description]\` to create additional tasks
4. **Update Progress**: Use \`taskpilot_update\` to modify task status and progress

**Project initialization successful. TaskPilot is ready for active development.**`;

      return prompt;
    } else {
      // Provide initialization instructions (this shouldn't normally happen with the new flow)
      return `# TaskPilot Project Initialization

Initialize a new TaskPilot project with the following requirements:

**Project Name:** ${projectName}
**Workspace:** ${workspacePath}
**Technology Stack:** ${techStack}
**Requirements:** ${requirements}

## Initialization Process

The TaskPilot initialization process will:

1. **Create Workspace Configuration**
   - Set up project metadata and workspace tracking
   - Initialize task tracking system
   - Configure default workflow patterns

2. **Establish Development Rules**
   - Copy standard development practices
   - Set up ${techStack}-specific guidelines
   - Configure coding standards and workflows

3. **Initialize Task Structure**
   - Create initial project breakdown tasks
   - Set up task dependencies and priorities
   - Establish project milestones

4. **Configure Quality Framework**
   - Set up validation workflows
   - Configure feedback step instructions
   - Establish quality assurance processes

The initialization process has been completed automatically.`;
    }
  }

  /**
   * Generate task creation workflow prompt
   */
  private async generateAddPrompt(workspaceId: string, args: Record<string, any>): Promise<string> {
    const description = args.description || args.task_description || 'No description provided';
    
    return `# Task Creation Workflow

**Task Description:** ${description}

## Task Analysis Required

Before creating this task, analyze the following aspects:

### 1. Task Decomposition
- Break down the task into clear, actionable components
- Identify dependencies on existing tasks or external requirements
- Determine appropriate task scope and complexity

### 2. Priority Assessment
- Evaluate task urgency and importance
- Consider project timeline and resource constraints
- Assess impact on project goals and deliverables

### 3. Technical Validation
- Verify technical feasibility and approach
- Identify required tools, frameworks, or dependencies
- Consider potential technical risks or blockers

### 4. Resource Planning
- Estimate effort and time requirements
- Identify required skills or expertise
- Plan file organization and code structure

## Quality Standards
- Ensure task is testable and has clear acceptance criteria
- Define measurable progress indicators
- Establish completion verification steps

Once analysis is complete and validation passes, proceed to create the task using \`taskpilot_create_task\`.`;
  }

  /**
   * Generate direct task creation prompt
   */
  private async generateCreateTaskPrompt(workspaceId: string, args: Record<string, any>): Promise<string> {
    // This is a direct action, not a workflow step
    return `Task creation executed. Task details have been processed and stored in the TaskPilot database.`;
  }

  /**
   * Generate status analysis prompt
   */
  private async generateStatusPrompt(workspaceId: string, args: Record<string, any>): Promise<string> {
    return `# Project Status Analysis

Generate a comprehensive status report for the current workspace including:

## Task Summary
- Count and categorize all tasks by status (Backlog, In-Progress, Blocked, Review, Done, Dropped)
- Calculate overall project completion percentage
- Identify velocity trends and progress patterns

## Priority Analysis
- High priority tasks and their current status
- Overdue or stalled tasks requiring attention
- Upcoming deadlines and milestone dependencies

## Health Indicators
- Rule compliance and quality metrics
- Blocked tasks and dependency issues
- Resource utilization and bottlenecks

## Recommendations
- Suggested next actions for project advancement
- Priority adjustments based on current state
- Process improvements and optimization opportunities

Provide actionable insights to guide project decision-making.`;
  }

  /**
   * Generate task update prompt
   */
  private async generateUpdatePrompt(workspaceId: string, args: Record<string, any>): Promise<string> {
    const target = args.target || 'unspecified target';
    const updates = args.updates || args.changes || 'No updates specified';
    
    return `# Task Update Request

**Target:** ${target}
**Updates:** ${updates}

## Update Validation

Verify the following before applying changes:

### 1. Change Impact Assessment
- Evaluate effects on dependent tasks and project timeline
- Consider implications for connected files and code
- Assess priority and status change justifications

### 2. Data Integrity
- Ensure updated information is accurate and complete
- Validate progress percentages and status transitions
- Confirm dependency relationships remain valid

### 3. Audit Trail
- Document reasons for changes
- Update modification timestamps
- Maintain change history for accountability

### 4. Quality Standards
- Verify changes align with project rules and standards
- Check completion criteria are still achievable
- Ensure task remains properly scoped and defined

Apply updates only after validation confirms they improve project organization and progress.`;
  }

  /**
   * Generate task focus prompt
   */
  private async generateFocusPrompt(workspaceId: string, args: Record<string, any>): Promise<string> {
    const taskId = args.task_id || 'No task specified';
    
    return `# Task Focus Mode

**Target Task:** ${taskId}

## Implementation Context

Prepare for focused work on the specified task:

### 1. Task Context Review
- Analyze task requirements and acceptance criteria
- Review connected files and code dependencies
- Understand parent task relationships and constraints

### 2. Implementation Planning
- Break down task into actionable development steps
- Identify required tools and development environment setup
- Plan testing and validation approaches

### 3. Progress Tracking
- Set up progress milestones and checkpoints
- Configure file tracking for modifications
- Establish completion verification criteria

### 4. Quality Assurance
- Review applicable coding standards and workspace rules
- Plan code review and testing procedures
- Ensure adherence to project quality guidelines

Begin focused implementation with clear understanding of task scope and quality expectations.`;
  }

  /**
   * Generate audit workflow prompt
   */
  private async generateAuditPrompt(workspaceId: string, args: Record<string, any>): Promise<string> {
    return `# Project Audit Workflow

Execute comprehensive project health assessment:

## Task Verification
- Review all task completion claims and verification
- Identify orphaned dependencies and broken task links
- Check for inconsistent status updates or progress claims

## File System Audit
- Verify connected file lists are accurate and up-to-date
- Check for missing or incorrectly referenced files
- Validate git commit references match task requirements

## Quality Compliance
- Assess adherence to project rules and coding standards
- Review test coverage and documentation completeness
- Evaluate task decomposition and scope appropriateness

## Data Integrity
- Check database consistency and referential integrity
- Validate timestamp accuracy and change tracking
- Ensure workspace configuration is properly maintained

## Recommendations
- Prioritize identified issues by severity and impact
- Suggest cleanup actions and process improvements
- Recommend preventive measures for future quality maintenance

Provide detailed findings with actionable remediation steps.`;
  }

  /**
   * Generate GitHub integration prompt
   */
  private async generateGithubPrompt(workspaceId: string, args: Record<string, any>): Promise<string> {
    const action = args.action || 'sync';
    
    return `# GitHub Integration Workflow

**Action:** ${action}

## Integration Operations

Execute GitHub synchronization and management:

### 1. Repository Connection
- Verify GitHub repository connection and authentication
- Check repository permissions and access rights
- Validate webhook configurations for real-time sync

### 2. Bidirectional Synchronization
- Sync TaskPilot tasks with GitHub issues
- Update task status based on GitHub PR/issue changes
- Create GitHub issues from TaskPilot tasks when requested

### 3. Change Tracking
- Monitor GitHub events and update relevant tasks
- Track commit references and link to task progress
- Maintain synchronization state and conflict resolution

### 4. Validation and Reporting
- Verify sync integrity and data consistency
- Report any sync conflicts or missing data
- Provide status updates on integration health

Ensure seamless integration between TaskPilot task management and GitHub project tracking.`;
  }

  /**
   * Generate rule update prompt
   */
  private async generateRuleUpdatePrompt(workspaceId: string, args: Record<string, any>): Promise<string> {
    const feedback = args.user_feedback || args.feedback || 'No feedback provided';
    
    return `# Workspace Rules Update

**User Feedback:** ${feedback}

## Rule Detection and Update

Process user feedback for dynamic rule learning:

### 1. Trigger Phrase Analysis
- Scan feedback for rule trigger phrases: "never", "always", "remember", "don't", "do not"
- Extract actionable guidelines and preferences
- Categorize rules by scope and importance

### 2. Rule Formulation
- Convert feedback into clear, actionable workspace rules
- Ensure rules are specific and consistently applicable
- Avoid conflicts with existing workspace or global rules

### 3. Workspace Rules Integration
- Update workspace "workspace_rules" feedback step
- Maintain rule organization and readability
- Preserve rule history and evolution tracking

### 4. Validation and Application
- Verify rule clarity and actionability
- Test rule application in current workspace context
- Ensure rules enhance rather than hinder productivity

Updated workspace rules will be automatically applied to future task workflows and LLM guidance.`;
  }
}