#!/usr/bin/env node

/**
 * TaskPilot MCP Server
 * 
 * A Model Context Protocol server that implements a prompt orchestration system
 * based on SWE-agent capabilities. Returns structured prompt instructions to LLMs
 * rather than executing business logic directly, enabling dynamic workflow
 * configuration through tool flows and feedback steps.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { initializeGlobalDatabase, getGlobalDatabase, initializeWorkspaceDatabase, getWorkspaceDatabase } from './database/connection.js';
import { DatabaseService } from './services/database-service.js';
import { SeedManager } from './services/seed-manager.js';
import { PromptOrchestrator } from './services/prompt-orchestrator.js';

// Tools
import { StartTool, startToolSchema } from './tools/start.js';
import { InitTool, initToolSchema } from './tools/init.js';
import { AddTool, addToolSchema } from './tools/add.js';
import { CreateTaskTool, createTaskToolSchema } from './tools/create-task.js';
import { StatusTool, statusToolSchema } from './tools/status.js';
import { UpdateTool, updateToolSchema } from './tools/update.js';
import { FocusTool, focusToolSchema } from './tools/focus.js';
import { AuditTool, auditToolSchema } from './tools/audit.js';
import { GitHubTool, githubToolSchema } from './tools/github.js';
import { RuleUpdateTool, ruleUpdateToolSchema } from './tools/rule-update.js';
import { RemoteInterfaceTool, remoteInterfaceToolSchema } from './tools/remote-interface.js';

/**
 * Create an MCP server with TaskPilot capabilities
 */
