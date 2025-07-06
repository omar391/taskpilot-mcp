import { v4 as uuidv4 } from 'uuid';
import type { DatabaseManager } from '../database/connection.js';
import type { Task } from '../types/index.js';
import { SeedManager } from './seed-manager.js';

// Database representation of Task (with JSON fields as strings)
interface DatabaseTask {
  id: string;
  title: string;
  description?: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Backlog' | 'In-Progress' | 'Blocked' | 'Review' | 'Done' | 'Dropped';
  progress: number;
  parent_task_id?: string;
  blocked_by_task_id?: string;
  connected_files: string; // JSON string in database
  notes?: string;
  workspace_id: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface ProjectInitializationInput {
  workspace_path: string;
  project_requirements: string;
  tech_stack: string;
  project_name: string;
}

export interface ProjectInitializationResult {
  workspace: {
    id: string;
    path: string;
    name: string;
  };
  initialTasks: Task[];
  workspaceRulesCreated: boolean;
}

/**
 * ProjectInitializer Service
 * 
 * Handles the initialization of new TaskPilot projects including:
 * - Workspace setup and configuration
 * - Initial task creation
 * - Workspace rules establishment
 * - Standard project structure setup
 */
export class ProjectInitializer {
  private seedManager: SeedManager;

  constructor(private db: DatabaseManager) {
    this.seedManager = new SeedManager(db);
  }

  /**
   * Initialize a new TaskPilot project
   */
  async initializeProject(input: ProjectInitializationInput): Promise<ProjectInitializationResult> {
    const { workspace_path, project_requirements, tech_stack, project_name } = input;

    try {
      // Step 1: Create or ensure workspace exists
      const workspace = await this.ensureWorkspace(workspace_path, project_name);

      // Step 2: Create initial project tasks
      const initialTasks = await this.createInitialTasks(workspace.id, project_requirements, tech_stack);

      // Step 3: Set up workspace-specific rules
      const workspaceRulesCreated = await this.createWorkspaceRules(workspace.id, tech_stack);

      // Step 4: Create initial session
      await this.createInitialSession(workspace.id);

      return {
        workspace: {
          id: workspace.id,
          path: workspace.path,
          name: workspace.name
        },
        initialTasks,
        workspaceRulesCreated
      };
    } catch (error) {
      console.error('Error initializing project:', error);
      throw error;
    }
  }

