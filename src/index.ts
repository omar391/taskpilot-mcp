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
import { SeedManager } from './services/seed-manager.js';
import { PromptOrchestrator } from './services/prompt-orchestrator.js';

// Utils
import { parseCliArgs, displayHelp } from './utils/cli-parser.js';
import { ensurePortAvailable } from './utils/port-manager.js';
import { killExistingTaskPilotProcesses, registerSignalHandlers } from './utils/process-manager.js';

// Express server
import { ExpressServer, MCPToolHandlers } from './server/express-server.js';

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

let globalDbService: any;
let expressServer: ExpressServer | null = null;

async function initializeServer() {
  try {
    // Initialize global database using pure Drizzle system
    globalDbService = await initializeGlobalDatabaseService();
    const globalDrizzleManager = globalDbService.getDrizzleManager();
    
    console.log('Pure TypeScript database system initialized successfully');

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
    
    // Initialize global seed data using pure TypeScript approach
    await seedManager.initializeGlobalData();
    console.log('Global seed data loaded successfully');
    
    console.log('TaskPilot MCP server initialized successfully (Pure TypeScript/Drizzle ORM)');
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
            inputSchema: initToolSchema,
          },
          {
            name: "taskpilot_start",
            description: "Initialize TaskPilot session for a workspace and provide comprehensive project context",
            inputSchema: startToolSchema,
          },
          {
            name: "taskpilot_add",
            description: "Orchestrate task creation workflow with analytical validation",
            inputSchema: addToolSchema,
          },
          {
            name: "taskpilot_create_task",
            description: "Create a new task after validation passes",
            inputSchema: createTaskToolSchema,
          },
          {
            name: "taskpilot_status",
            description: "Generate comprehensive project status report with analysis and recommendations",
            inputSchema: statusToolSchema,
          },
          {
            name: "taskpilot_update",
            description: "Update task properties with audit trail and validation",
            inputSchema: updateToolSchema,
          },
          {
            name: "taskpilot_audit",
            description: "Perform comprehensive project audit with health checking and cleanup recommendations",
            inputSchema: auditToolSchema,
          },
          {
            name: "taskpilot_focus",
            description: "Focus on a specific task and provide comprehensive implementation context",
            inputSchema: focusToolSchema,
          },
          {
            name: "taskpilot_github",
            description: "Integrate with GitHub for issue creation, PR management, and task synchronization",
            inputSchema: githubToolSchema,
          },
          {
            name: "taskpilot_rule_update",
            description: "Manage workspace-specific rules and guidelines",
            inputSchema: ruleUpdateToolSchema,
          },
          {
            name: "taskpilot_remote_interface",
            description: "Manage connections to external systems for task synchronization",
            inputSchema: remoteInterfaceToolSchema,
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

async function startStdioMode() {
  console.log('Starting TaskPilot MCP server in STDIO mode');
  
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
    const { name, arguments: args } = request.params;
    return await toolHandlers.handleToolCall(name, args);
  });

  // Start the server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log('TaskPilot MCP server running on stdio');
}

async function startHttpMode(port: number) {
  console.log(`Starting TaskPilot integrated server on port ${port}`);
  
  // Kill any existing TaskPilot processes
  await killExistingTaskPilotProcesses();
  
  // Ensure port is available
  await ensurePortAvailable(port);
  
  // Create Express server
  expressServer = new ExpressServer({ port, dev: process.env.NODE_ENV !== 'production' });
  
  // Setup MCP endpoint with SSE
  const toolHandlers = createMCPToolHandlers();
  expressServer.setupMCPEndpoint(toolHandlers);
  
  // Setup REST API endpoints
  expressServer.setupAPIEndpoints(globalDbService);
  
  // Setup static UI serving
  expressServer.setupStaticUI();
  
  // Setup health check
  expressServer.setupHealthCheck();
  
  // Setup graceful shutdown handling
  registerSignalHandlers('TaskPilot Integrated Server');
  
  // Start the server
  await expressServer.start();
}

async function main() {
  try {
    // Parse CLI arguments
    const cliOptions = parseCliArgs();
    
    if (cliOptions.help) {
      displayHelp();
      process.exit(0);
    }
    
    // Initialize server
    await initializeServer();
    
    // Start in appropriate mode
    if (cliOptions.mode === 'stdio') {
      await startStdioMode();
    } else {
      await startHttpMode(cliOptions.port);
    }
    
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

// Handle shutdown gracefully
process.on('SIGINT', async () => {
  console.log('\nShutting down TaskPilot server...');
  if (expressServer) {
    await expressServer.stop();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down TaskPilot server...');
  if (expressServer) {
    await expressServer.stop();
  }
  process.exit(0);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
