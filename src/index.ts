#!/usr/bin/env node

/**
 * TaskPilot Integrated Server
 * 
 * Unified server that combines MCP server + UI + REST API
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { initializeGlobalDatabaseService } from './database/global-queries.js';
import { DatabaseService } from './services/database-service.js';
import { SeedManager } from './services/seed-manager.js';
import { PromptOrchestrator } from './services/prompt-orchestrator.js';

// Utils
import { parseCliArgs, displayHelp } from './utils/cli-parser.js';
import { ensurePortFree } from './utils/process-manager.js';

// Express server
import { ExpressServer, MCPToolHandlers } from './server/express-server.js';

import { zodToJsonSchema } from 'zod-to-json-schema';
// Tools
import { InitTool, initToolSchema } from './tools/init.js';
import { StartTool, startToolSchema } from './tools/start.js';
import { AddTool, addToolSchema } from './tools/add.js';
import { CreateTaskTool, createTaskToolSchema } from './tools/create-task.js';
import { StatusTool, statusToolSchema } from './tools/status.js';
import { UpdateTool, updateToolSchema } from './tools/update.js';
import { AuditTool, auditToolSchema } from './tools/audit.js';
import { FocusTool, focusToolSchema } from './tools/focus.js';
import { GitHubTool, githubToolSchema } from './tools/github.js';
import { RuleUpdateTool, ruleUpdateToolSchema } from './tools/rule-update.js';
import { RemoteInterfaceTool, remoteInterfaceToolSchema } from './tools/remote-interface.js';
import { UpdateResourcesTool, updateResourcesToolSchema } from './tools/update-resources.js';
import { UpdateStepsTool, updateStepsToolSchema } from './tools/update-steps.js';
import { InstanceManager } from './server/instance-manager.js';

// Global variables
let seedManager: SeedManager;
let orchestrator: PromptOrchestrator;
let initTool: InitTool;
let startTool: StartTool;
let addTool: AddTool;
let createTaskTool: CreateTaskTool;
let statusTool: StatusTool;
let updateTool: UpdateTool;
let auditTool: AuditTool;
let focusTool: FocusTool;
let githubTool: GitHubTool;
let ruleUpdateTool: RuleUpdateTool;
let remoteInterfaceTool: RemoteInterfaceTool;
let updateResourcesTool: UpdateResourcesTool;
let updateStepsTool: UpdateStepsTool;

let globalDbService: any;
let databaseService: DatabaseService;
let expressServer: ExpressServer | null = null;

async function initializeServer() {
  try {
    // Initialize global database using pure Drizzle system
    globalDbService = await initializeGlobalDatabaseService();
    const globalDrizzleManager = globalDbService.getDrizzleManager();

    // Create DatabaseService for API endpoints
    databaseService = new DatabaseService(globalDrizzleManager);


    // Initialize services with pure Drizzle operations
    seedManager = new SeedManager(globalDrizzleManager);
    orchestrator = new PromptOrchestrator(globalDrizzleManager);

    // Initialize tools with pure Drizzle database manager
    initTool = new InitTool(globalDrizzleManager);
    startTool = new StartTool(globalDrizzleManager);
    addTool = new AddTool(globalDrizzleManager);
    createTaskTool = new CreateTaskTool(globalDrizzleManager);
    statusTool = new StatusTool(globalDrizzleManager);
    updateTool = new UpdateTool(globalDrizzleManager);
    auditTool = new AuditTool(globalDrizzleManager);
    focusTool = new FocusTool(globalDrizzleManager);
    githubTool = new GitHubTool(globalDrizzleManager);
    ruleUpdateTool = new RuleUpdateTool(globalDrizzleManager);
    remoteInterfaceTool = new RemoteInterfaceTool(globalDrizzleManager);
    updateResourcesTool = new UpdateResourcesTool(globalDrizzleManager);
    updateStepsTool = new UpdateStepsTool(globalDrizzleManager);

    // Initialize global seed data using pure TypeScript approach
    await seedManager.initializeGlobalData();

  } catch (error) {
    console.error('Error initializing server:', error);
    throw error;
  }
}

function createMCPToolHandlers(): MCPToolHandlers {
  return {
    async listTools() {
      return {
        tools: [
          {
            name: "taskpilot_init",
            description: "Initialize a TaskPilot workspace with .task folder structure and configuration",
            inputSchema: zodToJsonSchema(initToolSchema),
          },
          {
            name: "taskpilot_start",
            description: "Initialize TaskPilot session for a workspace and provide comprehensive project context",
            inputSchema: zodToJsonSchema(startToolSchema),
          },
          {
            name: "taskpilot_add",
            description: "Orchestrate task creation workflow with analytical validation",
            inputSchema: zodToJsonSchema(addToolSchema),
          },
          {
            name: "taskpilot_create_task",
            description: "Create a new task after validation passes",
            inputSchema: zodToJsonSchema(createTaskToolSchema),
          },
          {
            name: "taskpilot_status",
            description: "Generate comprehensive project status report with analysis and recommendations",
            inputSchema: zodToJsonSchema(statusToolSchema),
          },
          {
            name: "taskpilot_update",
            description: "Update task properties with audit trail and validation",
            inputSchema: zodToJsonSchema(updateToolSchema),
          },
          {
            name: "taskpilot_audit",
            description: "Perform comprehensive project audit with health checking and cleanup recommendations",
            inputSchema: zodToJsonSchema(auditToolSchema),
          },
          {
            name: "taskpilot_focus",
            description: "Focus on a specific task and provide comprehensive implementation context",
            inputSchema: zodToJsonSchema(focusToolSchema),
          },
          {
            name: "taskpilot_github",
            description: "Integrate with GitHub for issue creation, PR management, and task synchronization",
            inputSchema: zodToJsonSchema(githubToolSchema),
          },
          {
            name: "taskpilot_rule_update",
            description: "Manage workspace-specific rules and guidelines",
            inputSchema: zodToJsonSchema(ruleUpdateToolSchema),
          },
          {
            name: "taskpilot_remote_interface",
            description: "Manage connections to external systems for task synchronization",
            inputSchema: zodToJsonSchema(remoteInterfaceToolSchema),
          },
          {
            name: "taskpilot_update_resources",
            description: "Update project documentation resources like project.md and design.md",
            inputSchema: zodToJsonSchema(updateResourcesToolSchema),
          },
          {
            name: "taskpilot_update_steps",
            description: "Update workspace-specific feedback steps and validation rules",
            inputSchema: zodToJsonSchema(updateStepsToolSchema),
          },
        ],
      };
    },

    async handleToolCall(name: string, args: any) {
      try {
        switch (name) {
          case 'taskpilot_init': {
            const input = initToolSchema.parse(args);
            const result = await initTool.execute(input);
            return {
              content: result.content,
              isError: result.isError
            };
          }

          case 'taskpilot_start': {
            const input = startToolSchema.parse(args);
            const result = await startTool.execute(input);
            return {
              content: result.content,
              isError: result.isError
            };
          }

          case 'taskpilot_add': {
            const input = addToolSchema.parse(args);
            const result = await addTool.execute(input);
            return {
              content: result.content,
              isError: result.isError
            };
          }

          case 'taskpilot_create_task': {
            const input = createTaskToolSchema.parse(args);
            const result = await createTaskTool.execute(input);
            return {
              content: result.content,
              isError: result.isError
            };
          }

          case 'taskpilot_status': {
            const input = statusToolSchema.parse(args);
            const result = await statusTool.execute(input);
            return {
              content: result.content,
              isError: result.isError
            };
          }

          case 'taskpilot_update': {
            const input = updateToolSchema.parse(args);
            const result = await updateTool.execute(input);
            return {
              content: result.content,
              isError: result.isError
            };
          }

          case 'taskpilot_audit': {
            const input = auditToolSchema.parse(args);
            const result = await auditTool.execute(input);
            return {
              content: result.content,
              isError: result.isError
            };
          }

          case 'taskpilot_focus': {
            const input = focusToolSchema.parse(args);
            const result = await focusTool.execute(input);
            return {
              content: result.content,
              isError: result.isError
            };
          }

          case 'taskpilot_github': {
            const input = githubToolSchema.parse(args);
            const result = await githubTool.execute(input);
            return {
              content: result.content,
              isError: result.isError
            };
          }

          case 'taskpilot_rule_update': {
            const input = ruleUpdateToolSchema.parse(args);
            const result = await ruleUpdateTool.execute(input);
            return {
              content: result.content,
              isError: result.isError
            };
          }

          case 'taskpilot_remote_interface': {
            const input = remoteInterfaceToolSchema.parse(args);
            const result = await remoteInterfaceTool.execute(input);
            return {
              content: result.content,
              isError: result.isError
            };
          }

          case 'taskpilot_update_resources': {
            const input = updateResourcesToolSchema.parse(args);
            const result = await updateResourcesTool.execute(input);
            return {
              content: result.content,
              isError: result.isError
            };
          }

          case 'taskpilot_update_steps': {
            const input = updateStepsToolSchema.parse(args);
            const result = await updateStepsTool.execute(input);
            return {
              content: result.content,
              isError: result.isError
            };
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Error: ${errorMessage}` }],
          isError: true
        };
      }
    }
  };
}

async function startStdioMode(cliOptions: any) {
  // POTENTIAL ISSUE: This console.log goes to stdout, violating MCP protocol
  if (cliOptions.mode !== 'stdio') {
    // Allow error logs only in test for debugging
    console.error('[DEBUG] Starting TaskPilot MCP server in STDIO mode (logging to stderr)');
  }

  const server = new Server(
    {
      name: "taskpilot",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  const toolHandlers = createMCPToolHandlers();

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, toolHandlers.listTools);

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    // Avoid debug logs in stdio mode
    if (cliOptions.mode !== 'stdio') {
      console.debug(`[DEBUG] MCP tool call received: ${request.params.name}`);
    }
    const { name, arguments: args } = request.params;
    return await toolHandlers.handleToolCall(name, args);
  });

  // Start the server
  const transport = new StdioServerTransport();
  if (cliOptions.mode !== 'stdio') {
    console.error('[DEBUG] Connecting to STDIO transport...');
  }
  await server.connect(transport);

  // POTENTIAL ISSUE: This console.log goes to stdout, violating MCP protocol
  if (cliOptions.mode !== 'stdio') {
    console.error('[DEBUG] TaskPilot MCP server running on stdio (logging to stderr)');
  }
}

async function startHttpMode(port: number) {
  console.log(`Starting TaskPilot integrated server on port ${port}`);

  // Ensure port is free (killing any processes using it)
  const portFree = await ensurePortFree(port);
  if (!portFree) {
    throw new Error(`Unable to free port ${port} for TaskPilot server`);
  }

  // Create Express server
  expressServer = new ExpressServer({ port, dev: process.env.NODE_ENV !== 'production' });

  // Add /__version and /__shutdown endpoints for multi-instance/proxy logic
  expressServer.registerCustomEndpoints((app) => {
    app.get('/__version', (req, res) => {
      res.json({ version: require('./server/instance-manager.js').InstanceManager.VERSION });
    });
    app.post('/__shutdown', (req, res) => {
      res.status(200).json({ ok: true });
      setTimeout(() => process.exit(0), 100);
    });
  });
  // Setup MCP endpoint with SSE
  const toolHandlers = createMCPToolHandlers();
  expressServer.setupMCPEndpoint(toolHandlers);

  // Setup REST API endpoints
  expressServer.setupAPIEndpoints(databaseService);

  // Setup health check
  expressServer.setupHealthCheck();

  // Setup graceful shutdown handling with Express server cleanup
  setupGracefulShutdown();

  // Start the server
  await expressServer.start();
}

function setupGracefulShutdown(): void {
  const shutdownHandler = async (signal: string) => {
    console.log(`\n${signal} received. Shutting down TaskPilot Integrated Server gracefully...`);

    try {
      if (expressServer) {
        await expressServer.stop();
      }
    } catch (error) {
      console.error('Error during shutdown:', error);
    }

    console.log('TaskPilot Integrated Server shutdown complete.');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdownHandler('SIGINT'));
  process.on('SIGTERM', () => shutdownHandler('SIGTERM'));
  process.on('SIGUSR1', () => shutdownHandler('SIGUSR1'));
  process.on('SIGUSR2', () => shutdownHandler('SIGUSR2'));

  // Handle uncaught exceptions gracefully
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    console.log('Shutting down due to uncaught exception...');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    console.log('Shutting down due to unhandled rejection...');
    process.exit(1);
  });
}

async function main() {
  let cliOptions: any;
  try {
    // Parse CLI arguments
    cliOptions = parseCliArgs();

    // DIAGNOSTIC: Log parsed CLI options to stderr (not stdout to avoid MCP protocol pollution)
    if (cliOptions.mode !== 'stdio') {
      console.error(`[DEBUG] Parsed CLI options:`, JSON.stringify(cliOptions, null, 2));
      console.error(`[DEBUG] Process argv:`, process.argv);
    }

    if (cliOptions.help) {
      displayHelp();
      process.exit(0);
    }

    // DIAGNOSTIC: Log mode detection
    if (cliOptions.mode !== 'stdio') {
      console.error(`[DEBUG] Starting in mode: ${cliOptions.mode}`);
    }

    // Initialize server
    await initializeServer();

    // Start in appropriate mode

    // Multi-instance/proxy logic
    const instanceManager = new InstanceManager();
    let isMain = await instanceManager.tryBecomeMain();
    if (!isMain) {
      // Read lock and check PID liveness
      const lock = await instanceManager.readLock();
      if (!lock || !InstanceManager.isPidAlive(lock.pid)) {
        // Stale lock, remove and try to become main again
        await instanceManager.removeLock();
        isMain = await instanceManager.tryBecomeMain();
      }
    }

    if (!isMain) {
      // Check version of running main instance
      const mainVersion = await instanceManager.fetchMainVersion();
      if (mainVersion === InstanceManager.VERSION) {
        // Proxy mode: forward all requests to main instance
        const proxyServer = await instanceManager.startProxy();
        const port = instanceManager.proxyPort;
        console.log(`[PROXY MODE] Main instance running on port 8989. Proxying on port ${port}.`);
        // Keep process alive
        await new Promise(() => { });
      } else {
        // Version mismatch: request shutdown, wait, then become main
        const shutdownOk = await instanceManager.requestMainShutdown();
        if (shutdownOk) {
          await instanceManager.waitForPort(10000);
          await instanceManager.removeLock();
          isMain = await instanceManager.tryBecomeMain();
          if (!isMain) {
            throw new Error("Failed to take over as main instance after shutdown.");
          }
        } else {
          throw new Error("Failed to shutdown old main instance (version mismatch).");
        }
      }
    }

    // Main instance: proceed with normal startup
    // we only allow stdio mode for main instance
    // underlying reason is: we are using sqlite3 db which may cause issues for multi writer
    if (isMain) {
      if (cliOptions.mode === 'stdio') {
        // Avoid debug logs in stdio mode
        await startStdioMode(cliOptions);
      }
      await startHttpMode(cliOptions.port);
    }

  } catch (error) {
    // Only log error if cliOptions is defined and not stdio mode
    if (cliOptions && cliOptions.mode !== 'stdio') {
      console.error('Error starting server:', error);
    }
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    // Only log error if not in stdio mode
    let cliOptions: any;
    try {
      cliOptions = parseCliArgs();
    } catch {
      cliOptions = {};
    }
    if (!cliOptions.mode || cliOptions.mode !== 'stdio') {
      console.error(err);
    }
  });
}