  /**
   * Ensure workspace exists, create if necessary
   */
  private async ensureWorkspace(workspacePath: string, projectName: string): Promise<any> {
    // Check if workspace already exists
    let workspace = await this.db.get<any>(
      'SELECT * FROM workspaces WHERE path = ?',
      [workspacePath]
    );

    if (!workspace) {
      // Create new workspace
      const workspaceId = uuidv4();
      
      await this.db.run(
        `INSERT INTO workspaces (id, path, name, created_at, updated_at, last_activity, is_active)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)`,
        [workspaceId, workspacePath, projectName]
      );

      workspace = await this.db.get<any>(
        'SELECT * FROM workspaces WHERE id = ?',
        [workspaceId]
      );
    } else {
      // Update existing workspace
      await this.db.run(
        `UPDATE workspaces 
         SET name = ?, is_active = 1, last_activity = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [projectName, workspace.id]
      );
      
      workspace = await this.db.get<any>(
        'SELECT * FROM workspaces WHERE id = ?',
        [workspace.id]
      );
    }

    return workspace;
  }

  /**
   * Create initial project tasks based on requirements and tech stack
   */
  private async createInitialTasks(workspaceId: string, requirements: string, techStack: string): Promise<Task[]> {
    const initialTasks: Partial<DatabaseTask>[] = [
      {
        id: this.generateTaskId(),
        title: 'Project Setup and Configuration',
        description: `Set up initial project structure and configuration for ${techStack} development environment. Includes package management with bun, build tools, and development dependencies setup.`,
        priority: 'High',
        status: 'Backlog',
        progress: 0,
        workspace_id: workspaceId,
        connected_files: JSON.stringify(['package.json', 'bun.lockb', 'tsconfig.json', '.gitignore', 'README.md']),
        notes: 'Foundation task for project initialization - use bun for package management'
      },
      {
        id: this.generateTaskId(),
        title: 'Requirements Analysis and Documentation',
        description: `Analyze and document project requirements: ${requirements}. Create detailed specifications and architectural decisions.`,
        priority: 'High',
        status: 'Backlog',
        progress: 0,
        workspace_id: workspaceId,
        connected_files: JSON.stringify(['docs/requirements.md', 'docs/architecture.md']),
        notes: 'Critical for project planning and scope definition'
      },
      {
        id: this.generateTaskId(),
        title: 'Development Environment Setup',
        description: `Configure development environment for ${techStack}. Set up linting, formatting, testing frameworks, and development workflows.`,
        priority: 'Medium',
        status: 'Backlog',
        progress: 0,
        workspace_id: workspaceId,
        connected_files: JSON.stringify(['.eslintrc.js', '.prettierrc', 'jest.config.js']),
        notes: 'Ensures consistent development practices'
      }
    ];

    // Add tech-stack specific tasks
    if (techStack.toLowerCase().includes('react')) {
      initialTasks.push({
        id: this.generateTaskId(),
        title: 'React Application Structure',
        description: 'Set up React application structure with components, routing, and state management.',
        priority: 'Medium',
        status: 'Backlog',
        progress: 0,
        workspace_id: workspaceId,
        connected_files: JSON.stringify(['src/App.tsx', 'src/components/', 'src/pages/']),
        notes: 'React-specific setup'
      });
    }

    if (techStack.toLowerCase().includes('node') || techStack.toLowerCase().includes('typescript')) {
      initialTasks.push({
        id: this.generateTaskId(),
        title: 'Node.js/TypeScript Backend Setup',
        description: 'Configure Node.js backend with TypeScript, Express/Fastify, and database connections.',
        priority: 'Medium',
        status: 'Backlog',
        progress: 0,
        workspace_id: workspaceId,
        connected_files: JSON.stringify(['src/index.ts', 'src/routes/', 'src/services/']),
        notes: 'Backend foundation'
      });
    }

    // Insert tasks into database
    const createdTasks: Task[] = [];
    for (const task of initialTasks) {
      await this.db.run(
        `INSERT INTO tasks (
          id, title, description, priority, status, progress, 
          workspace_id, connected_files, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          task.id, task.title, task.description, task.priority, task.status,
          task.progress, task.workspace_id, task.connected_files, task.notes
        ]
      );

      // Fetch the created task and convert to proper Task type
      const dbTask = await this.db.get<DatabaseTask>(
        'SELECT * FROM tasks WHERE id = ?',
        [task.id]
      );
      
      if (dbTask) {
        // Convert database task to API task format
        const apiTask: Task = {
          ...dbTask,
          connected_files: JSON.parse(dbTask.connected_files || '[]')
        };
        createdTasks.push(apiTask);
      }
    }

    return createdTasks;
  }

