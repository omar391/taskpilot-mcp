import { DatabaseManager } from '../database/connection.js';
import { PromptOrchestrator } from '../services/prompt-orchestrator.js';
import { z } from 'zod';

// Schema for GitHub tool arguments
export const githubToolSchema = z.object({
  workspace_id: z.string().describe('Workspace ID to perform GitHub operations on'),
  action: z.enum(['connect', 'sync', 'create_issue', 'update_from_pr', 'disconnect', 'status'])
    .describe('GitHub action to perform'),
  github_token: z.string().optional().describe('GitHub personal access token (required for connect)'),
  repo_url: z.string().optional().describe('GitHub repository URL (required for connect)'),
  task_id: z.string().optional().describe('Task ID for creating GitHub issues'),
  issue_number: z.number().optional().describe('GitHub issue number for operations'),
  pr_number: z.number().optional().describe('GitHub pull request number for updates'),
  auto_sync: z.boolean().optional().describe('Enable automatic synchronization')
});

interface GitHubToolArgs {
  workspace_id: string;
  action: 'connect' | 'sync' | 'create_issue' | 'update_from_pr' | 'disconnect' | 'status';
  github_token?: string;
  repo_url?: string;
  task_id?: string;
  issue_number?: number;
  pr_number?: number;
  auto_sync?: boolean;
}

interface GitHubConfig {
  id: string;
  workspace_id: string;
  repo_url: string;
  repo_owner: string;
  repo_name: string;
  github_token: string;
  auto_sync: boolean;
  last_sync: string | null;
  sync_direction: 'bidirectional' | 'github_to_taskpilot' | 'taskpilot_to_github';
  created_at: string;
  updated_at: string;
}

interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: string[];
  assignee?: string;
  created_at: string;
  updated_at: string;
  url: string;
}

interface GitHubPullRequest {
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed' | 'merged';
  head_ref: string;
  base_ref: string;
  created_at: string;
  updated_at: string;
  url: string;
}

export class GitHubTool {
  private db: DatabaseManager;
  private promptOrchestrator: PromptOrchestrator;

  constructor(db: DatabaseManager) {
    this.db = db;
    this.promptOrchestrator = new PromptOrchestrator(db);
  }

  /**
   * Get tool definition for MCP server
   */
  static getToolDefinition() {
    return {
      name: 'taskpilot_github',
      description: 'Integrate TaskPilot workspace with GitHub repository for bidirectional task and issue synchronization',
      inputSchema: {
        type: 'object',
        properties: {
          workspace_id: {
            type: 'string',
            description: 'Workspace ID to perform GitHub operations on'
          },
          action: {
            type: 'string',
            enum: ['connect', 'sync', 'create_issue', 'update_from_pr', 'disconnect', 'status'],
            description: 'GitHub action to perform: connect (link repository), sync (bidirectional sync), create_issue (create GitHub issue from task), update_from_pr (update task from PR), disconnect (remove integration), status (show connection info)'
          },
          github_token: {
            type: 'string',
            description: 'GitHub personal access token (required for connect action)'
          },
          repo_url: {
            type: 'string',
            description: 'GitHub repository URL in format https://github.com/owner/repo (required for connect action)'
          },
          task_id: {
            type: 'string',
            description: 'Task ID for creating GitHub issues (required for create_issue action)'
          },
          issue_number: {
            type: 'number',
            description: 'GitHub issue number for operations (required for specific issue operations)'
          },
          pr_number: {
            type: 'number',
            description: 'GitHub pull request number for task updates (required for update_from_pr action)'
          },
          auto_sync: {
            type: 'boolean',
            description: 'Enable automatic synchronization between GitHub and TaskPilot (optional for connect action)',
            default: false
          }
        },
        required: ['workspace_id', 'action']
      }
    };
  }

