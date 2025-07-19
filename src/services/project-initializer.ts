import { v4 as uuidv4 } from 'uuid';
import type { DatabaseManager } from '../database/connection.js';
import type { DrizzleDatabaseManager } from '../database/drizzle-connection.js';
import { getGlobalDatabase } from '../database/drizzle-connection.js';
import type { Task } from '../types/index.js';
import { SeedManager } from './seed-manager.js';
import { workspaces, sessions, type Workspace, type NewWorkspace, type NewSession } from '../database/schema/global-schema.js';
import { tasks, workspaceFeedbackSteps, type Task as DrizzleTask, type NewTask, type NewWorkspaceFeedbackStep } from '../database/schema/workspace-schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';

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

  constructor(private drizzleManager: DrizzleDatabaseManager) {
    this.seedManager = new SeedManager(drizzleManager);
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
  private async ensureWorkspace(workspacePath: string, projectName: string): Promise<Workspace> {
    const globalDb = getGlobalDatabase();

    // Check if workspace already exists
    let workspace = await globalDb.getDb().select()
      .from(workspaces)
      .where(eq(workspaces.path, workspacePath))
      .get();

    if (!workspace) {
      // Create new workspace
      const workspaceId = uuidv4();
      const currentTime = new Date().toISOString();
      
      const newWorkspaceData: NewWorkspace = {
        id: workspaceId,
        path: workspacePath,
        name: projectName,
        status: 'active',
        createdAt: currentTime,
        updatedAt: currentTime,
        lastActivity: currentTime,
        taskCount: 0
      };

      await globalDb.getDb().insert(workspaces).values(newWorkspaceData);

      workspace = await globalDb.getDb().select()
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId))
        .get();
    } else {
      // Update existing workspace
      const currentTime = new Date().toISOString();
      
      await globalDb.getDb().update(workspaces)
        .set({
          name: projectName,
          status: 'active',
          lastActivity: currentTime,
          updatedAt: currentTime
        })
        .where(eq(workspaces.id, workspace.id));

      workspace = await globalDb.getDb().select()
        .from(workspaces)
        .where(eq(workspaces.id, workspace.id))
        .get();
    }

    return workspace!;
  }

  /**
   * Create initial project tasks based on requirements and tech stack
   */
  private async createInitialTasks(workspaceId: string, requirements: string, techStack: string): Promise<Task[]> {
    // CRITICAL FIX: Get workspace from global DB to get the workspace path
    const globalDb = getGlobalDatabase();
    const workspace = await globalDb.getDb().select()
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .get();

    if (!workspace) {
      throw new Error(`Workspace with ID ${workspaceId} not found`);
    }

    // Import and initialize the workspace database service for the correct workspace
    const { getWorkspaceDatabase, initializeWorkspaceDatabase } = await import('../database/drizzle-connection.js');
    const workspaceDb = await initializeWorkspaceDatabase(workspace.path);

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

    // Insert tasks into WORKSPACE database using correct Drizzle connection
    const createdTasks: Task[] = [];
    for (const task of initialTasks) {
      const taskData: NewTask = {
        id: task.id!,
        title: task.title!,
        description: task.description,
        priority: (task.priority as 'High' | 'Medium' | 'Low')?.toLowerCase() as 'high' | 'medium' | 'low' || 'medium',
        status: (task.status as 'Backlog' | 'In-Progress' | 'Blocked' | 'Review' | 'Done' | 'Dropped')?.toLowerCase().replace('-', '-') as 'backlog' | 'in-progress' | 'blocked' | 'review' | 'done' | 'dropped' || 'backlog',
        progress: task.progress || 0,
        dependencies: JSON.stringify([]),
        notes: task.notes,
        connectedFiles: JSON.stringify(task.connected_files ? JSON.parse(task.connected_files) : []),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null
      };

      await workspaceDb.getDb().insert(tasks).values(taskData);

      // Fetch the created task from workspace database
      const dbTask = await workspaceDb.getDb().select()
        .from(tasks)
        .where(eq(tasks.id, task.id!))
        .get();
      
      if (dbTask) {
        // Convert database task to API task format - mapping Drizzle types to legacy API types
        const apiTask: Task = {
          id: dbTask.id,
          title: dbTask.title,
          description: dbTask.description || undefined,
          priority: (dbTask.priority ?
            (dbTask.priority.charAt(0).toUpperCase() + dbTask.priority.slice(1)) as 'High' | 'Medium' | 'Low'
            : 'Medium'),
          status: (dbTask.status ?
            dbTask.status.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('-') as 'Backlog' | 'In-Progress' | 'Blocked' | 'Review' | 'Done' | 'Dropped'
            : 'Backlog'),
          progress: dbTask.progress || 0,
          connected_files: Array.isArray(dbTask.connectedFiles) ? dbTask.connectedFiles : [],
          notes: dbTask.notes || undefined,
          workspace_id: workspaceId, // Add workspace_id from method parameter
          created_at: dbTask.createdAt || new Date().toISOString(),
          updated_at: dbTask.updatedAt || new Date().toISOString(),
          completed_at: dbTask.completedAt || undefined
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
      // Get workspace from global DB to get the workspace path
      const globalDb = getGlobalDatabase();
      const workspace = await globalDb.getDb().select()
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId))
        .get();

      if (!workspace) {
        throw new Error(`Workspace with ID ${workspaceId} not found`);
      }

      // Use correct workspace database for feedback steps
      const { initializeWorkspaceDatabase } = await import('../database/drizzle-connection.js');
      const workspaceDb = await initializeWorkspaceDatabase(workspace.path);

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

      // Create workspace_rules feedback step using workspace Drizzle connection
      const feedbackStepData: NewWorkspaceFeedbackStep = {
        id: uuidv4(),
        name: 'workspace_rules',
        description: 'Workspace-specific development rules and guidelines',
        templateContent: workspaceRulesInstructions,
        variableSchema: JSON.stringify({
          category: 'workspace_guidelines',
          tech_stack: techStack,
          auto_generated: true
        }),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await workspaceDb.getDb().insert(workspaceFeedbackSteps).values(feedbackStepData);

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
    const globalDb = getGlobalDatabase();

    // Deactivate any existing sessions using Drizzle
    await globalDb.getDb().update(sessions)
      .set({ isActive: false })
      .where(eq(sessions.workspaceId, workspaceId));

    // Create new session using Drizzle
    const sessionId = uuidv4();
    const currentTime = new Date().toISOString();

    const sessionData: NewSession = {
      id: sessionId,
      workspaceId: workspaceId,
      createdAt: currentTime,
      lastActivity: currentTime,
      isActive: true
    };

    await globalDb.getDb().insert(sessions).values(sessionData);
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
    const globalDb = getGlobalDatabase();

    const workspace = await globalDb.getDb().select()
      .from(workspaces)
      .where(eq(workspaces.path, workspacePath))
      .get();

    if (!workspace) {
      return false;
    }

    // Check if workspace has tasks and rules using workspace database
    const { initializeWorkspaceDatabase } = await import('../database/drizzle-connection.js');
    const workspaceDb = await initializeWorkspaceDatabase(workspace.path);

    const taskCountResult = await workspaceDb.getDb().select({ count: sql<number>`COUNT(*)` })
      .from(tasks)
      .get();

    const workspaceRules = await workspaceDb.getDb().select()
      .from(workspaceFeedbackSteps)
      .where(eq(workspaceFeedbackSteps.name, 'workspace_rules'))
      .get();

    return (taskCountResult?.count || 0) > 0 && !!workspaceRules;
  }

  /**
   * Reinitialize existing workspace (useful for project updates)
   */
  async reinitializeWorkspace(workspacePath: string, preserveTasks: boolean = true): Promise<ProjectInitializationResult> {
    const globalDb = getGlobalDatabase();

    const workspace = await globalDb.getDb().select()
      .from(workspaces)
      .where(eq(workspaces.path, workspacePath))
      .get();

    if (!workspace) {
      throw new Error(`Workspace not found: ${workspacePath}`);
    }

    // Use correct workspace database for task operations
    const { initializeWorkspaceDatabase } = await import('../database/drizzle-connection.js');
    const workspaceDb = await initializeWorkspaceDatabase(workspace.path);

    // Preserve existing tasks if requested
    let existingTasks: Task[] = [];
    if (preserveTasks) {
      const dbTasks = await workspaceDb.getDb().select()
        .from(tasks)
        .all();
      
      // Convert database tasks to API format
      existingTasks = dbTasks.map((dbTask: DrizzleTask) => ({
        id: dbTask.id,
        title: dbTask.title,
        description: dbTask.description || undefined,
        priority: (dbTask.priority ?
          (dbTask.priority.charAt(0).toUpperCase() + dbTask.priority.slice(1)) as 'High' | 'Medium' | 'Low'
          : 'Medium'),
        status: (dbTask.status ?
          dbTask.status.split('-').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join('-') as 'Backlog' | 'In-Progress' | 'Blocked' | 'Review' | 'Done' | 'Dropped'
          : 'Backlog'),
        progress: dbTask.progress || 0,
        connected_files: Array.isArray(dbTask.connectedFiles) ? dbTask.connectedFiles : [],
        notes: dbTask.notes || undefined,
        workspace_id: workspace.id,
        created_at: dbTask.createdAt || new Date().toISOString(),
        updated_at: dbTask.updatedAt || new Date().toISOString(),
        completed_at: dbTask.completedAt || undefined
      }));
    } else {
      // Clear existing tasks from workspace database
      await workspaceDb.getDb().delete(tasks);
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