  /**
   * Create workspace-specific rules based on tech stack
   */
  private async createWorkspaceRules(workspaceId: string, techStack: string): Promise<boolean> {
    try {
      // Generate tech-stack specific rules
      let workspaceRulesInstructions = `# Workspace-Specific Development Rules

## Project Guidelines
- Follow ${techStack} best practices and conventions
- Maintain consistent code style and formatting
- Use descriptive naming for variables, functions, and files
- Write comprehensive tests for all business logic

## Quality Standards
- Minimum 80% test coverage for core functionality
- All code must pass linting and formatting checks
- Use TypeScript strict mode for type safety
- Document complex algorithms and business logic

## Package Management
- **Always use bun instead of npm where possible** for faster performance
- Use \`bun install\` instead of \`npm install\`
- Use \`bun run\` instead of \`npm run\` for scripts
- Use \`bun add\` instead of \`npm install <package>\`
- Only fallback to npm if bun compatibility issues arise

`;

      // Add tech-stack specific rules
      if (techStack.toLowerCase().includes('typescript')) {
        workspaceRulesInstructions += `## TypeScript Guidelines
- Use strict TypeScript configuration
- Prefer interfaces over types for object shapes
- Use proper error handling with Result/Either patterns
- Avoid 'any' type, use specific types or generics

`;
      }

      if (techStack.toLowerCase().includes('react')) {
        workspaceRulesInstructions += `## React Development
- Use functional components with hooks
- Implement proper prop types and validation
- Follow component composition patterns
- Use React Query for data fetching

`;
      }

      if (techStack.toLowerCase().includes('node')) {
        workspaceRulesInstructions += `## Node.js Backend
- Use async/await over Promise chains
- Implement proper error handling middleware
- Use environment variables for configuration
- Follow RESTful API design principles

`;
      }

      workspaceRulesInstructions += `## Development Workflow
- Create feature branches for new development
- Write descriptive commit messages
- Update documentation with code changes
- Review code before merging to main branch

*These rules evolve based on project needs and team feedback.*`;

      // Create workspace_rules feedback step
      await this.db.run(
        `INSERT INTO feedback_steps (id, name, instructions, workspace_id, metadata, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          uuidv4(),
          'workspace_rules',
          workspaceRulesInstructions,
          workspaceId,
          JSON.stringify({
            category: 'workspace_guidelines',
            tech_stack: techStack,
            auto_generated: true
          })
        ]
      );

      return true;
    } catch (error) {
      console.error('Error creating workspace rules:', error);
      return false;
    }
  }

  /**
   * Create initial session for the workspace
   */
  private async createInitialSession(workspaceId: string): Promise<void> {
    // Deactivate any existing sessions
    await this.db.run(
      'UPDATE sessions SET is_active = 0 WHERE workspace_id = ?',
      [workspaceId]
    );

    // Create new session
    const sessionId = uuidv4();
    await this.db.run(
      `INSERT INTO sessions (id, workspace_id, created_at, last_activity, is_active)
       VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)`,
      [sessionId, workspaceId]
    );
  }

  /**
   * Generate task ID with TP prefix
   */
  private generateTaskId(): string {
    // Generate a simple incremental ID (in production, this could be more sophisticated)
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 900) + 100;
    return `TP-${timestamp}${random}`;
  }

  /**
   * Check if workspace is already initialized
   */
  async isWorkspaceInitialized(workspacePath: string): Promise<boolean> {
    const workspace = await this.db.get<any>(
      'SELECT * FROM workspaces WHERE path = ?',
      [workspacePath]
    );

    if (!workspace) {
      return false;
    }

    // Check if workspace has tasks and rules
    const taskCount = await this.db.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM tasks WHERE workspace_id = ?',
      [workspace.id]
    );

    const workspaceRules = await this.db.get<any>(
      'SELECT * FROM feedback_steps WHERE name = ? AND workspace_id = ?',
      ['workspace_rules', workspace.id]
    );

    return (taskCount?.count || 0) > 0 && !!workspaceRules;
  }

  /**
   * Reinitialize existing workspace (useful for project updates)
   */
  async reinitializeWorkspace(workspacePath: string, preserveTasks: boolean = true): Promise<ProjectInitializationResult> {
    const workspace = await this.db.get<any>(
      'SELECT * FROM workspaces WHERE path = ?',
      [workspacePath]
    );

    if (!workspace) {
      throw new Error(`Workspace not found: ${workspacePath}`);
    }

    // Preserve existing tasks if requested
    let existingTasks: Task[] = [];
    if (preserveTasks) {
      const dbTasks = await this.db.all<DatabaseTask>(
        'SELECT * FROM tasks WHERE workspace_id = ?',
        [workspace.id]
      );
      
      // Convert database tasks to API format
      existingTasks = dbTasks.map(dbTask => ({
        ...dbTask,
        connected_files: JSON.parse(dbTask.connected_files || '[]')
      }));
    } else {
      // Clear existing tasks
      await this.db.run('DELETE FROM tasks WHERE workspace_id = ?', [workspace.id]);
    }

    // Update workspace rules
    const workspaceRulesCreated = await this.createWorkspaceRules(workspace.id, 'Updated Configuration');

    // Create new session
    await this.createInitialSession(workspace.id);

    return {
      workspace: {
        id: workspace.id,
        path: workspace.path,
        name: workspace.name
      },
      initialTasks: existingTasks,
      workspaceRulesCreated
    };
  }
}