  async execute(args: GitHubToolArgs): Promise<any> {
    try {
      // Validate workspace exists
      const workspace = await this.db.get<any>(
        'SELECT * FROM workspaces WHERE id = ?',
        [args.workspace_id]
      );

      if (!workspace) {
        return {
          content: [{
            type: 'text',
            text: 'Error: Workspace not found'
          }],
          isError: true
        };
      }

      let actionResult;
      switch (args.action) {
        case 'connect':
          actionResult = await this.connectRepository(args);
          break;
        case 'sync':
          actionResult = await this.syncWithGitHub(args.workspace_id);
          break;
        case 'create_issue':
          actionResult = await this.createGitHubIssue(args);
          break;
        case 'update_from_pr':
          actionResult = await this.updateFromPullRequest(args);
          break;
        case 'disconnect':
          actionResult = await this.disconnectRepository(args.workspace_id);
          break;
        case 'status':
          actionResult = await this.getGitHubStatus(args.workspace_id);
          break;
        default:
          throw new Error(`Unknown action: ${args.action}`);
      }

      // Prepare context for prompt orchestration
      const context = {
        workspace_id: args.workspace_id,
        workspace_name: workspace.name,
        workspace_path: workspace.path,
        action: args.action,
        result: actionResult,
        timestamp: new Date().toISOString()
      };

      // Get orchestrated prompt response
      const orchestrationResult = await this.promptOrchestrator.orchestratePrompt(
        'taskpilot_github',
        args.workspace_id,
        context
      );

      return {
        content: [{
          type: 'text',
          text: orchestrationResult.prompt_text
        }]
      };
    } catch (error) {
      console.error('Error in taskpilot_github:', error);
      return {
        content: [{
          type: 'text',
          text: `Error in GitHub integration: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  /**
   * Connect a GitHub repository to the workspace
   */
  private async connectRepository(args: GitHubToolArgs): Promise<any> {
    if (!args.github_token || !args.repo_url) {
      throw new Error('GitHub token and repository URL are required for connection');
    }

    // Parse repository URL to extract owner and name
    const repoMatch = args.repo_url.match(/github\.com\/([^\/]+)\/([^\/]+)(?:\.git)?$/);
    if (!repoMatch) {
      throw new Error('Invalid GitHub repository URL format');
    }

    const [, owner, name] = repoMatch;
    
    // Validate GitHub token and repository access
    const validationResult = await this.validateGitHubAccess(args.github_token, owner, name);
    if (!validationResult.valid) {
      throw new Error(`GitHub validation failed: ${validationResult.error}`);
    }

    // Check if repository is already connected
    const existingConfig = await this.db.get<any>(
      'SELECT * FROM github_configs WHERE workspace_id = ?',
      [args.workspace_id]
    );

    if (existingConfig) {
      // Update existing configuration
      await this.db.run(
        `UPDATE github_configs SET 
         repo_url = ?, repo_owner = ?, repo_name = ?, github_token = ?, 
         auto_sync = ?, updated_at = ?
         WHERE workspace_id = ?`,
        [args.repo_url, owner, name, args.github_token, args.auto_sync || false, new Date().toISOString(), args.workspace_id]
      );
    } else {
      // Create new configuration
      const configId = `gh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await this.db.run(
        `INSERT INTO github_configs 
         (id, workspace_id, repo_url, repo_owner, repo_name, github_token, auto_sync, sync_direction, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          configId, args.workspace_id, args.repo_url, owner, name, 
          args.github_token, args.auto_sync || false, 'bidirectional',
          new Date().toISOString(), new Date().toISOString()
        ]
      );
    }

    return {
      success: true,
      repository: {
        url: args.repo_url,
        owner,
        name,
        auto_sync: args.auto_sync || false
      },
      message: 'Repository connected successfully'
    };
  }

  /**
   * Sync tasks with GitHub issues and pull requests
   */
  private async syncWithGitHub(workspaceId: string): Promise<any> {
    const config = await this.getGitHubConfig(workspaceId);
    if (!config) {
      throw new Error('No GitHub repository connected to this workspace');
    }

    const syncResults = {
      issues_synced: 0,
      tasks_created: 0,
      tasks_updated: 0,
      issues_created: 0,
      issues_updated: 0,
      errors: [] as string[]
    };

    try {
      // Sync GitHub issues to TaskPilot tasks
      if (config.sync_direction === 'bidirectional' || config.sync_direction === 'github_to_taskpilot') {
        const issuesSyncResult = await this.syncIssuestoTasks(config);
        syncResults.issues_synced = issuesSyncResult.synced;
        syncResults.tasks_created = issuesSyncResult.created;
        syncResults.tasks_updated = issuesSyncResult.updated;
        syncResults.errors.push(...issuesSyncResult.errors);
      }

      // Sync TaskPilot tasks to GitHub issues
      if (config.sync_direction === 'bidirectional' || config.sync_direction === 'taskpilot_to_github') {
        const tasksSyncResult = await this.syncTasksToIssues(config);
        syncResults.issues_created = tasksSyncResult.created;
        syncResults.issues_updated = tasksSyncResult.updated;
        syncResults.errors.push(...tasksSyncResult.errors);
      }

      // Update last sync timestamp
      await this.db.run(
        'UPDATE github_configs SET last_sync = ? WHERE workspace_id = ?',
        [new Date().toISOString(), workspaceId]
      );

      return {
        success: true,
        sync_results: syncResults,
        last_sync: new Date().toISOString()
      };
    } catch (error) {
      syncResults.errors.push(error instanceof Error ? error.message : 'Unknown sync error');
      return {
        success: false,
        sync_results: syncResults,
        error: error instanceof Error ? error.message : 'Sync failed'
      };
    }
  }

  /**
   * Create GitHub issue from TaskPilot task
   */
  private async createGitHubIssue(args: GitHubToolArgs): Promise<any> {
    if (!args.task_id) {
      throw new Error('Task ID is required to create GitHub issue');
    }

    const config = await this.getGitHubConfig(args.workspace_id);
    if (!config) {
      throw new Error('No GitHub repository connected to this workspace');
    }

    const task = await this.db.get<any>(
      'SELECT * FROM tasks WHERE id = ? AND workspace_id = ?',
      [args.task_id, args.workspace_id]
    );

    if (!task) {
      throw new Error('Task not found');
    }

    // Check if task already has a GitHub issue
    if (task.github_issue_number) {
      throw new Error(`Task already linked to GitHub issue #${task.github_issue_number}`);
    }

    try {
      const issueData = {
        title: task.title,
        body: this.formatTaskForGitHub(task),
        labels: this.getLabelsFromTask(task)
      };

      const issue = await this.createGitHubIssueAPI(config, issueData);

      // Update task with GitHub issue reference
      await this.db.run(
        'UPDATE tasks SET github_issue_number = ?, github_url = ?, updated_at = ? WHERE id = ?',
        [issue.number, issue.url, new Date().toISOString(), args.task_id]
      );

      return {
        success: true,
        issue: {
          number: issue.number,
          title: issue.title,
          url: issue.url
        },
        task_id: args.task_id
      };
    } catch (error) {
      throw new Error(`Failed to create GitHub issue: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update task status based on pull request
   */
  private async updateFromPullRequest(args: GitHubToolArgs): Promise<any> {
    if (!args.pr_number) {
      throw new Error('Pull request number is required');
    }

    const config = await this.getGitHubConfig(args.workspace_id);
    if (!config) {
      throw new Error('No GitHub repository connected to this workspace');
    }

    try {
      const pr = await this.getGitHubPullRequestAPI(config, args.pr_number);
      
      // Find tasks that reference this PR in their connected files or description
      const tasks = await this.db.all<any>(
        `SELECT * FROM tasks WHERE workspace_id = ? AND 
         (description LIKE ? OR notes LIKE ? OR connected_files LIKE ?)`,
        [
          args.workspace_id,
          `%#${args.pr_number}%`,
          `%#${args.pr_number}%`,
          `%${pr.head_ref}%`
        ]
      ) as any[];

      const updateResults = [];

      for (const task of tasks) {
        let newStatus = task.status;
        let newProgress = task.progress;

        // Update status based on PR state
        if (pr.state === 'merged') {
          newStatus = 'Done';
          newProgress = 100;
        } else if (pr.state === 'open' && task.status === 'Backlog') {
          newStatus = 'In-Progress';
          newProgress = Math.max(newProgress, 25);
        }

        if (newStatus !== task.status || newProgress !== task.progress) {
          await this.db.run(
            'UPDATE tasks SET status = ?, progress = ?, updated_at = ? WHERE id = ?',
            [newStatus, newProgress, new Date().toISOString(), task.id]
          );

          updateResults.push({
            task_id: task.id,
            task_title: task.title,
            old_status: task.status,
            new_status: newStatus,
            old_progress: task.progress,
            new_progress: newProgress
          });
        }
      }

      return {
        success: true,
        pull_request: {
          number: pr.number,
          title: pr.title,
          state: pr.state,
          url: pr.url
        },
        tasks_updated: updateResults
      };
    } catch (error) {
      throw new Error(`Failed to update from pull request: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Disconnect GitHub repository
   */
  private async disconnectRepository(workspaceId: string): Promise<any> {
    const config = await this.getGitHubConfig(workspaceId);
    if (!config) {
      throw new Error('No GitHub repository connected to this workspace');
    }

    // Remove GitHub references from tasks
    await this.db.run(
      'UPDATE tasks SET github_issue_number = NULL, github_url = NULL WHERE workspace_id = ?',
      [workspaceId]
    );

    // Delete GitHub configuration
    await this.db.run(
      'DELETE FROM github_configs WHERE workspace_id = ?',
      [workspaceId]
    );

    return {
      success: true,
      message: 'GitHub repository disconnected successfully'
    };
  }

  /**
   * Get GitHub integration status
   */
  private async getGitHubStatus(workspaceId: string): Promise<any> {
    const config = await this.getGitHubConfig(workspaceId);
    
    if (!config) {
      return {
        connected: false,
        message: 'No GitHub repository connected'
      };
    }

    // Get linked tasks count
    const linkedTasksCount = await this.db.get<any>(
      'SELECT COUNT(*) as count FROM tasks WHERE workspace_id = ? AND github_issue_number IS NOT NULL',
      [workspaceId]
    );

    return {
      connected: true,
      repository: {
        url: config.repo_url,
        owner: config.repo_owner,
        name: config.repo_name
      },
      sync_direction: config.sync_direction,
      auto_sync: config.auto_sync,
      last_sync: config.last_sync,
      linked_tasks: linkedTasksCount?.count || 0
    };
  }

  // Helper methods for GitHub API interactions
  private async validateGitHubAccess(token: string, owner: string, repo: string): Promise<{valid: boolean; error?: string}> {
    try {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (response.ok) {
        return { valid: true };
      } else {
        const error = await response.text();
        return { valid: false, error: `GitHub API error: ${response.status} ${error}` };
      }
    } catch (error) {
      return { valid: false, error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  private async getGitHubConfig(workspaceId: string): Promise<GitHubConfig | null> {
    const result = await this.db.get<GitHubConfig>(
      'SELECT * FROM github_configs WHERE workspace_id = ?',
      [workspaceId]
    );
    return result || null;
  }

  private formatTaskForGitHub(task: any): string {
    let body = task.description || '';
    
    if (task.priority) {
      body += `\n\n**Priority:** ${task.priority}`;
    }
    
    if (task.dependencies) {
      body += `\n\n**Dependencies:** ${task.dependencies}`;
    }
    
    if (task.connected_files) {
      try {
        const files = JSON.parse(task.connected_files);
        if (files.length > 0) {
          body += `\n\n**Connected Files:**\n${files.map((f: string) => `- ${f}`).join('\n')}`;
        }
      } catch (error) {
        // Ignore invalid JSON
      }
    }
    
    body += `\n\n---\n*Created from TaskPilot task ${task.id}*`;
    
    return body;
  }

  private getLabelsFromTask(task: any): string[] {
    const labels = [];
    
    if (task.priority) {
      labels.push(`priority-${task.priority.toLowerCase()}`);
    }
    
    if (task.status) {
      labels.push(`status-${task.status.toLowerCase().replace(/\s+/g, '-')}`);
    }
    
    labels.push('taskpilot');
    
    return labels;
  }

  private async createGitHubIssueAPI(config: GitHubConfig, issueData: any): Promise<GitHubIssue> {
    const response = await fetch(`https://api.github.com/repos/${config.repo_owner}/${config.repo_name}/issues`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${config.github_token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(issueData)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GitHub API error: ${response.status} ${error}`);
    }

    const issue = await response.json();
    return {
      number: issue.number,
      title: issue.title,
      body: issue.body,
      state: issue.state,
      labels: issue.labels.map((l: any) => l.name),
      assignee: issue.assignee?.login,
      created_at: issue.created_at,
      updated_at: issue.updated_at,
      url: issue.html_url
    };
  }

  private async getGitHubPullRequestAPI(config: GitHubConfig, prNumber: number): Promise<GitHubPullRequest> {
    const response = await fetch(`https://api.github.com/repos/${config.repo_owner}/${config.repo_name}/pulls/${prNumber}`, {
      headers: {
        'Authorization': `token ${config.github_token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GitHub API error: ${response.status} ${error}`);
    }

    const pr = await response.json();
    return {
      number: pr.number,
      title: pr.title,
      body: pr.body,
      state: pr.merged ? 'merged' : pr.state,
      head_ref: pr.head.ref,
      base_ref: pr.base.ref,
      created_at: pr.created_at,
      updated_at: pr.updated_at,
      url: pr.html_url
    };
  }

  private async syncIssuestoTasks(config: GitHubConfig): Promise<{synced: number; created: number; updated: number; errors: string[]}> {
    const result = { synced: 0, created: 0, updated: 0, errors: [] as string[] };
    
    try {
      // Get all open issues from GitHub
      const response = await fetch(`https://api.github.com/repos/${config.repo_owner}/${config.repo_name}/issues?state=open`, {
        headers: {
          'Authorization': `token ${config.github_token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch issues: ${response.status}`);
      }

      const issues = await response.json();

      for (const issue of issues) {
        try {
          // Skip pull requests (they appear as issues in GitHub API)
          if (issue.pull_request) {
            continue;
          }

          // Check if task already exists for this issue
          const existingTask = await this.db.get<any>(
            'SELECT * FROM tasks WHERE workspace_id = ? AND github_issue_number = ?',
            [config.workspace_id, issue.number]
          );

          if (existingTask) {
            // Update existing task
            await this.db.run(
              'UPDATE tasks SET title = ?, description = ?, updated_at = ? WHERE id = ?',
              [issue.title, issue.body || '', new Date().toISOString(), existingTask.id]
            );
            result.updated++;
          } else {
            // Create new task
            const taskId = `TP-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
            await this.db.run(
              `INSERT INTO tasks (id, workspace_id, title, description, priority, status, progress, 
               github_issue_number, github_url, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                taskId, config.workspace_id, issue.title, issue.body || '', 'Medium', 'Backlog', 0,
                issue.number, issue.html_url, new Date().toISOString(), new Date().toISOString()
              ]
            );
            result.created++;
          }
          result.synced++;
        } catch (error) {
          result.errors.push(`Issue #${issue.number}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    } catch (error) {
      result.errors.push(`Sync issues failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  private async syncTasksToIssues(config: GitHubConfig): Promise<{created: number; updated: number; errors: string[]}> {
    const result = { created: 0, updated: 0, errors: [] as string[] };
    
    try {
      // Get tasks that don't have GitHub issues yet
      const tasks = await this.db.all<any>(
        'SELECT * FROM tasks WHERE workspace_id = ? AND github_issue_number IS NULL AND status != ?',
        [config.workspace_id, 'Done']
      ) as any[];

      for (const task of tasks) {
        try {
          const issueData = {
            title: task.title,
            body: this.formatTaskForGitHub(task),
            labels: this.getLabelsFromTask(task)
          };

          const issue = await this.createGitHubIssueAPI(config, issueData);

          // Update task with GitHub issue reference
          await this.db.run(
            'UPDATE tasks SET github_issue_number = ?, github_url = ?, updated_at = ? WHERE id = ?',
            [issue.number, issue.url, new Date().toISOString(), task.id]
          );

          result.created++;
        } catch (error) {
          result.errors.push(`Task ${task.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    } catch (error) {
      result.errors.push(`Sync tasks failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }
}