const server = new Server(
  {
    name: "taskpilot",
    version: "0.1.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

// Global instances
let databaseService: DatabaseService;
let seedManager: SeedManager;
let orchestrator: PromptOrchestrator;
let startTool: StartTool;
let initTool: InitTool;
let addTool: AddTool;
let createTaskTool: CreateTaskTool;
let statusTool: StatusTool;
let updateTool: UpdateTool;
let focusTool: FocusTool;
let auditTool: AuditTool;
let githubTool: GitHubTool;
let ruleUpdateTool: RuleUpdateTool;
let remoteInterfaceTool: RemoteInterfaceTool;

/**
 * Initialize server components
 */
async function initializeServer() {
  try {
    // Initialize global database and create database service
    const globalDb = await initializeGlobalDatabase();
    databaseService = new DatabaseService(globalDb);
    console.log('Global database initialized successfully');

    // Initialize services with database service
    seedManager = new SeedManager(globalDb); // SeedManager only needs global DB
    orchestrator = new PromptOrchestrator(globalDb); // PromptOrchestrator only needs global DB
    
    // Initialize global seed data
    await seedManager.initializeGlobalData();
    console.log('Global seed data loaded successfully');

    // Initialize tools with database service (they'll need to be updated to use it)
    // For now, pass globalDb to maintain compatibility
    startTool = new StartTool(globalDb);
    initTool = new InitTool(globalDb);
    addTool = new AddTool(globalDb);
    createTaskTool = new CreateTaskTool(globalDb);
    statusTool = new StatusTool(globalDb);
    updateTool = new UpdateTool(globalDb);
    focusTool = new FocusTool(globalDb);
    auditTool = new AuditTool(globalDb);
    githubTool = new GitHubTool(globalDb);
    ruleUpdateTool = new RuleUpdateTool(globalDb);
    remoteInterfaceTool = new RemoteInterfaceTool(globalDb);
    
    console.log('TaskPilot MCP server initialized successfully');
  } catch (error) {
    console.error('Error initializing server:', error);
    process.exit(1);
  }
}

/**
 * Handler for listing available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      StartTool.getToolDefinition(),
      InitTool.getToolDefinition(),
      AddTool.getToolDefinition(),
      CreateTaskTool.getToolDefinition(),
      StatusTool.getToolDefinition(),
      UpdateTool.getToolDefinition(),
      FocusTool.getToolDefinition(),
      AuditTool.getToolDefinition(),
      GitHubTool.getToolDefinition(),
      RuleUpdateTool.getToolDefinition(),
      RemoteInterfaceTool.getToolDefinition(),
      // Additional tools will be added here as they are implemented
    ]
  };
});

/**
 * Handler for tool execution
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'taskpilot_start': {
        const input = startToolSchema.parse(args);
        const result = await startTool.execute(input);
        return {
          content: result.content,
          isError: result.isError
        };
      }

      case 'taskpilot_init': {
        const input = initToolSchema.parse(args);
        const result = await initTool.execute(input);
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

      case 'taskpilot_focus': {
        const input = focusToolSchema.parse(args);
        const result = await focusTool.execute(input);
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
    console.error(`Error executing tool ${name}:`, error);
    return {
      content: [{
        type: "text",
        text: `Error executing ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`
      }],
      isError: true
    };
  }
});

/**
 * Handler for listing available resources
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "taskpilot://workspaces",
        mimeType: "application/json",
        name: "Active Workspaces",
        description: "List of all TaskPilot workspaces"
      },
      {
        uri: "taskpilot://global-flows",
        mimeType: "application/json", 
        name: "Global Tool Flows",
        description: "Global tool flow configurations"
      },
      {
        uri: "taskpilot://global-feedback",
        mimeType: "application/json",
        name: "Global Feedback Steps", 
        description: "Global feedback step instructions"
      }
    ]
  };
});

/**
 * Handler for reading resource contents
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  
  // Parse taskpilot:// URIs manually since URL constructor doesn't handle custom schemes well
  let path: string;
  if (uri.startsWith('taskpilot://')) {
    path = '/' + uri.substring(12); // Remove 'taskpilot://' prefix
  } else {
    const url = new URL(uri);
    path = url.pathname;
  }

  try {
    switch (path) {
      case '/workspaces': {
        const workspaces = await databaseService.globalAll(
          'SELECT * FROM workspaces ORDER BY last_activity DESC'
        );
        return {
          contents: [{
            uri: request.params.uri,
            mimeType: "application/json",
            text: JSON.stringify(workspaces, null, 2)
          }]
        };
      }

      case '/global-flows': {
        const flows = await databaseService.globalAll(`
          SELECT tf.*, 
                 json_group_array(
                   json_object(
                     'id', tfs.id,
                     'step_order', tfs.step_order,
                     'system_tool_fn', tfs.system_tool_fn,
                     'feedback_step', tfs.feedback_step,
                     'next_tool', tfs.next_tool
                   )
                 ) as flow_steps
          FROM tool_flows tf
          LEFT JOIN tool_flow_steps tfs ON tf.id = tfs.tool_flow_id
          WHERE tf.workspace_id IS NULL
          GROUP BY tf.id
          ORDER BY tf.tool_name
        `);
        
        return {
          contents: [{
            uri: request.params.uri,
            mimeType: "application/json",
            text: JSON.stringify(flows, null, 2)
          }]
        };
      }

      case '/global-feedback': {
        const feedbackSteps = await databaseService.globalAll(
          'SELECT * FROM feedback_steps WHERE workspace_id IS NULL ORDER BY name'
        );
        return {
          contents: [{
            uri: request.params.uri,
            mimeType: "application/json",
            text: JSON.stringify(feedbackSteps, null, 2)
          }]
        };
      }

      default:
        throw new Error(`Unknown resource path: ${path}`);
    }
  } catch (error) {
    console.error(`Error reading resource ${path}:`, error);
    throw new Error(`Error reading resource: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

/**
 * Start the server using stdio transport
 */
async function main() {
  try {
    // Initialize server components
    await initializeServer();

    // Start MCP server
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.error('TaskPilot MCP server running on stdio');
  } catch (error) {
    console.error("Server startup error:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.error('Shutting down TaskPilot MCP server...');
  if (databaseService) {
    await databaseService.close();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('Shutting down TaskPilot MCP server...');
  if (databaseService) {
    await databaseService.close();
  }
  process.exit(0);
});

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
